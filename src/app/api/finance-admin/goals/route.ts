/**
 * /api/finance-admin/goals
 *
 * Manages owner-level monthly goals.
 *
 * Supabase table: finance_goals
 *   id               uuid PK default gen_random_uuid()
 *   period           text NOT NULL UNIQUE   -- 'YYYY-MM'
 *   revenue_target   integer                -- centavos
 *   max_cmv_pct      numeric(5,2)           -- e.g. 35.00
 *   min_net_margin_pct numeric(5,2)           -- e.g. 15.00
 *   avg_ticket_target integer               -- centavos
 *   created_at       timestamptz NOT NULL default now()
 *   updated_at       timestamptz NOT NULL default now()
 *
 * GET  ?period=YYYY-MM  → get goals for period (returns empty defaults if none)
 * PUT  ?period=YYYY-MM  → upsert goals for period
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseServer'

export interface FinanceGoal {
  period:           string
  revenueTarget:    number | null   // centavos
  maxCmvPct:        number | null   // 0–100
  minNetMargin:     number | null   // 0–100
  avgTicketTarget:  number | null   // centavos
}

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

function mapRow(row: Record<string, unknown>): FinanceGoal {
  return {
    period:          row.period           as string,
    revenueTarget:   (row.revenue_target  as number | null) ?? null,
    maxCmvPct:       (row.max_cmv_pct     as number | null) ?? null,
    minNetMargin:    (row.min_net_margin_pct  as number | null) ?? null,
    avgTicketTarget: (row.avg_ticket_target as number | null) ?? null,
  }
}

const EMPTY_GOAL = (period: string): FinanceGoal => ({
  period, revenueTarget: null, maxCmvPct: null, minNetMargin: null, avgTicketTarget: null,
})

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get('period')
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return err('period obrigatório no formato YYYY-MM')
  }

  const { data, error } = await supabase
    .from('finance_goals')
    .select('*')
    .eq('period', period)
    .maybeSingle()

  if (error) {
    // Table may not exist yet — return empty defaults
    console.warn('[finance-admin/goals] GET error (table may not exist):', error.message)
    return NextResponse.json({ goal: EMPTY_GOAL(period) })
  }

  return NextResponse.json({ goal: data ? mapRow(data as Record<string, unknown>) : EMPTY_GOAL(period) })
}

// ─── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  const period = req.nextUrl.searchParams.get('period')
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return err('period obrigatório no formato YYYY-MM')
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return err('JSON inválido') }

  const revenueTarget   = body.revenueTarget   != null ? Number(body.revenueTarget)   : null
  const maxCmvPct       = body.maxCmvPct       != null ? Number(body.maxCmvPct)       : null
  const minNetMargin    = body.minNetMargin     != null ? Number(body.minNetMargin)    : null
  const avgTicketTarget = body.avgTicketTarget  != null ? Number(body.avgTicketTarget) : null

  const { data, error } = await supabase
    .from('finance_goals')
    .upsert({
      period,
      revenue_target:    revenueTarget,
      max_cmv_pct:       maxCmvPct,
      min_net_margin_pct: minNetMargin,
      avg_ticket_target: avgTicketTarget,
      updated_at:        new Date().toISOString(),
    }, { onConflict: 'period' })
    .select()
    .single()

  if (error) {
    console.error('[finance-admin/goals] PUT error:', error.message)
    return err(error.message, 500)
  }

  return NextResponse.json({ goal: mapRow(data as Record<string, unknown>) })
}
