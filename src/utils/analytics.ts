/**
 * analytics — Lightweight event tracking utility.
 *
 * Design goals:
 * - Fire-and-forget: never blocks the UI
 * - Backend-agnostic: swapping to Supabase / PostHog / Amplitude = changing one function
 * - Locally buffered: events go to localStorage now, drain to backend later
 * - Zero dependencies beyond the CRM store
 *
 * To plug in a real backend, replace `dispatch` with an HTTP call or SDK call.
 * The rest of the app doesn't change.
 */

import type { AnalyticsEvent, AnalyticsEventName } from '@/types/crm'

// ─── Storage ──────────────────────────────────────────────────────────────────

const EVENTS_KEY = 'marujos_analytics'
const MAX_BUFFERED = 200 // cap to avoid unbounded localStorage growth

function readBuffer(): AnalyticsEvent[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(EVENTS_KEY) ?? '[]')
  } catch {
    return []
  }
}

function writeBuffer(events: AnalyticsEvent[]): void {
  if (typeof window === 'undefined') return
  // Keep only the latest MAX_BUFFERED events (ring buffer behaviour)
  const trimmed = events.slice(-MAX_BUFFERED)
  localStorage.setItem(EVENTS_KEY, JSON.stringify(trimmed))
}

// ─── Core dispatch ────────────────────────────────────────────────────────────

/**
 * Internal dispatch. Replace body to send to a real backend.
 * Currently: append to localStorage buffer.
 * Future:    await fetch('/api/events', { method: 'POST', body: JSON.stringify(event) })
 *         or supabase.from('events').insert(event)
 */
function dispatch(event: AnalyticsEvent): void {
  const buffer = readBuffer()
  buffer.push(event)
  writeBuffer(buffer)
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Track an analytics event.
 *
 * Usage:
 *   track('view_product', sessionId, { productId: 'prod-x', productName: 'Hot Roll' })
 *   track('checkout_complete', sessionId, { orderId, total: 9800 })
 */
export function track(
  event: AnalyticsEventName,
  sessionId: string,
  props?: Record<string, string | number | boolean>
): void {
  const payload: AnalyticsEvent = {
    event,
    sessionId,
    ts: new Date().toISOString(),
    props,
  }

  // Truly fire-and-forget — wrap in setTimeout so it never sits in the
  // synchronous call stack of user interactions (add to cart, etc.)
  setTimeout(() => dispatch(payload), 0)
}

// ─── Dev utility ──────────────────────────────────────────────────────────────

/**
 * Read all buffered events from localStorage.
 * Useful in browser console: import { getEventBuffer } from '@/utils/analytics'
 * Will be replaced by a real query when backend is connected.
 */
export function getEventBuffer(): AnalyticsEvent[] {
  return readBuffer()
}

/**
 * Clear the local event buffer. Dev/testing only.
 */
export function clearEventBuffer(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(EVENTS_KEY)
  }
}
