/**
 * stockDeduction.ts
 *
 * Deducts ingredient stock when an order is delivered.
 * Idempotent: will not deduct twice for the same order_id.
 *
 * Flow:
 *  1. Check if movements already exist for this order (idempotency guard)
 *  2. Read crm_pedidos.items snapshot
 *  3. For each sold product, read its technical sheet (cmv_sheets + cmv_ingredients)
 *  4. Aggregate total ingredient consumption across all items
 *  5. Insert stock_movements rows (type = 'out')
 *  6. Decrement current_stock on each affected ingredient
 */

import { supabase } from '@/lib/supabaseServer'

interface OrderItem {
  productId: string
  quantity: number
  [key: string]: unknown
}

/**
 * Deducts stock for a delivered order.
 * Returns { ok: true } on success, { ok: false, reason } on skip/error.
 */
export async function deductStockForOrder(orderId: string): Promise<
  { ok: true; movementsCreated: number } | { ok: false; reason: string }
> {
  console.log(`[stockDeduction] START orderId=${orderId}`)

  // ── 1. Idempotency: check if already deducted ───────────────────────────────
  const { data: existing, error: existErr } = await supabase
    .from('stock_movements')
    .select('id')
    .eq('related_order_id', orderId)
    .limit(1)

  if (existErr) {
    console.error('[stockDeduction] idempotency check error:', existErr.message)
    return { ok: false, reason: existErr.message }
  }

  if (existing && existing.length > 0) {
    console.log(`[stockDeduction] already_deducted for orderId=${orderId}`)
    return { ok: false, reason: 'already_deducted' }
  }

  // ── 2. Read order items ─────────────────────────────────────────────────────
  const { data: orderRow, error: orderErr } = await supabase
    .from('crm_pedidos')
    .select('items')
    .eq('id', orderId)
    .single()

  if (orderErr || !orderRow) {
    console.error('[stockDeduction] order fetch error:', orderErr?.message, '— orderId:', orderId)
    return { ok: false, reason: orderErr?.message ?? 'order not found' }
  }

  const items = orderRow.items as OrderItem[] | null
  console.log(`[stockDeduction] raw items:`, JSON.stringify(items))

  if (!Array.isArray(items) || items.length === 0) {
    console.warn('[stockDeduction] no_items — items is empty or not an array')
    return { ok: false, reason: 'no_items' }
  }

  // ── 3. Collect product IDs and quantities ───────────────────────────────────
  const soldMap = new Map<string, number>() // productId → total qty sold
  for (const item of items) {
    console.log(`[stockDeduction] item: productId=${item.productId} quantity=${item.quantity}`)
    if (item.productId && item.quantity > 0) {
      soldMap.set(item.productId, (soldMap.get(item.productId) ?? 0) + item.quantity)
    } else {
      console.warn(`[stockDeduction] skipping item — productId="${item.productId}" quantity=${item.quantity}`)
    }
  }

  if (soldMap.size === 0) {
    console.warn('[stockDeduction] soldMap is empty after processing items')
    return { ok: false, reason: 'no_items' }
  }

  const productIds = Array.from(soldMap.keys())
  console.log(`[stockDeduction] productIds from order:`, productIds)

  // ── 4. Fetch ALL sheets to compare with sold product IDs ───────────────────
  // First fetch all known product_ids in cmv_sheets to help diagnose mismatches
  const { data: allSheetPids } = await supabase
    .from('cmv_sheets')
    .select('product_id')

  const knownPids = [...new Set((allSheetPids ?? []).map((r) => r.product_id as string))]
  console.log(`[stockDeduction] all product_ids in cmv_sheets:`, knownPids)

  const matched = productIds.filter((pid) => knownPids.includes(pid))
  const unmatched = productIds.filter((pid) => !knownPids.includes(pid))
  console.log(`[stockDeduction] matched product_ids:`, matched)
  console.log(`[stockDeduction] unmatched product_ids (no sheet):`, unmatched)

  // ── 5. Fetch technical sheets for sold products ────────────────────────────
  const { data: sheetRows, error: sheetsErr } = await supabase
    .from('cmv_sheets')
    .select('product_id, ingredient_id, quantity_used')
    .in('product_id', productIds)

  if (sheetsErr) {
    console.error('[stockDeduction] sheets fetch error:', sheetsErr.message)
    return { ok: false, reason: sheetsErr.message }
  }

  console.log(`[stockDeduction] sheetRows returned:`, JSON.stringify(sheetRows))

  if (!sheetRows || sheetRows.length === 0) {
    console.warn('[stockDeduction] no_sheets — no cmv_sheets rows matched the sold product_ids')
    return { ok: false, reason: 'no_sheets' }
  }

  // ── 6. Aggregate ingredient consumption ────────────────────────────────────
  const consumptionMap = new Map<string, number>() // ingredientId → total qty consumed

  for (const row of sheetRows) {
    const pid     = row.product_id as string
    const ingId   = row.ingredient_id as string
    const qtyUsed = row.quantity_used as number
    const qtySold = soldMap.get(pid) ?? 0

    console.log(`[stockDeduction] sheet row: product_id=${pid} ingredient_id=${ingId} quantity_used=${qtyUsed} qtySold=${qtySold}`)

    if (qtySold === 0) {
      console.warn(`[stockDeduction] qtySold=0 for product_id=${pid}, skipping`)
      continue
    }

    const total = qtyUsed * qtySold
    console.log(`[stockDeduction] consuming ${total} of ingredient ${ingId} (${qtyUsed} × ${qtySold})`)
    consumptionMap.set(ingId, (consumptionMap.get(ingId) ?? 0) + total)
  }

  console.log(`[stockDeduction] consumptionMap:`, Object.fromEntries(consumptionMap))

  if (consumptionMap.size === 0) {
    console.warn('[stockDeduction] no_consumption — consumptionMap is empty')
    return { ok: false, reason: 'no_consumption' }
  }

  // ── 7. Insert stock_movements ───────────────────────────────────────────────
  const movements = Array.from(consumptionMap.entries()).map(([ingredientId, quantity]) => ({
    ingredient_id:    ingredientId,
    type:             'out' as const,
    quantity,
    reason:           'Pedido entregue',
    related_order_id: orderId,
  }))

  console.log(`[stockDeduction] inserting ${movements.length} movement(s):`, JSON.stringify(movements))

  const { data: mvData, error: mvErr } = await supabase
    .from('stock_movements')
    .insert(movements)
    .select('id')

  if (mvErr) {
    console.error('[stockDeduction] movements insert error:', mvErr.message, mvErr.details, mvErr.hint)
    return { ok: false, reason: mvErr.message }
  }

  console.log(`[stockDeduction] movements inserted:`, JSON.stringify(mvData))

  // ── 8. Decrement current_stock for each ingredient ─────────────────────────
  // Try RPC first (atomic); fall back to read-modify-write if RPC doesn't exist.
  for (const [ingredientId, qty] of Array.from(consumptionMap.entries())) {
    console.log(`[stockDeduction] decrementing ingredient ${ingredientId} by ${qty}`)

    const { error: rpcErr } = await supabase.rpc('decrement_stock', {
      p_ingredient_id: ingredientId,
      p_qty:           qty,
    })

    if (rpcErr) {
      console.warn(`[stockDeduction] decrement_stock RPC failed for ${ingredientId}: ${rpcErr.message} — trying direct update`)

      // Fallback: read current value then write new value
      const { data: row, error: readErr } = await supabase
        .from('cmv_ingredients')
        .select('current_stock')
        .eq('id', ingredientId)
        .single()

      if (readErr || !row) {
        console.error(`[stockDeduction] fallback read failed for ${ingredientId}:`, readErr?.message)
        continue
      }

      const newStock = ((row as Record<string, unknown>).current_stock as number ?? 0) - qty
      const { error: writeErr } = await supabase
        .from('cmv_ingredients')
        .update({ current_stock: newStock })
        .eq('id', ingredientId)

      if (writeErr) {
        console.error(`[stockDeduction] fallback write failed for ${ingredientId}:`, writeErr.message)
      } else {
        console.log(`[stockDeduction] fallback write OK for ${ingredientId}: new stock=${newStock}`)
      }
    } else {
      console.log(`[stockDeduction] decrement_stock RPC OK for ${ingredientId}`)
    }
  }

  console.log(`[stockDeduction] DONE — movementsCreated=${movements.length}`)
  return { ok: true, movementsCreated: movements.length }
}
