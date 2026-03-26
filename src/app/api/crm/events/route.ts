/**
 * POST /api/crm/events
 *
 * Receives a batch of CRM events from the frontend event queue.
 * Validates, persists raw event log, then routes each event to its processor.
 *
 * Request body:
 *   { "events": CrmEvent[] }   // 1–100 events per batch
 *
 * Response (2xx):
 *   { "received": number, "persisted": number, "errors": ProcessingError[] | [] }
 *
 * Response (400):
 *   { "error": string, "details"?: unknown }
 *
 * Response (503):
 *   { "error": "supabase_not_configured", "message": string }
 *
 * Design:
 * - "received" = events that passed Zod validation.
 * - "persisted" = events where raw log write AND processor both succeeded.
 * - "errors" = per-event failures (visible in dev, omitted in production).
 * - The frontend interprets any 2xx as "acknowledged" and removes events from
 *   its retry queue. In production, write failures are logged server-side.
 *   A future improvement: return 5xx when ALL writes fail so the frontend retries.
 */

import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, getSupabaseConfigError } from '@/lib/supabaseServer'
import { EventBatchSchema } from './schemas'
import {
  processCustomerIdentified,
  processOptIn,
  processOptOut,
  processOrderCreated,
  processOrderCompleted,
} from './processors'
import { appendRawEvent } from './rawEventLog'

const isDev = process.env.NODE_ENV !== 'production'

interface ProcessingError {
  eventId: string
  eventName: string
  stage: 'raw_log' | 'processor'
  error: string
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Config check ───────────────────────────────────────────────────────────
  if (!isSupabaseConfigured()) {
    const reason = getSupabaseConfigError()
    console.error('[CRM events] Supabase not configured:', reason)
    return NextResponse.json(
      { error: 'supabase_not_configured', message: reason },
      { status: 503 }
    )
  }

  // ── Parse ──────────────────────────────────────────────────────────────────
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // ── Validate ───────────────────────────────────────────────────────────────
  const result = EventBatchSchema.safeParse(body)
  if (!result.success) {
    console.warn('[CRM events] Validation failed:', result.error.flatten())
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 }
    )
  }

  const { events } = result.data
  console.log(`[CRM events] batch received: ${events.length} event(s) — ${events.map(e => e.payload.event).join(', ')}`)
  let persisted = 0
  const processingErrors: ProcessingError[] = []

  // ── Process each event ─────────────────────────────────────────────────────
  for (const event of events) {
    const eventName = event.payload.event
    console.log(`[CRM events] processing: ${eventName} (${event.id})`)

    // 1. Raw log — must succeed for the event to be considered persisted.
    let rawLogOk = false
    try {
      await appendRawEvent(event)
      rawLogOk = true
      console.log(`[CRM events] raw_log OK: ${eventName} (${event.id})`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[CRM events] raw_log FAILED for ${eventName} (${event.id}):`, msg)
      processingErrors.push({ eventId: event.id, eventName, stage: 'raw_log', error: msg })
    }

    // 2. Structured processor.
    let processorOk = false
    try {
      switch (eventName) {
        case 'customer_identified': await processCustomerIdentified(event); break
        case 'customer_opt_in':     await processOptIn(event);              break
        case 'customer_opt_out':    await processOptOut(event);             break
        case 'order_created':       await processOrderCreated(event);       break
        case 'order_completed':     await processOrderCompleted(event);     break
        default: break  // add_to_cart, upsell_clicked: raw log only
      }
      processorOk = true
      console.log(`[CRM events] processor OK: ${eventName} (${event.id})`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[CRM events] processor FAILED for ${eventName} (${event.id}):`, msg)
      processingErrors.push({ eventId: event.id, eventName, stage: 'processor', error: msg })
    }

    if (rawLogOk && processorOk) persisted++
  }

  console.log(`[CRM events] done: ${persisted}/${events.length} persisted, ${processingErrors.length} error(s)`)
  if (processingErrors.length > 0) {
    console.error('[CRM events] processing errors:', JSON.stringify(processingErrors, null, 2))
  }

  return NextResponse.json({
    received: events.length,
    persisted,
    // Expose error details in dev so the debug panel can show them.
    // In production this field is omitted to avoid leaking internals.
    ...(isDev ? { errors: processingErrors } : {}),
  })
}
