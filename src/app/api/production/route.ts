/**
 * /api/production — Kitchen production board API.
 *
 * GET  ?since=<ISO>  → returns orders in kitchen-visible statuses
 * PATCH              → { id, status } → updates a single order's status
 *
 * Kitchen statuses: new | preparing | ready | delivered
 * (CrmPedido status is extended to include these alongside the CRM statuses)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseServer'
import { deductStockForOrder } from '@/lib/stockDeduction'

type KitchenStatus = 'new' | 'preparing' | 'ready' | 'delivered'

const KITCHEN_STATUSES: KitchenStatus[] = ['new', 'preparing', 'ready', 'delivered']
const VISIBLE_STATUSES: KitchenStatus[] = ['new', 'preparing', 'ready']  // 'delivered' excluded from board

function err(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status })
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const since = searchParams.get('since')

  let query = supabase
    .from('crm_pedidos')
    .select('id, customer_name, customer_phone, table_id, items, total, created_at, status')
    .in('status', VISIBLE_STATUSES)
    .order('created_at', { ascending: true })

  if (since) {
    query = query.gte('created_at', since)
  }

  const { data, error } = await query

  if (error) {
    console.error('[production] GET error:', error)
    return err('Falha ao buscar pedidos', 500)
  }

  // Collect unique phones to look up customer profiles in batch
  const phones = Array.from(new Set((data ?? []).map((r) => r.customer_phone as string).filter(Boolean)))

  const customerMap = new Map<string, { orderCount: number; totalSpentCentavos: number }>()

  if (phones.length > 0) {
    const { data: clients } = await supabase
      .from('crm_clientes')
      .select('phone, order_count, total_spent_centavos')
      .in('phone', phones)

    for (const c of (clients ?? [])) {
      customerMap.set(c.phone as string, {
        orderCount:          (c.order_count          as number) ?? 0,
        totalSpentCentavos:  (c.total_spent_centavos as number) ?? 0,
      })
    }
  }

  const orders = (data ?? []).map((row) => {
    const profile = customerMap.get(row.customer_phone as string)
    return {
      id:           row.id           as string,
      customerName: row.customer_name as string,
      tableId:      (row.table_id ?? null) as string | null,
      items:        row.items as Array<{ productName: string; quantity: number; variations?: string }>,
      total:        row.total        as number,
      createdAt:    row.created_at   as string,
      status:       row.status       as KitchenStatus,
      customerOrderCount:         profile?.orderCount         ?? 0,
      customerTotalSpentCentavos: profile?.totalSpentCentavos ?? 0,
    }
  })

  return NextResponse.json({ orders })
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('JSON inválido', 400)
  }

  if (!body || typeof body !== 'object') return err('Body inválido', 400)

  const { id, status } = body as Record<string, unknown>

  if (typeof id !== 'string' || !id) return err('id obrigatório', 400)
  if (!KITCHEN_STATUSES.includes(status as KitchenStatus)) {
    return err(`status inválido — aceitos: ${KITCHEN_STATUSES.join(', ')}`, 400)
  }

  const { error } = await supabase
    .from('crm_pedidos')
    .update({ status })
    .eq('id', id)

  if (error) {
    console.error('[production] PATCH error:', error)
    return err('Falha ao atualizar status', 500)
  }

  // Trigger stock deduction when order is delivered
  let deductionResult: string = 'not_attempted'
  if (status === 'delivered') {
    console.log(`[production] delivered — calling deductStockForOrder(${id})`)
    try {
      const result = await deductStockForOrder(id)
      if (result.ok) {
        deductionResult = `ok:${result.movementsCreated}_movements`
        console.log(`[production] stock deducted for order ${id}: ${result.movementsCreated} movement(s)`)
      } else {
        deductionResult = `skipped:${result.reason}`
        console.warn(`[production] stock deduction skipped for order ${id}: reason=${result.reason}`)
      }
    } catch (e) {
      deductionResult = `exception:${String(e)}`
      console.error(`[production] deductStockForOrder threw for order ${id}:`, e)
    }
  }

  return NextResponse.json({ ok: true, deductionResult })
}
