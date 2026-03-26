/**
 * phone — Normalize phone numbers to a consistent format.
 *
 * Storage format: digits only with country code, no separators.
 * Example: "(11) 9 8765-4321" → "5511987654321"
 *
 * All CRM phone fields must pass through normalizePhone() before storage
 * so phone is a reliable primary key across devices and input formats.
 */

const BR_COUNTRY_CODE = '55'

/**
 * Strip every non-digit character from a phone string.
 * "  (11) 9 8765-4321 " → "11987654321"
 */
function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '')
}

/**
 * Normalize a Brazilian phone number to E.164-compatible digits-only format.
 *
 * Rules applied:
 * 1. Remove all non-digit characters
 * 2. If number starts with "55" and is 12–13 digits → already has country code
 * 3. If number is 10–11 digits (local format with DDD) → prepend "55"
 * 4. Anything else → return stripped digits as-is (unknown format, don't corrupt)
 *
 * Examples:
 *   "(11) 98765-4321"  → "5511987654321"
 *   "11987654321"      → "5511987654321"
 *   "5511987654321"    → "5511987654321"   (idempotent)
 *   "+55 11 98765-4321"→ "5511987654321"
 */
export function normalizePhone(raw: string): string {
  const digits = digitsOnly(raw)

  if (!digits) return ''

  // Already has country code (12 = DDD2+8, 13 = DDD2+9)
  if (digits.startsWith(BR_COUNTRY_CODE) && (digits.length === 12 || digits.length === 13)) {
    return digits
  }

  // Local format with DDD: 10 digits (DDD2 + 8) or 11 digits (DDD2 + 9)
  if (digits.length === 10 || digits.length === 11) {
    return BR_COUNTRY_CODE + digits
  }

  // Unknown format — return stripped digits without modification
  return digits
}

/**
 * Format a normalized phone for display: "(11) 98765-4321"
 * Input should be the normalized form: "5511987654321"
 * Gracefully handles unnormalized input by stripping country code if present.
 */
export function formatPhoneDisplay(normalized: string): string {
  const digits = digitsOnly(normalized)

  // Strip country code if present
  const local = digits.startsWith(BR_COUNTRY_CODE) && digits.length >= 12
    ? digits.slice(BR_COUNTRY_CODE.length)
    : digits

  if (local.length === 11) {
    // (DD) 9XXXX-XXXX
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  }
  if (local.length === 10) {
    // (DD) XXXX-XXXX
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
  }

  return normalized // unknown format — return as-is
}
