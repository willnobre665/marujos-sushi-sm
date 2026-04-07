/**
 * POST /api/auth/session
 *
 * Sets the sb-session cookie via a proper HTTP Set-Cookie header so it is
 * reliably committed before the next navigation — avoids the document.cookie
 * race on mobile Safari where the cookie may not be sent on the very next
 * request when set from JS and navigated away immediately.
 *
 * Body: { expiresAt?: number }   — Unix timestamp (seconds), optional
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  let expiresAt: number | undefined

  try {
    const body = await req.json()
    if (typeof body.expiresAt === 'number') expiresAt = body.expiresAt
  } catch {
    // body is optional — ignore parse errors
  }

  const isSecure = req.nextUrl.protocol === 'https:'

  const cookieParts = [
    'sb-session=1',
    'Path=/',
    'SameSite=Lax',
    isSecure ? 'Secure' : '',
    expiresAt ? `Expires=${new Date(expiresAt * 1000).toUTCString()}` : '',
  ].filter(Boolean).join('; ')

  return new NextResponse(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookieParts,
    },
  })
}
