/**
 * POST /api/campaigns/execute
 *
 * Executes a campaign: selects matching customers from crm_clientes based on
 * the campaign's targeting config, then inserts pending automation log entries
 * into crm_automations_log. Does NOT send messages — logs intent only.
 *
 * Body: { id: string }
 *
 * Response:
 *   {
 *     ok: true,
 *     campaignId:  string,
 *     targeted:    number,   // customers matched before consent/dedup filters
 *     inserted:    number,   // new automation log entries created
 *     skipped:     number,   // filtered out (suppressed, no consent, dedup)
 *     detail:      string[]  // per-customer log lines
 *   }
 *
 * Targeting config (campaign.targeting JSONB):
 *   segment:  'at_risk' | 'new_customer' | 'vip' | 'custom' | null
 *   filters:  {
 *     minOrderCount?:         number   min order_count (inclusive)
 *     maxOrderCount?:         number   max order_count (inclusive)
 *     minTotalSpent?:         number   centavos
 *     maxDaysSinceLastOrder?: number   customers inactive AT MOST N days
 *     minDaysSinceLastOrder?: number   customers inactive AT LEAST N days
 *   }
 *   flow:     'at_risk' | 'new_customer' | 'vip' | 'reactivation' | 'upsell'
 *
 * Safety rules (same as automationEngine):
 *  - Only customers with promotional consent
 *  - Skips customers with active suppression (suppressed_until > now)
 *  - Dedup: skip if same flow+phone already has a 'pending' entry today
 *  - Frequency control: skip if same flow+phone was 'sent' in last 3 days
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseServer'

// ─── Types ────────────────────────────────────────────────────────────────────

type TargetSegment = 'at_risk' | 'new_customer' | 'vip' | 'custom'
type ExecutionFlow  = 'at_risk' | 'new_customer' | 'vip' | 'reactivation' | 'upsell'

interface TargetingFilters {
  minOrderCount?:         number
  maxOrderCount?:         number
  minTotalSpent?:         number
  maxDaysSinceLastOrder?: number
  minDaysSinceLastOrder?: number
}

interface TargetingConfig {
  segment?: TargetSegment | null
  filters?: TargetingFilters
  flow?:    ExecutionFlow | null
}

interface ExecutionStats {
  lastRunAt:         string
  targeted:          number
  inserted:          number
  skipped:           number
  converted:         number
  convertedRevenue:  number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FREQUENCY_CONTROL_DAYS = 3

const VALID_FLOWS: ExecutionFlow[] = ['at_risk', 'new_customer', 'vip', 'reactivation', 'upsell']

// ─── Message templates ────────────────────────────────────────────────────────

function buildMessage(flow: ExecutionFlow, name: string, meta: Record<string, unknown>): string {
  const first = name.split(' ')[0]

  switch (flow) {
    case 'at_risk':
    case 'reactivation': {
      const days = (meta.daysSince as number | undefined) ?? 0
      return `Oi ${first}! 🍣 Faz ${days} dias que não te vemos no Marujos Sushi. Temos novidades esperando por você! Que tal voltar hoje? A gente tem saudade 🎋`
    }
    case 'new_customer':
      return `Bem-vindo ao Marujos Sushi, ${first}! 🎉 Foi um prazer recebê-lo pela primeira vez. Na sua próxima visita, mencione este convite para uma surpresa especial. Até breve! 🍱`
    case 'vip': {
      const spent = (meta.totalSpentCentavos as number | undefined) ?? 0
      const fmt   = (spent / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      return `${first}, você é um cliente VIP do Marujos Sushi! ⭐ Como agradecimento pelos seus ${fmt} em pedidos, temos uma oferta exclusiva para você. Entre em contato para saber mais! 🍣`
    }
    case 'upsell':
      return `Oi ${first}! 🍱 Você sabia que temos novidades no cardápio do Marujos Sushi? Venha experimentar e surpreenda-se. Escaneie o QR Code na sua mesa. 🎋`
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isActivelySuppressed(suppressedUntil: string | null): boolean {
  if (!suppressedUntil) return false
  return new Date(suppressedUntil) > new Date()
}

function hasPromotionalConsent(row: Record<string, unknown>): boolean {
  if (row.consent_promotional === true) return true
  const prefs = row.preferencias as Record<string, unknown> | null
  if (!prefs) return false
  if (prefs.marketing === true || prefs.promotional === true) return true
  const orderUpdates = prefs.orderUpdates as Record<string, unknown> | null
  if (orderUpdates?.granted === true) return true
  return false
}

async function wasRecentlyContacted(flow: ExecutionFlow, phone: string): Promise<boolean> {
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - FREQUENCY_CONTROL_DAYS)

  const { data } = await supabase
    .from('crm_automations_log')
    .select('id')
    .eq('flow', flow)
    .eq('customer_phone', phone)
    .eq('status', 'sent')
    .gte('sent_at', since.toISOString())
    .limit(1)

  return (data?.length ?? 0) > 0
}

async function hasPendingToday(flow: ExecutionFlow, phone: string): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('crm_automations_log')
    .select('id')
    .eq('flow', flow)
    .eq('customer_phone', phone)
    .eq('status', 'pending')
    .gte('triggered_at', `${today}T00:00:00.000Z`)
    .limit(1)

  return (data?.length ?? 0) > 0
}

// ─── Audience selection ───────────────────────────────────────────────────────

async function selectAudience(
  targeting: TargetingConfig,
): Promise<Array<Record<string, unknown>>> {
  const { segment, filters = {} } = targeting

  let query = supabase
    .from('crm_clientes')
    .select(
      'phone, name, order_count, total_spent_centavos, last_order_at, first_seen_at, ' +
      'consent_promotional, preferencias, suppressed_until',
    )
    .limit(500)

  // ── Preset segment shortcuts ──────────────────────────────────────────────

  if (segment === 'at_risk') {
    const cutoffMax = new Date()
    cutoffMax.setUTCDate(cutoffMax.getUTCDate() - 7)
    const cutoffMin = new Date()
    cutoffMin.setUTCDate(cutoffMin.getUTCDate() - 30)
    query = query
      .lte('last_order_at', cutoffMax.toISOString())
      .gte('last_order_at', cutoffMin.toISOString())
      .not('last_order_at', 'is', null)
  }

  if (segment === 'new_customer') {
    const since = new Date()
    since.setUTCHours(since.getUTCHours() - 48)
    query = query
      .eq('order_count', 1)
      .gte('first_seen_at', since.toISOString())
  }

  if (segment === 'vip') {
    query = query.or('order_count.gte.5,total_spent_centavos.gte.30000')
  }

  // ── Custom / additional numeric filters ───────────────────────────────────

  if (filters.minOrderCount != null)
    query = query.gte('order_count', filters.minOrderCount)
  if (filters.maxOrderCount != null)
    query = query.lte('order_count', filters.maxOrderCount)
  if (filters.minTotalSpent != null)
    query = query.gte('total_spent_centavos', filters.minTotalSpent)

  if (filters.minDaysSinceLastOrder != null) {
    const cut = new Date()
    cut.setUTCDate(cut.getUTCDate() - filters.minDaysSinceLastOrder)
    query = query.lte('last_order_at', cut.toISOString())
  }
  if (filters.maxDaysSinceLastOrder != null) {
    const cut = new Date()
    cut.setUTCDate(cut.getUTCDate() - filters.maxDaysSinceLastOrder)
    query = query.gte('last_order_at', cut.toISOString())
  }

  const { data, error } = await query

  if (error) throw new Error(`audience query failed: ${error.message}`)
  return (data ?? []) as unknown as Array<Record<string, unknown>>
}

// ─── POST ─────────────────────────────────────────────────────────────────────

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return err('JSON inválido') }

  const id = body.id as string | undefined
  if (!id) return err('id da campanha obrigatório')

  // ── Fetch campaign ─────────────────────────────────────────────────────────

  const { data: campRow, error: campErr } = await supabase
    .from('campaigns')
    .select('id, campaign_name, status, targeting')
    .eq('id', id)
    .single()

  if (campErr) {
    if (campErr.code === 'PGRST116') return err('Campanha não encontrada', 404)
    return err(campErr.message, 500)
  }

  const targeting = ((campRow as Record<string, unknown>).targeting ?? {}) as TargetingConfig
  const flow: ExecutionFlow = (targeting.flow && VALID_FLOWS.includes(targeting.flow))
    ? targeting.flow
    : 'reactivation'

  // ── Select audience ────────────────────────────────────────────────────────

  let audience: Array<Record<string, unknown>>
  try {
    audience = await selectAudience(targeting)
  } catch (e) {
    return err((e as Error).message, 500)
  }

  const targeted = audience.length
  let inserted = 0
  let skipped  = 0
  const detail: string[] = []

  // ── Process each customer ──────────────────────────────────────────────────

  for (const row of audience) {
    const phone = row.phone as string
    const name  = (row.name as string) || 'Cliente'

    // Suppression check
    if (isActivelySuppressed(row.suppressed_until as string | null)) {
      skipped++
      detail.push(`skip: suppressed → ${phone}`)
      continue
    }

    // Consent check
    if (!hasPromotionalConsent(row)) {
      skipped++
      continue
    }

    // Frequency control (sent in last 3 days)
    if (await wasRecentlyContacted(flow, phone)) {
      skipped++
      detail.push(`skip: recently contacted → ${phone}`)
      continue
    }

    // Dedup: already pending today
    if (await hasPendingToday(flow, phone)) {
      skipped++
      detail.push(`skip: pending today → ${phone}`)
      continue
    }

    // Build trigger_data
    const now = new Date()
    const lastOrderAt = row.last_order_at as string | null
    const daysSince   = lastOrderAt
      ? Math.floor((now.getTime() - new Date(lastOrderAt).getTime()) / 86_400_000)
      : null

    const triggerData: Record<string, unknown> = {
      campaign_id:         id,
      campaignName:        (campRow as Record<string, unknown>).campaign_name,
      flow,
      orderCount:          row.order_count,
      totalSpentCentavos:  row.total_spent_centavos,
      daysSince,
    }

    const message = buildMessage(flow, name, {
      daysSince: daysSince ?? 0,
      totalSpentCentavos: row.total_spent_centavos as number ?? 0,
    })

    const { error: insertErr } = await supabase
      .from('crm_automations_log')
      .insert({
        flow,
        customer_phone: phone,
        customer_name:  name,
        message_text:   message,
        status:         'pending',
        trigger_data:   triggerData,
      })

    if (!insertErr) {
      inserted++
      detail.push(`✓ ${flow} → ${phone}`)
    } else if (insertErr.code === '23505') {
      // unique constraint: already triggered today for this flow+phone
      skipped++
      detail.push(`skip: dedup constraint → ${phone}`)
    } else {
      detail.push(`error: ${insertErr.message} → ${phone}`)
    }
  }

  // ── Update execution_stats on the campaign ────────────────────────────────

  const stats: ExecutionStats = {
    lastRunAt:        new Date().toISOString(),
    targeted,
    inserted,
    skipped,
    converted:        0,
    convertedRevenue: 0,
  }

  await supabase
    .from('campaigns')
    .update({ execution_stats: stats, updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({
    ok:         true,
    campaignId: id,
    targeted,
    inserted,
    skipped,
    detail,
  })
}
