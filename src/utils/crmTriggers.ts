/**
 * crmTriggers — Segment-change detection and automation trigger runner.
 *
 * Flow:
 *   1. processOrderCompleted saves the updated CrmCliente (with new segments).
 *   2. It calls runTriggers(previous, current).
 *   3. detectSegmentChange() computes whether either dimension actually changed.
 *   4. Each registered trigger's condition() is evaluated against the change.
 *   5. Matching triggers have their handler() called with the resolved recommendation.
 *
 * Adding a new trigger:
 *   Push a new AutomationTrigger object into TRIGGERS at the bottom of this file.
 *   No other code changes are needed.
 *
 * Design rules:
 *   - detectSegmentChange is pure (no I/O).
 *   - runTriggers never throws — every handler is wrapped individually.
 *   - Handlers are stubs right now: they log. WhatsApp/message dispatch is added later.
 *   - The trigger registry is a plain array — no framework, no DI container.
 */

import type {
  CrmCliente,
  SegmentChange,
  AutomationTrigger,
  AutomationLog,
  TimeSegment,
  FrequencySegment,
} from '@/types/crm'
import { getEngagementAction } from '@/utils/crmEngagement'
import { appendAutomationLog, checkCooldown } from '@/services/adapters/supabaseCrmAdapter'
import { gerarUUID } from '@/utils/uuid'

// ─── Change detection ─────────────────────────────────────────────────────────

/**
 * Compare two customer snapshots and return a typed SegmentChange.
 * Pass null for `previous` when the customer is new (first order ever).
 */
export function detectSegmentChange(
  previous: Pick<CrmCliente, 'timeSegment' | 'frequencySegment'> | null,
  current:  Pick<CrmCliente, 'timeSegment' | 'frequencySegment'>,
  phone:    string
): SegmentChange {
  const changed =
    previous === null ||
    previous.timeSegment      !== current.timeSegment ||
    previous.frequencySegment !== current.frequencySegment

  return {
    phone,
    previous: previous
      ? { timeSegment: previous.timeSegment, frequencySegment: previous.frequencySegment }
      : null,
    current: { timeSegment: current.timeSegment, frequencySegment: current.frequencySegment },
    changed,
  }
}

// ─── Trigger registry ─────────────────────────────────────────────────────────
//
// Conditions use two small helpers to keep entries readable:
//   enteredTime(t)      — current timeSegment is t (and either it changed or customer is new)
//   enteredFrequency(f) — current frequencySegment is f (same rule)
//
// Add new triggers at the bottom of TRIGGERS. Order does not matter — all
// matching triggers fire for a given change (not first-match only).

function enteredTime(t: TimeSegment) {
  return (c: SegmentChange) =>
    c.current.timeSegment === t &&
    (c.previous === null || c.previous.timeSegment !== t)
}

function enteredFrequency(f: FrequencySegment) {
  return (c: SegmentChange) =>
    c.current.frequencySegment === f &&
    (c.previous === null || c.previous.frequencySegment !== f)
}

// ─── Cooldown reference ───────────────────────────────────────────────────────
//
//  168 h =  7 days   — standard relational touch cadence
//  336 h = 14 days   — warm/at-risk reactivation window
//  720 h = 30 days   — promotional / nurture cadence
// 2160 h = 90 days   — one-shot recovery attempts (VIP winback, final try)

