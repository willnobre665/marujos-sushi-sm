/**
 * /api/cmv/stock
 *
 * GET  ?ingredientId=X  → list movements for one ingredient (latest 100)
 * GET  (no param)       → list all movements (latest 100)
 * POST                  → manual adjustment / entry / loss
 *   body: { ingredientId, type: 'in'|'adjustment'|'loss', quantity, reason? }
 *
 * The 'out' type is reserved for automatic deductions from delivered orders.
 *
 * Supabase tables expected:
 *
 *   stock_movements
 *     id               uuid PK default gen_random_uuid()
 *     ingredient_id    uuid NOT NULL references cmv_ingredients(id)
 *     type             text NOT NULL  CHECK (type IN ('in','out','adjustment','loss'))
 *     quantity         numeric NOT NULL
 *     reason           text
 *     related_order_id uuid  (nullable, FK to crm_pedidos.id)
 *     created_at       timestamptz NOT NULL default now()
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/lib/supabaseServer'

export type MovementType = 'in' | 'out' | 'adjustment' | 'loss'

export interface StockMovement {
  id: string
  ingredientId: string
  ingredientName: string
  type: MovementType
  quantity: number
  reason: string | null
  relatedOrderId: string | null
  createdAt: string
}

const MANUAL_TYPES: MovementType[] = ['in', 'adjustment', 'loss']

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'supabase_not_configured' }, { status: 503 })
  const ingredientId = req.nextUrl.searchParams.get('ingredientId')

  let query = supabase
    .from('stock_movements')
    .select('id, ingredient_id, type, quantity, reason, related_order_id, created_at, cmv_ingredients ( name )')
    .order('created_at', { ascending: false })
    .limit(100)

  if (ingredientId) {
    query = query.eq('ingredient_id', ingredientId)
  }

  const { data, error } = await query

  if (error) {
    console.error('[cmv/stock] GET error:', error.message)
    return err(error.message, 500)
  }

  const movements: StockMovement[] = (data ?? []).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ing = (row as any).cmv_ingredients as { name: string } | null
    return {
      id:             row.id as string,
      ingredientId:   row.ingredient_id as string,
      ingredientName: ing?.name ?? '',
      type:           row.type as MovementType,
      quantity:       row.quantity as number,
      reason:         row.reason as string | null,
      relatedOrderId: row.related_order_id as string | null,
      createdAt:      row.created_at as string,
    }
  })

  return NextResponse.json({ movements })
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'supabase_not_configured' }, { status: 503 })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return err('JSON inválido') }

  const ingredientId = (body.ingredientId as string | undefined)?.trim()
  const type         = body.type as MovementType | undefined
  const quantity     = Number(body.quantity)
  const reason       = (body.reason as string | undefined)?.trim() ?? null

  if (!ingredientId)                               return err('ingredientId obrigatório')
  if (!type || !MANUAL_TYPES.includes(type))        return err(`type inválido — aceitos: ${MANUAL_TYPES.join(', ')}`)
  if (!Number.isFinite(quantity) || quantity <= 0) return err('quantity deve ser positivo')

  // Insert movement
  const { error: mvErr } = await supabase
    .from('stock_movements')
    .insert({ ingredient_id: ingredientId, type, quantity, reason })

  if (mvErr) {
    console.error('[cmv/stock] POST insert error:', mvErr.message)
    return err(mvErr.message, 500)
  }

  // Update current_stock accordingly
  const delta = type === 'in' ? quantity : -quantity  // adjustment and loss reduce stock

  if (delta !== 0) {
    const { error: updErr } = await supabase.rpc('decrement_stock', {
      p_ingredient_id: ingredientId,
      p_qty:           -delta,   // decrement_stock subtracts; pass negative to add
    })

    if (updErr) {
      console.error('[cmv/stock] stock update error:', updErr.message)
      // Non-fatal — movement was already recorded
    }
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
