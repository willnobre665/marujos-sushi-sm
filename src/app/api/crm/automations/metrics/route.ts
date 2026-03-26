/**
 * GET /api/crm/automations/metrics
 *
 * Returns summary metrics for the automations dashboard.
 *
 * Sending metrics:
 *   pending               — total pending entries
 *   sent_today            — entries sent today (UTC)
 *   failed_today          — entries failed today
 *   send_rate_today       — sent / (sent + failed) today, as 0–100
 *   potential_revenue_pending    — estimated revenue from pending entries (centavos)
 *   potential_revenue_sent_today — estimated revenue from entries sent today (centavos)
 *
 * Recovery (attribution) metrics:
 *   recovered_today         — entries attributed to a customer order today
 *   recovered_revenue_today — total centavos recovered today
 *   recovery_rate           — recovered / sent_total (all time), as 0–100
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

function extractAvgTicket(triggerData: Record<string, unknown> | null): number {
  if (!triggerData) return 0
  const total  = triggerData.totalSpentCentavos as number | undefined
  const orders = triggerData.orderCount         as number | undefined
  if (!total || !orders || orders === 0) return 0
  return Math.round(total / orders)
}

export async function GET() {
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayStartStr = todayStart.toISOString()

  const [pendingRes, todayRes, recoveredTodayRes, recoveryRateRes] = await Promise.all([
    // Pending entries for potential revenue
    supabase
      .from('crm_automations_log')
      .select('id, trigger_data')
      .eq('status', 'pending'),

    // Sent + failed today for send metrics
    supabase
      .from('crm_automations_log')
      .select('id, status, trigger_data, sent_at')
      .in('status', ['sent', 'failed'])
      .gte('triggered_at', todayStartStr),

    // Recovered entries with recovered_at today
    supabase
      .from('crm_automations_log')
      .select('id, recovered_revenue_centavos')
      .gte('recovered_at', todayStartStr)
      .not('recovered_at', 'is', null),

    // All-time: total sent vs total recovered (for recovery_rate)
    supabase
      .from('crm_automations_log')
      .select('id, recovered_at')
      .eq('status', 'sent'),
  ])

  const pendingEntries      = pendingRes.data          ?? []
  const todayEntries        = todayRes.data            ?? []
  const recoveredTodayRows  = recoveredTodayRes.data   ?? []
  const allSentRows         = recoveryRateRes.data     ?? []

  const sentToday   = todayEntries.filter((e) => e.status === 'sent')
  const failedToday = todayEntries.filter((e) => e.status === 'failed')

  const totalAttemptedToday = sentToday.length + failedToday.length
  const sendRateToday = totalAttemptedToday === 0
    ? 0
    : Math.round((sentToday.length / totalAttemptedToday) * 100)

  const potentialRevenuePending = pendingEntries.reduce(
    (sum, e) => sum + extractAvgTicket(e.trigger_data as Record<string, unknown> | null),
    0,
  )

  const potentialRevenueSentToday = sentToday.reduce(
    (sum, e) => sum + extractAvgTicket(e.trigger_data as Record<string, unknown> | null),
    0,
  )

  const recoveredToday = recoveredTodayRows.length
  const recoveredRevenueToday = recoveredTodayRows.reduce(
    (sum, e) => sum + ((e.recovered_revenue_centavos as number) ?? 0),
    0,
  )

  const totalSent      = allSentRows.length
  const totalRecovered = allSentRows.filter((e) => e.recovered_at !== null).length
  const recoveryRate   = totalSent === 0
    ? 0
    : Math.round((totalRecovered / totalSent) * 100)

  return NextResponse.json({
    // Sending
    pending:                      pendingEntries.length,
    sent_today:                   sentToday.length,
    failed_today:                 failedToday.length,
    send_rate_today:              sendRateToday,
    potential_revenue_pending:    potentialRevenuePending,
    potential_revenue_sent_today: potentialRevenueSentToday,
    // Recovery
    recovered_today:         recoveredToday,
    recovered_revenue_today: recoveredRevenueToday,
    recovery_rate:           recoveryRate,
  })
}
