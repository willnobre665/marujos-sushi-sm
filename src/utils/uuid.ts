/**
 * Generates a UUID v4.
 *
 * Uses crypto.randomUUID() when available (HTTPS / localhost).
 * Falls back to a Math.random()-based implementation for HTTP on Safari,
 * which does not expose crypto.randomUUID() in non-secure contexts.
 */
export function gerarUUID(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  // RFC 4122 v4 fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
