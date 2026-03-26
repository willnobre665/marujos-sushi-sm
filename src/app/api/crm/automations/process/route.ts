/**
 * POST /api/crm/automations/process
 *
 * Batch-processes pending automation log entries with intelligent throttling.
 *
 * Settings priority: DB (crm_automation_settings) → env vars → hardcoded defaults.
 * Env var fallbacks (all optional):
 *   AUTOMATION_BATCH_LIMIT   — max entries per run          (default: 3)
 *   AUTOMATION_DAILY_CAP     — max messages sent per day    (default: 10)
 *   AUTOMATION_WINDOW_LUNCH  — "HH:MM-HH:MM" lunch window  (default: "11:00-14:00")
 *   AUTOMATION_WINDOW_DINNER — "HH:MM-HH:MM" dinner window (default: "18:00-22:00")
 *   AUTOMATION_TIMEZONE      — IANA timezone for windows    (default: "America/Sao_Paulo")
 *
 * Order of operations:
 *   1. Load settings from DB (fallback to env)
 *   2. Check is_enabled — bail if disabled
 *   3. Check time window — bail early if outside
 *   4. Check daily cap — bail early if reached
 *   5. Fetch top-N pending entries sorted by priorityScore DESC
 *   6. Atomic claim per entry (concurrent-safe)
 *   7. Send via WhatsApp provider
 *   8. Update final status
 *
 * Auth:
 *   Requires X-Automation-Secret header in production.
 *
 * Response:
 *   { processed, sent, failed, skipped, durationMs }
 *   | { skipped: 0, reason: 'disabled' | 'outside_window' | 'daily_cap_reached', ... }
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseServer'
import { sendMessage } from '@/lib/communicationProvider'
import { SETTINGS_DEFAULTS, type AutomationSettings } from '../settings/route'

// ─── Settings loader ───────────────────────────────────────────────────────────

async function loadSettings(): Promise<AutomationSettings> {
  try {
    const { data, error } = await supabase
  .from('crm_automation_settings')
  .select('is_enabled, batch_limit, daily_cap, lunch_window, dinner_window')
  .limit(1)
  .maybeSingle()

    console.log('[process:loadSettings] raw data:', JSON.stringify(data))
    console.log('[process:loadSettings] raw error:', error ? JSON.stringify(error) : null)

    if (error) {
      console.warn('[process:loadSettings] DB error — falling back to defaults:', error.message)
      console.log('[process:loadSettings] resolved settings (fallback):', JSON.stringify(SETTINGS_DEFAULTS))
      return SETTINGS_DEFAULTS
    }
    if (!data) {
      console.warn('[process:loadSettings] no row found — falling back to defaults')
      console.log('[process:loadSettings] resolved settings (fallback):', JSON.stringify(SETTINGS_DEFAULTS))
      return SETTINGS_DEFAULTS
    }

    const resolved: AutomationSettings = {
      is_enabled:    data.is_enabled    as boolean,
      batch_limit:   data.batch_limit   as number,
      daily_cap:     data.daily_cap     as number,
      lunch_window:  data.lunch_window  as string,
      dinner_window: data.dinner_window as string,
      timezone:      SETTINGS_DEFAULTS.timezone,
    }
    console.log('[process:loadSettings] resolved settings (from DB):', JSON.stringify(resolved))
    return resolved
  } catch (err) {
    console.warn('[process:loadSettings] exception — falling back to defaults:', err)
    console.log('[process:loadSettings] resolved settings (fallback):', JSON.stringify(SETTINGS_DEFAULTS))
    return SETTINGS_DEFAULTS
  }
}

// ─── Time-window helpers ──────────────────────────────────────────────────────

function parseWindow(spec: string): { start: number; end: number } | null {
  const m = spec.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/)
  if (!m) return null
  return {
    start: parseInt(m[1], 10) * 60 + parseInt(m[2], 10),
    end:   parseInt(m[3], 10) * 60 + parseInt(m[4], 10),
  }
}

function nowMinutes(tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(new Date())
  const h = parseInt(parts.find((p) => p.type === 'hour')!.value,   10)
  const m = parseInt(parts.find((p) => p.type === 'minute')!.value, 10)
  return h * 60 + m
}

function isInsideWindow(settings: AutomationSettings): boolean {
  const current = nowMinutes(settings.timezone)
  for (const spec of [settings.lunch_window, settings.dinner_window]) {
    const w = parseWindow(spec)
    if (w && current >= w.start && current <= w.end) return true
  }
  return false
}

function todayStartUTC(tz: string): string {
  const local = new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  return new Date(`${local}T00:00:00`).toISOString()
}

// ─── Shared processing logic ──────────────────────────────────────────────────
//
// Extracted so both the manual route (POST /api/crm/automations/process) and
// the Vercel Cron route (GET /api/cron/automations-process) share identical
// behaviour: same settings, time-window checks, daily cap, and atomic claim.

export async function processPendingAutomations(): Promise<{
  processed:  number
  sent:       number
  failed:     number
  skipped:    number
  daily_cap?: number
  sent_today?: number
  reason?:    string
  windows?:   string[]
  durationMs: number
}> {
  const startedAt = Date.now()

  // ── 1. Load settings ──────────────────────────────────────────────────────
  const settings = await loadSettings()

  // ── 2. Enabled check ─────────────────────────────────────────────────────
  if (!settings.is_enabled) {
    console.log('[process] automations disabled via settings — skipping')
    return { processed: 0, sent: 0, failed: 0, skipped: 0, reason: 'disabled', durationMs: Date.now() - startedAt }
  }

  // ── 3. Time-window check ──────────────────────────────────────────────────
  if (!isInsideWindow(settings)) {
    console.log(`[process] outside sending window — lunch=${settings.lunch_window} dinner=${settings.dinner_window} tz=${settings.timezone}`)
    return {
      processed: 0, sent: 0, failed: 0, skipped: 0,
      reason: 'outside_window',
      windows: [settings.lunch_window, settings.dinner_window],
      durationMs: Date.now() - startedAt,
    }
  }

  // ── 4. Daily cap check ────────────────────────────────────────────────────
  const todayStart = todayStartUTC(settings.timezone)

  const { count: sentToday, error: capErr } = await supabase
    .from('crm_automations_log')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('sent_at', todayStart)

  if (capErr) {
    console.error('[process] failed to check daily cap:', capErr.message)
    throw new Error(capErr.message)
  }

  if ((sentToday ?? 0) >= settings.daily_cap) {
    console.log(`[process] daily cap reached (${sentToday}/${settings.daily_cap}) — skipping`)
    return {
      processed: 0, sent: 0, failed: 0, skipped: 0,
      reason: 'daily_cap_reached',
      daily_cap: settings.daily_cap,
      sent_today: sentToday ?? 0,
      durationMs: Date.now() - startedAt,
    }
  }

  const remaining = settings.daily_cap - (sentToday ?? 0)
  const limit     = Math.min(settings.batch_limit, remaining)

  // ── 5. Fetch top-N pending entries by priorityScore DESC ──────────────────
  const fetchPool = Math.min(limit * 5, 100)

  const { data: entries, error: fetchErr } = await supabase
    .from('crm_automations_log')
    .select('id, flow, customer_phone, customer_name, message_text, status, attempt_count, trigger_data')
    .eq('status', 'pending')
    .not('customer_phone', 'is', null)
    .not('message_text',   'is', null)
    .order('triggered_at', { ascending: true })
    .limit(fetchPool)

  if (fetchErr) {
    console.error('[process] failed to fetch pending entries:', fetchErr.message)
    throw new Error(fetchErr.message)
  }

  const sorted = (entries ?? []).sort((a, b) => {
    const scoreA = ((a.trigger_data as Record<string, unknown>)?.priorityScore as number) ?? 0
    const scoreB = ((b.trigger_data as Record<string, unknown>)?.priorityScore as number) ?? 0
    return scoreB - scoreA
  })

  const batch = sorted.slice(0, limit)
  console.log(`[process] pool=${entries?.length ?? 0} batch=${batch.length} (limit=${limit}, daily_remaining=${remaining})`)

  let sent    = 0
  let failed  = 0
  let skipped = 0

  for (const entry of batch) {
    const now = new Date().toISOString()

    // ── 6. Claim atomically (pending → processing) ────────────────────────────
    const { data: claimed, error: claimErr } = await supabase
      .from('crm_automations_log')
      .update({
        status:        'processing',
        processing_at: now,
        attempt_count: (entry.attempt_count as number ?? 0) + 1,
      })
      .eq('id', entry.id)
      .eq('status', 'pending')
      .select('id')
      .single()

    if (claimErr || !claimed) {
      skipped++
      continue
    }

    // ── 7. Send via communication provider ───────────────────────────────────
    const sendResult = await sendMessage(
      entry.customer_phone as string,
      entry.message_text   as string,
    )

    // ── 8. Update final status ────────────────────────────────────────────────
    if (sendResult.success) {
      await supabase
        .from('crm_automations_log')
        .update({ status: 'sent', sent_at: new Date().toISOString(), processing_at: null, last_error: null })
        .eq('id', entry.id)

      sent++
      console.log(`[process] sent → ${entry.flow} / ${entry.customer_phone}`)
    } else {
      const errMsg = sendResult.error ?? 'Provider returned failure'
      await supabase
        .from('crm_automations_log')
        .update({ status: 'failed', processing_at: null, last_error: errMsg })
        .eq('id', entry.id)

      failed++
      console.warn(`[process] failed → ${entry.flow} / ${entry.customer_phone}: ${errMsg}`)
    }
  }

  const durationMs = Date.now() - startedAt
  console.log(`[process] done — processed=${batch.length} sent=${sent} failed=${failed} skipped=${skipped} (${durationMs}ms)`)

  return {
    processed:  batch.length,
    sent,
    failed,
    skipped,
    daily_cap:  settings.daily_cap,
    sent_today: (sentToday ?? 0) + sent,
    durationMs,
  }
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    const secret = req.headers.get('x-automation-secret')
    if (!secret || secret !== process.env.AUTOMATION_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const result = await processPendingAutomations()
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[automations/process] unexpected error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
