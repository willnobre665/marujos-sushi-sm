/**
 * crmEngagement — Engagement strategy layer.
 *
 * Maps every (TimeSegment × FrequencySegment) combination to a concrete
 * business action. This is the single source of truth for "what should we
 * do with this customer right now?"
 *
 * Design rules:
 * - Pure data — no I/O, no side effects, no imports from Zustand or services.
 * - The action map is a plain object keyed by "timeSegment:frequencySegment".
 *   Add a new combination here and it becomes available everywhere automatically.
 * - allowsPromotion is intentionally conservative: when in doubt, false.
 *   Promotional consent is a separate gate enforced by crmService — this flag
 *   is a strategic guide, not a bypass of the consent check.
 *
 * Not implemented here:
 * - Message templates (belong in a templates registry)
 * - Send scheduling (belongs in an automation runner)
 * - Consent verification (belongs in crmService.verificarConsentimento)
 */

import type {
  TimeSegment,
  FrequencySegment,
  EngagementRecommendation,
} from '@/types/crm'

// ─── Action map ───────────────────────────────────────────────────────────────
//
// Key format: `${timeSegment}:${frequencySegment}`
//
// Priority guide:
//   high   → act within 24 h   (VIP at risk, first-order window closing)
//   medium → act within 3–5 d  (steady regular drifting, warm upsell moment)
//   low    → act within 7–14 d (passive touch, long-tail lost customer)
//   none   → do not schedule
//
// allowsPromotion:
//   true  → customer relationship is warm enough for a promotional message
//   false → relationship is too new, too cold, or too fragile for promotion

const ACTION_MAP: Record<string, EngagementRecommendation> = {

  // ── new × vip ───────────────────────────────────────────────────────────────
  // Ordered 4+ times in the first week. Exceptional early loyalty.
  // Acknowledge it personally — do not push promotions yet.
  'new:vip': {
    action:          'follow_up',
    priority:        'high',
    allowsPromotion: false,
    rationale:       'New VIP: already ordering frequently in week 1. Send a warm welcome and recognition. No promotion — build the relationship first.',
  },

  // ── new × regular ───────────────────────────────────────────────────────────
  // First or second order, just placed. The impression window is open.
  // A single follow-up message can convert them into a returning customer.
  'new:regular': {
    action:          'follow_up',
    priority:        'high',
    allowsPromotion: false,
    rationale:       'First-time or very recent customer. Follow up to reinforce the experience. No promotion yet — too early.',
  },

  // ── active × vip ────────────────────────────────────────────────────────────
  // High-frequency, still ordering regularly. The ideal customer.
  // Nurture the relationship; a subtle loyalty recognition works well here.
  'active:vip': {
    action:          'vip_nurture',
    priority:        'medium',
    allowsPromotion: true,
    rationale:       'Active VIP: high frequency, recent orders. Reinforce loyalty. Light promotional touch is acceptable — they are engaged.',
  },

  // ── active × regular ────────────────────────────────────────────────────────
  // Ordering regularly, within the last 30 days. Healthy relationship.
  // A well-timed upsell (combo, premium item) fits naturally here.
  'active:regular': {
    action:          'upsell',
    priority:        'medium',
    allowsPromotion: true,
    rationale:       'Active regular: consistent ordering pattern. Good moment for a relevant upsell or combo suggestion.',
  },

  // ── warm × vip ──────────────────────────────────────────────────────────────
  // Was ordering very frequently but has slowed down (31–60 days silent).
  // A VIP going quiet is a priority signal — act before the habit breaks.
  'warm:vip': {
    action:          'vip_recovery',
    priority:        'high',
    allowsPromotion: false,
    rationale:       'Warm VIP: was high-frequency but slowing down. Priority recovery — reach out personally before the habit breaks. No cold promotion.',
  },

  // ── warm × regular ──────────────────────────────────────────────────────────
  // 31–60 days since last order. Still within the recoverable window.
  // A light reactivation or a relevant seasonal suggestion works here.
  'warm:regular': {
    action:          'reactivation',
    priority:        'medium',
    allowsPromotion: true,
    rationale:       'Warm regular: 31–60 days since last order. Still recoverable. A soft reactivation message or seasonal offer is appropriate.',
  },

  // ── at_risk × vip ───────────────────────────────────────────────────────────
  // Was VIP-level but has been silent for 61–120 days. High-value, high-risk.
  // Treat carefully — a personal outreach, not a generic promotion.
  'at_risk:vip': {
    action:          'vip_recovery',
    priority:        'high',
    allowsPromotion: false,
    rationale:       'At-risk VIP: 61–120 days silent. Was your best customer. Personal recovery message only — no bulk promotional tone.',
  },

  // ── at_risk × regular ───────────────────────────────────────────────────────
  // 61–120 days since last order. Drifting significantly.
  // One direct, low-pressure reactivation attempt is warranted.
  'at_risk:regular': {
    action:          'reactivation',
    priority:        'medium',
    allowsPromotion: false,
    rationale:       'At-risk regular: 61–120 days since last order. One reactivation attempt. Avoid promotional tone — relationship is fragile.',
  },

  // ── lost × vip ──────────────────────────────────────────────────────────────
  // 120+ days silent but was once a high-frequency customer.
  // One last personal attempt. If no response, move to no_contact.
  'lost:vip': {
    action:          'final_winback',
    priority:        'low',
    allowsPromotion: false,
    rationale:       'Lost VIP: 120+ days silent, once high-frequency. Single final winback — personal, no pressure. Honour the past relationship.',
  },

  // ── lost × regular ──────────────────────────────────────────────────────────
  // 120+ days silent, low frequency history. Very cold.
  // Do not send anything — the cost of irritating them outweighs the recovery odds.
  'lost:regular': {
    action:          'no_contact',
    priority:        'none',
    allowsPromotion: false,
    rationale:       'Lost regular: 120+ days silent, low historical frequency. Outreach is unlikely to recover and risks being marked as spam. Do not contact.',
  },
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Return the engagement recommendation for a given segment combination.
 *
 * @example
 *   const rec = getEngagementAction('warm', 'vip')
 *   // { action: 'vip_recovery', priority: 'high', allowsPromotion: false, rationale: '...' }
 */
export function getEngagementAction(
  timeSegment: TimeSegment,
  frequencySegment: FrequencySegment
): EngagementRecommendation {
  const key = `${timeSegment}:${frequencySegment}`
  const rec = ACTION_MAP[key]

  // Exhaustive guard — all 10 combinations are defined above.
  // This branch should never be reached with valid TypeScript inputs.
  if (!rec) {
    return {
      action:          'none',
      priority:        'none',
      allowsPromotion: false,
      rationale:       `No action defined for segment combination '${key}'.`,
    }
  }

  return rec
}

/**
 * Convenience overload: pass a CrmCliente directly.
 *
 * @example
 *   const rec = getEngagementActionForCliente(cliente)
 */
export function getEngagementActionForCliente(cliente: {
  timeSegment: TimeSegment
  frequencySegment: FrequencySegment
}): EngagementRecommendation {
  return getEngagementAction(cliente.timeSegment, cliente.frequencySegment)
}
