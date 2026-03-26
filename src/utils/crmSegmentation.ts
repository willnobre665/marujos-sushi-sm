/**
 * crmSegmentation — Pure functions for behavior-based customer segmentation.
 *
 * Two independent axes:
 *   - Time segment:      how recently the customer last ordered
 *   - Frequency segment: order volume in the last 30 days
 *
 * Both are computed from fields on CrmCliente and combined into segmentTags[].
 * These functions are pure (no I/O, no side effects) and run synchronously.
 *
 * Called by crmStore.saveCliente on every new order so the stored profile
 * always reflects the customer's current segment without a separate job.
 */

import type { TimeSegment, FrequencySegment, SegmentTag } from '@/types/crm'

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000

const TIME_THRESHOLDS = {
  new:     7,    // 0–7 days
  active:  30,   // 8–30 days
  warm:    60,   // 31–60 days
  at_risk: 120,  // 61–120 days
  // lost = 120+
} as const

const VIP_ORDER_THRESHOLD = 4  // orders in last 30 days to qualify as VIP

// ─── Time segment ─────────────────────────────────────────────────────────────

/**
 * Classify a customer by recency of their last order.
 *
 * @param lastOrderAt  ISO 8601 timestamp of most recent order, or undefined for brand-new customers.
 * @param now          Reference timestamp in ms (defaults to Date.now()). Injectable for testing.
 */
export function calcTimeSegment(
  lastOrderAt: string | undefined,
  now: number = Date.now()
): TimeSegment {
  if (!lastOrderAt) return 'new'

  const daysSince = (now - new Date(lastOrderAt).getTime()) / DAY_MS

  if (daysSince <= TIME_THRESHOLDS.new)     return 'new'
  if (daysSince <= TIME_THRESHOLDS.active)  return 'active'
  if (daysSince <= TIME_THRESHOLDS.warm)    return 'warm'
  if (daysSince <= TIME_THRESHOLDS.at_risk) return 'at_risk'
  return 'lost'
}

// ─── Frequency segment ────────────────────────────────────────────────────────

/**
 * Classify a customer by purchase frequency in the last 30 days.
 *
 * @param ordersLast30Days  Rolling count of orders in the last 30 days (stored on CrmCliente).
 */
export function calcFrequencySegment(ordersLast30Days: number): FrequencySegment {
  return ordersLast30Days >= VIP_ORDER_THRESHOLD ? 'vip' : 'regular'
}

// ─── Combined ─────────────────────────────────────────────────────────────────

/**
 * Compute both segment dimensions at once.
 * Use this when building or updating a CrmCliente profile — it gives you the
 * two typed fields directly and derives segmentTags for backward compatibility.
 *
 * @param lastOrderAt      ISO 8601 timestamp of last order (undefined for first-time customers).
 * @param ordersLast30Days Rolling 30-day order count.
 * @param now              Reference timestamp in ms (injectable for testing).
 */
export function calcSegments(
  lastOrderAt: string | undefined,
  ordersLast30Days: number,
  now: number = Date.now()
): { timeSegment: TimeSegment; frequencySegment: FrequencySegment; segmentTags: SegmentTag[] } {
  const timeSegment      = calcTimeSegment(lastOrderAt, now)
  const frequencySegment = calcFrequencySegment(ordersLast30Days)
  return { timeSegment, frequencySegment, segmentTags: [timeSegment, frequencySegment] }
}

/**
 * @deprecated Use calcSegments() instead — returns the two explicit dimension fields.
 * Kept for any call sites that only need the tag array.
 */
export function calcSegmentTags(
  lastOrderAt: string | undefined,
  ordersLast30Days: number,
  now: number = Date.now()
): SegmentTag[] {
  return calcSegments(lastOrderAt, ordersLast30Days, now).segmentTags
}
