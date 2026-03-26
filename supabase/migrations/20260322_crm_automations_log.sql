-- ============================================================
-- CRM Automations Log
-- Stores every automation trigger evaluation result.
-- Sending is NOT done here — this is a log/queue only.
-- ============================================================

create table if not exists crm_automations_log (
  id              uuid        primary key default gen_random_uuid(),

  -- which automation flow fired
  flow            text        not null,
  -- at_risk | new_customer | vip | low_sales

  -- customer targeted (null for low_sales / broadcast-style flows)
  customer_phone  text        references crm_clientes(phone) on delete set null,
  customer_name   text,

  -- the message that would be sent
  message_text    text        not null,

  -- current status
  status          text        not null default 'pending',
  -- pending | sent | skipped | failed

  -- why it was skipped (e.g. "no_consent", "recently_triggered", "already_sent_today")
  skip_reason     text,

  -- metadata used when the rule fired
  trigger_data    jsonb,

  -- timestamps
  triggered_at    timestamptz not null default now(),
  sent_at         timestamptz,
  created_at      timestamptz not null default now()
);

-- Indexes for common queries
create index if not exists crm_automations_log_flow_idx
  on crm_automations_log (flow);

create index if not exists crm_automations_log_phone_idx
  on crm_automations_log (customer_phone);

create index if not exists crm_automations_log_status_idx
  on crm_automations_log (status);

create index if not exists crm_automations_log_triggered_at_idx
  on crm_automations_log (triggered_at desc);

-- Prevent firing the same flow for the same customer more than once per day
create unique index if not exists crm_automations_log_dedup_idx
  on crm_automations_log (flow, customer_phone, (triggered_at::date))
  where customer_phone is not null;
