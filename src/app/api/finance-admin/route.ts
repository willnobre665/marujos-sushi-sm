/**
 * /api/finance-admin
 *
 * Owner-only financial dashboard aggregation.
 *
 * GET ?period=YYYY-MM
 *
 * Aggregates from existing tables (no new joins):
 *   - Revenue & orders → crm_pedidos
 *   - CMV (total cost of goods) → cmv_sheets + cmv_ingredients + crm_pedidos.items
 *   - Owner costs → owner_costs (fixed, variable, pro-labore, tax, platform, discount)
 *   - Revenue by UTM campaign → crm_pedidos.attribution
 *
 * Returns:
 *   overview:   { grossRevenue, netRevenue, estimatedProfit, cmvPct, avgTicket, totalOrders }
 *   costs:      { fixed, variable, prolabore, tax, platform, discount, other, totalCosts }
 *   results:    { grossMargin, grossMarginPct, netMargin, netMarginPct }
 *   byChannel:  { channel, orders, revenue, avgTicket, sharePct }[]
 *   byCampaign: { campaign, orders, revenue, cmvCost, contribution }[]
 *   byPayment:  { method, orders, revenue }[]
 *   period:     string  (YYYY-MM echoed back)
 *   rangeStart / rangeEnd: ISO strings
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseServer'

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

/**
 * Derives a canonical marketing channel from the order's attribution and source fields.
 *
 * Priority:
 *   1. utm_source  — explicit, most reliable
 *   2. utm_medium  — fallback when source is absent
 *   3. source      — crm_pedidos.source column (e.g. 'qrcode', 'whatsapp', 'instagram')
 *   4. fbclid/gclid — infer social/search from click IDs
 *   5. '(direto)'  — no signal available
 *
 * The returned string is always lowercase and normalised to one of the known
 * channel keys, so the frontend can map it to a display label.
 */
function deriveChannel(attribution: unknown, source: string | null): string {
  const attr = (attribution && typeof attribution === 'object')
    ? attribution as Record<string, unknown>
    : null

  // Extract flat UTM fields — handle both v1 (flat) and v0 (lastTouch/firstTouch) shapes
  let utmSource:   string | null = null
  let utmMedium:   string | null = null
  let fbclid:      string | null = null
  let gclid:       string | null = null

  if (attr) {
    if (attr.schema_version === 1) {
      utmSource  = (attr.utm_source  as string | null) ?? null
      utmMedium  = (attr.utm_medium  as string | null) ?? null
      fbclid     = (attr.fbclid      as string | null) ?? null
      gclid      = (attr.gclid       as string | null) ?? null
    } else {
      const last  = (attr.lastTouch  as Record<string, unknown> | null) ?? null
      const first = (attr.firstTouch as Record<string, unknown> | null) ?? null
      const pick  = (f: string) => ((last?.[f] ?? first?.[f]) as string | undefined) ?? null
      utmSource  = pick('utm_source')
      utmMedium  = pick('utm_medium')
      fbclid     = pick('fbclid')
      gclid      = pick('gclid')
    }
  }

  // Normalise to lowercase for matching
  const src = utmSource?.toLowerCase().trim() ?? null
  const med = utmMedium?.toLowerCase().trim() ?? null
  const ord = source?.toLowerCase().trim() ?? null

  // ── Match rules (first match wins) ────────────────────────────────────────

  // 1. utm_source — explicit channel set by marketer
  if (src) {
    if (src.includes('instagram') || src.includes('ig'))  return 'instagram'
    if (src.includes('whatsapp')  || src.includes('wa'))  return 'whatsapp'
    if (src.includes('google')    || src.includes('ggl')) return 'google'
    if (src.includes('facebook')  || src.includes('fb'))  return 'facebook'
    if (src.includes('tiktok'))                           return 'tiktok'
    if (src.includes('email')     || src.includes('mail'))return 'email'
    if (src.includes('salao')     || src.includes('qr') || src.includes('mesa')) return 'salão'
    // unknown utm_source — return it as-is (capitalised)
    return src
  }

  // 2. utm_medium — channel category
  if (med) {
    if (med === 'social' || med === 'social-media') {
      // gclid → Google, fbclid → Facebook, else generic social
      if (fbclid) return 'facebook'
      if (gclid)  return 'google'
      return 'social'
    }
    if (med === 'cpc' || med === 'paid-search') return gclid ? 'google' : 'pago'
    if (med === 'email' || med === 'newsletter') return 'email'
    if (med === 'whatsapp')                      return 'whatsapp'
    if (med === 'qr' || med === 'qrcode')        return 'salão'
  }

  // 3. crm_pedidos.source column
  if (ord) {
    if (ord === 'instagram' || ord === 'ig')         return 'instagram'
    if (ord === 'whatsapp'  || ord === 'wa')         return 'whatsapp'
    if (ord === 'google')                            return 'google'
    if (ord === 'facebook'  || ord === 'fb')         return 'facebook'
    if (ord === 'qrcode'    || ord === 'qr' || ord === 'salao' || ord === 'mesa') return 'salão'
    if (ord === 'retirada'  || ord === 'takeaway')   return 'retirada'
    if (ord === 'delivery'  || ord === 'ifood')      return 'delivery'
    return ord   // preserve unknown source values verbatim
  }

  // 4. Click IDs with no source/medium
  if (fbclid) return 'facebook'
  if (gclid)  return 'google'

  return '(direto)'
}

