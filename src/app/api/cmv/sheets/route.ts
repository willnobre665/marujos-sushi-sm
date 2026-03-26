/**
 * /api/cmv/sheets
 *
 * Supabase table: cmv_sheets
 *   id              uuid PK default gen_random_uuid()
 *   product_id      text NOT NULL   -- matches Produto.id from src/data/products.ts
 *   ingredient_id   uuid NOT NULL references cmv_ingredients(id)
 *   quantity_used   numeric NOT NULL  -- in ingredient's usage_unit
 *   created_at      timestamptz NOT NULL default now()
 *
 *   UNIQUE(product_id, ingredient_id)
 *
 * GET  /api/cmv/sheets?productId=X   → lines for one product
 * GET  /api/cmv/sheets               → all sheets (product_id list with line count)
 * POST /api/cmv/sheets               → upsert full sheet for a product
 *   body: { productId, lines: [{ ingredientId, quantityUsed }] }
 *   Replaces ALL existing lines for that product atomically.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/lib/supabaseServer'

export interface SheetLine {
  id: string
  productId: string
  ingredientId: string
  ingredientName: string
  usageUnit: string
  quantityUsed: number
  unitCost: number       // centavos per usageUnit
  lineCost: number       // centavos = unitCost * quantityUsed
}

export interface SheetSummary {
  productId: string
  lineCount: number
  totalCost: number   // centavos
}

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'supabase_not_configured' }, { status: 503 })
  const productId = req.nextUrl.searchParams.get('productId')

  if (productId) {
    // Full sheet for one product — join with ingredients
    const { data, error } = await supabase
      .from('cmv_sheets')
      .select(`
        id,
        product_id,
        quantity_used,
        ingredient_id,
        cmv_ingredients ( name, usage_unit, purchase_qty, purchase_cost )
      `)
      .eq('product_id', productId)
      .order('created_at')

    if (error) {
      console.error('[cmv/sheets] GET error:', error.message)
      return err(error.message, 500)
    }

    const lines: SheetLine[] = (data ?? []).map((row) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ing = (row as any).cmv_ingredients as {
        name: string; usage_unit: string; purchase_qty: number; purchase_cost: number
      }
      const unitCost = ing.purchase_qty > 0 ? ing.purchase_cost / ing.purchase_qty : 0
      const lineCost = unitCost * (row.quantity_used as number)
      return {
        id:             row.id as string,
        productId:      row.product_id as string,
        ingredientId:   row.ingredient_id as string,
        ingredientName: ing.name,
        usageUnit:      ing.usage_unit,
        quantityUsed:   row.quantity_used as number,
        unitCost,
        lineCost,
      }
    })

    return NextResponse.json({ lines })
  }

  // Summary — distinct product_ids with line count
  const { data, error } = await supabase
    .from('cmv_sheets')
    .select('product_id, ingredient_id, quantity_used, cmv_ingredients ( purchase_qty, purchase_cost )')

  if (error) {
    console.error('[cmv/sheets] GET all error:', error.message)
    return err(error.message, 500)
  }

  const map = new Map<string, { count: number; cost: number }>()
  for (const row of (data ?? [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ing = (row as any).cmv_ingredients as { purchase_qty: number; purchase_cost: number }
    const unitCost = ing.purchase_qty > 0 ? ing.purchase_cost / ing.purchase_qty : 0
    const lineCost = unitCost * (row.quantity_used as number)
    const pid = row.product_id as string
    const entry = map.get(pid) ?? { count: 0, cost: 0 }
    entry.count++
    entry.cost += lineCost
    map.set(pid, entry)
  }

  const summaries: SheetSummary[] = Array.from(map.entries()).map(([productId, v]) => ({
    productId,
    lineCount: v.count,
    totalCost: Math.round(v.cost),
  }))

  return NextResponse.json({ summaries })
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'supabase_not_configured' }, { status: 503 })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return err('JSON inválido') }

  const productId = (body.productId as string | undefined)?.trim()
  if (!productId) return err('productId obrigatório')

  const rawLines = body.lines as Array<{ ingredientId: string; quantityUsed: number }> | undefined
  if (!Array.isArray(rawLines) || rawLines.length === 0) return err('lines obrigatório e não vazio')

  for (const l of rawLines) {
    if (!l.ingredientId) return err('ingredientId obrigatório em cada linha')
    if (!Number.isFinite(Number(l.quantityUsed)) || Number(l.quantityUsed) <= 0)
      return err(`quantityUsed inválido para ingrediente ${l.ingredientId}`)
  }

  // Delete all existing lines for this product, then insert new ones
  const { error: delErr } = await supabase
    .from('cmv_sheets')
    .delete()
    .eq('product_id', productId)

  if (delErr) {
    console.error('[cmv/sheets] delete error:', delErr.message)
    return err(delErr.message, 500)
  }

  const rows = rawLines.map((l) => ({
    product_id:    productId,
    ingredient_id: l.ingredientId,
    quantity_used: Number(l.quantityUsed),
  }))

  const { data, error } = await supabase
    .from('cmv_sheets')
    .insert(rows)
    .select('id, product_id, ingredient_id, quantity_used')

  if (error) {
    console.error('[cmv/sheets] insert error:', error.message)
    return err(error.message, 500)
  }

  return NextResponse.json({ saved: (data ?? []).length }, { status: 201 })
}
