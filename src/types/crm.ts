/**
 * CRM types — isolated from menu/order types on purpose.
 *
 * Designed for a WhatsApp-safe, consent-first, segmentation-oriented CRM.
 * Core principle: we collect data to serve customers better, never to blast them.
 *
 * Architecture invariants:
 * - Every communication decision requires explicit consent on record.
 * - Message categories are structurally separated — transactional, relational, promotional.
 * - No mass-send primitives exist at this layer. Segmentation is the unit of sending.
 * - The communication provider is fully abstracted. Swapping from unofficial tooling
 *   to an official WhatsApp Business API provider requires no changes here.
 */

// ─── Campaign attribution ─────────────────────────────────────────────────────

/**
 * Attribution snapshot captured at landing time.
 * Both first-touch and last-touch are recorded independently.
 * Stored as JSONB in crm_pedidos so no schema migration is needed to add fields.
 */
export interface AttributionSnapshot {
  utm_source?:   string
  utm_medium?:   string
  utm_campaign?: string
  utm_content?:  string
  utm_term?:     string
  fbclid?:       string
  gclid?:        string
  referrer?:     string
  landing_path?: string
  captured_at:   string   // ISO 8601
}

export interface OrderAttribution {
  schema_version: 1
  // Flat best-value fields (lastTouch preferred, firstTouch as fallback, null if absent)
  utm_source:   string | null
  utm_medium:   string | null
  utm_campaign: string | null
  utm_content:  string | null
  utm_term:     string | null
  fbclid:       string | null
  gclid:        string | null
  referrer:     string | null
  landing_path: string | null
  // Full touch records for multi-touch analysis
  firstTouch: AttributionSnapshot | null
  lastTouch:  AttributionSnapshot | null
}

// ─── Session / attribution ─────────────────────────────────────────────────────

/** How the customer arrived at this session. Sourced from ?utm_source=. */
export type EntrySource =
  | 'qr'        // QR code on table or printed material
  | 'instagram' // Instagram bio / story link
  | 'google'    // Google search or Maps
  | 'whatsapp'  // WhatsApp shared link (NOT automation — human share)
  | 'direct'    // Direct URL or unknown

/** Consumption context for this visit. */
export type OrderContext =
  | 'dine_in'   // Eating at the restaurant (default when QR code present)
  | 'pickup'    // Counter pickup
  | 'delivery'  // Future — not active in MVP

/** Everything known about the current visit before an order is placed. */
export interface CrmSession {
  entrySource: EntrySource
  orderContext: OrderContext
  tableId?: string  // "5", "Varanda", etc. — from ?mesa= or manual selection
}

// ─── Consent ──────────────────────────────────────────────────────────────────
//
// Consent is first-class. Every field is independently timestamped and sourced.
// This structure is designed to satisfy LGPD (Lei Geral de Proteção de Dados)
// and to be compatible with WhatsApp Business API requirements, which require
// explicit opt-in for each category of message.

/**
 * Where the customer gave (or withdrew) consent.
 * Traceability — we must know which UI surface or flow generated each consent record.
 */
export type ConsentSource =
  | 'checkout_form'      // Checkbox on the checkout page
  | 'whatsapp_reply'     // Customer replied "SIM" to a WhatsApp opt-in message
  | 'in_person'          // Staff-recorded consent (future: manager panel)
  | 'unsubscribe_link'   // Customer clicked unsubscribe in a message

/**
 * A single timestamped consent record for one category.
 * Append-only: never delete old records. Add a new one when consent changes.
 */
export interface ConsentRecord {
  granted: boolean          // true = opted in, false = opted out / withdrawn
  grantedAt: string         // ISO 8601
  source: ConsentSource
  ip?: string               // optional, for legal audit trail
}

/**
 * Communication preferences — one ConsentRecord per category.
 * All optional: absence means consent was never collected (not the same as refusal).
 *
 * Categories:
 * - orderUpdates: status changes for placed orders (transactional)
 * - relational: post-purchase follow-up, birthday message, feedback requests
 * - promotional: campaigns, offers, reactivation messages
 *
 * WhatsApp compliance note:
 * - orderUpdates may be sent via utility templates (lower barrier under WABA rules)
 * - relational and promotional require marketing template opt-in
 * - Never send promotional content to a customer who only consented to orderUpdates
 */
