/**
 * crmEvents — Unified CRM event dispatcher.
 *
 * Single public API: sendEventToCRM(sessionId, payload)
 *
 * Architecture:
 *   Events are written to a persistent queue (eventQueue.ts) that survives
 *   page refreshes via localStorage. The sync engine (eventSync.ts) drains
 *   the queue to the backend in batches, with retry + exponential backoff.
 *
 *   When no backend endpoint is configured (NEXT_PUBLIC_CRM_EVENTS_ENDPOINT
 *   is undefined), the queue stays in localStorage only — same as MVP behaviour.
 *
 * Design rules:
 * - Never throws. A tracking failure must never break the checkout or any UX.
 * - Never awaited by callers. Pure side-effect.
 * - sessionId is passed in by the caller (from crmStore.sessionId) so this
 *   module has no dependency on Zustand and stays pure / testable.
 */

import type { CrmEvent, CrmEventPayload } from '@/types/crm'
import { CURRENT_OPERATION } from '@/config/operation'
import { gerarUUID } from '@/utils/uuid'
import { enqueueEvent, drainQueue, clearQueue } from '@/utils/eventQueue'
import { triggerSync } from '@/utils/eventSync'

// ─── Internal dispatch ────────────────────────────────────────────────────────

function dispatch(event: CrmEvent): void {
  // 1. Persist to durable queue (localStorage + in-memory).
  enqueueEvent(event)
  console.log('[CRM] enqueued', event.payload.event, '— queue size now:', (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('marujos_crm_queue') ?? '[]') : []).length)
  // 2. Attempt to sync to backend (throttled, non-blocking).
  triggerSync()
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send a CRM event. Fire-and-forget — never blocks the caller.
 *
 * @param sessionId  Browser-session UUID from useCrmStore(s => s.sessionId)
 * @param payload    Discriminated union — TypeScript enforces the shape per event name
 *
 * @example
 *   sendEventToCRM(sessionId, {
 *     event: 'add_to_cart',
 *     data: { productId, productName, categoryId, unitPrice, quantity, withUpsell: false, sessionId },
 *   })
 */
export function sendEventToCRM(sessionId: string, payload: CrmEventPayload): void {
  console.log('[CRM] sendEventToCRM called:', payload.event)
  const event: CrmEvent = {
    id: gerarUUID(),
    ts: new Date().toISOString(),
    sessionId,
    operationId: CURRENT_OPERATION,
    payload,
  }

  // Wrap in setTimeout(0) so the event never sits in a user-interaction call stack.
  // This matches the same pattern used by utils/analytics.ts.
  setTimeout(() => {
    try {
      dispatch(event)
    } catch (err) {
      console.error('[CRM] dispatch error:', err)
    }
  }, 0)
}

// ─── Dev utilities ────────────────────────────────────────────────────────────

/**
 * Read all events currently in the queue (unsent + waiting for retry).
 * Use in browser console: import { getCrmEventBuffer } from '@/utils/crmEvents'
 */
export function getCrmEventBuffer(): CrmEvent[] {
  return drainQueue()
}

/** Clear the local event queue. Dev/testing only. */
export function clearCrmEventBuffer(): void {
  clearQueue()
}
