/**
 * eventSync — Syncs the CRM event queue to a backend endpoint.
 *
 * Design:
 * - Sends events in a single batch POST (not one-by-one).
 * - On success → removes sent events from the queue.
 * - On failure → keeps events for retry (they are already in localStorage).
 * - Exponential backoff on consecutive failures (capped at MAX_BACKOFF_MS).
 * - Auto-sync triggers:
 *     1. After every enqueue (immediate attempt, throttled).
 *     2. On page visibility change (tab regains focus).
 *     3. On online event (network restored).
 * - Only one sync run at a time (mutex flag).
 *
 * To connect a real backend, set CRM_EVENTS_ENDPOINT in your .env:
 *   NEXT_PUBLIC_CRM_EVENTS_ENDPOINT=https://your-project.supabase.co/functions/v1/crm-events
 *
 * For Supabase Edge Functions the POST body is the same:
 *   { events: CrmEvent[] }
 * The function inserts into a `crm_events` table and returns { received: number }.
 *
 * Mock mode (no endpoint configured): events stay in localStorage only.
 * This matches the existing MVP behaviour — no breaking change.
 */

import type { CrmEvent } from '@/types/crm'
import { drainQueue, removeEvents, queueSize } from '@/utils/eventQueue'

// ─── Debug logging (opt-in) ───────────────────────────────────────────────────
// Enable in browser console: localStorage.setItem('crm_debug', '1')
// Disable:                   localStorage.removeItem('crm_debug')

function dbg(...args: unknown[]): void {
  if (typeof window !== 'undefined' && localStorage.getItem('crm_debug') === '1') {
    console.log('[CRM sync]', ...args)
  }
}

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * Backend endpoint URL.
 * Leave undefined (or unset the env var) to keep events in localStorage only.
 * Replace with your real endpoint when ready:
 *   NEXT_PUBLIC_CRM_EVENTS_ENDPOINT=/api/crm/events
 */
const ENDPOINT: string | undefined =
  process.env.NEXT_PUBLIC_CRM_EVENTS_ENDPOINT

if (!ENDPOINT) {
  console.warn('[CRM sync] NEXT_PUBLIC_CRM_EVENTS_ENDPOINT is not set — CRM events will queue in localStorage but never reach the backend. Set this variable in your .env to enable persistence.')
} else {
  console.log('[CRM sync] ENDPOINT at module load:', ENDPOINT)
}

const BATCH_SIZE = 100          // max events per POST
const INITIAL_BACKOFF_MS = 2_000
const MAX_BACKOFF_MS = 60_000   // 1 minute ceiling
const THROTTLE_MS = 1_000       // min gap between auto-sync triggers

// ─── State ────────────────────────────────────────────────────────────────────

let _syncing = false                    // mutex: prevent concurrent runs
let _failCount = 0                      // consecutive failure counter
let _lastSyncAttempt = 0               // timestamp of last trigger (for throttle)
let _retryTimer: ReturnType<typeof setTimeout> | null = null

// ─── Observable log (debug panel hook) ───────────────────────────────────────

type SyncLogCallback = (msg: string) => void
let _logCallback: SyncLogCallback | null = null

/** Register a callback to receive human-readable sync status messages. */
export function setSyncLogCallback(cb: SyncLogCallback | null): void {
  _logCallback = cb
}

function log(msg: string): void {
  dbg(msg)
  _logCallback?.(msg)
}

// ─── Core sync logic ──────────────────────────────────────────────────────────

/**
 * Send one batch of events to the backend.
 * Returns the IDs of successfully acknowledged events.
 */
