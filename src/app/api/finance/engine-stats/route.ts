/**
 * GET /api/finance/engine-stats
 *
 * Returns real conversion rates per flow and hourly execution count.
 * Used by the finance dashboard to replace static impact estimates.
 *
 * Response:
 *   {
 *     conversionRates: {
 *       reactivation: number   // 0–100, real recovery_rate for this flow
 *       upsell:       number
 *     }
 *     execLastHour:   number   // auto-executions in the last 60 minutes
 *     execToday:      number   // auto-executions since midnight UTC
 *   }
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseServer'

export async function GET() {
  const now      = new Date()
  const hourAgo  = new Date(now); hourAgo.setUTCHours(hourAgo.getUTCHours() - 1)
  const dayStart = new Date(now); dayStart.setUTCHours(0, 0, 0, 0)

  const [reactivationStats, upsellStats, execHourRes, execTodayRes] = await Promise.all([
    // Reactivation flow: sent vs recovered
    supabase
      .from('crm_automations_log')
      .select('id, recovered_at')
      .eq('flow', 'reactivation')
      .eq('status', 'sent'),

    // Upsell flow: sent vs recovered
    supabase
      .from('crm_automations_log')
      .select('id, recovered_at')
      .eq('flow', 'upsell')
      .eq('status', 'sent'),

    // Auto-executions in the last hour
    supabase
      .from('crm_automations_log')
      .select('id')
      .gte('triggered_at', hourAgo.toISOString())
      .contains('trigger_data', { source: 'auto' }),

    // Auto-executions today
    supabase
      .from('crm_automations_log')
      .select('id')
      .gte('triggered_at', dayStart.toISOString())
      .contains('trigger_data', { source: 'auto' }),
  ])

  function convRate(rows: Array<{ recovered_at: string | null }> | null): number {
    const all = rows ?? []
    if (all.length === 0) return 15  // no data → default 15%
    const recovered = all.filter((r) => r.recovered_at !== null).length
    return Math.round((recovered / all.length) * 100)
  }

  return NextResponse.json({
    conversionRates: {
      reactivation: convRate((reactivationStats.data ?? []) as Array<{ recovered_at: string | null }>),
      upsell:       convRate((upsellStats.data       ?? []) as Array<{ recovered_at: string | null }>),
    },
    execLastHour: (execHourRes.data  ?? []).length,
    execToday:    (execTodayRes.data ?? []).length,
  })
}
