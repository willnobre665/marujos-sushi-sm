/**
 * communicationProvider.ts — Communication boundary for outbound messages.
 *
 * This is the single import point for anything that needs to send a message.
 * Business logic (the automation runner, the send route) calls sendMessage()
 * and never references a provider-specific module directly.
 *
 * Current implementation: WhatsApp via whatsappProvider.ts (stub).
 *
 * Dry-run mode:
 *   Set AUTOMATION_DRY_RUN=true in your environment.
 *   Messages are logged but never dispatched. The runner receives
 *   { success: true } so status transitions (pending → sent) still happen,
 *   allowing the full automation pipeline to be validated end-to-end.
 *   Safe to enable in production for a controlled rollout check.
 *
 * To switch provider:
 *   Replace the import below with the new provider module.
 *   The new module must export a function with this signature:
 *     (phone: string, message: string) => Promise<SendResult>
 *   No other files need to change.
 *
 * To add a second channel (e.g. SMS fallback):
 *   Extend sendMessage() to inspect the channel parameter and route accordingly.
 *   Add the new provider module and keep this file as the only routing point.
 */

import { sendWhatsAppMessage } from '@/lib/whatsappProvider'

// ─── Public contract ──────────────────────────────────────────────────────────

export interface SendResult {
  success: boolean
  /** Provider-assigned message ID, if available. Stored in crm_automations_log for receipts. */
  messageId?: string
  /** Human-readable error description. Stored in last_error on failure. */
  error?: string
}

// ─── Dry-run mode ─────────────────────────────────────────────────────────────
//
// Enabled by: AUTOMATION_DRY_RUN=true
// Disabled by: unset or any other value
//
// When enabled, sendMessage() logs the full message and returns success without
// calling the provider. All downstream status transitions (pending → sent,
// sent_at, attempt_count, etc.) proceed exactly as in a live run.
// The log entry messageId is prefixed with "dry-" so dry-run sends are
// identifiable in crm_automations_log without a separate column.

const DRY_RUN = process.env.AUTOMATION_DRY_RUN === 'true'

/**
 * Send an outbound message to a customer.
 *
 * @param phone   Recipient phone number — digits only, with country code ("5511999999999").
 * @param message Pre-rendered message text. Template interpolation is the caller's responsibility.
 *
 * Never throws — returns { success: false, error } on provider failure.
 * Callers must handle both outcomes.
 */
export async function sendMessage(
  phone:   string,
  message: string,
): Promise<SendResult> {
  if (DRY_RUN) {
    console.log(`[communicationProvider] DRY RUN — phone=${phone} message="${message.slice(0, 80)}${message.length > 80 ? '…' : ''}"`)
    return { success: true, messageId: `dry-${Date.now()}` }
  }

  return sendWhatsAppMessage(phone, message)
}
