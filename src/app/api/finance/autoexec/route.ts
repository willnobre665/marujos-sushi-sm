/**
 * POST /api/finance/autoexec
 *
 * Auto-execution engine for the finance dashboard.
 * Called by the client when high-priority conditions are met.
 * Inserts pending automation log entries directly (no campaign required).
 *
 * Body:
 *   { flow: 'reactivation' | 'upsell', source: 'auto' | 'manual' }
 *
 * Server-side safety gates (all must pass):
 *   1. Kitchen NOT overloaded (byStatus.new + preparing + ready < 8)
 *   2. No execution of same flow in last 30 minutes (crm_automations_log)
 *   3. Global hourly limit: max 3 auto executions per hour (crm_automations_log)
 *
 * Audience:
 *   reactivation → last_order_at between 7 and 30 days ago, has consent
 *   upsell       → order_count >= 2, last_order_at within 7 days, has consent
 *
 * Response:
 *   { ok: true, flow, inserted, skipped, blockedReason: null }
 *   { ok: false, blockedReason: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseServer'

type AutoFlow = 'reactivation' | 'upsell'

// ─── Safety limits ────────────────────────────────────────────────────────────

const KITCHEN_OVERLOAD_THRESHOLD = 8
const FLOW_COOLDOWN_MINS         = 30
const HOURLY_EXEC_LIMIT          = 3

// ─── Safety gate checks ───────────────────────────────────────────────────────

async function isKitchenOverloaded(): Promise<boolean> {
  const { data } = await supabase
    .from('crm_pedidos')
    .select('status')
    .in('status', ['new', 'preparing', 'ready'])

  const active = (data ?? []).length
  return active >= KITCHEN_OVERLOAD_THRESHOLD
}

/** Returns true if the same flow was auto-executed in the last FLOW_COOLDOWN_MINS. */
async function isFlowOnCooldown(flow: AutoFlow): Promise<boolean> {
  const since = new Date()
  since.setUTCMinutes(since.getUTCMinutes() - FLOW_COOLDOWN_MINS)

  const { data } = await supabase
    .from('crm_automations_log')
    .select('id')
    .eq('flow', flow)
    .eq('status', 'pending')
    .gte('triggered_at', since.toISOString())
    .limit(1)

  return (data?.length ?? 0) > 0
}

/** Returns true if 3+ auto-executions have been logged in the last hour. */
async function isOverHourlyLimit(): Promise<boolean> {
  const since = new Date()
  since.setUTCHours(since.getUTCHours() - 1)

  const { data } = await supabase
    .from('crm_automations_log')
    .select('id')
    .gte('triggered_at', since.toISOString())
    .contains('trigger_data', { source: 'auto' })
    .limit(HOURLY_EXEC_LIMIT + 1)

  return (data?.length ?? 0) >= HOURLY_EXEC_LIMIT
}

// ─── Audience selection ───────────────────────────────────────────────────────

async function selectAudience(flow: AutoFlow): Promise<Array<Record<string, unknown>>> {
  let query = supabase
    .from('crm_clientes')
    .select('phone, name, order_count, total_spent_centavos, last_order_at, consent_promotional, preferencias, suppressed_until')
    .limit(200)

  const now = new Date()

  if (flow === 'reactivation') {
    const cutMax = new Date(now); cutMax.setUTCDate(cutMax.getUTCDate() - 7)
    const cutMin = new Date(now); cutMin.setUTCDate(cutMin.getUTCDate() - 30)
    query = query
      .lte('last_order_at', cutMax.toISOString())
      .gte('last_order_at', cutMin.toISOString())
      .not('last_order_at', 'is', null)
  } else {
    // upsell: active customers who visited in the last 7 days with 2+ orders
    const cutRecent = new Date(now); cutRecent.setUTCDate(cutRecent.getUTCDate() - 7)
    query = query
      .gte('last_order_at', cutRecent.toISOString())
      .gte('order_count', 2)
  }

  const { data, error } = await query
  if (error) throw new Error(`audience query: ${error.message}`)
  return (data ?? []) as Array<Record<string, unknown>>
}

