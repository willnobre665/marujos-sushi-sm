/**
 * attribution — Campaign attribution capture, storage, and read.
 *
 * Captures UTM parameters, click IDs, referrer, and landing path on every
 * page load that carries attribution signals. Persists first-touch and
 * last-touch records independently in localStorage.
 *
 * First-touch: written once — never overwritten after the first capture.
 * Last-touch:  written on every load that has at least one attribution signal.
 *
 * Both are included in the order_completed CRM event so the backend can
 * attribute conversions to either model without losing data.
 *
 * Design rules:
 * - Never throws. Attribution failures must never break checkout or UX.
 * - No external dependencies — pure localStorage + window.
 * - Safe to call server-side (all reads/writes are guarded by typeof window).
 */

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEY_FIRST = 'marujos_attr_first'
const KEY_LAST  = 'marujos_attr_last'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AttributionData {
  utm_source?:   string
  utm_medium?:   string
  utm_campaign?: string
  utm_content?:  string
  utm_term?:     string
  fbclid?:       string
  gclid?:        string
  referrer?:     string   // document.referrer at the time of capture
  landing_path?: string   // pathname + search at the time of capture
  captured_at:   string   // ISO 8601 — when this record was written
}

export interface Attribution {
  firstTouch: AttributionData | null
  lastTouch:  AttributionData | null
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function readRecord(key: string): AttributionData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as AttributionData) : null
  } catch {
    return null
  }
}

function writeRecord(key: string, data: AttributionData): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // localStorage full or unavailable — fail silently.
  }
}

/**
 * Build an AttributionData from the current page context.
 * Returns null if no attribution signals are present (no UTM, no click IDs,
 * no external referrer) — visiting the menu directly doesn't create a record.
 */
function buildFromCurrentPage(): AttributionData | null {
  if (typeof window === 'undefined') return null

  const params   = new URLSearchParams(window.location.search)
  const referrer = document.referrer

  const utm_source   = params.get('utm_source')   ?? undefined
  const utm_medium   = params.get('utm_medium')   ?? undefined
  const utm_campaign = params.get('utm_campaign') ?? undefined
  const utm_content  = params.get('utm_content')  ?? undefined
  const utm_term     = params.get('utm_term')     ?? undefined
  const fbclid       = params.get('fbclid')       ?? undefined
  const gclid        = params.get('gclid')        ?? undefined

  // Only capture external referrers (different origin). Same-origin navigation
  // is not an attribution signal — it's in-app browsing.
  const externalReferrer = referrer && !referrer.startsWith(window.location.origin)
    ? referrer
    : undefined

  const hasSignal = utm_source || utm_medium || utm_campaign || fbclid || gclid || externalReferrer

  if (!hasSignal) return null

  return {
    ...(utm_source   ? { utm_source }   : {}),
    ...(utm_medium   ? { utm_medium }   : {}),
    ...(utm_campaign ? { utm_campaign } : {}),
    ...(utm_content  ? { utm_content }  : {}),
    ...(utm_term     ? { utm_term }     : {}),
    ...(fbclid       ? { fbclid }       : {}),
    ...(gclid        ? { gclid }        : {}),
    ...(externalReferrer ? { referrer: externalReferrer } : {}),
    landing_path: window.location.pathname + window.location.search,
    captured_at: new Date().toISOString(),
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Call once on app mount (from SessionHydrator).
 * - If the current page has attribution signals AND no first-touch exists → write first-touch.
 * - If the current page has attribution signals → always write/overwrite last-touch.
 * - If no signals → no-op (don't clear existing records).
 */
export function captureAttribution(): void {
  const current = buildFromCurrentPage()
  if (!current) return

  // First-touch: write once, never overwrite.
  if (!readRecord(KEY_FIRST)) {
    writeRecord(KEY_FIRST, current)
  }

  // Last-touch: always update to the most recent attributed landing.
  writeRecord(KEY_LAST, current)
}

/**
 * Return both first-touch and last-touch attribution records.
 * Returns nulls if no attribution was ever captured in this browser.
 * Safe to call at any time (checkout, analytics, etc.).
 */
export function getAttribution(): Attribution {
  return {
    firstTouch: readRecord(KEY_FIRST),
    lastTouch:  readRecord(KEY_LAST),
  }
}

/**
 * Return a normalized attribution object for the order_completed CRM event.
 *
 * Always returns the full schema — every key is present, missing fields are null.
 * Flat string fields (utm_*) are lowercased for consistent querying.
 * schema_version: 1 lets the backend detect and migrate legacy records.
 *
 * Never returns null — if no attribution was captured, all flat fields are null
 * and firstTouch/lastTouch are null, but the object is always written.
 */
export function getNormalizedAttribution(): import('@/types/crm').OrderAttribution {
  const first = readRecord(KEY_FIRST)
  const last  = readRecord(KEY_LAST)

  function pick(field: keyof AttributionData): string | null {
    const raw = (last as AttributionData | null)?.[field] ?? (first as AttributionData | null)?.[field]
    const v = (raw as string | undefined) ?? null
    // Lowercase utm fields and landing_path for consistent filtering
    if (v && field !== 'referrer' && field !== 'captured_at') return v.toLowerCase()
    return v
  }

  return {
    schema_version: 1,
    utm_source:   pick('utm_source'),
    utm_medium:   pick('utm_medium'),
    utm_campaign: pick('utm_campaign'),
    utm_content:  pick('utm_content'),
    utm_term:     pick('utm_term'),
    fbclid:       pick('fbclid'),
    gclid:        pick('gclid'),
    referrer:     pick('referrer'),
    landing_path: pick('landing_path'),
    firstTouch: first ?? null,
    lastTouch:  last  ?? null,
  }
}

/**
 * Clear all attribution data. Dev/testing only.
 */
export function clearAttribution(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(KEY_FIRST)
  localStorage.removeItem(KEY_LAST)
}
