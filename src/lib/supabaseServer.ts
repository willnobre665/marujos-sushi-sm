/**
 * supabaseServer — singleton Supabase client for server-side use only.
 *
 * Used exclusively in API routes and server components.
 * MUST NOT be imported in any client-side component, hook, or store.
 *
 * Env vars required (add to .env.local):
 *   SUPABASE_URL=https://your-project.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
 *
 * The service role key bypasses RLS — safe here because this code runs
 * server-side only. Never expose it to the browser.
 *
 * Configuration state:
 *   isSupabaseConfigured() returns false when env vars are missing or still
 *   holding placeholder values. API routes check this and return a clear error
 *   instead of crashing with "TypeError: fetch failed".
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const PLACEHOLDER_URL = 'https://your-project.supabase.co'
const PLACEHOLDER_KEY = 'your-service-role-key-here'

const url = process.env.SUPABASE_URL ?? ''
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

const _configured =
  url.length > 0 &&
  key.length > 0 &&
  url !== PLACEHOLDER_URL &&
  key !== PLACEHOLDER_KEY

/** True only when real (non-placeholder) credentials are present. */
export function isSupabaseConfigured(): boolean {
  return _configured
}

/**
 * Returns a diagnostic string explaining why Supabase is not configured.
 * Returns null when configuration is valid.
 */
export function getSupabaseConfigError(): string | null {
  if (!url || url === PLACEHOLDER_URL) {
    return 'SUPABASE_URL is missing or still set to the placeholder value. Update .env.local.'
  }
  if (!key || key === PLACEHOLDER_KEY) {
    return 'SUPABASE_SERVICE_ROLE_KEY is missing or still set to the placeholder value. Update .env.local.'
  }
  return null
}

// Create the real client only when credentials are present.
// When not configured, export a stub so imports don't throw at module load.
export const supabase: SupabaseClient = _configured
  ? createClient(url, key, { auth: { persistSession: false } })
  : (new Proxy({}, {
      get() {
        throw new Error(
          'supabase client used before configuration. Check isSupabaseConfigured() first.'
        )
      },
    }) as unknown as SupabaseClient)
