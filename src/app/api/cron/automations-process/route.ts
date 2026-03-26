/**
 * GET /api/cron/automations-process
 *
 * Vercel Cron entry point — sends all pending automation messages.
 * Schedule: every 15 minutes at :05 :20 :35 :50 (5 min after run, see vercel.json)
 *
 * Delegates entirely to processPendingAutomations() so this path and the manual
 * POST /api/crm/automations/process path share identical behaviour: same settings
 * loading, time-window checks, daily cap, atomic claim, and status transitions.
 *
 * Vercel calls cron routes via GET and injects the
 * CRON_SECRET as a Bearer token in the Authorization header.
 * See: https://vercel.com/docs/cron-jobs/manage-cron-jobs
 */

import { NextRequest, NextResponse } from 'next/server'
import { processPendingAutomations } from '@/lib/automationProcessor'

export async function GET(req: NextRequest) {
  // Vercel Cron auth: Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get('authorization')
  if (
    process.env.NODE_ENV === 'production' &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('[cron/automations-process] starting...')
    const result = await processPendingAutomations()
    console.log('[cron/automations-process] done', JSON.stringify({ processed: result.processed, sent: result.sent, failed: result.failed }))
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/automations-process] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
