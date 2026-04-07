/**
 * saiposAuth.ts — Token lifecycle for the Saipos Order API.
 *
 * The Saipos API uses a custom JWT auth:
 *   1. POST /auth with { idPartner, secret } → returns { token }
 *   2. All subsequent requests send:  Authorization: <token>  (no "Bearer" prefix)
 *
 * This module keeps a single in-process token cache (valid for the lifetime
 * of the server process / edge function instance). On a 401 from any request,
 * the adapter calls refreshToken() to force a new fetch, then retries once.
 *
 * Thread-safety: the in-flight promise is shared so concurrent requests during
 * a token refresh do not trigger multiple simultaneous /auth calls.
 */

export interface SaiposTokenCache {
  token: string
  fetchedAt: number   // Date.now() ms
}

// Module-level cache — survives for the lifetime of the server process.
// In serverless / edge environments this resets per cold start, which is fine.
let cache: SaiposTokenCache | null = null
let inFlight: Promise<string> | null = null

// Saipos does not document token expiry. 50 minutes is a safe conservative TTL.
const TOKEN_TTL_MS = 50 * 60 * 1000

export function getBaseUrl(): string {
  const url = process.env.SAIPOS_API_URL
  if (!url) throw new Error('[saiposAuth] SAIPOS_API_URL is not set.')
  return url.replace(/\/$/, '') // strip trailing slash
}

function getCredentials(): { idPartner: string; secret: string } {
  const idPartner = process.env.SAIPOS_PARTNER_ID
  const secret = process.env.SAIPOS_SECRET
  if (!idPartner || !secret) {
    throw new Error(
      '[saiposAuth] Missing env vars: SAIPOS_PARTNER_ID and SAIPOS_SECRET must be set.',
    )
  }
  return { idPartner, secret }
}

async function fetchNewToken(): Promise<string> {
  const { idPartner, secret } = getCredentials()
  const baseUrl = getBaseUrl()

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  let res: Response
  try {
    res = await fetch(`${baseUrl}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idPartner, secret }),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    const body = await res.text()
    throw new Error(
      `[saiposAuth] /auth failed — HTTP ${res.status}: ${body}`,
    )
  }

  const data = await res.json() as { token?: string }
  if (!data.token) {
    throw new Error('[saiposAuth] /auth response missing token field.')
  }

  return data.token
}

/**
 * Returns a valid token, fetching a new one if the cache is empty or stale.
 * Concurrent callers share the same in-flight promise.
 */
export async function getToken(): Promise<string> {
  const now = Date.now()

  if (cache && now - cache.fetchedAt < TOKEN_TTL_MS) {
    return cache.token
  }

  if (!inFlight) {
    inFlight = fetchNewToken()
      .then((token) => {
        cache = { token, fetchedAt: Date.now() }
        inFlight = null
        return token
      })
      .catch((err) => {
        inFlight = null
        throw err
      })
  }

  return inFlight
}

/**
 * Evicts the cached token and fetches a fresh one.
 * Call this when a request returns HTTP 401.
 */
export async function refreshToken(): Promise<string> {
  cache = null
  return getToken()
}