const TRIGGERS: AutomationTrigger[] = [

  // ── First order / welcome window ───────────────────────────────────────────
  // Cooldown: 7 days. A returning customer who re-enters 'new' (e.g. after a
  // long gap they came back) should not get a second welcome within a week.
  {
    id: 'new_customer_follow_up',
    cooldownHours: 168,
    condition: enteredTime('new'),
    async handler(change, rec) {
      console.log(`[trigger:${this.id}] phone=${change.phone} action=${rec.action} priority=${rec.priority}`)
      // TODO: enqueue follow_up message via communication adapter
    },
  },

  // ── Active VIP — nurture ───────────────────────────────────────────────────
  // Cooldown: 30 days. VIP nurture is a relationship touch, not a transactional
  // alert — once a month is the right cadence.
  {
    id: 'active_vip_nurture',
    cooldownHours: 720,
    condition: (c) =>
      c.current.timeSegment === 'active' && c.current.frequencySegment === 'vip' &&
      (c.previous === null ||
        c.previous.timeSegment !== 'active' ||
        c.previous.frequencySegment !== 'vip'),
    async handler(change, rec) {
      console.log(`[trigger:${this.id}] phone=${change.phone} action=${rec.action} priority=${rec.priority}`)
      // TODO: enqueue vip_nurture message
    },
  },

  // ── Became VIP (any time segment) — frequency upgrade ─────────────────────
  // Cooldown: 30 days. A customer can only cross the VIP threshold once per
  // 30-day window (the window itself resets, but we cap the celebration).
  {
    id: 'frequency_upgrade_to_vip',
    cooldownHours: 720,
    condition: enteredFrequency('vip'),
    async handler(change, rec) {
      console.log(`[trigger:${this.id}] phone=${change.phone} action=${rec.action} priority=${rec.priority}`)
      // TODO: enqueue loyalty recognition message
    },
  },

  // ── Warm VIP — priority recovery ──────────────────────────────────────────
  // Cooldown: 14 days. Give the message time to land before re-evaluating.
  {
    id: 'warm_vip_recovery',
    cooldownHours: 336,
    condition: (c) =>
      c.current.timeSegment === 'warm' && c.current.frequencySegment === 'vip' &&
      (c.previous === null || c.previous.timeSegment !== 'warm'),
    async handler(change, rec) {
      console.log(`[trigger:${this.id}] phone=${change.phone} action=${rec.action} priority=${rec.priority}`)
      // TODO: enqueue vip_recovery message (personal tone)
    },
  },

  // ── At-risk — reactivation ─────────────────────────────────────────────────
  // Cooldown: 14 days. One attempt per fortnight — more would feel like spam.
  {
    id: 'entered_at_risk',
    cooldownHours: 336,
    condition: enteredTime('at_risk'),
    async handler(change, rec) {
      console.log(`[trigger:${this.id}] phone=${change.phone} action=${rec.action} priority=${rec.priority}`)
      // TODO: enqueue reactivation or vip_recovery message depending on rec.action
    },
  },

  // ── Lost VIP — final winback ───────────────────────────────────────────────
  // Cooldown: 90 days. This is a one-shot attempt — long window to prevent
  // any accidental re-fire within the same lost period.
  {
    id: 'lost_vip_final_winback',
    cooldownHours: 2160,
    condition: (c) =>
      c.current.timeSegment === 'lost' && c.current.frequencySegment === 'vip' &&
      (c.previous === null || c.previous.timeSegment !== 'lost'),
    async handler(change, rec) {
      console.log(`[trigger:${this.id}] phone=${change.phone} action=${rec.action} priority=${rec.priority}`)
      // TODO: enqueue final_winback message (single send, no follow-up)
    },
  },

  // ── Lost regular — suppress outreach ──────────────────────────────────────
  // Cooldown: 90 days. Even the suppression log entry should not repeat constantly.
  {
    id: 'lost_regular_no_contact',
    cooldownHours: 2160,
    condition: (c) =>
      c.current.timeSegment === 'lost' && c.current.frequencySegment === 'regular' &&
      (c.previous === null || c.previous.timeSegment !== 'lost'),
    async handler(change, rec) {
      // no_contact: do not send anything, but log so the manager panel can reflect this.
      console.log(`[trigger:${this.id}] phone=${change.phone} action=${rec.action} — suppressed, no message sent`)
    },
  },
]

// ─── Runner ───────────────────────────────────────────────────────────────────

/**
 * Evaluate all registered triggers against a segment change and fire matching handlers.
 *
 * - Never throws: each handler is individually try/caught.
 * - Skips evaluation entirely when change.changed === false (segments unchanged).
 * - Resolves the EngagementRecommendation once per run and passes it to all handlers.
 *
 * @param previous  Customer profile before this order (null if first order).
 * @param current   Customer profile after this order (segments already computed).
 */
