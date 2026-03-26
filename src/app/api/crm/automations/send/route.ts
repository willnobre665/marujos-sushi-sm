/**
 * POST /api/crm/automations/send
 *
 * Sends a pending automation log entry via WhatsApp and updates its status.
 *
 * Body: { logId: string }
 *
 * Response:
 *   200 — { success: true, logId, phone, status: 'sent' }
 *   400 — { error: string }
 *   404 — { error: 'Log entry not found' }
 *   409 — { error: 'Entry is not pending' }
 *   500 — { error: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseServer'
import { sendMessage } from '@/lib/communicationProvider'

export async function POST(req: NextRequest) {
  let body: { logId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { logId } = body
  if (!logId || typeof logId !== 'string') {
    return NextResponse.json({ error: 'logId is required' }, { status: 400 })
  }

  // 1. Fetch the log entry
  const { data: entry, error: fetchErr } = await supabase
    .from('crm_automations_log')
    .select('id, flow, customer_phone, customer_name, message_text, status')
    .eq('id', logId)
    .single()

  if (fetchErr || !entry) {
    return NextResponse.json({ error: 'Log entry not found' }, { status: 404 })
  }

  // 2. Validate
  if (entry.status !== 'pending') {
    return NextResponse.json(
      { error: `Entry is not pending (current status: ${entry.status})` },
      { status: 409 }
    )
  }

  if (!entry.customer_phone) {
    return NextResponse.json(
      { error: 'Entry has no customer_phone — cannot send' },
      { status: 400 }
    )
  }

  if (!entry.message_text) {
    return NextResponse.json(
      { error: 'Entry has no message_text — cannot send' },
      { status: 400 }
    )
  }

  // 3. Send via communication provider
  const sendResult = await sendMessage(entry.customer_phone, entry.message_text)

  const newStatus = sendResult.success ? 'sent' : 'failed'
  const now       = new Date().toISOString()

  // 4. Update log entry
  const updatePayload: Record<string, unknown> = { status: newStatus }
  if (sendResult.success) updatePayload.sent_at = now

  const { error: updateErr } = await supabase
    .from('crm_automations_log')
    .update(updatePayload)
    .eq('id', logId)

  if (updateErr) {
    console.error('[send] failed to update log entry:', updateErr.message)
    return NextResponse.json({ error: 'Message may have been sent but log update failed' }, { status: 500 })
  }

  if (!sendResult.success) {
    return NextResponse.json(
      {
        success: false,
        logId,
        phone:  entry.customer_phone,
        status: 'failed',
        error:  sendResult.error ?? 'Provider returned failure',
      },
      { status: 502 }
    )
  }

  return NextResponse.json({
    success: true,
    logId,
    phone:  entry.customer_phone,
    flow:   entry.flow,
    status: 'sent',
    sentAt: now,
  })
}
