/**
 * eventQueue — Persistent in-memory + localStorage event queue.
 *
 * Responsibilities:
 * - Hold queued events in memory for the current session.
 * - Persist the queue to localStorage so events survive a page refresh.
 * - Prevent duplicate entries using the event's UUID.
 * - Expose a simple push / drain / remove API used by eventSync.
 *
 * This module has NO dependency on React, Zustand, or any framework.
 * It is safe to import anywhere, including service workers (future).
 */

import type { CrmEvent } from '@/types/crm'

// ─── Constants ────────────────────────────────────────────────────────────────

const QUEUE_KEY = 'marujos_crm_queue'
const MAX_QUEUE_SIZE = 500

// ─── In-memory queue ──────────────────────────────────────────────────────────

// The single source of truth during a session.
// Populated from localStorage on first access (lazy hydration).
let _queue: CrmEvent[] | null = null

function getQueue(): CrmEvent[] {
  if (_queue !== null) return _queue
  _queue = loadFromStorage()
  return _queue
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

function loadFromStorage(): CrmEvent[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persistToStorage(events: CrmEvent[]): void {
  if (typeof window === 'undefined') return
  try {
    // Keep only the most recent MAX_QUEUE_SIZE events (ring-buffer behaviour).
    localStorage.setItem(QUEUE_KEY, JSON.stringify(events.slice(-MAX_QUEUE_SIZE)))
  } catch {
    // localStorage full or unavailable — fail silently.
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Add an event to the queue.
 * Silently ignores duplicates (same UUID already queued or already sent).
 */
export function enqueueEvent(event: CrmEvent): void {
  const queue = getQueue()
  const isDuplicate = queue.some((e) => e.id === event.id)
  if (isDuplicate) return
  queue.push(event)
  persistToStorage(queue)
}

/**
 * Return a snapshot of all queued events (oldest first).
 * Does NOT remove them — call removeEvents() after a successful send.
 */
export function drainQueue(): CrmEvent[] {
  return [...getQueue()]
}

/**
 * Remove events from the queue by their IDs.
 * Called by the sync engine after a successful batch POST.
 */
export function removeEvents(ids: string[]): void {
  if (ids.length === 0) return
  const idSet = new Set(ids)
  const queue = getQueue()
  _queue = queue.filter((e) => !idSet.has(e.id))
  persistToStorage(_queue)
}

/** How many events are currently waiting to be synced. */
export function queueSize(): number {
  return getQueue().length
}

/** Clear the entire queue. Dev / testing only. */
export function clearQueue(): void {
  _queue = []
  if (typeof window !== 'undefined') {
    localStorage.removeItem(QUEUE_KEY)
  }
}
