/**
 * /api/finance-admin/costs
 *
 * Manages owner-level cost entries (fixed, variable, pro-labore, fees, etc.)
 *
 * Supabase table: owner_costs
 *   id          uuid PK default gen_random_uuid()
 *   label       text NOT NULL                     -- short description
 *   description text                              -- optional long description
 *   category    text NOT NULL                     -- fixed | variable | prolabore | tax | platform | discount | other
 *   amount      integer NOT NULL                  -- centavos (always positive)
 *   period      text NOT NULL                     -- 'YYYY-MM' e.g. '2025-03'
 *   created_at  timestamptz NOT NULL default now()
 *   updated_at  timestamptz NOT NULL default now()
 *
 * GET  ?period=YYYY-MM  → list all costs for that month
 * POST             → create cost entry
 * DELETE ?id=xxx   → hard delete
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseServer'

export type CostCategory =
  | 'fixed'      // aluguel, salário fixo, contador…
  | 'variable'   // embalagem, gás, descartável…
  | 'prolabore'  // retirada do sócio
  | 'tax'        // impostos, taxas
  | 'platform'   // iFood, taxas plataforma
  | 'discount'   // descontos concedidos
  | 'other'

export interface OwnerCost {
  id: string
  label: string
  category: CostCategory
  amount: number   // centavos
  period: string   // YYYY-MM
  createdAt: string
}

const VALID_CATEGORIES: CostCategory[] = [
  'fixed', 'variable', 'prolabore', 'tax', 'platform', 'discount', 'other',
]

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

function mapRow(row: Record<string, unknown>): OwnerCost {
  return {
    id:        row.id        as string,
    label:     row.label     as string,
    category:  row.category  as CostCategory,
    amount:    row.amount    as number,
    period:    row.period    as string,
    createdAt: row.created_at as string,
  }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get('period')
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return err('period obrigatório no formato YYYY-MM')
  }

  const { data, error } = await supabase
    .from('owner_costs')
    .select('*')
    .eq('period', period)
    .order('category')
    .order('label')

  if (error) {
    console.warn('[finance-admin/costs] GET error (table may not exist yet):', error.message)
    return NextResponse.json({ costs: [], _warning: error.message })
  }

  return NextResponse.json({ costs: (data ?? []).map(mapRow) })
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return err('JSON inválido') }

  const label    = (body.label as string | undefined)?.trim()
  const category = body.category as string | undefined
  const amount   = Number(body.amount)
  const period   = (body.period as string | undefined)?.trim()

  if (!label)                                       return err('label obrigatório')
  if (!category || !VALID_CATEGORIES.includes(category as CostCategory))
                                                    return err(`category inválido — aceitos: ${VALID_CATEGORIES.join(', ')}`)
  if (!Number.isFinite(amount) || amount < 0)       return err('amount inválido')
  if (!period || !/^\d{4}-\d{2}$/.test(period))    return err('period obrigatório no formato YYYY-MM')

  const { data, error } = await supabase
    .from('owner_costs')
    .insert({ label, category, amount, period })
    .select()
    .single()

  if (error) {
    console.error('[finance-admin/costs] POST error:', error.message)
    return err(error.message, 500)
  }

  return NextResponse.json({ cost: mapRow(data as Record<string, unknown>) }, { status: 201 })
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return err('id obrigatório')

  const { error } = await supabase
    .from('owner_costs')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[finance-admin/costs] DELETE error:', error.message)
    return err(error.message, 500)
  }

  return NextResponse.json({ ok: true })
}
