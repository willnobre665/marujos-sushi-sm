/**
 * GET /api/crm/debug
 *
 * Development-only endpoint. Returns a snapshot of all CRM tables so the
 * debug page can display the current pipeline state without a full dashboard.
 *
 * BLOCKED in production: returns 404 when NODE_ENV === 'production'.
 * Never expose this in prod — it returns raw customer data.
 */

import { NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured, getSupabaseConfigError } from '@/lib/supabaseServer'

export async function GET(): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // ── Config check — surface this clearly instead of crashing ───────────────
  if (!isSupabaseConfigured()) {
    const reason = getSupabaseConfigError()
    console.error('[CRM debug] Supabase not configured:', reason)
    return NextResponse.json(
      {
        configError: true,
        message: reason,
        hint: 'Set real values for SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local, then restart the dev server.',
        // Always include these so the panel never crashes on missing fields.
        meta: { generatedAt: new Date().toISOString(), counts: { events: 0, clientes: 0, pedidos: 0, consentLogs: 0 } },
        events: [],
        clientes: [],
        pedidos: [],
        consentLogs: [],
        errors: { events: null, clientes: null, pedidos: null, consentLogs: null },
      },
      { status: 503 }
    )
  }

  // ── Query each table independently — one failure doesn't block the rest ───
  const queryResults = await Promise.allSettled([
    supabase
      .from('crm_events_raw')
      .select('id, ts, session_id, event_name, received_at')
      .order('received_at', { ascending: false })
      .limit(50),

    supabase
      .from('crm_clientes')
      .select('phone, name, email, order_count, total_spent_centavos, consent_order_updates, consent_promotional, segment_tags, last_order_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(20),

    supabase
      .from('crm_pedidos')
      .select('id, customer_phone, total, status, context, source, created_at')
      .order('created_at', { ascending: false })
      .limit(20),

    supabase
      .from('crm_consent_logs')
      .select('id, customer_phone, category, granted, granted_at, source, event_id')
      .order('granted_at', { ascending: false })
      .limit(50),
  ])

  const [eventsResult, clientesResult, pedidosResult, consentResult] = queryResults

  function extractData(result: PromiseSettledResult<{ data: unknown; error: { message: string } | null }>) {
    if (result.status === 'rejected') {
      const msg = result.reason instanceof Error ? result.reason.message : String(result.reason)
      console.error('[CRM debug] Query threw:', msg)
      return { data: [], error: `Query threw: ${msg}` }
    }
    if (result.value.error) {
      console.error('[CRM debug] Supabase error:', result.value.error.message)
      return { data: [], error: result.value.error.message }
    }
    return { data: result.value.data ?? [], error: null }
  }

  const events    = extractData(eventsResult as PromiseSettledResult<{ data: unknown; error: { message: string } | null }>)
  const clientes  = extractData(clientesResult as PromiseSettledResult<{ data: unknown; error: { message: string } | null }>)
  const pedidos   = extractData(pedidosResult as PromiseSettledResult<{ data: unknown; error: { message: string } | null }>)
  const consents  = extractData(consentResult as PromiseSettledResult<{ data: unknown; error: { message: string } | null }>)

  const anyError = events.error || clientes.error || pedidos.error || consents.error

  if (anyError) {
    console.warn('[CRM debug] One or more queries failed. Check errors field in response.')
  }

  return NextResponse.json({
    configError: false,
    meta: {
      generatedAt: new Date().toISOString(),
      counts: {
        events:      (events.data as unknown[]).length,
        clientes:    (clientes.data as unknown[]).length,
        pedidos:     (pedidos.data as unknown[]).length,
        consentLogs: (consents.data as unknown[]).length,
      },
    },
    events:      events.data,
    clientes:    clientes.data,
    pedidos:     pedidos.data,
    consentLogs: consents.data,
    errors: {
      events:      events.error,
      clientes:    clientes.error,
      pedidos:     pedidos.error,
      consentLogs: consents.error,
    },
  })
}
