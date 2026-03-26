/**
 * /api/campaigns
 *
 * Full campaign management API.
 *
 * Supabase table: campaigns
 *   id               uuid PK default gen_random_uuid()
 *   campaign_name    text NOT NULL
 *   campaign_type    text NOT NULL   -- 'instagram' | 'google' | 'whatsapp' | 'email' | 'flyer' | 'other'
 *   status           text NOT NULL default 'draft'  -- 'draft' | 'active' | 'paused' | 'ended'
 *   utm_campaign     text           -- value used in links (matches crm_pedidos.attribution.utm_campaign)
 *   utm_source       text
 *   utm_medium       text
 *   start_date       date
 *   end_date         date
 *   description      text
 *   audience         text
 *   observations     text
 *   created_at       timestamptz NOT NULL default now()
 *   updated_at       timestamptz NOT NULL default now()
 *
 * GET  /api/campaigns              → list all campaigns
 * GET  /api/campaigns?id=xxx       → single campaign with live performance metrics
 * POST /api/campaigns              → create campaign
 * PUT  /api/campaigns?id=xxx       → update campaign (manual fields only)
 * DELETE /api/campaigns?id=xxx     → hard delete
 *
 * Performance metrics (read-only, computed on-the-fly):
 *   impacted_customers  — distinct customer_phone values that matched utm_campaign
 *   generated_orders    — orders attributed to this campaign
 *   total_revenue       — sum of order totals attributed
 *   cmv_impact          — estimated cost of goods for those orders
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseServer'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CampaignType   = 'instagram' | 'google' | 'whatsapp' | 'email' | 'flyer' | 'other'
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'ended'

export type TargetSegment = 'at_risk' | 'new_customer' | 'vip' | 'custom'
export type ExecutionFlow  = 'at_risk' | 'new_customer' | 'vip' | 'reactivation' | 'upsell'

export interface TargetingFilters {
  minOrderCount?:         number
  maxOrderCount?:         number
  minTotalSpent?:         number   // centavos
  maxDaysSinceLastOrder?: number
  minDaysSinceLastOrder?: number
}

export interface TargetingConfig {
  segment?: TargetSegment | null
  filters?: TargetingFilters
  flow?:    ExecutionFlow | null
}

export interface ExecutionStats {
  lastRunAt:         string
  targeted:          number
  inserted:          number
  skipped:           number
  converted:         number
  convertedRevenue:  number   // centavos
}

export interface Campaign {
  id:             string
  campaignName:   string
  campaignType:   CampaignType
  status:         CampaignStatus
  utmCampaign:    string | null
  utmSource:      string | null
  utmMedium:      string | null
  startDate:      string | null   // ISO date YYYY-MM-DD
  endDate:        string | null
  description:    string | null
  audience:       string | null
  observations:   string | null
  budgetTotal:    number | null   // centavos — planned media budget
  spend:          number | null   // centavos — actual media spend
  targeting:      TargetingConfig | null
  executionStats: ExecutionStats  | null
  createdAt:      string
  updatedAt:      string
}

export type CampaignClass = 'testing' | 'scaling' | 'profitable' | 'losing'

/** Classify a campaign based on ROAS. Returns null when spend is unknown. */
export function classifyCampaign(spend: number | null, revenueCentavos: number): CampaignClass | null {
  if (!spend || spend === 0) return null
  const roas = revenueCentavos / spend
  if (roas === 0)   return 'testing'
  if (roas < 1)     return 'losing'
  if (roas < 3)     return 'scaling'
  return 'profitable'
}

export interface CampaignMetrics {
  impactedCustomers: number
  generatedOrders:   number
  totalRevenue:      number   // centavos
  cmvImpact:         number   // centavos — estimated COGS for attributed orders
  avgTicket:         number   // centavos
  cmvPct:            number   // 0–100
}

export interface CampaignWithMetrics extends Campaign {
  metrics: CampaignMetrics
}

const VALID_TYPES:    CampaignType[]   = ['instagram', 'google', 'whatsapp', 'email', 'flyer', 'other']
const VALID_STATUSES: CampaignStatus[] = ['draft', 'active', 'paused', 'ended']

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

