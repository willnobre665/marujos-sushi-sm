/**
 * GET /api/cron/automations-recover
 *
 * Vercel Cron entry point — runs revenue attribution scan.
 * Schedule: every 30 minutes at :10 :40 (see vercel.json)
 *
 * Checks sent automation messages and attributes revenue from
 * orders placed after the message was sent.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseServer'

const BATCH_LIMIT = 100

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (
    process.env.NODE_ENV === 'production' &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()

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
    console.error('[cron/automations-recover] fetch error:', fetchErr.message)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  const batch = entries ?? []
  let attributed           = 0
  let totalRevenueCentavos = 0

  for (const entry of batch) {
    const phone  = entry.customer_phone as string
    const sentAt = entry.sent_at        as string

    const { data: orders, error: orderErr } = await supabase
      .from('crm_pedidos')
      .select('id, total, created_at')
      .eq('customer_phone', phone)
      .gt('created_at', sentAt)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true })
      .limit(1)

    if (orderErr || !orders || orders.length === 0) continue

    const order = orders[0]

    const { error: updateErr } = await supabase
      .from('crm_automations_log')
      .update({
        recovered_at:               order.created_at,
        recovered_revenue_centavos: order.total as number,
      })
      .eq('id', entry.id)
      .is('recovered_at', null)

    if (updateErr) continue

    attributed++
    totalRevenueCentavos += order.total as number
  }

  const durationMs = Date.now() - startedAt
  console.log(`[cron/automations-recover] done — scanned=${batch.length} attributed=${attributed} revenue=${totalRevenueCentavos} (${durationMs}ms)`)

  return NextResponse.json({ ok: true, scanned: batch.length, attributed, total_revenue_centavos: totalRevenueCentavos, durationMs })
}