export interface ComunicacaoPreferencias {
  channel: 'whatsapp' | 'email' | 'sms'  // preferred contact channel
  orderUpdates?: ConsentRecord            // transactional — e.g. "Seu pedido está pronto"
  relational?: ConsentRecord              // relational — e.g. birthday, NPS, feedback
  promotional?: ConsentRecord             // promotional — e.g. "Promoção de fim de semana"
}

// ─── Customer identity ────────────────────────────────────────────────────────

/**
 * Persistent customer profile.
 * Phone is the primary identifier — used to stitch orders across visits.
 *
 * Segmentation tags are computed by the CRM backend (not the menu app).
 * They are stored here so a future manager panel can filter without re-querying
 * every order. The menu only writes raw data; tags are managed server-side.
 */
/**
 * Time-based segment: how recently the customer last ordered.
 * Calculated from lastOrderAt at the time of each new order.
 *
 *   new       0–7 days since last order (or first ever order)
 *   active    8–30 days
 *   warm      31–60 days
 *   at_risk   61–120 days
 *   lost      120+ days
 */
export type TimeSegment = 'new' | 'active' | 'warm' | 'at_risk' | 'lost'

/**
 * Frequency-based segment: order volume in the last 30 days.
 *
 *   vip       4+ orders in the last 30 days
 *   regular   all others
 */
export type FrequencySegment = 'vip' | 'regular'

/** Union of all segment tags stored on a customer profile. */
export type SegmentTag = TimeSegment | FrequencySegment

// ─── Engagement strategy ──────────────────────────────────────────────────────

/**
 * The recommended strategic action for a given segment combination.
 * Resolved by getEngagementAction() in crmEngagement.ts.
 *
 * none            — no action warranted (e.g. very new customer, let the relationship breathe)
 * follow_up       — light post-purchase check-in; reinforce the first impression
 * loyalty         — recognize and reward consistent behavior
 * upsell          — customer is engaged; present complementary or premium items
 * vip_nurture     — high-frequency active customer; deepen the relationship
 * vip_recovery    — high-frequency customer going silent; treat with priority and care
 * reactivation    — regular customer drifting away; send a gentle prompt
 * final_winback   — last attempt before treating the customer as lost; single message, no pressure
 * no_contact      — do not send anything; relationship too cold for outreach to be welcomed
 */
export type EngagementAction =
  | 'none'
  | 'follow_up'
  | 'loyalty'
  | 'upsell'
  | 'vip_nurture'
  | 'vip_recovery'
  | 'reactivation'
  | 'final_winback'
  | 'no_contact'

/**
 * Priority level for scheduling and throttling automation runs.
 *
 * high    — act within 24 h (VIP churn risk, first-order follow-up)
 * medium  — act within 3–5 days (regular reactivation, warm upsell)
 * low     — act within 7–14 days (passive loyalty touch, borderline lost)
 * none    — do not schedule
 */
export type EngagementPriority = 'high' | 'medium' | 'low' | 'none'

/** Full engagement recommendation for a customer at a point in time. */
export interface EngagementRecommendation {
  action: EngagementAction
  priority: EngagementPriority
  /** Whether a promotional message is acceptable for this combination. */
  allowsPromotion: boolean
  /** Human-readable rationale — for manager panel and automation logs. */
  rationale: string
}

// ─── Automation triggers ──────────────────────────────────────────────────────

/**
 * Snapshot of a customer's segment before and after an update.
 * `previous` is null when the customer is being created for the first time.
 */
export interface SegmentChange {
  phone: string
  previous: { timeSegment: TimeSegment; frequencySegment: FrequencySegment } | null
  current:  { timeSegment: TimeSegment; frequencySegment: FrequencySegment }
  /** True when either dimension changed (or when this is a first-time registration). */
  changed: boolean
}

