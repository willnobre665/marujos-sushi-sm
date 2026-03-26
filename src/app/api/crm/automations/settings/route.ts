/**
 * GET  /api/crm/automations/settings
 *   Returns the current sending-rules row (singleton id=1).
 *   Falls back to env-var defaults if the DB row is missing.
 *
 * PUT  /api/crm/automations/settings
 *   Upserts id=1 with the supplied fields. All fields optional; only
 *   supplied fields are updated (partial update via spread).
 *
 *   Body (all optional):
 *   {
 *     is_enabled?:    boolean
 *     batch_limit?:   number   (1–50)
 *     daily_cap?:     number   (1–500)
 *     lunch_window?:  string   "HH:MM-HH:MM"
 *     dinner_window?: string   "HH:MM-HH:MM"
 *     timezone?:      string   IANA tz name
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseServer'

// ─── Defaults (mirrors process/route.ts env-var fallbacks) ────────────────────

export const SETTINGS_DEFAULTS = {
  is_enabled:    true,
  batch_limit:   parseInt(process.env.AUTOMATION_BATCH_LIMIT  ?? '3',  10),
  daily_cap:     parseInt(process.env.AUTOMATION_DAILY_CAP    ?? '10', 10),
  lunch_window:  process.env.AUTOMATION_WINDOW_LUNCH  ?? '11:00-14:00',
  dinner_window: process.env.AUTOMATION_WINDOW_DINNER ?? '18:00-22:00',
  timezone:      process.env.AUTOMATION_TIMEZONE       ?? 'America/Sao_Paulo',
}

export type AutomationSettings = typeof SETTINGS_DEFAULTS

// ─── Validation ───────────────────────────────────────────────────────────────

const WINDOW_RE = /^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/

function validate(body: Record<string, unknown>): string | null {
  if ('batch_limit'  in body) {
    const v = body.batch_limit
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 50)
      return 'batch_limit deve ser inteiro entre 1 e 50'
  }
  if ('daily_cap' in body) {
    const v = body.daily_cap
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 500)
      return 'daily_cap deve ser inteiro entre 1 e 500'
  }
  for (const field of ['lunch_window', 'dinner_window'] as const) {
    if (field in body) {
      if (typeof body[field] !== 'string' || !WINDOW_RE.test(body[field] as string))
        return `${field} deve estar no formato HH:MM-HH:MM`
    }
  }
  if ('timezone' in body) {
    const tz = body.timezone
    if (typeof tz !== 'string' || tz.trim() === '')
      return 'timezone não pode ser vazio'
    try { Intl.DateTimeFormat(undefined, { timeZone: tz }) }
    catch { return `timezone inválido: ${tz}` }
  }
  return null
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const { data, error } = await supabase
    .from('crm_automation_settings')
    .select('*')
    .eq('id', 1)
    .single()

  if (error || !data) {
    // Table may not exist yet — return env-var defaults gracefully
    return NextResponse.json({ ...SETTINGS_DEFAULTS, _source: 'env' })
  }

  return NextResponse.json({
    is_enabled:    data.is_enabled    as boolean,
    batch_limit:   data.batch_limit   as number,
    daily_cap:     data.daily_cap     as number,
    lunch_window:  data.lunch_window  as string,
    dinner_window: data.dinner_window as string,
    timezone:      data.timezone      as string,
    updated_at:    data.updated_at    as string,
    _source: 'db',
  })
}

// ─── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const validationError = validate(body)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const allowed = ['is_enabled', 'batch_limit', 'daily_cap', 'lunch_window', 'dinner_window', 'timezone']
  const patch: Record<string, unknown> = { id: 1, updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  const { data, error } = await supabase
    .from('crm_automation_settings')
    .upsert(patch, { onConflict: 'id' })
    .select('*')
    .single()

  if (error) {
    console.error('[settings] PUT error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    is_enabled:    data.is_enabled    as boolean,
    batch_limit:   data.batch_limit   as number,
    daily_cap:     data.daily_cap     as number,
    lunch_window:  data.lunch_window  as string,
    dinner_window: data.dinner_window as string,
    timezone:      data.timezone      as string,
    updated_at:    data.updated_at    as string,
    _source: 'db',
  })
}
