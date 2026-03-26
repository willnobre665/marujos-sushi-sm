/**
 * GET /api/crm/automations
 *
 * Returns the automation log for the finance-admin dashboard.
 *
 * Query params:
 *   flow?    — filter by flow (at_risk | new_customer | vip | low_sales)
 *   status?  — filter by status (pending | sent | skipped | failed)
 *   phone?   — filter by customer_phone (exact match)
 *   limit?   — number of rows (default 50, max 200)
 *   offset?  — pagination offset (default 0)
 *
 * PATCH /api/crm/automations
 *
 * Update a log entry status (e.g. mark as sent or skipped).
 *
 * Body: { id: string, status: 'sent' | 'skipped' | 'failed', sentAt?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseServer'
import type { AutomationLogStatus } from '@/types/crm'

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

// flow values from the legacy automationEngine — kept for backward-compat filtering
const VALID_FLOWS    = ['at_risk', 'new_customer', 'vip', 'low_sales'] as const
const VALID_STATUSES: AutomationLogStatus[] = ['pending', 'sent', 'skipped', 'failed']

function mapRow(row: Record<string, unknown>) {
  return {
    id:            row.id            as string,
    flow:          row.flow          as string | null,
    customerPhone: row.customer_phone as string | null,
    customerName:  row.customer_name  as string | null,
    messageText:   row.message_text   as string,
    status:        row.status         as AutomationLogStatus,
    skipReason:    row.skip_reason    as string | null,
    triggerData:   row.trigger_data   as Record<string, unknown>,
    triggeredAt:   row.triggered_at   as string,
    sentAt:        row.sent_at        as string | null,
    attemptCount:               row.attempt_count               as number | undefined,
    lastError:                  row.last_error                  as string | null | undefined,
    recoveredAt:                row.recovered_at                as string | null | undefined,
    recoveredRevenueCentavos:   row.recovered_revenue_centavos  as number | null | undefined,
  }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const sp     = req.nextUrl.searchParams
  const flow   = sp.get('flow')
  const status = sp.get('status') as AutomationLogStatus | null
  const phone  = sp.get('phone')
  const limit  = Math.min(parseInt(sp.get('limit')  ?? '50', 10), 200)
  const offset = parseInt(sp.get('offset') ?? '0', 10)

  if (flow   && !(VALID_FLOWS as readonly string[]).includes(flow)) return err('flow inválido')
  if (status && !VALID_STATUSES.includes(status)) return err('status inválido')

  let query = supabase
    .from('crm_automations_log')
    .select('*', { count: 'exact' })
    .order('triggered_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (flow)   query = query.eq('flow', flow)
  if (status) query = query.eq('status', status)
  if (phone)  query = query.eq('customer_phone', phone)

  const { data, error, count } = await query

  if (error) {
    console.warn('[automations] GET error (table may not exist):', error.message)
    return NextResponse.json({ entries: [], total: 0, _warning: error.message })
  }

  return NextResponse.json({
    entries: (data ?? []).map(mapRow),
    total:  count ?? 0,
    limit,
    offset,
  })
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return err('JSON inválido') }

  const id     = body.id     as string | undefined
  const status = body.status as string | undefined

  if (!id)                                        return err('id obrigatório')
  if (!status || !VALID_STATUSES.includes(status as AutomationLogStatus))
                                                  return err(`status inválido — aceitos: ${VALID_STATUSES.join(', ')}`)

  const patch: Record<string, unknown> = { status }
  if (status === 'sent') patch.sent_at = body.sentAt ?? new Date().toISOString()

  const { data, error } = await supabase
    .from('crm_automations_log')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[automations] PATCH error:', error.message)
    return err(error.message, 500)
  }

  return NextResponse.json({ entry: mapRow(data as Record<string, unknown>) })
}