/**
 * A single automation trigger definition.
 *
 * condition — pure predicate evaluated against the SegmentChange.
 *             Return true to fire this trigger.
 * handler   — async side-effect to run when the condition matches.
 *             Receives the change and the resolved EngagementRecommendation.
 *             Must never throw — failures are caught by the runner.
 */
export interface AutomationTrigger {
  id: string   // unique identifier used in logs — e.g. 'new_customer_follow_up'
  /**
   * Minimum hours that must pass before this trigger can fire again for the
   * same customer. Checked against crm_automations_log (non-failed, non-skipped entries).
   * Set to 0 to disable cooldown (not recommended for message-sending triggers).
   */
  cooldownHours: number
  condition: (change: SegmentChange) => boolean
  handler: (change: SegmentChange, recommendation: EngagementRecommendation) => Promise<void>
}

/**
 * Immutable log entry written for every trigger execution attempt.
 * Append-only — never updated in place. Status transitions produce new reads
 * from the same row (sent_at, skip_reason) but no structural update.
 *
 * Maps to crm_automations_log in Supabase.
 */
export type AutomationLogStatus = 'pending' | 'sent' | 'skipped' | 'failed'

export interface AutomationLog {
  id: string                       // UUID — dedup key
  triggerId: string                // matches AutomationTrigger.id
  customerPhone: string
  timeSegment: TimeSegment
  frequencySegment: FrequencySegment
  engagementAction: EngagementAction
  status: AutomationLogStatus
  skipReason?: string              // populated when status === 'skipped'
  executedAt: string               // ISO 8601 — when the trigger fired
}

export interface CrmCliente {
  phone: string               // digits only: "11987654321" — primary key
  name: string
  email?: string
  birthday?: string           // "DD/MM/AAAA" — NOT collected in current UI. Reserved.
  preferencias: ComunicacaoPreferencias
  // ── Segmentation (two explicit dimensions) ──────────────────────────────────
  timeSegment: TimeSegment          // recency axis — computed on every checkout
  frequencySegment: FrequencySegment // frequency axis — computed on every checkout
  /** Backward-compat tag array derived from the two dimensions above: [timeSegment, frequencySegment]. */
  segmentTags: SegmentTag[]
  // ── Order metrics ───────────────────────────────────────────────────────────
  orderCount: number          // lifetime order count — updated on every checkout
  totalSpentCentavos: number  // lifetime spend in centavos — updated on every checkout
  firstSeenAt: string         // ISO 8601
  lastSeenAt: string          // ISO 8601 — updated on every checkout
  lastOrderAt?: string        // ISO 8601 — timestamp of the most recent order
  ordersLast30Days: number    // rolling count used for frequency segmentation
}

// ─── Order payload ────────────────────────────────────────────────────────────

/**
 * CRM-friendly order payload — normalized snapshot, backend-agnostic.
 * Shares its `id` with the Saipos/mock Pedido so both records are joinable.
 */
export interface CrmPedido {
  id: string              // shared UUID with Pedido.id
  customerPhone: string   // FK → CrmCliente.phone
  customerName: string
  context: OrderContext
  tableId?: string
  source: EntrySource
  items: CrmItemPedido[]
  subtotal: number        // centavos
  discount: number        // centavos — 0 in MVP
  serviceFee: number      // centavos — 0 in MVP
  total: number           // centavos
  notes?: string
  paymentMethod?: string  // e.g. 'pix' | 'credito' | 'debito' | 'dinheiro' — optional for legacy rows
  createdAt: string       // ISO 8601
  status: 'pending' | 'confirmed' | 'cancelled' | 'new' | 'preparing' | 'ready' | 'delivered'
  attribution: OrderAttribution | null   // null for legacy orders; schema_version: 1 for all new orders
}

export interface CrmItemPedido {
  productId: string
  productName: string     // snapshot at order time
  unitPrice: number       // centavos — snapshot
  quantity: number
  total: number           // centavos
  variations?: string     // human-readable: "16 peças"
  note?: string
}

