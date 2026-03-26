/**
 * /api/cmv/ingredients
 *
 * Supabase table: cmv_ingredients
 *   id              uuid PK default gen_random_uuid()
 *   name            text NOT NULL
 *   supplier_name   text            -- optional supplier name
 *   category        text            -- 'insumo_alimentar' | 'bebida' | 'embalagem' | 'limpeza' | 'descartavel' | 'outro'
 *   purchase_unit   text NOT NULL   -- e.g. 'kg', 'L', 'unidade'
 *   usage_unit      text NOT NULL   -- e.g. 'g', 'ml', 'unidade'
 *   purchase_qty    numeric NOT NULL  -- how much you get per purchase (in usage_unit)
 *   purchase_cost   integer NOT NULL  -- centavos for the whole purchase
 *   unit_cost       numeric GENERATED ALWAYS AS (purchase_cost::numeric / purchase_qty) STORED
 *                   -- OR computed on read (we compute on read to avoid generated column complexity)
 *   current_stock   numeric NOT NULL default 0
 *   minimum_stock   numeric NOT NULL default 0
 *   active          boolean NOT NULL default true
 *   created_at      timestamptz NOT NULL default now()
 *
 * GET  /api/cmv/ingredients         → list all active stock items
 * POST /api/cmv/ingredients         → create stock item
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/lib/supabaseServer'
import type { StockCategory } from '@/lib/stockCategories'

export type { StockCategory }

export interface CmvIngredient {
  id: string
  name: string
  supplierName: string | null
  category: StockCategory | null
  purchaseUnit: string         // e.g. 'pacote 1kg', 'garrafa 1L'
  usageUnit: string            // e.g. 'g', 'ml', 'unidade'
  purchaseQty: number          // how many usageUnits per purchase (e.g. 1000 g per kg)
  purchaseCost: number         // centavos
  unitCost: number             // centavos per usageUnit = purchaseCost / purchaseQty
  currentStock: number         // current stock in usageUnit
  minimumStock: number         // minimum stock threshold — triggers low-stock alert
  active: boolean
}

function mapRow(row: Record<string, unknown>): CmvIngredient {
  const purchaseQty  = row.purchase_qty  as number
  const purchaseCost = row.purchase_cost as number
  return {
    id:           row.id           as string,
    name:         row.name         as string,
    supplierName: (row.supplier_name as string | null) ?? null,
    category:     (row.category    as StockCategory | null) ?? null,
    purchaseUnit: row.purchase_unit as string,
    usageUnit:    row.usage_unit   as string,
    purchaseQty,
    purchaseCost,
    unitCost:     purchaseQty > 0 ? purchaseCost / purchaseQty : 0,
    currentStock: (row.current_stock as number | null) ?? 0,
    minimumStock: (row.minimum_stock as number | null) ?? 0,
    active:       row.active       as boolean,
  }
}

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'supabase_not_configured' }, { status: 503 })
  const { data, error } = await supabase
    .from('cmv_ingredients')
    .select('*')
    .eq('active', true)
    .order('name')

  if (error) {
    console.error('[cmv/ingredients] GET error:', error.message)
    return err(error.message, 500)
  }

  return NextResponse.json({ ingredients: (data ?? []).map(mapRow) })
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'supabase_not_configured' }, { status: 503 })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return err('JSON inválido') }

  const name         = (body.name as string | undefined)?.trim()
  const supplierName = (body.supplierName as string | undefined)?.trim() || null
  const category     = (body.category as string | undefined) || null
  const purchaseUnit = (body.purchaseUnit as string | undefined)?.trim()
  const usageUnit    = (body.usageUnit as string | undefined)?.trim()
  const purchaseQty  = Number(body.purchaseQty)
  const purchaseCost = Number(body.purchaseCost)

  if (!name)                                    return err('name obrigatório')
  if (!purchaseUnit)                            return err('purchaseUnit obrigatório')
  if (!usageUnit)                               return err('usageUnit obrigatório')
  if (!Number.isFinite(purchaseQty) || purchaseQty <= 0)  return err('purchaseQty inválido')
  if (!Number.isFinite(purchaseCost) || purchaseCost < 0) return err('purchaseCost inválido')

  const { data, error } = await supabase
    .from('cmv_ingredients')
    .insert({ name, supplier_name: supplierName, category, purchase_unit: purchaseUnit, usage_unit: usageUnit, purchase_qty: purchaseQty, purchase_cost: purchaseCost })
    .select()
    .single()

  if (error) {
    console.error('[cmv/ingredients] POST error:', error.message)
    return err(error.message, 500)
  }

  return NextResponse.json({ ingredient: mapRow(data as Record<string, unknown>) }, { status: 201 })
}
