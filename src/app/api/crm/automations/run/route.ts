/**
 * POST /api/crm/automations/run
 *
 * Deprecated — the old automationEngine (flow-based) has been replaced by
 * crmTriggers (trigger_id / segment-based). Triggers now fire inline during
 * order_completed processing in processors.ts.
 *
 * This endpoint is intentionally disabled to prevent double-logging.
 * The cron equivalent (GET /api/cron/automations-run) is also disabled.
 */

import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'disabled — automation triggers now fire via crmTriggers during order_completed processing' },
    { status: 410 }
  )
}
