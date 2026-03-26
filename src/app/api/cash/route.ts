/**
 * /api/cash — Cash register session management.
 *
 * Tables (Supabase):
 *
 *   cash_sessions
 *     id            uuid PK default gen_random_uuid()
 *     opened_at     timestamptz NOT NULL default now()
 *     closed_at     timestamptz
 *     opening_amount  integer NOT NULL   -- centavos
 *     counted_amount  integer            -- centavos, set on close
 *     notes         text
 *
 *   cash_entries
 *     id            uuid PK default gen_random_uuid()
 *     session_id    uuid NOT NULL references cash_sessions(id)
 *     created_at    timestamptz NOT NULL default now()
 *     type          text NOT NULL  -- 'in' | 'out'
 *     amount        integer NOT NULL  -- centavos, always positive
 *     description   text NOT NULL
 *
 * Endpoints:
 *   GET    /api/cash              → active session + entries, or null
 *   POST   /api/cash              → open session  { action:'open', openingAmount, notes? }
 *   POST   /api/cash              → add entry     { action:'entry', type, amount, description }
 *   POST   /api/cash              → close session { action:'close', countedAmount, notes? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseServer'

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

// ─── GET — active session ─────────────────────────────────────────────────────

export async function GET() {
  // Find the one open session (closed_at is null)
  const { data: session, error: sErr } = await supabase
    .from('cash_sessions')
    .select('*')
    .is('closed_at', null)
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (sErr) {
    console.error('[cash] GET session error:', sErr.message)
    return err(sErr.message, 500)
  }

  if (!session) {
    return NextResponse.json({ session: null, entries: [] })
  }

  // Load entries for this session
  const { data: entries, error: eErr } = await supabase
    .from('cash_entries')
    .select('*')
    .eq('session_id', session.id)
    .order('created_at', { ascending: true })

  if (eErr) {
    console.error('[cash] GET entries error:', eErr.message)
    return err(eErr.message, 500)
  }

  return NextResponse.json({
    session: mapSession(session),
    entries: (entries ?? []).map(mapEntry),
  })
}

// ─── POST — actions ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return err('JSON inválido')
  }

  const action = body.action as string | undefined

  if (action === 'open')  return handleOpen(body)
  if (action === 'entry') return handleEntry(body)
  if (action === 'close') return handleClose(body)

  return err('action inválido — aceitos: open, entry, close')
}

// ── open ──────────────────────────────────────────────────────────────────────

async function handleOpen(body: Record<string, unknown>) {
  // Reject if a session is already open
  const { data: existing } = await supabase
    .from('cash_sessions')
    .select('id')
    .is('closed_at', null)
    .limit(1)
    .maybeSingle()

  if (existing) return err('Já existe um caixa aberto. Feche-o antes de abrir outro.', 409)

  const openingAmount = toInt(body.openingAmount)
  if (openingAmount === null || openingAmount < 0) return err('openingAmount inválido')

  const { data, error } = await supabase
    .from('cash_sessions')
    .insert({
      opening_amount: openingAmount,
      notes: (body.notes as string | undefined) ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('[cash] open error:', error.message)
    return err(error.message, 500)
  }

  return NextResponse.json({ session: mapSession(data), entries: [] }, { status: 201 })
}

// ── entry ─────────────────────────────────────────────────────────────────────

async function handleEntry(body: Record<string, unknown>) {
  const type = body.type as string | undefined
  if (type !== 'in' && type !== 'out') return err('type deve ser "in" ou "out"')

  const amount = toInt(body.amount)
  if (amount === null || amount <= 0) return err('amount deve ser > 0')

  const description = (body.description as string | undefined)?.trim()
  if (!description) return err('description obrigatória')

  // Find open session
  const { data: session } = await supabase
    .from('cash_sessions')
    .select('id')
    .is('closed_at', null)
    .limit(1)
    .maybeSingle()

  if (!session) return err('Nenhum caixa aberto', 409)

  const { data, error } = await supabase
    .from('cash_entries')
    .insert({
      session_id: session.id,
      type,
      amount,
      description,
    })
    .select()
    .single()

  if (error) {
    console.error('[cash] entry error:', error.message)
    return err(error.message, 500)
  }

  return NextResponse.json({ entry: mapEntry(data) }, { status: 201 })
}

// ── close ─────────────────────────────────────────────────────────────────────

async function handleClose(body: Record<string, unknown>) {
  const { data: session } = await supabase
    .from('cash_sessions')
    .select('id')
    .is('closed_at', null)
    .limit(1)
    .maybeSingle()

  if (!session) return err('Nenhum caixa aberto', 409)

  const countedAmount = toInt(body.countedAmount)
  if (countedAmount === null || countedAmount < 0) return err('countedAmount inválido')

  const { data, error } = await supabase
    .from('cash_sessions')
    .update({
      closed_at: new Date().toISOString(),
      counted_amount: countedAmount,
      notes: (body.notes as string | undefined) ?? null,
    })
    .eq('id', session.id)
    .select()
    .single()

  if (error) {
    console.error('[cash] close error:', error.message)
    return err(error.message, 500)
  }

  return NextResponse.json({ session: mapSession(data) })
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSession(row: any) {
  return {
    id:             row.id as string,
    openedAt:       row.opened_at as string,
    closedAt:       (row.closed_at ?? null) as string | null,
    openingAmount:  row.opening_amount as number,
    countedAmount:  (row.counted_amount ?? null) as number | null,
    notes:          (row.notes ?? null) as string | null,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEntry(row: any) {
  return {
    id:          row.id as string,
    sessionId:   row.session_id as string,
    createdAt:   row.created_at as string,
    type:        row.type as 'in' | 'out',
    amount:      row.amount as number,
    description: row.description as string,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v)
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return Math.round(n)
  }
  return null
}