async function postBatch(events: CrmEvent[]): Promise<string[]> {
  if (!ENDPOINT) return []   // no endpoint → skip silently (mock mode)

  const body = JSON.stringify({ events })
  console.log('[CRM sync] POST payload:', body)
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // keepalive: true allows the request to outlive the page unload.
    keepalive: true,
    body,
  })

  const responseText = await res.text()
  console.log('[CRM sync] response:', res.status, responseText)
  if (!res.ok) {
    throw new Error(`CRM sync failed: ${res.status} ${res.statusText} — ${responseText}`)
  }

  // The backend must acknowledge by returning { received: number }.
  // We trust the server received all events we sent (idempotency is on the server).
  return events.map((e) => e.id)
}

/**
 * Run a full sync cycle: drain queue → send in batches → remove acknowledged.
 * Safe to call anytime; the mutex prevents concurrent runs.
 */
export async function syncEvents(): Promise<void> {
  if (_syncing) {
    log('skipped — sync already in progress')
    return
  }
  if (!ENDPOINT) {
    log('skipped — no endpoint configured (NEXT_PUBLIC_CRM_EVENTS_ENDPOINT is unset)')
    return
  }
  if (queueSize() === 0) {
    log('skipped — queue is empty')
    return
  }

  _syncing = true
  _lastSyncAttempt = Date.now()

  // Cancel any pending retry timer — we are running now.
  if (_retryTimer !== null) {
    clearTimeout(_retryTimer)
    _retryTimer = null
  }

  try {
    const events = drainQueue()
    if (events.length === 0) {
      _syncing = false
      return
    }

    log(`sync started — ${events.length} event(s): ${events.map((e) => e.payload.event).join(', ')}`)

    // Send in batches to avoid oversized payloads.
    for (let i = 0; i < events.length; i += BATCH_SIZE) {
      const batch = events.slice(i, i + BATCH_SIZE)
      log(`POST ${ENDPOINT} — batch of ${batch.length}`)
      const acknowledged = await postBatch(batch)
      removeEvents(acknowledged)
      log(`batch acknowledged — queue remaining: ${queueSize()}`)
    }

    _failCount = 0    // reset backoff on success
    log('sync complete ✓')
  } catch (err) {
    _failCount++
    const msg = err instanceof Error ? err.message : String(err)
    log(`sync failed (attempt ${_failCount}): ${msg}`)
    scheduleRetry()
  } finally {
    _syncing = false
  }
}

// ─── Retry with exponential backoff ───────────────────────────────────────────

function scheduleRetry(): void {
  if (_retryTimer !== null) return  // already scheduled
  const delay = Math.min(INITIAL_BACKOFF_MS * 2 ** (_failCount - 1), MAX_BACKOFF_MS)
  log(`retry scheduled in ${Math.round(delay / 1000)}s (fail count: ${_failCount})`)
  _retryTimer = setTimeout(() => {
    _retryTimer = null
    syncEvents()
  }, delay)
}

// ─── Throttled trigger ────────────────────────────────────────────────────────

/**
 * Request a sync. Throttled so rapid enqueues don't fire dozens of requests.
 * Called by crmEvents.ts after every enqueue.
 */
export function triggerSync(): void {
  if (!ENDPOINT) return
  const now = Date.now()
  if (now - _lastSyncAttempt < THROTTLE_MS) return
  // Defer to the next microtask so the enqueue that triggered this
  // has time to persist before we drain the queue.
  setTimeout(() => { syncEvents() }, 0)
}

// ─── Browser lifecycle hooks ──────────────────────────────────────────────────

/**
 * Register browser lifecycle listeners.
 * Call this once at app startup (e.g. from a layout component or _app).
 * Safe to call server-side — guards against window being undefined.
 */
export function registerSyncListeners(): void {
  if (typeof window === 'undefined') return

  // Sync when tab becomes visible again (user returns from another tab).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncEvents()
    }
  })

  // Sync when network is restored.
  window.addEventListener('online', () => {
    _failCount = 0  // reset backoff — fresh connection
    syncEvents()
  })

  // Best-effort flush on page unload (keepalive fetch).
  window.addEventListener('pagehide', () => {
    if (queueSize() > 0) syncEvents()
  })
}