function mapRow(row: Record<string, unknown>): Campaign {
  return {
    id:             row.id            as string,
    campaignName:   row.campaign_name as string,
    campaignType:   row.campaign_type as CampaignType,
    status:         row.status        as CampaignStatus,
    utmCampaign:    (row.utm_campaign as string | null) ?? null,
    utmSource:      (row.utm_source   as string | null) ?? null,
    utmMedium:      (row.utm_medium   as string | null) ?? null,
    startDate:      (row.start_date   as string | null) ?? null,
    endDate:        (row.end_date     as string | null) ?? null,
    description:    (row.description  as string | null) ?? null,
    audience:       (row.audience     as string | null) ?? null,
    observations:   (row.observations as string | null) ?? null,
    budgetTotal:    (row.budget_total  as number | null) ?? null,
    spend:          (row.spend         as number | null) ?? null,
    targeting:      (row.targeting      as TargetingConfig | null) ?? null,
    executionStats: (row.execution_stats as ExecutionStats | null) ?? null,
    createdAt:      row.created_at    as string,
    updatedAt:      row.updated_at    as string,
  }
}

// ─── Attribution reader (mirrors manager/route.ts logic) ──────────────────────

function readUtmCampaign(attribution: unknown): string | null {
  if (!attribution || typeof attribution !== 'object') return null
  const attr = attribution as Record<string, unknown>

  if (attr.schema_version === 1) {
    return (attr.utm_campaign as string | null) ?? null
  }

  // v0 legacy: try lastTouch then firstTouch
  const last  = (attr.lastTouch  as Record<string, unknown> | null) ?? null
  const first = (attr.firstTouch as Record<string, unknown> | null) ?? null
  return (last?.utm_campaign ?? first?.utm_campaign ?? null) as string | null
}

// ─── Metrics computation ──────────────────────────────────────────────────────

async function computeMetrics(campaign: Campaign): Promise<CampaignMetrics> {
  const empty: CampaignMetrics = {
    impactedCustomers: 0, generatedOrders: 0,
    totalRevenue: 0, cmvImpact: 0, avgTicket: 0, cmvPct: 0,
  }

  // No utm_campaign set → can't match orders
  if (!campaign.utmCampaign) return empty

  // Fetch all orders in date range (if set) with their attribution + items
  let query = supabase
    .from('crm_pedidos')
    .select('id, customer_phone, total, items, attribution, created_at')
    .neq('status', 'cancelled')

  if (campaign.startDate) {
    query = query.gte('created_at', campaign.startDate + 'T00:00:00.000Z')
  }
  if (campaign.endDate) {
    query = query.lte('created_at', campaign.endDate + 'T23:59:59.999Z')
  }

  const { data: orders, error: ordersErr } = await query

  if (ordersErr) {
    console.error('[campaigns] metrics orders error:', ordersErr.message)
    return empty
  }

  // Filter to only orders attributed to this utm_campaign
  const matchingOrders = (orders ?? []).filter((o) =>
    readUtmCampaign(o.attribution) === campaign.utmCampaign
  )

  if (matchingOrders.length === 0) return empty

  const phones = new Set<string>()
  let totalRevenue = 0
  const soldMap = new Map<string, number>()  // productId → total qty

  for (const o of matchingOrders) {
    phones.add(o.customer_phone as string)
    totalRevenue += o.total as number

    const items = o.items as Array<{ productId: string; quantity: number }> | null
    if (Array.isArray(items)) {
      for (const item of items) {
        soldMap.set(item.productId, (soldMap.get(item.productId) ?? 0) + item.quantity)
      }
    }
  }

  // Compute CMV for matched products
  let cmvImpact = 0

  if (soldMap.size > 0) {
    const productIds = Array.from(soldMap.keys())

    const { data: sheetRows } = await supabase
      .from('cmv_sheets')
      .select('product_id, quantity_used, cmv_ingredients ( purchase_qty, purchase_cost )')
      .in('product_id', productIds)

    for (const row of (sheetRows ?? [])) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ing = (row as any).cmv_ingredients as { purchase_qty: number; purchase_cost: number }
      const unitCost = ing.purchase_qty > 0 ? ing.purchase_cost / ing.purchase_qty : 0
      const lineCost = unitCost * (row.quantity_used as number)
      const pid = row.product_id as string
      const qty = soldMap.get(pid) ?? 0
      cmvImpact += lineCost * qty
    }
  }

  cmvImpact = Math.round(cmvImpact)
  const generatedOrders   = matchingOrders.length
  const impactedCustomers = phones.size
  const avgTicket         = generatedOrders > 0 ? Math.round(totalRevenue / generatedOrders) : 0
  const cmvPct            = totalRevenue > 0 ? Math.round((cmvImpact / totalRevenue) * 1000) / 10 : 0

  return { impactedCustomers, generatedOrders, totalRevenue, cmvImpact, avgTicket, cmvPct }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')

  // Single campaign with metrics
  if (id) {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return err('Campanha não encontrada', 404)
      return err(error.message, 500)
    }

    const campaign = mapRow(data as Record<string, unknown>)
    const metrics  = await computeMetrics(campaign)

    return NextResponse.json({ campaign: { ...campaign, metrics } satisfies CampaignWithMetrics })
  }

  // Full list (no metrics — fast)
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('[campaigns] GET list error (table may not exist yet):', error.message)
    return NextResponse.json({ campaigns: [], _warning: error.message })
  }

  return NextResponse.json({ campaigns: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)) })
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return err('JSON inválido') }

  const campaignName = (body.campaignName as string | undefined)?.trim()
  const campaignType = body.campaignType as string | undefined
  const status       = (body.status as string | undefined) ?? 'draft'
  const utmCampaign  = (body.utmCampaign as string | undefined)?.trim() || null
  const utmSource    = (body.utmSource   as string | undefined)?.trim() || null
  const utmMedium    = (body.utmMedium   as string | undefined)?.trim() || null
  const startDate    = (body.startDate   as string | undefined)?.trim() || null
  const endDate      = (body.endDate     as string | undefined)?.trim() || null
  const description  = (body.description  as string | undefined)?.trim() || null
  const audience     = (body.audience     as string | undefined)?.trim() || null
  const observations = (body.observations as string | undefined)?.trim() || null
  const budgetTotal  = typeof body.budgetTotal === 'number' ? Math.round(body.budgetTotal) : null
  const spend        = typeof body.spend        === 'number' ? Math.round(body.spend)        : null
  const targeting    = (body.targeting != null && typeof body.targeting === 'object')
    ? body.targeting as TargetingConfig
    : null

  if (!campaignName)                                        return err('campaignName obrigatório')
  if (!campaignType || !VALID_TYPES.includes(campaignType as CampaignType))
                                                            return err(`campaignType inválido — aceitos: ${VALID_TYPES.join(', ')}`)
  if (!VALID_STATUSES.includes(status as CampaignStatus))  return err(`status inválido — aceitos: ${VALID_STATUSES.join(', ')}`)

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      campaign_name: campaignName, campaign_type: campaignType, status,
      utm_campaign: utmCampaign, utm_source: utmSource, utm_medium: utmMedium,
      start_date: startDate, end_date: endDate,
      description, audience, observations,
      budget_total: budgetTotal, spend,
      targeting,
    })
    .select()
    .single()

  if (error) {
    console.error('[campaigns] POST error:', error.message)
    return err(error.message, 500)
  }

  return NextResponse.json({ campaign: mapRow(data as Record<string, unknown>) }, { status: 201 })
}

