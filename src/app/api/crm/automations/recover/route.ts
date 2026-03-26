/**
 * POST /api/crm/automations/recover
 *
 * Revenue attribution scan.
 *
 * For each sent automation log entry that has not yet been attributed:
 *   1. Look up orders by customer_phone placed AFTER sent_at
 *   2. Take the earliest such order (first order after message)
 *   3. Set recovered_at = order.created_at, recovered_revenue_centavos = order.total
 *
 * Idempotent: only updates entries where recovered_at IS NULL.
 * Safe to run repeatedly — duplicate attribution is prevented at the query level.
 *
 * Auth:
 *   - Requires X-Automation-Secret header in production
 *
 * Response:
 *   { scanned, attributed, total_revenue_centavos, durationMs }
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseServer'

const BATCH_LIMIT = 100

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    const secret = req.headers.get('x-automation-secret')
    if (!secret || secret !== process.env.AUTOMATION_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const startedAt = Date.now()

  // ── 1. Fetch sent entries that have not been attributed yet ───────────────
  const { data: entries, error: fetchErr } = await supabase
    .from('crm_automations_log')
    .select('id, customer_phone, sent_at')
    .eq('status', 'sent')
    .is('recovered_at', null)
    .not('customer_phone', 'is', null)
    .not('sent_at', 'is', null)
    .order('sent_at', { ascending: true })
    .limit(BATCH_LIMIT)

  if (fetchErr) {
    console.error('[recover] fetch error:', fetchErr.message)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  const batch = entries ?? []
  console.log(`[recover] scanning ${batch.length} unattributed sent entries`)

  let attributed          = 0
  let totalRevenueCentavos = 0

  for (const entry of batch) {
    const phone  = entry.customer_phone as string
    const sentAt = entry.sent_at        as string

    // ── 2. Find the first order by this phone placed after sent_at ──────────
    const { data: orders, error: orderErr } = await supabase
      .from('crm_pedidos')
      .select('id, total, created_at')
      .eq('customer_phone', phone)
      .gt('created_at', sentAt)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true })
      .limit(1)

    if (orderErr) {
      console.warn(`[recover] order lookup error for ${phone}:`, orderErr.message)
      continue
    }

    if (!orders || orders.length === 0) continue

    const order   = orders[0]
    const revenue = order.total as number

    // ── 3. Attribute recovery ─────────────────────────────────────────────────
    // Use .is('recovered_at', null) as idempotency guard
    const { error: updateErr } = await supabase
      .from('crm_automations_log')
      .update({
        recovered_at:               order.created_at,
        recovered_revenue_centavos: revenue,
      })
      .eq('id', entry.id)
      .is('recovered_at', null)  // only update if not already attributed

    if (updateErr) {
      console.error(`[recover] update error for entry ${entry.id}:`, updateErr.message)
      continue
    }

    attributed++
    totalRevenueCentavos += revenue
    console.log(`[recover] attributed → entry ${entry.id} / ${phone} / revenue=${revenue}`)
  }

  const durationMs = Date.now() - startedAt
  console.log(`[recover] done — scanned=${batch.length} attributed=${attributed} revenue=${totalRevenueCentavos} (${durationMs}ms)`)

  return NextResponse.json({
    scanned:                batch.length,
    attributed,
    total_revenue_centavos: totalRevenueCentavos,
    durationMs,
  })
}
