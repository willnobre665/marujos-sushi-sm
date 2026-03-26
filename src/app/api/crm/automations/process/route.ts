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
import { processPendingAutomations } from '@/lib/automationProcessor'

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
