/**
 * whatsappProvider.ts
 *
 * Abstraction layer for sending WhatsApp messages.
 * Swap the implementation block below when integrating a real provider.
 *
 * Supported providers (future):
 *   - Z-API        https://developer.z-api.io/
 *   - WhatsApp Cloud API (Meta)
 *   - Twilio WhatsApp
 *
 * Current state: stub — always returns success: true.
 */

export interface WhatsAppSendResult {
  success: boolean
  /** Provider message ID, if available */
  messageId?: string
  /** Error description on failure */
  error?: string
}

/**
 * Sends a WhatsApp message to the given phone number.
 *
 * Phone must be in E.164 format (e.g. "+5511999999999") or the format
 * required by your chosen provider.
 */
export async function sendWhatsAppMessage(
  phone: string,
  message: string,
): Promise<WhatsAppSendResult> {
  // ─── TODO: Replace this stub with a real provider ─────────────────────────
  //
  // Example — Z-API:
  //
  //   const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE_ID
  //   const ZAPI_TOKEN    = process.env.ZAPI_TOKEN
  //   const ZAPI_CLIENT   = process.env.ZAPI_CLIENT_TOKEN
  //
  //   const res = await fetch(
  //     `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`,
  //     {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //         'Client-Token': ZAPI_CLIENT!,
  //       },
  //       body: JSON.stringify({ phone, message }),
  //     }
  //   )
  //
  //   if (!res.ok) {
  //     const text = await res.text()
  //     return { success: false, error: `Z-API error ${res.status}: ${text}` }
  //   }
  //
  //   const data = await res.json()
  //   return { success: true, messageId: data.zaapId }
  //
  // ──────────────────────────────────────────────────────────────────────────

  console.log(`[whatsappProvider] STUB — would send to ${phone}: "${message.slice(0, 60)}..."`)
  return { success: true, messageId: `stub-${Date.now()}` }
}
