/**
 * /api/finance — Financial dashboard data.
 *
 * GET ?range=today|week
 *
 * Returns:
 *   - revenue:              total in centavos
 *   - orders:               count
 *   - avgTicket:            centavos
 *   - byPayment:            { [method]: { orders, revenue } }
 *   - byStatus:             { new, preparing, ready, delivered }
 *   - rangeStart:           ISO — start of the requested window
 *   - yesterdayRevenue:     centavos — only populated when range=today
 *   - weeklyAvgRevenue:     centavos — avg daily revenue over last 7 days (today excluded)
 *   - inactiveCustomerCount: customers with last_order_at < 30 days ago
 *
 * Source: crm_pedidos + crm_clientes. No heavy joins.
 * All non-cancelled statuses are counted for revenue.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseServer'

type Range = 'today' | 'week'

const EXCLUDED_STATUSES = ['cancelled']

function rangeStart(range: Range): string {
  const now = new Date()
  if (range === 'today') {
    const d = new Date(now)
    d.setUTCHours(0, 0, 0, 0)
    return d.toISOString()
  }
  const d = new Date(now)
  d.setUTCDate(d.getUTCDate() - 6)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const range: Range = searchParams.get('range') === 'week' ? 'week' : 'today'
  const since = rangeStart(range)

  const { data, error } = await supabase
    .from('crm_pedidos')
    .select('id, total, status, payment_method, created_at')
    .gte('created_at', since)
    .not('status', 'in', `(${EXCLUDED_STATUSES.map((s) => `"${s}"`).join(',')})`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[finance] query error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = data ?? []

  // ── Core metrics ────────────────────────────────────────────────────────────
  const revenue   = rows.reduce((sum, r) => sum + (r.total as number), 0)
  const orders    = rows.length
  const avgTicket = orders > 0 ? Math.round(revenue / orders) : 0

  // ── Payment breakdown ───────────────────────────────────────────────────────
  const byPayment: Record<string, { orders: number; revenue: number }> = {}
  for (const row of rows) {
    const method = (row.payment_method as string | null) ?? 'desconhecido'
    if (!byPayment[method]) byPayment[method] = { orders: 0, revenue: 0 }
    byPayment[method].orders++
    byPayment[method].revenue += row.total as number
  }

  // ── Status counts (live queue, unfiltered by date) ───────────────────────────
  const { data: statusData, error: statusError } = await supabase
    .from('crm_pedidos')
    .select('status')
    .in('status', ['new', 'preparing', 'ready', 'delivered'])

  if (statusError) {
    console.error('[finance] status query error:', statusError.message)
    return NextResponse.json({ error: statusError.message }, { status: 500 })
  }

  const byStatus = { new: 0, preparing: 0, ready: 0, delivered: 0 }
  for (const row of (statusData ?? [])) {
    const s = row.status as keyof typeof byStatus
    if (s in byStatus) byStatus[s]++
  }

  // ── Yesterday revenue (only for today range) ──────────────────────────────
  let yesterdayRevenue = 0
  if (range === 'today') {
    const yStart = new Date(); yStart.setUTCDate(yStart.getUTCDate() - 1); yStart.setUTCHours(0, 0, 0, 0)
    const yEnd   = new Date(); yEnd.setUTCHours(0, 0, 0, 0)
    const { data: yData } = await supabase
      .from('crm_pedidos')
      .select('total')
      .gte('created_at', yStart.toISOString())
      .lt('created_at', yEnd.toISOString())
      .not('status', 'in', `(${EXCLUDED_STATUSES.map((s) => `"${s}"`).join(',')})`)
    yesterdayRevenue = (yData ?? []).reduce((sum, r) => sum + (r.total as number), 0)
  }

  // ── Weekly average revenue (last 7 complete days, today excluded) ──────────
  let weeklyAvgRevenue = 0
  {
    const w7End   = new Date(); w7End.setUTCHours(0, 0, 0, 0)
    const w7Start = new Date(w7End); w7Start.setUTCDate(w7Start.getUTCDate() - 7)
    const { data: w7Data } = await supabase
      .from('crm_pedidos')
      .select('total, created_at')
      .gte('created_at', w7Start.toISOString())
      .lt('created_at', w7End.toISOString())
      .not('status', 'in', `(${EXCLUDED_STATUSES.map((s) => `"${s}"`).join(',')})`)
    if (w7Data && w7Data.length > 0) {
      const w7Total = w7Data.reduce((sum, r) => sum + (r.total as number), 0)
      weeklyAvgRevenue = Math.round(w7Total / 7)
    }
  }

  // ── Inactive customer count (last_order_at < 30 days ago) ─────────────────
  let inactiveCustomerCount = 0
  {
    const cutoff = new Date(); cutoff.setUTCDate(cutoff.getUTCDate() - 30)
    const { count } = await supabase
      .from('crm_clientes')
      .select('*', { count: 'exact', head: true })
      .lt('last_order_at', cutoff.toISOString())
    inactiveCustomerCount = count ?? 0
  }

  return NextResponse.json({
    range,
    rangeStart: since,
    revenue,
    orders,
    avgTicket,
    byPayment,
    byStatus,
    yesterdayRevenue,
    weeklyAvgRevenue,
    inactiveCustomerCount,
  })
}
