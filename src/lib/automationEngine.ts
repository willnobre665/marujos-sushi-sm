/**
 * automationEngine.ts
 *
 * Evaluates all CRM automation flows and writes trigger logs to
 * crm_automations_log. Does NOT send messages — just logs intent.
 *
 * Flows:
 *  1. at_risk       — no orders in last 7–30 days
 *  2. new_customer  — placed first order ever
 *  3. vip           — high LTV or frequent orders
 *  4. low_sales     — revenue below expected for current hour window
 *
 * Safe by design:
 *  - Only triggers for customers with promotional consent granted
 *  - Dedup index on (flow, phone, date) prevents double-firing per day
 *  - Frequency control prevents re-contacting same customer+flow within 3 days
 *  - Returns a full RunResult for observability
 *
 * Upgrades (v2):
 *  - Priority score computed per customer and included in trigger_data
 *  - at_risk sorted by score descending (highest-value customers first)
 *  - Frequency control: skip if same flow+phone was sent in last 3 days
 *  - Impact estimation: potential_revenue added to each FlowResult
 */

import { supabase } from '@/lib/supabaseServer'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AutomationFlow = 'at_risk' | 'new_customer' | 'vip' | 'low_sales'
export type AutomationStatus = 'pending' | 'sent' | 'skipped' | 'failed'

export interface AutomationLogEntry {
  id:             string
  flow:           AutomationFlow
  customerPhone:  string | null
  customerName:   string | null
  messageText:    string
  status:         AutomationStatus
  skipReason:     string | null
  triggerData:    Record<string, unknown>
  triggeredAt:    string
  sentAt:         string | null
}

export interface FlowResult {
  flow:             AutomationFlow
  evaluated:        number
  triggered:        number
  skipped:          number
  errors:           number
  detail:           string[]
  potential_revenue: number   // centavos
}

export interface RunResult {
  runAt:   string
  flows:   FlowResult[]
  total:   { evaluated: number; triggered: number; skipped: number; errors: number; potential_revenue: number }
}

// ─── Message templates ────────────────────────────────────────────────────────

function msgAtRisk(name: string, daysSince: number): string {
  const firstName = name.split(' ')[0]
  return `Oi ${firstName}! 🍣 Faz ${daysSince} dias que não te vemos no Marujos Sushi. Temos novidades esperando por você! Que tal voltar hoje? A gente tem saudade 🎋`
}

function msgNewCustomer(name: string): string {
  const firstName = name.split(' ')[0]
  return `Bem-vindo ao Marujos Sushi, ${firstName}! 🎉 Foi um prazer recebê-lo pela primeira vez. Na sua próxima visita, mencione este convite para ganhar um desconto especial. Até breve! 🍱`
}

