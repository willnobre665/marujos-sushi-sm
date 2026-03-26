/**
 * /api/finance-admin/chart
 *
 * Revenue time-series for the main dashboard chart.
 *
 * GET ?range=today|7d|30d
 *
 * Returns:
 *   current:  { label: string; value: number }[]   — main series (centavos)
 *   compare:  { label: string; value: number }[]   — comparison series (prev day / prev period)
 *   range:    string echoed back
 *   rangeLabel: string  — human-readable range description
 *   compareLabel: string
 *   total:    number    — sum of current series (centavos)
 *   compareTotal: number
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseServer'

type Range = 'today' | '7d' | '30d'

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

/** Zero-filled array helper */
function zeroArray(n: number): number[] {
  return Array.from({ length: n }, () => 0)
}

/** Format 'YYYY-MM-DD HH' → 'HHh' label */
function hourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}h`
}

/** Format 'YYYY-MM-DD' → 'DD/MM' label */
function dayLabel(date: string): string {
  const [, m, d] = date.split('-')
  return `${parseInt(d)}/${parseInt(m)}`
}

export async function GET(req: NextRequest) {
  const range = (req.nextUrl.searchParams.get('range') ?? 'today') as Range
  if (!['today', '7d', '30d'].includes(range)) return err('range inválido')

  const now = new Date()

  // ─── TODAY: hourly buckets for current day, compare = yesterday same hours ──

  if (range === 'today') {
    const todayStr  = now.toISOString().slice(0, 10)            // YYYY-MM-DD
    const yd        = new Date(now)
    yd.setUTCDate(yd.getUTCDate() - 1)
    const ydStr     = yd.toISOString().slice(0, 10)

    const todayStart = `${todayStr}T00:00:00.000Z`
    const todayEnd   = `${todayStr}T23:59:59.999Z`
    const ydStart    = `${ydStr}T00:00:00.000Z`
    const ydEnd      = `${ydStr}T23:59:59.999Z`

    const [todayRes, ydRes] = await Promise.all([
      supabase
        .from('crm_pedidos')
        .select('total, created_at')
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd)
        .not('status', 'in', '("cancelled")'),
      supabase
        .from('crm_pedidos')
        .select('total, created_at')
        .gte('created_at', ydStart)
        .lte('created_at', ydEnd)
        .not('status', 'in', '("cancelled")'),
    ])

    if (todayRes.error) {
      console.error('[finance/chart] today error:', todayRes.error.message)
      return err(todayRes.error.message, 500)
    }

    // Build hourly buckets (0–23)
    const currentBuckets = zeroArray(24)
    const compareBuckets = zeroArray(24)

    for (const row of (todayRes.data ?? [])) {
      const h = new Date(row.created_at as string).getUTCHours()
      currentBuckets[h] += row.total as number
    }
    for (const row of (ydRes.data ?? [])) {
      const h = new Date(row.created_at as string).getUTCHours()
      compareBuckets[h] += row.total as number
    }

    // Trim to current hour (don't show future hours)
    const currentHour = now.getUTCHours()
    const labels = Array.from({ length: currentHour + 1 }, (_, i) => hourLabel(i))

    return NextResponse.json({
      range,
      rangeLabel:    'Hoje',
      compareLabel:  'Ontem',
      current:       labels.map((label, i) => ({ label, value: currentBuckets[i] })),
      compare:       labels.map((label, i) => ({ label, value: compareBuckets[i] })),
      total:         currentBuckets.slice(0, currentHour + 1).reduce((s, v) => s + v, 0),
      compareTotal:  compareBuckets.slice(0, currentHour + 1).reduce((s, v) => s + v, 0),
    })
  }

  // ─── 7d / 30d: daily buckets ───────────────────────────────────────────────

  const days = range === '7d' ? 7 : 30

  // Current period: last N days ending today
  const currentEnd   = new Date(now)
  currentEnd.setUTCHours(23, 59, 59, 999)
  const currentStart = new Date(now)
  currentStart.setUTCDate(currentStart.getUTCDate() - (days - 1))
  currentStart.setUTCHours(0, 0, 0, 0)

  // Compare period: same length immediately before current period
  const compareEnd   = new Date(currentStart)
  compareEnd.setUTCMilliseconds(-1)
  const compareStart = new Date(compareEnd)
  compareStart.setUTCDate(compareStart.getUTCDate() - (days - 1))
  compareStart.setUTCHours(0, 0, 0, 0)

  const [currentRes, compareRes] = await Promise.all([
    supabase
      .from('crm_pedidos')
      .select('total, created_at')
      .gte('created_at', currentStart.toISOString())
      .lte('created_at', currentEnd.toISOString())
      .not('status', 'in', '("cancelled")'),
    supabase
      .from('crm_pedidos')
      .select('total, created_at')
      .gte('created_at', compareStart.toISOString())
      .lte('created_at', compareEnd.toISOString())
      .not('status', 'in', '("cancelled")'),
  ])

  if (currentRes.error) {
    console.error('[finance/chart] daily error:', currentRes.error.message)
    return err(currentRes.error.message, 500)
  }

  // Build date-keyed maps
  const currentMap = new Map<string, number>()
  const compareMap = new Map<string, number>()

  for (const row of (currentRes.data ?? [])) {
    const d = (row.created_at as string).slice(0, 10)
    currentMap.set(d, (currentMap.get(d) ?? 0) + (row.total as number))
  }
  for (const row of (compareRes.data ?? [])) {
    const d = (row.created_at as string).slice(0, 10)
    compareMap.set(d, (compareMap.get(d) ?? 0) + (row.total as number))
  }

  // Generate day sequences
  const currentDays: { label: string; value: number }[] = []
  const compareDays: { label: string; value: number }[] = []

  for (let i = 0; i < days; i++) {
    const cd = new Date(currentStart)
    cd.setUTCDate(cd.getUTCDate() + i)
    const cdStr = cd.toISOString().slice(0, 10)
    currentDays.push({ label: dayLabel(cdStr), value: currentMap.get(cdStr) ?? 0 })

    const pd = new Date(compareStart)
    pd.setUTCDate(pd.getUTCDate() + i)
    const pdStr = pd.toISOString().slice(0, 10)
    compareDays.push({ label: dayLabel(pdStr), value: compareMap.get(pdStr) ?? 0 })
  }

  const rangeLabel    = range === '7d' ? 'Últimos 7 dias' : 'Últimos 30 dias'
  const compareLabel  = range === '7d' ? '7 dias anteriores' : '30 dias anteriores'

  return NextResponse.json({
    range,
    rangeLabel,
    compareLabel,
    current:      currentDays,
    compare:      compareDays,
    total:        currentDays.reduce((s, d) => s + d.value, 0),
    compareTotal: compareDays.reduce((s, d) => s + d.value, 0),
  })
}