// ─── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return err('id obrigatório')

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return err('JSON inválido') }

  const campaignName = (body.campaignName as string | undefined)?.trim()
  const campaignType = body.campaignType as string | undefined
  const status       = body.status as string | undefined
  const utmCampaign  = (body.utmCampaign as string | undefined)?.trim() || null
  const utmSource    = (body.utmSource   as string | undefined)?.trim() || null
  const utmMedium    = (body.utmMedium   as string | undefined)?.trim() || null
  const startDate    = (body.startDate   as string | undefined)?.trim() || null
  const endDate      = (body.endDate     as string | undefined)?.trim() || null
  const description  = (body.description  as string | undefined)?.trim() || null
  const audience     = (body.audience     as string | undefined)?.trim() || null
  const observations = (body.observations as string | undefined)?.trim() || null
  const budgetTotal  = typeof body.budgetTotal === 'number' ? Math.round(body.budgetTotal) : null
  const spend        = typeof body.spend        === 'number' ? Math.round(body.spend)        : null
  const targeting    = (body.targeting != null && typeof body.targeting === 'object')
    ? body.targeting as TargetingConfig
    : null

  if (!campaignName)                                                         return err('campaignName obrigatório')
  if (!campaignType || !VALID_TYPES.includes(campaignType as CampaignType)) return err(`campaignType inválido`)
  if (!status || !VALID_STATUSES.includes(status as CampaignStatus))        return err(`status inválido`)

  const { data, error } = await supabase
    .from('campaigns')
    .update({
      campaign_name: campaignName, campaign_type: campaignType, status,
      utm_campaign: utmCampaign, utm_source: utmSource, utm_medium: utmMedium,
      start_date: startDate, end_date: endDate,
      description, audience, observations,
      budget_total: budgetTotal, spend,
      targeting,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[campaigns] PUT error:', error.message)
    return err(error.message, 500)
  }

  return NextResponse.json({ campaign: mapRow(data as Record<string, unknown>) })
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return err('id obrigatório')

  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[campaigns] DELETE error:', error.message)
    return err(error.message, 500)
  }

  return NextResponse.json({ ok: true })
}