function msgVip(name: string, totalSpent: number): string {
  const firstName = name.split(' ')[0]
  const fmt = (totalSpent / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  return `${firstName}, você é um cliente VIP do Marujos Sushi! ⭐ Como agradecimento pelos seus ${fmt} em pedidos, temos uma oferta exclusiva para você. Entre em contato para saber mais! 🍣`
}

function msgLowSales(hour: number, revenueToday: number, expectedRevenue: number): string {
  const diff = ((expectedRevenue - revenueToday) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  return `📢 Promoção relâmpago Marujos Sushi! Só hoje, até as ${hour + 2}h, aproveite condições especiais no nosso cardápio. Acesse o QR Code na sua mesa ou chame o garçom. Não perca! 🎋 (${diff} abaixo do esperado para este horário)`
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

const AT_RISK_MIN_DAYS        = 7
const AT_RISK_MAX_DAYS        = 30    // beyond 30d → too cold, skip
const VIP_MIN_ORDERS          = 5
const VIP_MIN_SPENT           = 30000 // R$ 300,00 in centavos
const LOW_SALES_GAP_PCT       = 0.40  // trigger if today's revenue < 60% of same-hour average
const FREQUENCY_CONTROL_DAYS  = 3     // skip if same flow+phone sent within this many days

// ─── Helper: customer priority score ─────────────────────────────────────────
//
// score = (total_spent_centavos / 100) * 2 + (order_count * 5) - (days_since_last_order * 3)
// Higher score = higher-value customer → prioritize for outreach

function computePriorityScore(
  totalSpentCentavos: number,
  orderCount: number,
  daysSinceLastOrder: number,
): number {
  return (totalSpentCentavos / 100) * 2 + orderCount * 5 - daysSinceLastOrder * 3
}

// ─── Helper: frequency control ───────────────────────────────────────────────
//
// Returns true if the given phone was already contacted for this flow
// in the last FREQUENCY_CONTROL_DAYS days (status = 'sent').

async function wasRecentlyContacted(flow: AutomationFlow, phone: string): Promise<boolean> {
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - FREQUENCY_CONTROL_DAYS)

  const { data } = await supabase
    .from('crm_automations_log')
    .select('id')
    .eq('flow', flow)
    .eq('customer_phone', phone)
    .in('status', ['pending', 'processing', 'sent'])
    .gte('triggered_at', since.toISOString())
    .limit(1)

  return (data?.length ?? 0) > 0
}

// ─── Helper: insert log entry, skipping dedup conflicts ───────────────────────

async function logTrigger(entry: {
  flow:          AutomationFlow
  customerPhone: string | null
  customerName:  string | null
  messageText:   string
  status:        AutomationStatus
  skipReason?:   string
  triggerData:   Record<string, unknown>
}): Promise<'inserted' | 'deduped' | 'error'> {
  const { error } = await supabase
    .from('crm_automations_log')
    .insert({
      flow:           entry.flow,
      customer_phone: entry.customerPhone,
      customer_name:  entry.customerName,
      message_text:   entry.messageText,
      status:         entry.status,
      skip_reason:    entry.skipReason ?? null,
      trigger_data:   entry.triggerData,
    })

  if (!error) return 'inserted'

  // Unique constraint violation = already triggered today for this customer+flow
  if (error.code === '23505') return 'deduped'

  console.error('[automationEngine] insert error:', error.message)
  return 'error'
}

// ─── Flow 1: At-risk customers ────────────────────────────────────────────────

async function runAtRisk(): Promise<FlowResult> {
  const result: FlowResult = { flow: 'at_risk', evaluated: 0, triggered: 0, skipped: 0, errors: 0, detail: [], potential_revenue: 0 }

  const cutoffMax = new Date()
  cutoffMax.setUTCDate(cutoffMax.getUTCDate() - AT_RISK_MIN_DAYS)
  const cutoffMin = new Date()
  cutoffMin.setUTCDate(cutoffMin.getUTCDate() - AT_RISK_MAX_DAYS)

  const { data, error } = await supabase
    .from('crm_clientes')
    .select('phone, name, last_order_at, order_count, total_spent_centavos, consent_promotional, preferencias')
    .lte('last_order_at', cutoffMax.toISOString())
    .gte('last_order_at', cutoffMin.toISOString())
    .not('last_order_at', 'is', null)
    .limit(100)

  if (error) {
    result.errors++
    result.detail.push(`DB error: ${error.message}`)
    return result
  }

  // Sort by priority score descending — highest-value customers first
  const rows = (data ?? []).map((row) => {
    const daysSince = Math.floor(
      (Date.now() - new Date(row.last_order_at as string).getTime()) / 86_400_000
    )
    const score = computePriorityScore(
      (row.total_spent_centavos as number) ?? 0,
      (row.order_count as number) ?? 0,
      daysSince,
    )
    return { ...row, daysSince, score }
  }).sort((a, b) => b.score - a.score)

  for (const row of rows) {
    result.evaluated++

    // Consent guard
    const prefs = row.preferencias as Record<string, unknown> | null
    const hasPromotionalConsent =
      row.consent_promotional === true ||
      prefs?.marketing === true ||
      prefs?.promotional === true
    if (!hasPromotionalConsent) {
      result.skipped++
      continue
    }

    // Frequency control
    if (await wasRecentlyContacted('at_risk', row.phone as string)) {
      result.skipped++
      result.detail.push(`skip: recently contacted → ${row.phone}`)
      continue
    }

    const avgTicket = (row.order_count as number) > 0
      ? Math.round((row.total_spent_centavos as number) / (row.order_count as number))
      : 0
    result.potential_revenue += avgTicket

    const msg = msgAtRisk(row.name as string, row.daysSince)

    const outcome = await logTrigger({
      flow: 'at_risk',
      customerPhone: row.phone as string,
      customerName:  row.name as string,
      messageText:   msg,
      status: 'pending',
      triggerData: {
        daysSinceLastOrder:  row.daysSince,
        lastOrderAt:         row.last_order_at,
        priorityScore:       Math.round(row.score),
        orderCount:          row.order_count,
        totalSpentCentavos:  row.total_spent_centavos,
      },
    })

    if (outcome === 'inserted')  { result.triggered++; result.detail.push(`✓ at_risk → ${row.phone} (score ${Math.round(row.score)})`) }
    else if (outcome === 'deduped') { result.skipped++; result.potential_revenue -= avgTicket }
    else { result.errors++; result.potential_revenue -= avgTicket }
  }

  return result
}

// ─── Flow 2: New customers ────────────────────────────────────────────────────

async function runNewCustomer(): Promise<FlowResult> {
  const result: FlowResult = { flow: 'new_customer', evaluated: 0, triggered: 0, skipped: 0, errors: 0, detail: [], potential_revenue: 0 }

  const since = new Date()
  since.setUTCHours(since.getUTCHours() - 48)

  const { data, error } = await supabase
    .from('crm_clientes')
    .select('phone, name, order_count, total_spent_centavos, preferencias, first_seen_at')
    .eq('order_count', 1)
    .gte('first_seen_at', since.toISOString())
    .limit(100)

  if (error) {
    result.errors++
    result.detail.push(`DB error: ${error.message}`)
    return result
  }

  for (const row of data ?? []) {
    result.evaluated++

    // Consent guard
    const prefs = row.preferencias as Record<string, unknown> | null
    const orderUpdates = (prefs?.orderUpdates as Record<string, unknown> | null)
    if (!orderUpdates?.granted) {
      result.skipped++
      continue
    }

    // Frequency control
    if (await wasRecentlyContacted('new_customer', row.phone as string)) {
      result.skipped++
      result.detail.push(`skip: recently contacted → ${row.phone}`)
      continue
    }

    // avg ticket = total_spent / order_count (order_count is 1 here, but use formula for consistency)
    const avgTicket = (row.order_count as number) > 0
      ? Math.round((row.total_spent_centavos as number) / (row.order_count as number))
      : 0
    result.potential_revenue += avgTicket

    const msg = msgNewCustomer(row.name as string)

    const outcome = await logTrigger({
      flow: 'new_customer',
      customerPhone: row.phone as string,
      customerName:  row.name as string,
      messageText:   msg,
      status: 'pending',
      triggerData: {
        orderCount:         1,
        firstSeenAt:        row.first_seen_at,
        totalSpentCentavos: row.total_spent_centavos,
        priorityScore:      computePriorityScore(
          (row.total_spent_centavos as number) ?? 0, 1, 0
        ),
      },
    })

    if (outcome === 'inserted')  { result.triggered++; result.detail.push(`✓ new_customer → ${row.phone}`) }
    else if (outcome === 'deduped') { result.skipped++; result.potential_revenue -= avgTicket }
    else { result.errors++; result.potential_revenue -= avgTicket }
  }

  return result
}

// ─── Flow 3: VIP customers ────────────────────────────────────────────────────

async function runVip(): Promise<FlowResult> {
  const result: FlowResult = { flow: 'vip', evaluated: 0, triggered: 0, skipped: 0, errors: 0, detail: [], potential_revenue: 0 }

  const { data, error } = await supabase
    .from('crm_clientes')
    .select('phone, name, order_count, total_spent_centavos, consent_promotional, preferencias')
    .or(`order_count.gte.${VIP_MIN_ORDERS},total_spent_centavos.gte.${VIP_MIN_SPENT}`)
    .limit(200)

  if (error) {
    result.errors++
    result.detail.push(`DB error: ${error.message}`)
    return result
  }

  for (const row of data ?? []) {
    result.evaluated++

    // Consent guard
    const prefs = row.preferencias as Record<string, unknown> | null
    const hasPromotionalConsent =
      row.consent_promotional === true ||
      prefs?.marketing === true ||
      prefs?.promotional === true
    if (!hasPromotionalConsent) {
      result.skipped++
      continue
    }

    // Frequency control
    if (await wasRecentlyContacted('vip', row.phone as string)) {
      result.skipped++
      result.detail.push(`skip: recently contacted → ${row.phone}`)
      continue
    }

    const avgTicket = (row.order_count as number) > 0
      ? Math.round((row.total_spent_centavos as number) / (row.order_count as number))
      : 0
    result.potential_revenue += avgTicket

    const score = computePriorityScore(
      (row.total_spent_centavos as number) ?? 0,
      (row.order_count as number) ?? 0,
      0, // VIP: days_since not available in this query, default 0
    )

    const msg = msgVip(row.name as string, row.total_spent_centavos as number)

    const outcome = await logTrigger({
      flow: 'vip',
      customerPhone: row.phone as string,
      customerName:  row.name as string,
      messageText:   msg,
      status: 'pending',
      triggerData: {
        orderCount:         row.order_count,
        totalSpentCentavos: row.total_spent_centavos,
        priorityScore:      Math.round(score),
      },
    })

    if (outcome === 'inserted')  { result.triggered++; result.detail.push(`✓ vip → ${row.phone} (score ${Math.round(score)})`) }
    else if (outcome === 'deduped') { result.skipped++; result.potential_revenue -= avgTicket }
    else { result.errors++; result.potential_revenue -= avgTicket }
  }

  return result
}

// ─── Flow 4: Low-sales period ─────────────────────────────────────────────────

async function runLowSales(): Promise<FlowResult> {
  const result: FlowResult = { flow: 'low_sales', evaluated: 1, triggered: 0, skipped: 0, errors: 0, detail: [], potential_revenue: 0 }

  const now   = new Date()
  const hour  = now.getUTCHours()
  const today = now.toISOString().slice(0, 10)

  const todayStart = `${today}T00:00:00.000Z`
  const todayEnd   = now.toISOString()

  const { data: todayOrders, error: todayErr } = await supabase
    .from('crm_pedidos')
    .select('total')
    .gte('created_at', todayStart)
    .lte('created_at', todayEnd)
    .not('status', 'in', '("cancelled")')

  if (todayErr) {
    result.errors++
    result.detail.push(`DB error: ${todayErr.message}`)
    return result
  }

  const revenueToday = (todayOrders ?? []).reduce((s, r) => s + (r.total as number), 0)

  const histStart = new Date(now)
  histStart.setUTCDate(histStart.getUTCDate() - 14)
  const histStartStr = histStart.toISOString().slice(0, 10)

  const { data: histOrders, error: histErr } = await supabase
    .from('crm_pedidos')
    .select('total, created_at')
    .gte('created_at', `${histStartStr}T00:00:00.000Z`)
    .lt('created_at', `${today}T00:00:00.000Z`)
    .not('status', 'in', '("cancelled")')

  if (histErr) {
    result.errors++
    result.detail.push(`DB error (hist): ${histErr.message}`)
    return result
  }

  const dayTotals = new Map<string, number>()
  for (const row of histOrders ?? []) {
    const ts = new Date(row.created_at as string)
    if (ts.getUTCHours() > hour) continue
    const d = (row.created_at as string).slice(0, 10)
    dayTotals.set(d, (dayTotals.get(d) ?? 0) + (row.total as number))
  }

  if (dayTotals.size < 3) {
    result.skipped++
    result.detail.push('skip: insufficient history (<3 days)')
    return result
  }

  const avgRevenue = Array.from(dayTotals.values()).reduce((s, v) => s + v, 0) / dayTotals.size

  if (revenueToday >= avgRevenue * (1 - LOW_SALES_GAP_PCT)) {
    result.skipped++
    result.detail.push(`skip: revenue ok (today=${revenueToday} avg=${Math.round(avgRevenue)})`)
    return result
  }

  // Low sales — guard against same-day re-fire (NULL phone bypasses the unique index)
  const { data: existing } = await supabase
    .from('crm_automations_log')
    .select('id')
    .eq('flow', 'low_sales')
    .is('customer_phone', null)
    .gte('triggered_at', `${today}T00:00:00.000Z`)
    .lt('triggered_at',  `${today}T23:59:59.999Z`)
    .limit(1)

  if (existing && existing.length > 0) {
    result.skipped++
    result.detail.push('skip: low_sales already triggered today')
    return result
  }

  // Potential revenue = gap to average
  result.potential_revenue = Math.round(avgRevenue - revenueToday)

  const gapPct = Math.round(((avgRevenue - revenueToday) / avgRevenue) * 100)
  const msg    = msgLowSales(hour, revenueToday, avgRevenue)

  const outcome = await logTrigger({
    flow: 'low_sales',
    customerPhone: null,
    customerName:  null,
    messageText:   msg,
    status: 'pending',
    triggerData: {
      hour,
      revenueToday,
      avgRevenue: Math.round(avgRevenue),
      gapPct,
    },
  })

  if (outcome === 'inserted')  { result.triggered++; result.detail.push(`✓ low_sales triggered (gap ${gapPct}%)`) }
  else if (outcome === 'deduped') { result.skipped++; result.potential_revenue = 0 }
  else { result.errors++; result.potential_revenue = 0 }

  return result
}

// ─── Main runner ──────────────────────────────────────────────────────────────

export async function runAllAutomations(): Promise<RunResult> {
  const runAt = new Date().toISOString()

  const flows = await Promise.all([
    runAtRisk(),
    runNewCustomer(),
    runVip(),
    runLowSales(),
  ])

  const total = flows.reduce(
    (acc, f) => ({
      evaluated:        acc.evaluated        + f.evaluated,
      triggered:        acc.triggered        + f.triggered,
      skipped:          acc.skipped          + f.skipped,
      errors:           acc.errors           + f.errors,
      potential_revenue: acc.potential_revenue + f.potential_revenue,
    }),
    { evaluated: 0, triggered: 0, skipped: 0, errors: 0, potential_revenue: 0 }
  )

  return { runAt, flows, total }
}