// ─── Message log ──────────────────────────────────────────────────────────────
//
// Every outbound message must be logged. This enables:
// - Deduplication (don't send the same message twice)
// - Quality control auditing
// - Unsubscribe enforcement
// - Frequency capping (no more than N messages per customer per period)
// - Provider-agnostic send history (works with any WABA provider)

/**
 * Category of outbound message.
 * This separation exists at the data model level — never collapse these.
 *
 * transactional: triggered by a specific order event. No consent required by
 *   WhatsApp policy for utility templates, but we store consent anyway.
 * relational: triggered by customer lifecycle events (birthday, NPS, etc.).
 *   Requires relational consent.
 * promotional: triggered by marketing campaigns. Requires promotional consent.
 *   Never sent to customers who only have transactional or no consent.
 */
export type MessageCategory = 'transactional' | 'relational' | 'promotional'

export type MessageStatus =
  | 'queued'     // scheduled, not yet sent
  | 'sent'       // dispatched to provider
  | 'delivered'  // delivery confirmed by provider
  | 'read'       // read receipt received (WhatsApp only)
  | 'failed'     // provider reported failure
  | 'blocked'    // blocked before send (unsubscribed, frequency cap, etc.)

export type MessageChannel = 'whatsapp' | 'email' | 'sms'

/**
 * Immutable log entry created for every attempted outbound message.
 * Never updated — status changes append a new `statusUpdatedAt` timestamp.
 */
export interface MensagemLog {
  id: string
  customerPhone: string       // FK → CrmCliente.phone
  channel: MessageChannel
  category: MessageCategory
  templateId: string          // template name / ID used (e.g. "order_confirmed_v1")
  orderId?: string            // FK → CrmPedido.id — if triggered by an order event
  campaignId?: string         // FK → future Campaign table — if part of a campaign
  status: MessageStatus
  blockedReason?: string      // why it was blocked, if status === 'blocked'
  sentAt?: string             // ISO 8601
  statusUpdatedAt: string     // ISO 8601 — last status change
  providerMessageId?: string  // ID returned by WABA provider (for receipts / debugging)
}

// ─── Campaign (future — defined now for type completeness) ────────────────────
//
// Campaigns operate on segments, not on "all customers".
// A campaign must have an approval status before any message is dispatched.
// Batch logic (send limits, send windows) is enforced by the backend, not here.

export type CampaignStatus =
  | 'draft'      // being configured, nothing sent
  | 'pending'    // awaiting approval
  | 'approved'   // ready to send
  | 'sending'    // currently dispatching in batches
  | 'paused'     // manually paused mid-send
  | 'completed'  // all messages dispatched
  | 'cancelled'  // cancelled before or during send

/**
 * Campaign definition.
 * A campaign targets a segment (not a raw phone list) and requires approval.
 * The backend resolves which customers match the segment at send time.
 */
export interface Campaign {
  id: string
  name: string
  category: MessageCategory   // must be 'relational' or 'promotional' — never 'transactional'
  templateId: string
  targetSegment: SegmentTag[] // customers must match ALL tags to be included
  consentRequired: 'relational' | 'promotional' // which consent record must be granted
  status: CampaignStatus
  approvedBy?: string         // manager ID — required before status can move to 'approved'
  approvedAt?: string         // ISO 8601
  scheduledAt?: string        // ISO 8601 — when to start sending
  batchSize: number           // how many messages to dispatch per batch
  batchIntervalMs: number     // delay between batches in ms (rate limiting)
  createdAt: string           // ISO 8601
  totalTargeted?: number      // populated after segment is resolved
  totalSent?: number          // running count
  totalDelivered?: number     // running count
}

// ─── Analytics events ─────────────────────────────────────────────────────────

export type AnalyticsEventName =
  | 'view_menu'
  | 'view_product'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'upsell_click'
  | 'cart_view'
  | 'checkout_start'
  | 'checkout_complete'

export interface AnalyticsEvent {
  event: AnalyticsEventName
  sessionId: string   // random per-session UUID — not tied to customer identity
  ts: string          // ISO 8601
  props?: Record<string, string | number | boolean>
}