export async function runTriggers(
  previous: Pick<CrmCliente, 'timeSegment' | 'frequencySegment'> | null,
  current:  Pick<CrmCliente, 'timeSegment' | 'frequencySegment'>,
  phone:    string
): Promise<void> {
  const change = detectSegmentChange(previous, current, phone)

  console.log(`[runTriggers] phone=${phone} changed=${change.changed} prev=${JSON.stringify(change.previous)} curr=${JSON.stringify(change.current)}`)

  if (!change.changed) {
    console.log(`[runTriggers] no segment change — skipping all triggers`)
    return
  }

  const recommendation = getEngagementAction(
    change.current.timeSegment,
    change.current.frequencySegment
  )

  console.log(`[runTriggers] recommendation: action=${recommendation.action} priority=${recommendation.priority}`)

  const matching = TRIGGERS.filter((t) => t.condition(change))

  console.log(`[runTriggers] matching triggers: [${matching.map(t => t.id).join(', ')}] (of ${TRIGGERS.length} total)`)

  for (const trigger of matching) {
    const baseEntry: Omit<AutomationLog, 'status' | 'skipReason'> = {
      id:                gerarUUID(),
      triggerId:         trigger.id,
      customerPhone:     phone,
      timeSegment:       change.current.timeSegment,
      frequencySegment:  change.current.frequencySegment,
      engagementAction:  recommendation.action,
      executedAt:        new Date().toISOString(),
    }

    // no_contact / none: run handler for side-effects (e.g. suppression log),
    // but always record as skipped — no message will ever be sent.
    if (recommendation.action === 'no_contact' || recommendation.action === 'none') {
      try {
        await trigger.handler(change, recommendation)
      } catch (err) {
        console.error(`[trigger:${trigger.id}] handler error:`, err)
      }
      await logSilently({ ...baseEntry, status: 'skipped', skipReason: recommendation.action })
      continue
    }

    // Cooldown check: skip if this trigger already fired for this customer
    // within the configured window. Fails open if the DB is unreachable.
    if (trigger.cooldownHours > 0) {
      const inCooldown = await checkCooldownSilently({
        triggerId:     trigger.id,
        customerPhone: phone,
        cooldownHours: trigger.cooldownHours,
      })
      console.log(`[runTriggers] trigger=${trigger.id} cooldown check: inCooldown=${inCooldown}`)
      if (inCooldown) {
        await logSilently({ ...baseEntry, status: 'skipped', skipReason: 'cooldown' })
        continue
      }
    }

    try {
      await trigger.handler(change, recommendation)
      console.log(`[runTriggers] trigger=${trigger.id} handler OK — writing pending log entry id=${baseEntry.id}`)
      await logSilently({ ...baseEntry, status: 'pending' })
    } catch (err) {
      console.error(`[trigger:${trigger.id}] handler error (phone=${phone}):`, err)
      await logSilently({ ...baseEntry, status: 'failed', skipReason: String(err) })
    }
  }

  console.log(`[runTriggers] done for phone=${phone}`)
}

/**
 * Cooldown check that never throws.
 * Returns false (= allow) if the DB query fails, so the trigger proceeds.
 */
async function checkCooldownSilently(params: {
  triggerId: string
  customerPhone: string
  cooldownHours: number
}): Promise<boolean> {
  try {
    return await checkCooldown(params)
  } catch (err) {
    console.error('[crmTriggers] cooldown check error (failing open):', err)
    return false
  }
}

/**
 * Write an automation log entry without ever throwing.
 * A logging failure must never surface to the order flow.
 */
async function logSilently(entry: AutomationLog): Promise<void> {
  console.log(`[logSilently] inserting trigger=${entry.triggerId} status=${entry.status} id=${entry.id}`)
  try {
    await appendAutomationLog(entry)
    console.log(`[logSilently] insert OK — trigger=${entry.triggerId} id=${entry.id}`)
  } catch (err) {
    // Log full Supabase error detail so schema/table issues are visible in server logs.
    const detail = (err as { code?: string; message?: string; details?: string })
    console.error(
      '[logSilently] INSERT FAILED:',
      detail.code ?? '?', '—', detail.message ?? String(err),
      detail.details ? `details=(${detail.details})` : '',
      '| trigger:', entry.triggerId, 'id:', entry.id,
    )
  }
}
