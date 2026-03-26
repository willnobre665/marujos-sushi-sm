/**
 * POST /api/crm/automations/bulk
 *
 * Bulk actions on automation log entries.
 *
 * Body: { action: 'send_pending' | 'reprocess_failed' | 'cancel_pending' }
 *
 * Actions:
 *   send_pending     — delegates to /api/crm/automations/process (same logic)
 *   reprocess_failed — moves failed entries with attempt_count < 3 back to pending
 *   cancel_pending   — sets all pending entries to skipped with skip_reason = 'manually cancelled'
 *
 * Response:
 *   { action, affected: number, detail?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseServer'

const MAX_ATTEMPTS = 3

type BulkAction = 'send_pending' | 'reprocess_failed' | 'cancel_pending'
const VALID_ACTIONS: BulkAction[] = ['send_pending', 'reprocess_failed', 'cancel_pending']

export async function POST(req: NextRequest) {
  let body: { action?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = body.action as BulkAction | undefined
  if (!action || !VALID_ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: `action inválido — aceitos: ${VALID_ACTIONS.join(', ')}` },
      { status: 400 }
    )
  }

  // ── send_pending ──────────────────────────────────────────────────────────
  if (action === 'send_pending') {
    // Delegate to the process endpoint internally by calling the same logic
    // via a loopback fetch so we don't duplicate code.
    const base = req.nextUrl.origin
    const res  = await fetch(`${base}/api/crm/automations/process`, {
      method: 'POST',
      headers: {
        'x-automation-secret': process.env.AUTOMATION_SECRET ?? '',
        'Content-Type': 'application/json',
      },
    })
    const json = await res.json() as { processed?: number; sent?: number; failed?: number; error?: string }
    if (!res.ok) return NextResponse.json({ error: json.error ?? 'process failed' }, { status: 502 })
    return NextResponse.json({ action, affected: json.sent ?? 0, detail: `sent=${json.sent} failed=${json.failed}` })
  }

  // ── reprocess_failed ──────────────────────────────────────────────────────
  if (action === 'reprocess_failed') {
    const { data: targets, error: fetchErr } = await supabase
      .from('crm_automations_log')
      .select('id')
      .eq('status', 'failed')
      .lt('attempt_count', MAX_ATTEMPTS)

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    if (!targets || targets.length === 0) {
      return NextResponse.json({ action, affected: 0, detail: 'no retryable failed entries' })
    }

    const ids = targets.map((t) => t.id as string)

    const { error: updateErr } = await supabase
      .from('crm_automations_log')
      .update({ status: 'pending', last_error: null, processing_at: null })
      .in('id', ids)
      .eq('status', 'failed') // idempotency guard

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    console.log(`[bulk] reprocess_failed: ${ids.length} entries moved back to pending`)
    return NextResponse.json({ action, affected: ids.length })
  }

  // ── cancel_pending ────────────────────────────────────────────────────────
  if (action === 'cancel_pending') {
    const { data: targets, error: fetchErr } = await supabase
      .from('crm_automations_log')
      .select('id')
      .eq('status', 'pending')

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    if (!targets || targets.length === 0) {
      return NextResponse.json({ action, affected: 0, detail: 'no pending entries' })
    }

    const ids = targets.map((t) => t.id as string)

    const { error: updateErr } = await supabase
      .from('crm_automations_log')
      .update({ status: 'skipped', skip_reason: 'manually cancelled' })
      .in('id', ids)
      .eq('status', 'pending') // idempotency guard

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    console.log(`[bulk] cancel_pending: ${ids.length} entries cancelled`)
    return NextResponse.json({ action, affected: ids.length })
  }

  // Unreachable, but satisfies TypeScript
  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
