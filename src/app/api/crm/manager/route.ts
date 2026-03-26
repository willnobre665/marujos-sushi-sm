/**
 * GET /api/crm/manager
 *
 * CRM manager read API. Three views:
 *
 *   ?view=list    — paginated customer list with segmentation
 *   ?view=detail  — single customer full detail
 *   ?view=campaigns — revenue aggregated by utm_campaign
 *
 * List query params:
 *   ?consent=transactional|relational|promotional|none
 *   ?segment=vip|frequente|ativo|dias_20_30|dias_30_45|dias_50_plus|novo
 *   ?minOrders=N
 *   ?source=instagram|qr|google|whatsapp|direct
 *   ?campaign=<utm_campaign substring>
 *   ?since=YYYY-MM-DD   — last_order_at >= date
 *   ?until=YYYY-MM-DD   — last_order_at <= date
 *   ?page=N             — 1-based, default 1
 *   ?limit=N            — default 50, max 200
 *   ?sort=last_order|order_count|total_spent   — default last_order
 *
 * Segmentation rules (priority order — higher overrides lower):
 *   vip         — order_count >= 5 (overrides all)
 *   frequente   — order_count 2–4 (overrides time segments)
 *   novo        — order_count = 1 (first purchase)
 *   ativo       — last_order_at within 0–20 days
 *   dias_20_30  — last_order_at 20–30 days ago
 *   dias_30_45  — last_order_at 30–45 days ago
 *   dias_50_plus — last_order_at 50+ days ago
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured, getSupabaseConfigError } from '@/lib/supabaseServer'

// ─── Types returned to the client ─────────────────────────────────────────────

export type CustomerSegment = 'vip' | 'frequente' | 'ativo' | 'dias_20_30' | 'dias_30_45' | 'dias_50_plus' | 'novo' | 'none'

export interface ManagerCliente {
  phone: string
  name: string
  email: string | null
  orderCount: number
  totalSpentCentavos: number
  lastOrderAt: string | null
  daysSinceLastOrder: number | null
  firstSeenAt: string
  consentOrderUpdates: boolean | null
  consentRelational: boolean | null
  consentPromotional: boolean | null
  segmentTags: string[]       // stored tags from crm_clientes
  segment: CustomerSegment    // computed segment for quick filtering
  // From latest order
  latestSource: string | null
  latestCampaign: string | null
  // Operator suppression
  suppressedUntil:  string | null   // ISO timestamptz — null = not suppressed
  suppressedReason: string | null
  suppressedBy:     string | null
}

export interface ManagerPedidoAttribution {
  utm_source:   string | null
  utm_medium:   string | null
  utm_campaign: string | null
  utm_content:  string | null
  utm_term:     string | null
  fbclid:       string | null
  gclid:        string | null
  referrer:     string | null
  landing_path: string | null
}

export interface ManagerPedido {
  id: string
  createdAt: string
  status: string
  context: string
  source: string
  total: number
  items: unknown
  attribution: ManagerPedidoAttribution | null
}

export interface ManagerConsentLog {
  id: number
  category: string
  granted: boolean
  grantedAt: string
  source: string
}

export interface ManagerDetail {
  cliente: ManagerCliente
  pedidos: ManagerPedido[]
  consentLogs: ManagerConsentLog[]
}

export interface ManagerListResponse {
  customers: ManagerCliente[]
  total: number
  page: number
  limit: number
}

export interface CampaignStat {
  campaign: string        // utm_campaign value, or '__none__' for unattributed
  orders: number
  revenue: number         // centavos
  customers: number       // distinct phones
}

export interface CampaignsResponse {
  campaigns: CampaignStat[]
}

// ─── Attribution reader ───────────────────────────────────────────────────────
//
// Reads attribution from a crm_pedidos row regardless of storage shape:
//   v1 (schema_version: 1) — flat fields are present and authoritative
//   v0 (legacy)            — only firstTouch/lastTouch present; derive flat fields
//
// Always returns an object with string | null for each field so callers never
// need to guard against missing keys or undefined.

interface NormalizedAttr {
  utm_source:   string | null
  utm_medium:   string | null
  utm_campaign: string | null
  utm_content:  string | null
  utm_term:     string | null
  fbclid:       string | null
  gclid:        string | null
  referrer:     string | null
  landing_path: string | null
}

function readAttribution(raw: unknown): NormalizedAttr {
  const empty: NormalizedAttr = {
    utm_source: null, utm_medium: null, utm_campaign: null,
    utm_content: null, utm_term: null, fbclid: null, gclid: null,
    referrer: null, landing_path: null,
  }

  if (!raw || typeof raw !== 'object') return empty
  const attr = raw as Record<string, unknown>

  // v1: schema_version present — flat fields are authoritative
  if (attr.schema_version === 1) {
    return {
      utm_source:   (attr.utm_source   as string | null) ?? null,
      utm_medium:   (attr.utm_medium   as string | null) ?? null,
      utm_campaign: (attr.utm_campaign as string | null) ?? null,
      utm_content:  (attr.utm_content  as string | null) ?? null,
      utm_term:     (attr.utm_term     as string | null) ?? null,
      fbclid:       (attr.fbclid       as string | null) ?? null,
      gclid:        (attr.gclid        as string | null) ?? null,
      referrer:     (attr.referrer     as string | null) ?? null,
      landing_path: (attr.landing_path as string | null) ?? null,
    }
  }

  // v0: only touch records present — derive flat fields, lastTouch preferred
  const last  = (attr.lastTouch  as Record<string, unknown> | null) ?? null
  const first = (attr.firstTouch as Record<string, unknown> | null) ?? null

  function pick(field: string): string | null {
    const v = (last?.[field] ?? first?.[field]) as string | undefined
    return v ?? null
  }

  return {
    utm_source:   pick('utm_source'),
    utm_medium:   pick('utm_medium'),
    utm_campaign: pick('utm_campaign'),
    utm_content:  pick('utm_content'),
    utm_term:     pick('utm_term'),
    fbclid:       pick('fbclid'),
    gclid:        pick('gclid'),
    referrer:     pick('referrer'),
    landing_path: pick('landing_path'),
  }
}

// ─── Segmentation helpers ─────────────────────────────────────────────────────

const VIP_MIN_ORDERS       = 5
const FREQUENTE_MIN_ORDERS = 2   // 2–4 orders = frequente
const DAYS_ATIVO           = 20
const DAYS_20_30           = 30
const DAYS_30_45           = 45
const DAYS_50_PLUS         = 50

function computeSegment(row: {
  order_count: number
  total_spent_centavos: number
  last_order_at: string | null
}): CustomerSegment {
  if (row.order_count === 0) return 'none'

  // VIP: 5+ orders — overrides everything
  if (row.order_count >= VIP_MIN_ORDERS) return 'vip'

  // Frequente: 2–4 orders — overrides time-based segments
  if (row.order_count >= FREQUENTE_MIN_ORDERS) return 'frequente'

  // First purchase — no time threshold applies
  if (row.order_count === 1) return 'novo'

  // Time-based (order_count >= 2 already handled above, so this is the fallthrough)
  if (row.last_order_at) {
    const days = (Date.now() - new Date(row.last_order_at).getTime()) / 86_400_000
    if (days <= DAYS_ATIVO)    return 'ativo'
    if (days <= DAYS_20_30)    return 'dias_20_30'
    if (days <= DAYS_30_45)    return 'dias_30_45'
    if (days >= DAYS_50_PLUS)  return 'dias_50_plus'
  }

  return 'ativo'
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function configErrorResponse() {
  return NextResponse.json(
    { error: 'supabase_not_configured', message: getSupabaseConfigError() },
    { status: 503 }
  )
}

function rowToCliente(
  row: Record<string, unknown>,
  latest?: { source: string; campaign: string | null }
): ManagerCliente {
  const orderCount          = row.order_count as number
  const totalSpentCentavos  = row.total_spent_centavos as number
  const lastOrderAt         = (row.last_order_at as string | null) ?? null

  return {
    phone:               row.phone as string,
    name:                row.name as string,
    email:               (row.email as string | null) ?? null,
    orderCount,
    totalSpentCentavos,
    lastOrderAt,
    daysSinceLastOrder:  daysSince(lastOrderAt),
    firstSeenAt:         row.first_seen_at as string,
    consentOrderUpdates: (row.consent_order_updates as boolean | null) ?? null,
    consentRelational:   (row.consent_relational as boolean | null) ?? null,
    consentPromotional:  (row.consent_promotional as boolean | null) ?? null,
    segmentTags:         (row.segment_tags as string[]) ?? [],
    segment:             computeSegment({ order_count: orderCount, total_spent_centavos: totalSpentCentavos, last_order_at: lastOrderAt }),
    latestSource:        latest?.source ?? null,
    latestCampaign:      latest?.campaign ?? null,
    suppressedUntil:     (row.suppressed_until  as string | null) ?? null,
    suppressedReason:    (row.suppressed_reason as string | null) ?? null,
    suppressedBy:        (row.suppressed_by     as string | null) ?? null,
  }
}

// ─── Campaigns view ───────────────────────────────────────────────────────────

async function handleCampaigns(): Promise<NextResponse> {
  // Fetch all completed orders with attribution (kitchen statuses + legacy 'confirmed')
  const { data, error } = await supabase
    .from('crm_pedidos')
    .select('customer_phone, total, attribution')
    .in('status', ['confirmed', 'new', 'preparing', 'ready', 'delivered'])

  if (error) {
    console.error('[manager API] campaigns query error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Aggregate by utm_campaign
  const map = new Map<string, { orders: number; revenue: number; phones: Set<string> }>()

  for (const row of (data ?? [])) {
    const key = readAttribution(row.attribution).utm_campaign ?? '__none__'

    if (!map.has(key)) map.set(key, { orders: 0, revenue: 0, phones: new Set() })
    const bucket = map.get(key)!
    bucket.orders++
    bucket.revenue += row.total as number
    bucket.phones.add(row.customer_phone as string)
  }

  const campaigns: CampaignStat[] = Array.from(map.entries())
    .map(([campaign, b]) => ({
      campaign,
      orders:    b.orders,
      revenue:   b.revenue,
      customers: b.phones.size,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  return NextResponse.json({ campaigns } satisfies CampaignsResponse)
}

// ─── List handler ─────────────────────────────────────────────────────────────

async function handleList(req: NextRequest): Promise<NextResponse> {
  const p = req.nextUrl.searchParams

  const consent   = p.get('consent')
  const segment   = p.get('segment')   // vip|warm|new|at_risk
  const minOrders = p.get('minOrders') ? parseInt(p.get('minOrders')!) : undefined
  const source    = p.get('source')
  const campaign  = p.get('campaign')
  const since     = p.get('since')
  const until     = p.get('until')
  const pg        = Math.max(1, parseInt(p.get('page')   ?? '1'))
  const limit     = Math.min(200, Math.max(1, parseInt(p.get('limit') ?? '50')))
  const sort      = p.get('sort') ?? 'last_order'

  // NOTE: suppressed_until / suppressed_reason / suppressed_by require migration
  // 20260322_crm_suppression.sql to have been applied. If those columns are missing
  // Supabase returns a PostgREST error and this handler would 500. We therefore
  // attempt the full select first and fall back to the base columns on error so the
  // Kanban remains usable even before the migration runs.
  const FULL_COLS  = 'phone, name, email, order_count, total_spent_centavos, last_order_at, first_seen_at, consent_order_updates, consent_relational, consent_promotional, segment_tags, suppressed_until, suppressed_reason, suppressed_by'
  const BASE_COLS  = 'phone, name, email, order_count, total_spent_centavos, last_order_at, first_seen_at, consent_order_updates, consent_relational, consent_promotional, segment_tags'

  let query = supabase
    .from('crm_clientes')
    .select(FULL_COLS, { count: 'exact' })

  // Consent filter
  if (consent === 'transactional') {
    query = query.eq('consent_order_updates', true)
  } else if (consent === 'relational') {
    query = query.eq('consent_relational', true)
  } else if (consent === 'promotional') {
    query = query.eq('consent_promotional', true)
  } else if (consent === 'none') {
    query = query
      .or('consent_order_updates.is.null,consent_order_updates.eq.false')
      .or('consent_relational.is.null,consent_relational.eq.false')
      .or('consent_promotional.is.null,consent_promotional.eq.false')
  }

  // Segment pre-filter — push as much as possible to the DB
  if (segment === 'vip') {
    query = query.gte('order_count', VIP_MIN_ORDERS)
  } else if (segment === 'frequente') {
    query = query.gte('order_count', FREQUENTE_MIN_ORDERS).lt('order_count', VIP_MIN_ORDERS)
  } else if (segment === 'novo') {
    query = query.eq('order_count', 1)
  } else if (segment === 'ativo') {
    const cutoff = new Date(Date.now() - DAYS_ATIVO * 86_400_000).toISOString()
    query = query.gte('last_order_at', cutoff).eq('order_count', 1)
  } else if (segment === 'dias_20_30') {
    const from = new Date(Date.now() - DAYS_20_30 * 86_400_000).toISOString()
    const to   = new Date(Date.now() - DAYS_ATIVO  * 86_400_000).toISOString()
    query = query.gte('last_order_at', from).lt('last_order_at', to).eq('order_count', 1)
  } else if (segment === 'dias_30_45') {
    const from = new Date(Date.now() - DAYS_30_45 * 86_400_000).toISOString()
    const to   = new Date(Date.now() - DAYS_20_30  * 86_400_000).toISOString()
    query = query.gte('last_order_at', from).lt('last_order_at', to).eq('order_count', 1)
  } else if (segment === 'dias_50_plus') {
    const cutoff = new Date(Date.now() - DAYS_50_PLUS * 86_400_000).toISOString()
    query = query.lt('last_order_at', cutoff).eq('order_count', 1)
  }

  if (minOrders !== undefined) query = query.gte('order_count', minOrders)
  if (since)  query = query.gte('last_order_at', since)
  if (until)  query = query.lte('last_order_at', until + 'T23:59:59.999Z')

  // Sort
  if (sort === 'order_count') {
    query = query.order('order_count', { ascending: false })
  } else if (sort === 'total_spent') {
    query = query.order('total_spent_centavos', { ascending: false })
  } else {
    query = query.order('last_order_at', { ascending: false, nullsFirst: false })
  }

  const from = (pg - 1) * limit
  query = query.range(from, from + limit - 1)

  let { data: clienteRows, error: clienteError, count } = await query

  // If the suppression columns don't exist yet (migration not applied), PostgREST
  // returns code 42703 ("column does not exist"). Retry with the base column set so
  // the Kanban keeps working until the migration runs. The same filter chain is
  // rebuilt from scratch on the narrowed column list.
  if (clienteError && (clienteError.code === '42703' || clienteError.message.includes('suppressed'))) {
    console.warn('[manager API] suppression columns missing — retrying without them:', clienteError.message)

    let fbQuery = supabase.from('crm_clientes').select(BASE_COLS, { count: 'exact' })

    if (consent === 'transactional') {
      fbQuery = fbQuery.eq('consent_order_updates', true)
    } else if (consent === 'relational') {
      fbQuery = fbQuery.eq('consent_relational', true)
    } else if (consent === 'promotional') {
      fbQuery = fbQuery.eq('consent_promotional', true)
    } else if (consent === 'none') {
      fbQuery = fbQuery
        .or('consent_order_updates.is.null,consent_order_updates.eq.false')
        .or('consent_relational.is.null,consent_relational.eq.false')
        .or('consent_promotional.is.null,consent_promotional.eq.false')
    }
    if (segment === 'vip') {
      fbQuery = fbQuery.gte('order_count', VIP_MIN_ORDERS)
    } else if (segment === 'frequente') {
      fbQuery = fbQuery.gte('order_count', FREQUENTE_MIN_ORDERS).lt('order_count', VIP_MIN_ORDERS)
    } else if (segment === 'novo') {
      fbQuery = fbQuery.eq('order_count', 1)
    } else if (segment === 'ativo') {
      const cutoff = new Date(Date.now() - DAYS_ATIVO * 86_400_000).toISOString()
      fbQuery = fbQuery.gte('last_order_at', cutoff).eq('order_count', 1)
    } else if (segment === 'dias_20_30') {
      const from = new Date(Date.now() - DAYS_20_30 * 86_400_000).toISOString()
      const to   = new Date(Date.now() - DAYS_ATIVO  * 86_400_000).toISOString()
      fbQuery = fbQuery.gte('last_order_at', from).lt('last_order_at', to).eq('order_count', 1)
    } else if (segment === 'dias_30_45') {
      const from = new Date(Date.now() - DAYS_30_45 * 86_400_000).toISOString()
      const to   = new Date(Date.now() - DAYS_20_30  * 86_400_000).toISOString()
      fbQuery = fbQuery.gte('last_order_at', from).lt('last_order_at', to).eq('order_count', 1)
    } else if (segment === 'dias_50_plus') {
      const cutoff = new Date(Date.now() - DAYS_50_PLUS * 86_400_000).toISOString()
      fbQuery = fbQuery.lt('last_order_at', cutoff).eq('order_count', 1)
    }
    if (minOrders !== undefined) fbQuery = fbQuery.gte('order_count', minOrders)
    if (since) fbQuery = fbQuery.gte('last_order_at', since)
    if (until) fbQuery = fbQuery.lte('last_order_at', until + 'T23:59:59.999Z')
    if (sort === 'order_count') {
      fbQuery = fbQuery.order('order_count', { ascending: false })
    } else if (sort === 'total_spent') {
      fbQuery = fbQuery.order('total_spent_centavos', { ascending: false })
    } else {
      fbQuery = fbQuery.order('last_order_at', { ascending: false, nullsFirst: false })
    }
    fbQuery = fbQuery.range(from, from + limit - 1)

    const fb = await fbQuery
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    clienteRows  = fb.data as any
    clienteError = fb.error
    count        = fb.count
  }

  if (clienteError) {
    console.error('[manager API] clientes query error:', clienteError.message)
    return NextResponse.json({ error: clienteError.message }, { status: 500 })
  }

  const phones = (clienteRows ?? []).map((r) => r.phone as string)

  // Latest order per customer — source + attribution campaign
  const latestOrderMap = new Map<string, { source: string; campaign: string | null }>()

  if (phones.length > 0) {
    const { data: latestOrders } = await supabase
      .from('crm_pedidos')
      .select('customer_phone, source, attribution, created_at')
      .in('customer_phone', phones)
      .order('created_at', { ascending: false })

    if (latestOrders) {
      for (const row of latestOrders) {
        if (!latestOrderMap.has(row.customer_phone as string)) {
          latestOrderMap.set(row.customer_phone as string, {
            source:   row.source as string,
            campaign: readAttribution(row.attribution).utm_campaign,
          })
        }
      }
    }
  }

  let customers: ManagerCliente[] = (clienteRows ?? []).map((row) =>
    rowToCliente(row as Record<string, unknown>, latestOrderMap.get(row.phone as string))
  )

  // Post-filter by source/campaign (join not possible in simple Supabase queries)
  if (source)   customers = customers.filter((c) => c.latestSource === source)
  if (campaign) customers = customers.filter((c) =>
    c.latestCampaign?.toLowerCase().includes(campaign.toLowerCase())
  )

  // For at_risk: DB cutoff catches last_order_at < cutoff, but vip customers
  // with recent re-orders may appear — already filtered correctly by DB query.

  return NextResponse.json({
    customers,
    total: count ?? customers.length,
    page: pg,
    limit,
  } satisfies ManagerListResponse)
}

// ─── Detail handler ───────────────────────────────────────────────────────────

async function handleDetail(phone: string): Promise<NextResponse> {
  const [clienteResult, pedidosResult, consentResult] = await Promise.all([
    supabase
      .from('crm_clientes')
      .select('*')
      .eq('phone', phone)
      .single(),

    supabase
      .from('crm_pedidos')
      .select('id, created_at, status, context, source, total, items, attribution')
      .eq('customer_phone', phone)
      .order('created_at', { ascending: false })
      .limit(50),

    supabase
      .from('crm_consent_logs')
      .select('id, category, granted, granted_at, source')
      .eq('customer_phone', phone)
      .order('granted_at', { ascending: false })
      .limit(100),
  ])

  if (clienteResult.error) {
    if (clienteResult.error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }
    return NextResponse.json({ error: clienteResult.error.message }, { status: 500 })
  }

  const latestPedido = (pedidosResult.data ?? [])[0]

  const cliente = rowToCliente(clienteResult.data as Record<string, unknown>, {
    source:   latestPedido?.source ?? null,
    campaign: readAttribution(latestPedido?.attribution).utm_campaign,
  })

  const pedidos: ManagerPedido[] = (pedidosResult.data ?? []).map((p) => ({
    id:          p.id as string,
    createdAt:   p.created_at as string,
    status:      p.status as string,
    context:     p.context as string,
    source:      p.source as string,
    total:       p.total as number,
    items:       p.items,
    attribution: readAttribution(p.attribution),
  }))

  const consentLogs: ManagerConsentLog[] = (consentResult.data ?? []).map((l) => ({
    id:        l.id as number,
    category:  l.category as string,
    granted:   l.granted as boolean,
    grantedAt: l.granted_at as string,
    source:    l.source as string,
  }))

  return NextResponse.json({ cliente, pedidos, consentLogs } satisfies ManagerDetail)
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isSupabaseConfigured()) return configErrorResponse()

  const view  = req.nextUrl.searchParams.get('view') ?? 'list'
  const phone = req.nextUrl.searchParams.get('phone')

  if (view === 'campaigns') return handleCampaigns()

  if (view === 'detail') {
    if (!phone) return NextResponse.json({ error: 'Missing ?phone param' }, { status: 400 })
    return handleDetail(phone)
  }

  return handleList(req)
}

// ─── PATCH ────────────────────────────────────────────────────────────────────
// PATCH /api/crm/manager?phone=xxx
// Body: { segmentTags?: string[] }
// Updates segment_tags on crm_clientes.

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  if (!isSupabaseConfigured()) return configErrorResponse()

  const phone = req.nextUrl.searchParams.get('phone')
  if (!phone) return NextResponse.json({ error: 'Missing ?phone param' }, { status: 400 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const patch: Record<string, unknown> = {}

  if (Array.isArray(body.segmentTags)) {
    patch.segment_tags = body.segmentTags as string[]
  }

  // Suppression: pass suppressedUntil as ISO string to set, or null to clear
  if ('suppressedUntil' in body) {
    const until = body.suppressedUntil
    if (until === null) {
      // Clearing suppression — also wipe reason/by
      patch.suppressed_until  = null
      patch.suppressed_reason = null
      patch.suppressed_by     = null
    } else if (typeof until === 'string') {
      patch.suppressed_until = until
      if (typeof body.suppressedReason === 'string') patch.suppressed_reason = body.suppressedReason || null
      if (typeof body.suppressedBy     === 'string') patch.suppressed_by     = body.suppressedBy     || null
    } else {
      return NextResponse.json({ error: 'suppressedUntil deve ser ISO string ou null' }, { status: 400 })
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
  }

  const { error } = await supabase
    .from('crm_clientes')
    .update(patch)
    .eq('phone', phone)

  if (error) {
    console.error('[manager] PATCH error:', error.message)
    // Surface a clear hint when the migration hasn't been applied yet
    if (error.code === '42703' && error.message.includes('suppressed')) {
      return NextResponse.json(
        { error: 'Suppression columns missing — apply migration 20260322_crm_suppression.sql first' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