// ─── Consent + suppression helpers ───────────────────────────────────────────

function hasConsent(row: Record<string, unknown>): boolean {
  if (row.consent_promotional === true) return true
  const prefs = row.preferencias as Record<string, unknown> | null
  if (!prefs) return false
  if (prefs.marketing === true || prefs.promotional === true) return true
  const ou = prefs.orderUpdates as Record<string, unknown> | null
  return ou?.granted === true
}

function isSuppressed(row: Record<string, unknown>): boolean {
  const su = row.suppressed_until as string | null
  return !!su && new Date(su) > new Date()
}

// ─── Frequency control ────────────────────────────────────────────────────────

async function wasRecentlyContacted(flow: AutoFlow, phone: string): Promise<boolean> {
  const since = new Date(); since.setUTCDate(since.getUTCDate() - 3)
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

// ─── Message builder ──────────────────────────────────────────────────────────

function buildMessage(flow: AutoFlow, name: string, daysSince: number | null): string {
  const first = name.split(' ')[0]
  if (flow === 'reactivation') {
    const days = daysSince ?? 0
    return `Oi ${first}! 🍣 Faz ${days} dias que não te vemos no Marujos Sushi. Temos novidades esperando por você! Que tal voltar hoje? 🎋`
  }
  return `Oi ${first}! 🍱 Você sabia que temos novidades no cardápio do Marujos Sushi? Venha experimentar — escaneie o QR Code na sua mesa. 🎋`
}

// ─── POST ─────────────────────────────────────────────────────────────────────

function err(msg: string, status = 400) {
  return NextResponse.json({ ok: false, blockedReason: msg }, { status })
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return err('JSON inválido') }

  const flow   = body.flow   as AutoFlow | undefined
  const source = (body.source as string | undefined) ?? 'auto'

  if (flow !== 'reactivation' && flow !== 'upsell') {
    return err('flow inválido — aceitos: reactivation, upsell')
  }

  // ── Safety gates ──────────────────────────────────────────────────────────

  const [overloaded, onCooldown, overLimit] = await Promise.all([
    isKitchenOverloaded(),
    isFlowOnCooldown(flow),
    isOverHourlyLimit(),
  ])

  if (overloaded)  return NextResponse.json({ ok: false, blockedReason: 'kitchen_overloaded' })
  if (onCooldown)  return NextResponse.json({ ok: false, blockedReason: 'flow_on_cooldown' })
  if (overLimit)   return NextResponse.json({ ok: false, blockedReason: 'hourly_limit_reached' })

  // ── Audience selection ────────────────────────────────────────────────────

  let audience: Array<Record<string, unknown>>
  try {
    audience = await selectAudience(flow)
  } catch (e) {
    return err((e as Error).message, 500)
  }

  // ── Process each customer ─────────────────────────────────────────────────

  let inserted = 0
  let skipped  = 0

  for (const row of audience) {
    const phone = row.phone as string
    const name  = (row.name  as string) || 'Cliente'

    if (isSuppressed(row))              { skipped++; continue }
    if (!hasConsent(row))               { skipped++; continue }
    if (await wasRecentlyContacted(flow, phone)) { skipped++; continue }

    const now         = new Date()
    const lastOrderAt = row.last_order_at as string | null
    const daysSince   = lastOrderAt
      ? Math.floor((now.getTime() - new Date(lastOrderAt).getTime()) / 86_400_000)
      : null

    const triggerData = {
      source,
      flow,
      auto: true,
      orderCount:         row.order_count,
      totalSpentCentavos: row.total_spent_centavos,
      daysSince,
    }

    const { error: insertErr } = await supabase
      .from('crm_automations_log')
      .insert({
        flow,
        customer_phone: phone,
        customer_name:  name,
        message_text:   buildMessage(flow, name, daysSince),
        status:         'pending',
        trigger_data:   triggerData,
      })

    if (!insertErr) {
      inserted++
    } else if (insertErr.code === '23505') {
      skipped++  // dedup constraint
    }
    // silent on other errors — don't fail the whole run
  }

  return NextResponse.json({ ok: true, flow, inserted, skipped, blockedReason: null })
}