/** Returns [startISO, endISO] for the given YYYY-MM period */
function periodRange(period: string): [string, string] {
  const [y, m] = period.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end   = new Date(Date.UTC(y, m, 1))       // exclusive upper bound
  return [start.toISOString(), end.toISOString()]
}

export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get('period')
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return err('period obrigatório no formato YYYY-MM')
  }

  const [rangeStart, rangeEnd] = periodRange(period)

  // ── 1. Fetch orders for the period ────────────────────────────────────────
  const { data: orders, error: ordersErr } = await supabase
    .from('crm_pedidos')
    .select('id, total, status, payment_method, items, attribution, source, created_at')
    .gte('created_at', rangeStart)
    .lt('created_at', rangeEnd)
    .not('status', 'in', '("cancelled")')

  if (ordersErr) {
    console.error('[finance-admin] orders error:', ordersErr.message)
    return err(ordersErr.message, 500)
  }

  const orderRows = orders ?? []

  // ── 2. Aggregate gross revenue & by-payment ────────────────────────────────
  const grossRevenue = orderRows.reduce((s, r) => s + (r.total as number), 0)
  const totalOrders  = orderRows.length
  const avgTicket    = totalOrders > 0 ? Math.round(grossRevenue / totalOrders) : 0

  const byPaymentMap = new Map<string, { orders: number; revenue: number }>()
  for (const row of orderRows) {
    const method = (row.payment_method as string | null) ?? 'desconhecido'
    const entry  = byPaymentMap.get(method) ?? { orders: 0, revenue: 0 }
    entry.orders++
    entry.revenue += row.total as number
    byPaymentMap.set(method, entry)
  }
  const byPayment = Array.from(byPaymentMap.entries())
    .map(([method, v]) => ({ method, ...v }))
    .sort((a, b) => b.revenue - a.revenue)

  // ── 3. CMV: compute total cost of goods sold ───────────────────────────────
  // Build soldMap: productId → { name, qty, revenue }
  const soldMap = new Map<string, { name: string; qty: number; revenue: number }>()

  for (const order of orderRows) {
    const items = order.items as Array<{
      productId: string; productName: string
      unitPrice: number; quantity: number; total: number
    }> | null
    if (!Array.isArray(items)) continue
    for (const item of items) {
      const e = soldMap.get(item.productId) ?? { name: item.productName, qty: 0, revenue: 0 }
      e.qty     += item.quantity
      e.revenue += item.total
      soldMap.set(item.productId, e)
    }
  }

  let totalCmvCost = 0

  if (soldMap.size > 0) {
    const productIds = Array.from(soldMap.keys())

    const { data: sheetRows, error: sheetsErr } = await supabase
      .from('cmv_sheets')
      .select('product_id, quantity_used, cmv_ingredients ( purchase_qty, purchase_cost )')
      .in('product_id', productIds)

    if (sheetsErr) {
      console.error('[finance-admin] sheets error:', sheetsErr.message)
      return err(sheetsErr.message, 500)
    }

    // Build product → unit cost map
    const costMap = new Map<string, number>()
    for (const row of (sheetRows ?? [])) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ing = (row as any).cmv_ingredients as { purchase_qty: number; purchase_cost: number }
      const unitCost = ing.purchase_qty > 0 ? ing.purchase_cost / ing.purchase_qty : 0
      const lineCost = unitCost * (row.quantity_used as number)
      const pid = row.product_id as string
      costMap.set(pid, (costMap.get(pid) ?? 0) + lineCost)
    }

    for (const [pid, sold] of Array.from(soldMap.entries())) {
      const unitCost = costMap.get(pid) ?? 0
      totalCmvCost += unitCost * sold.qty
    }
  }

  totalCmvCost = Math.round(totalCmvCost)
  const cmvPct = grossRevenue > 0 ? (totalCmvCost / grossRevenue) * 100 : 0

  // ── 4. Owner costs for the period ─────────────────────────────────────────
  const { data: costRows, error: costsErr } = await supabase
    .from('owner_costs')
    .select('category, amount')
    .eq('period', period)

  // Soft-fail: if owner_costs table doesn't exist yet, continue with zeros
  if (costsErr) {
    console.warn('[finance-admin] costs query failed (table may not exist yet):', costsErr.message)
  }

  const costsByCategory: Record<string, number> = {
    fixed: 0, variable: 0, prolabore: 0, tax: 0, platform: 0, discount: 0, other: 0,
  }
  for (const row of (costRows ?? [])) {
    const cat = row.category as string
    if (cat in costsByCategory) {
      costsByCategory[cat] += row.amount as number
    } else {
      costsByCategory.other += row.amount as number
    }
  }
  const totalOwnerCosts = Object.values(costsByCategory).reduce((s, v) => s + v, 0)

  // ── 5. Revenue by campaign (from attribution UTM) ─────────────────────────
  const campaignMap = new Map<string, { orders: number; revenue: number; productIds: Map<string, number> }>()

  for (const order of orderRows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attr = order.attribution as any
    const campaign: string = attr?.utm_campaign ?? attr?.lastTouch?.utm_campaign ?? '(orgânico)'

    const entry = campaignMap.get(campaign) ?? { orders: 0, revenue: 0, productIds: new Map() }
    entry.orders++
    entry.revenue += order.total as number

    // Track sold products for CMV calculation per campaign
    const items = order.items as Array<{ productId: string; quantity: number }> | null
    if (Array.isArray(items)) {
      for (const item of items) {
        entry.productIds.set(
          item.productId,
          (entry.productIds.get(item.productId) ?? 0) + item.quantity,
        )
      }
    }

    campaignMap.set(campaign, entry)
  }

  // We need the costMap for campaign CMV — re-derive it
  const campaignCostMap = new Map<string, number>()

  if (soldMap.size > 0) {
    const productIds = Array.from(soldMap.keys())
    const { data: sheetRows2 } = await supabase
      .from('cmv_sheets')
      .select('product_id, quantity_used, cmv_ingredients ( purchase_qty, purchase_cost )')
      .in('product_id', productIds)

    for (const row of (sheetRows2 ?? [])) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ing = (row as any).cmv_ingredients as { purchase_qty: number; purchase_cost: number }
      const unitCost = ing.purchase_qty > 0 ? ing.purchase_cost / ing.purchase_qty : 0
      const lineCost = unitCost * (row.quantity_used as number)
      const pid = row.product_id as string
      campaignCostMap.set(pid, (campaignCostMap.get(pid) ?? 0) + lineCost)
    }
  }

  const byCampaign = Array.from(campaignMap.entries()).map(([campaign, v]) => {
    let cmvCost = 0
    for (const [pid, qty] of Array.from(v.productIds.entries())) {
      cmvCost += (campaignCostMap.get(pid) ?? 0) * qty
    }
    cmvCost = Math.round(cmvCost)
    return {
      campaign,
      orders:       v.orders,
      revenue:      v.revenue,
      cmvCost,
      contribution: v.revenue - cmvCost,  // gross contribution margin
    }
  }).sort((a, b) => b.revenue - a.revenue)

  // ── 6. Result metrics ─────────────────────────────────────────────────────
  // netRevenue = grossRevenue - discounts
  const discounts   = costsByCategory.discount
  const netRevenue  = grossRevenue - discounts

  // grossMargin = netRevenue - CMV
  const grossMargin    = netRevenue - totalCmvCost
  const grossMarginPct = netRevenue > 0 ? (grossMargin / netRevenue) * 100 : 0

  // totalOperationalCosts = non-discount owner costs (CMV is separate)
  const totalOperationalCosts = totalOwnerCosts - discounts

  // netMargin = grossMargin - all other costs
  const netMargin    = grossMargin - totalOperationalCosts
  const netMarginPct = netRevenue > 0 ? (netMargin / netRevenue) * 100 : 0

  // estimatedProfit = netMargin (after all costs including pro-labore)
  const estimatedProfit = netMargin

  // ── 7. Daily revenue breakdown (for sparkline chart) ──────────────────────
  const dailyMap = new Map<string, number>()  // 'YYYY-MM-DD' → revenue centavos
  for (const order of orderRows) {
    const day = (order.created_at as string).slice(0, 10)
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + (order.total as number))
  }
  const dailyRevenue = Array.from(dailyMap.entries())
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // ── 8. By channel ─────────────────────────────────────────────────────────
  const channelMap = new Map<string, { orders: number; revenue: number }>()

  for (const order of orderRows) {
    const channel = deriveChannel(
      order.attribution,
      (order as Record<string, unknown>).source as string | null,
    )
    const entry = channelMap.get(channel) ?? { orders: 0, revenue: 0 }
    entry.orders++
    entry.revenue += order.total as number
    channelMap.set(channel, entry)
  }

  const byChannel = Array.from(channelMap.entries())
    .map(([channel, v]) => ({
      channel,
      orders:   v.orders,
      revenue:  v.revenue,
      avgTicket: v.orders > 0 ? Math.round(v.revenue / v.orders) : 0,
      sharePct:  grossRevenue > 0 ? Math.round((v.revenue / grossRevenue) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  // ── 9. Top products ───────────────────────────────────────────────────────
  const topProducts = Array.from(soldMap.entries())
    .map(([pid, { name, qty, revenue }]) => ({
      productId: pid,
      name,
      qty,
      revenue,
      cmvCost: Math.round((campaignCostMap.get(pid) ?? 0) * qty),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  return NextResponse.json({
    period,
    rangeStart,
    rangeEnd,
    overview: {
      grossRevenue,
      netRevenue,
      estimatedProfit,
      cmvPct: Math.round(cmvPct * 10) / 10,
      avgTicket,
      totalOrders,
      totalCmvCost,
    },
    costs: {
      ...costsByCategory,
      totalCosts: totalOwnerCosts,
    },
    results: {
      grossMargin,
      grossMarginPct: Math.round(grossMarginPct * 10) / 10,
      netMargin,
      netMarginPct: Math.round(netMarginPct * 10) / 10,
    },
    byChannel,
    byCampaign,
    byPayment,
    dailyRevenue,
    topProducts,
  })
}
