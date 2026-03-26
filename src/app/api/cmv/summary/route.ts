/**
 * /api/cmv/summary
 *
 * GET ?range=today|week|month
 *
 * Reads crm_pedidos.items (JSONB snapshot) for the period,
 * matches each sold product_id against cmv_sheets,
 * and computes:
 *   - per-product: sale price, cost, margin, CMV%
 *   - overall: total revenue, total cost, blended CMV%
 *
 * Products without a technical sheet are flagged as "sem ficha".
 * Sale price comes from the order snapshot (items[].unitPrice) — never from products.ts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseServer'

type Range = 'today' | 'week' | 'month'

function rangeStart(range: Range): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  if (range === 'today') return d.toISOString()
  if (range === 'week')  { d.setUTCDate(d.getUTCDate() - 6);  return d.toISOString() }
  /* month */              d.setUTCDate(d.getUTCDate() - 29); return d.toISOString()
}

export interface CmvProductLine {
  productId: string
  productName: string
  qtySold: number
  avgSalePrice: number   // centavos — weighted avg from order snapshots
  totalRevenue: number   // centavos
  unitCost: number       // centavos — from technical sheet
  totalCost: number      // centavos
  grossMargin: number    // centavos
  cmvPct: number         // 0–100
  hasSheet: boolean
}

export interface CmvSummaryResponse {
  range: Range
  rangeStart: string
  totalRevenue: number
  totalCost: number
  blendedCmvPct: number
  coveredRevenuePct: number   // % of revenue from products with sheets
  lines: CmvProductLine[]
}

export async function GET(req: NextRequest) {
  const rangeParam = req.nextUrl.searchParams.get('range')
  const range: Range =
    rangeParam === 'week' ? 'week' :
    rangeParam === 'month' ? 'month' :
    'today'

  const since = rangeStart(range)

  // ── 1. Fetch sold orders in range ──────────────────────────────────────────
  const { data: orders, error: ordersErr } = await supabase
    .from('crm_pedidos')
    .select('items')
    .gte('created_at', since)
    .not('status', 'in', '("cancelled")')

  if (ordersErr) {
    console.error('[cmv/summary] orders error:', ordersErr.message)
    return NextResponse.json({ error: ordersErr.message }, { status: 500 })
  }

  // Aggregate sold quantities and revenue per product_id
  const soldMap = new Map<string, { name: string; qty: number; revenue: number }>()

  for (const order of (orders ?? [])) {
    const items = order.items as Array<{
      productId: string
      productName: string
      unitPrice: number
      quantity: number
      total: number
    }> | null

    if (!Array.isArray(items)) continue

    for (const item of items) {
      const pid = item.productId
      const entry = soldMap.get(pid) ?? { name: item.productName, qty: 0, revenue: 0 }
      entry.qty     += item.quantity
      entry.revenue += item.total
      soldMap.set(pid, entry)
    }
  }

  if (soldMap.size === 0) {
    return NextResponse.json({
      range, rangeStart: since,
      totalRevenue: 0, totalCost: 0, blendedCmvPct: 0, coveredRevenuePct: 0,
      lines: [],
    } satisfies CmvSummaryResponse)
  }

  // ── 2. Fetch sheets for sold products ──────────────────────────────────────
  const productIds = Array.from(soldMap.keys())

  const { data: sheetRows, error: sheetsErr } = await supabase
    .from('cmv_sheets')
    .select('product_id, quantity_used, cmv_ingredients ( purchase_qty, purchase_cost )')
    .in('product_id', productIds)

  if (sheetsErr) {
    console.error('[cmv/summary] sheets error:', sheetsErr.message)
    return NextResponse.json({ error: sheetsErr.message }, { status: 500 })
  }

  // Build product_id → unit cost map
  const costMap = new Map<string, number>()  // product_id → total unit cost (centavos)

  for (const row of (sheetRows ?? [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ing = (row as any).cmv_ingredients as { purchase_qty: number; purchase_cost: number }
    const unitCost = ing.purchase_qty > 0 ? ing.purchase_cost / ing.purchase_qty : 0
    const lineCost = unitCost * (row.quantity_used as number)
    const pid = row.product_id as string
    costMap.set(pid, (costMap.get(pid) ?? 0) + lineCost)
  }

  // ── 3. Build lines ─────────────────────────────────────────────────────────
  const lines: CmvProductLine[] = []

  for (const [productId, sold] of Array.from(soldMap.entries())) {
    const hasSheet = costMap.has(productId)
    const unitCost = hasSheet ? Math.round(costMap.get(productId)!) : 0
    const avgSalePrice = sold.qty > 0 ? Math.round(sold.revenue / sold.qty) : 0
    const totalCost    = unitCost * sold.qty
    const grossMargin  = sold.revenue - totalCost
    const cmvPct       = sold.revenue > 0 ? (totalCost / sold.revenue) * 100 : 0

    lines.push({
      productId,
      productName:   sold.name,
      qtySold:       sold.qty,
      avgSalePrice,
      totalRevenue:  sold.revenue,
      unitCost,
      totalCost,
      grossMargin,
      cmvPct,
      hasSheet,
    })
  }

  // Sort by revenue descending
  lines.sort((a, b) => b.totalRevenue - a.totalRevenue)

  // ── 4. Totals ──────────────────────────────────────────────────────────────
  const totalRevenue = lines.reduce((s, l) => s + l.totalRevenue, 0)
  const coveredRevenue = lines
    .filter((l) => l.hasSheet)
    .reduce((s, l) => s + l.totalRevenue, 0)
  const totalCost = lines
    .filter((l) => l.hasSheet)
    .reduce((s, l) => s + l.totalCost, 0)
  const blendedCmvPct = coveredRevenue > 0 ? (totalCost / coveredRevenue) * 100 : 0
  const coveredRevenuePct = totalRevenue > 0 ? (coveredRevenue / totalRevenue) * 100 : 0

  return NextResponse.json({
    range, rangeStart: since,
    totalRevenue,
    totalCost,
    blendedCmvPct,
    coveredRevenuePct,
    lines,
  } satisfies CmvSummaryResponse)
}
