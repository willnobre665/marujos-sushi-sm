-- ============================================================================
-- Marujos Sushi CRM — Supabase Schema
-- ============================================================================
-- Run this in the Supabase SQL Editor before activating supabaseCrmAdapter.
-- All timestamps are stored in UTC (timestamptz).
-- Phone numbers are stored as TEXT (digits only, with country code: "5511987654321").
-- Monetary values are stored in centavos (INTEGER) — no floating point.
-- ============================================================================


-- ── crm_clientes ─────────────────────────────────────────────────────────────
-- One row per customer. Primary key: phone.
-- Consent columns store the LATEST state for fast reads.
-- Full consent history → crm_consent_logs.

CREATE TABLE IF NOT EXISTS crm_clientes (
  phone                         TEXT        PRIMARY KEY,    -- "5511987654321"
  name                          TEXT        NOT NULL,
  email                         TEXT,
  birthday                      TEXT,                       -- "DD/MM/AAAA" — optional
  channel                       TEXT        NOT NULL DEFAULT 'whatsapp',  -- 'whatsapp'|'email'|'sms'

  -- Latest consent state (denormalized for fast reads)
  consent_order_updates         BOOLEAN,
  consent_order_updates_at      TIMESTAMPTZ,
  consent_order_updates_source  TEXT,

  consent_relational            BOOLEAN,
  consent_relational_at         TIMESTAMPTZ,
  consent_relational_source     TEXT,

  consent_promotional           BOOLEAN,
  consent_promotional_at        TIMESTAMPTZ,
  consent_promotional_source    TEXT,

  -- Segmentation
  segment_tags                  TEXT[]      NOT NULL DEFAULT '{}',

  -- Lifetime aggregates
  order_count                   INTEGER     NOT NULL DEFAULT 0,
  total_spent_centavos          INTEGER     NOT NULL DEFAULT 0,

  -- Timestamps
  first_seen_at                 TIMESTAMPTZ NOT NULL,
  last_seen_at                  TIMESTAMPTZ NOT NULL,
  last_order_at                 TIMESTAMPTZ,

  -- Row audit
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Update updated_at automatically
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER crm_clientes_updated_at
BEFORE UPDATE ON crm_clientes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_crm_clientes_segment_tags ON crm_clientes USING GIN (segment_tags);
CREATE INDEX IF NOT EXISTS idx_crm_clientes_last_order_at ON crm_clientes (last_order_at);
CREATE INDEX IF NOT EXISTS idx_crm_clientes_order_count ON crm_clientes (order_count);


-- ── crm_consent_logs ─────────────────────────────────────────────────────────
-- Append-only audit trail of every consent change.
-- Never update or delete rows — insert only.
-- crm_clientes stores the latest state; this table stores the full history.

CREATE TABLE IF NOT EXISTS crm_consent_logs (
  id             BIGSERIAL   PRIMARY KEY,
  customer_phone TEXT        NOT NULL REFERENCES crm_clientes (phone) ON DELETE CASCADE,
  category       TEXT        NOT NULL,  -- 'transactional'|'relational'|'promotional'
  granted        BOOLEAN     NOT NULL,
  granted_at     TIMESTAMPTZ NOT NULL,
  source         TEXT        NOT NULL,  -- 'checkout_form'|'whatsapp_reply'|'in_person'|'unsubscribe_link'
  event_id       UUID,                  -- FK → crm_events_raw.id — traceability
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_consent_logs_phone ON crm_consent_logs (customer_phone, category, granted_at DESC);


-- ── crm_pedidos ──────────────────────────────────────────────────────────────
-- One row per CRM order. Shares id with the Saipos/mock Pedido.id.
-- items is stored as JSONB (snapshot at order time — never joins product table).

CREATE TABLE IF NOT EXISTS crm_pedidos (
  id             UUID        PRIMARY KEY,   -- shared with Pedido.id
  customer_phone TEXT        NOT NULL REFERENCES crm_clientes (phone) ON DELETE RESTRICT,
  customer_name  TEXT        NOT NULL,      -- snapshot
  context        TEXT        NOT NULL,      -- 'dine_in'|'pickup'|'delivery'
  table_id       TEXT,
  source         TEXT        NOT NULL,      -- 'qr'|'instagram'|'google'|'whatsapp'|'direct'
  items          JSONB       NOT NULL,      -- CrmItemPedido[] — full snapshot
  subtotal       INTEGER     NOT NULL,      -- centavos
  discount       INTEGER     NOT NULL DEFAULT 0,
  service_fee    INTEGER     NOT NULL DEFAULT 0,
  total          INTEGER     NOT NULL,      -- centavos
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pending',  -- 'pending'|'confirmed'|'cancelled'
  attribution    JSONB                                    -- { firstTouch, lastTouch } — null when no UTM present
);

CREATE INDEX IF NOT EXISTS idx_crm_pedidos_customer_phone ON crm_pedidos (customer_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_pedidos_created_at ON crm_pedidos (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_pedidos_status ON crm_pedidos (status);


-- ── crm_events_raw ───────────────────────────────────────────────────────────
-- Append-only log of every received CRM event, exactly as sent by the frontend.
-- Enables event replay, debugging, and future analytics pipelines.
-- event_name is extracted from payload for fast filtering without JSON parsing.

CREATE TABLE IF NOT EXISTS crm_events_raw (
  id          UUID        PRIMARY KEY,   -- from frontend: UUID v4
  ts          TIMESTAMPTZ NOT NULL,      -- event timestamp (client clock)
  session_id  TEXT        NOT NULL,      -- browser session UUID (not tied to identity)
  event_name  TEXT        NOT NULL,      -- e.g. 'order_completed', 'add_to_cart'
  payload     JSONB       NOT NULL,      -- full CrmEventPayload
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_events_raw_event_name ON crm_events_raw (event_name, ts DESC);
CREATE INDEX IF NOT EXISTS idx_crm_events_raw_session_id ON crm_events_raw (session_id);
CREATE INDEX IF NOT EXISTS idx_crm_events_raw_ts ON crm_events_raw (ts DESC);


-- ── crm_mensagens ────────────────────────────────────────────────────────────
-- Append-only message audit log. Every outbound message attempt is recorded here,
-- regardless of success or failure. Required for consent enforcement and frequency caps.

CREATE TABLE IF NOT EXISTS crm_mensagens (
  id                   UUID        PRIMARY KEY,
  customer_phone       TEXT        NOT NULL REFERENCES crm_clientes (phone) ON DELETE RESTRICT,
  channel              TEXT        NOT NULL,  -- 'whatsapp'|'email'|'sms'
  category             TEXT        NOT NULL,  -- 'transactional'|'relational'|'promotional'
  template_id          TEXT        NOT NULL,
  order_id             UUID        REFERENCES crm_pedidos (id) ON DELETE SET NULL,
  campaign_id          UUID,
  status               TEXT        NOT NULL,  -- 'queued'|'sent'|'delivered'|'read'|'failed'|'blocked'
  blocked_reason       TEXT,
  sent_at              TIMESTAMPTZ,
  status_updated_at    TIMESTAMPTZ NOT NULL,
  provider_message_id  TEXT        UNIQUE     -- dedup webhook retries
);

CREATE INDEX IF NOT EXISTS idx_crm_mensagens_phone_category ON crm_mensagens (customer_phone, category, status_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_mensagens_order_id ON crm_mensagens (order_id);


-- ── crm_campanhas ────────────────────────────────────────────────────────────
-- Campaign definitions. Target segments, not raw phone lists.
-- No message is dispatched without status = 'approved'.

CREATE TABLE IF NOT EXISTS crm_campanhas (
  id                 UUID        PRIMARY KEY,
  name               TEXT        NOT NULL,
  category           TEXT        NOT NULL,      -- 'relational'|'promotional' (never 'transactional')
  template_id        TEXT        NOT NULL,
  target_segment     TEXT[]      NOT NULL,       -- SegmentTag[]
  consent_required   TEXT        NOT NULL,       -- 'relational'|'promotional'
  status             TEXT        NOT NULL DEFAULT 'draft',
  approved_by        TEXT,
  approved_at        TIMESTAMPTZ,
  scheduled_at       TIMESTAMPTZ,
  batch_size         INTEGER     NOT NULL DEFAULT 50,
  batch_interval_ms  INTEGER     NOT NULL DEFAULT 60000,
  created_at         TIMESTAMPTZ NOT NULL,
  total_targeted     INTEGER,
  total_sent         INTEGER,
  total_delivered    INTEGER
);


-- ── Row Level Security ────────────────────────────────────────────────────────
-- RLS is disabled for now because all access goes through the service role key
-- in API routes. Enable and configure policies before opening a manager panel
-- or any client-side Supabase access.

ALTER TABLE crm_clientes     DISABLE ROW LEVEL SECURITY;
ALTER TABLE crm_consent_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE crm_pedidos      DISABLE ROW LEVEL SECURITY;
ALTER TABLE crm_events_raw   DISABLE ROW LEVEL SECURITY;
ALTER TABLE crm_mensagens    DISABLE ROW LEVEL SECURITY;
ALTER TABLE crm_campanhas    DISABLE ROW LEVEL SECURITY;