// ─── CRM event pipeline ───────────────────────────────────────────────────────
//
// CRM events are richer than analytics events: they carry customer identity,
// consent state, and structured order data. They feed the CRM, not just metrics.
//
// Event categories:
// - Identity:    customer_identified, customer_opt_in, customer_opt_out
// - Commerce:    order_created, order_completed
// - Engagement:  add_to_cart, upsell_clicked
//
// All events share a base envelope. Each event type narrows the `data` field.

export type CrmEventName =
  | 'customer_identified'  // customer's phone + name first seen or re-identified
  | 'customer_opt_in'      // customer granted consent for a message category
  | 'customer_opt_out'     // customer withdrew consent for a message category
  | 'order_created'        // order submitted to kitchen (pending confirmation)
  | 'order_completed'      // order confirmed — full payload including items
  | 'add_to_cart'          // item added to cart (pre-checkout behavioral signal)
  | 'upsell_clicked'       // customer interacted with an upsell suggestion

/** Minimal customer identity carrier — always digits-only phone with country code. */
export interface CrmEventCustomer {
  phone: string       // normalized: digits only + country code ("5511987654321")
  name: string
  email?: string
  /** Whether orderUpdates consent was granted at the time of this event. */
  consentOrderUpdates?: boolean
  /** Whether promotional consent was granted at the time of this event. */
  consentPromotional?: boolean
  /** Which UI surface collected the consent. */
  consentSource?: ConsentSource
}

export interface CrmEventOrderItem {
  productId: string
  productName: string
  categoryId: string
  unitPrice: number    // centavos
  quantity: number
  total: number        // centavos
  variations?: string
}

// ── Per-event data shapes ────────────────────────────────────────────────────

export interface CrmEventDataCustomerIdentified {
  customer: CrmEventCustomer
}

export interface CrmEventDataOptIn {
  customer: CrmEventCustomer
  /** Which consent category was granted. */
  category: MessageCategory
}

export interface CrmEventDataOptOut {
  customer: CrmEventCustomer
  category: MessageCategory
}

export interface CrmEventDataOrderCreated {
  orderId: string
  customer: CrmEventCustomer
  context: OrderContext
  tableId?: string
  source: EntrySource
  items: CrmEventOrderItem[]
  total: number          // centavos
  paymentMethod: string
}

export interface CrmEventDataOrderCompleted extends CrmEventDataOrderCreated {
  /** Sequential human-readable order number (e.g. 42 → displayed as #0042). */
  orderNumber: number
  /** Campaign attribution — always present with schema_version: 1. Flat fields are null when no UTM signals were captured. */
  attribution: OrderAttribution
}

export interface CrmEventDataAddToCart {
  productId: string
  productName: string
  categoryId: string
  unitPrice: number      // centavos
  quantity: number
  withUpsell: boolean    // true if an upsell item was added alongside
  sessionId: string
}

export interface CrmEventDataUpsellClicked {
  upsellProductId: string
  upsellProductName: string
  /** The main product that triggered the upsell suggestion. */
  triggerProductId: string
  accepted: boolean      // true = added, false = removed/declined
  sessionId: string
}

// ── Discriminated union ──────────────────────────────────────────────────────

export type CrmEventPayload =
  | { event: 'customer_identified'; data: CrmEventDataCustomerIdentified }
  | { event: 'customer_opt_in';     data: CrmEventDataOptIn }
  | { event: 'customer_opt_out';    data: CrmEventDataOptOut }
  | { event: 'order_created';       data: CrmEventDataOrderCreated }
  | { event: 'order_completed';     data: CrmEventDataOrderCompleted }
  | { event: 'add_to_cart';         data: CrmEventDataAddToCart }
  | { event: 'upsell_clicked';      data: CrmEventDataUpsellClicked }

/** Full envelope stored/dispatched for every CRM event. */
export interface CrmEvent {
  id: string            // UUID — for deduplication on the backend
  ts: string            // ISO 8601
  sessionId: string     // browser-session UUID (from crmStore) — NOT tied to identity
  operationId: string   // 'santa_maria' | 'cacapava_do_sul' — set by crmEvents.ts from CURRENT_OPERATION
  payload: CrmEventPayload
}
