/**
 * /api/cmv/ingredients/[id]
 *
 * PUT    → update ingredient
 * DELETE → soft-delete (active = false)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseServer'
import type { CmvIngredient } from '../route'
import type { StockCategory } from '@/lib/stockCategories'

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

// ─── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

  const updatePayload: Record<string, unknown> = {
    name, supplier_name: supplierName, category,
    purchase_unit: purchaseUnit, usage_unit: usageUnit,
    purchase_qty: purchaseQty, purchase_cost: purchaseCost,
  }

  const { data, error } = await supabase
    .from('cmv_ingredients')
    .update(updatePayload)
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    console.error('[cmv/ingredients] PUT error:', error.message)
    return err(error.message, 500)
  }

  return NextResponse.json({ ingredient: mapRow(data as Record<string, unknown>) })
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await supabase
    .from('cmv_ingredients')
    .update({ active: false })
    .eq('id', params.id)

  if (error) {
    console.error('[cmv/ingredients] DELETE error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
