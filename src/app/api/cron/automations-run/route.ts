/**
 * GET /api/cron/automations-run
 *
 * Deprecated — the old automationEngine (flow-based) has been replaced by
 * crmTriggers (trigger_id / segment-based). Triggers now fire inline during
 * order_completed processing in processors.ts.
 *
 * Returning 410 so Vercel Cron logs a clear failure rather than silently
 * running a no-op. Remove or repurpose this route once vercel.json is updated.
 */

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    { error: 'disabled — automation triggers now fire via crmTriggers during order_completed processing' },
    { status: 410 }
  )
}
