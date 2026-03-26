/**
 * /api/cmv/stock/debug?orderId=X
 *
 * READ-ONLY diagnostic — shows exactly why stock deduction would or would not fire
 * for a given order. Does NOT write anything.
 *
 * Returns:
 *  - order items (raw from DB)
 *  - product_ids extracted from items
 *  - all product_ids that exist in cmv_sheets
 *  - matched / unmatched product_ids
 *  - sheet rows for matched products
 *  - projected consumption map
 *  - any existing stock_movements for this order (idempotency state)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseServer'

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('orderId')
  if (!orderId) {
    return NextResponse.json({ error: 'orderId obrigatório' }, { status: 400 })
  }

  const result: Record<string, unknown> = { orderId }

  // ── Order items ─────────────────────────────────────────────────────────────
  const { data: orderRow, error: orderErr } = await supabase
    .from('crm_pedidos')
    .select('id, status, items')
    .eq('id', orderId)
    .single()

  if (orderErr || !orderRow) {
    return NextResponse.json({ error: 'order not found', detail: orderErr?.message }, { status: 404 })
  }

  result.orderStatus  = orderRow.status
  result.rawItems     = orderRow.items

  const items = orderRow.items as Array<{ productId?: string; quantity?: number; [k: string]: unknown }> | null

  const soldMap: Record<string, number> = {}
  if (Array.isArray(items)) {
    for (const item of items) {
      if (item.productId && (item.quantity ?? 0) > 0) {
        soldMap[item.productId] = (soldMap[item.productId] ?? 0) + (item.quantity as number)
      }
    }
  }

  const productIdsFromOrder = Object.keys(soldMap)
  result.soldMap            = soldMap
  result.productIdsFromOrder = productIdsFromOrder

  // ── All product_ids known in cmv_sheets ────────────────────────────────────
  const { data: allSheets } = await supabase
    .from('cmv_sheets')
    .select('product_id, ingredient_id, quantity_used')

  const allSheetPids = [...new Set((allSheets ?? []).map((r) => r.product_id as string))]
  result.allProductIdsInCmvSheets = allSheetPids

  // ── Match analysis ─────────────────────────────────────────────────────────
  const matched   = productIdsFromOrder.filter((pid) => allSheetPids.includes(pid))
  const unmatched = productIdsFromOrder.filter((pid) => !allSheetPids.includes(pid))
  result.matchedProductIds   = matched
  result.unmatchedProductIds = unmatched

  // ── Sheet rows for matched products ───────────────────────────────────────
  const matchedSheets = (allSheets ?? []).filter((r) => matched.includes(r.product_id as string))
  result.matchedSheetRows = matchedSheets

  // ── Projected consumption ─────────────────────────────────────────────────
  const consumptionMap: Record<string, number> = {}
  for (const row of matchedSheets) {
    const pid     = row.product_id as string
    const ingId   = row.ingredient_id as string
    const qtyUsed = row.quantity_used as number
    const qtySold = soldMap[pid] ?? 0
    consumptionMap[ingId] = (consumptionMap[ingId] ?? 0) + qtyUsed * qtySold
  }
  result.projectedConsumption = consumptionMap

  // ── Existing movements (idempotency state) ─────────────────────────────────
  const { data: existingMv } = await supabase
    .from('stock_movements')
    .select('id, ingredient_id, type, quantity, created_at')
    .eq('related_order_id', orderId)

  result.existingMovements    = existingMv ?? []
  result.alreadyDeducted      = (existingMv ?? []).length > 0

  // ── Verdict ────────────────────────────────────────────────────────────────
  let verdict = 'OK — would deduct'
  if ((existingMv ?? []).length > 0)          verdict = 'SKIP — already_deducted'
  else if (productIdsFromOrder.length === 0)  verdict = 'SKIP — no_items'
  else if (matched.length === 0)              verdict = 'SKIP — no_sheets (no matching product_id in cmv_sheets)'
  else if (Object.keys(consumptionMap).length === 0) verdict = 'SKIP — no_consumption'

  result.verdict = verdict

  return NextResponse.json(result, { status: 200 })
}
