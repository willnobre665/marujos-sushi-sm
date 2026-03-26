/**
 * processors.ts — One function per CRM event type.
 *
 * Each processor receives a validated event, reads/writes through crmService,
 * and never throws — failures are caught and logged so one bad event doesn't
 * block the rest of the batch.
 *
 * Persistence summary:
 *
 * customer_identified  → upsert customer (name, email, consent, timestamps)
 * customer_opt_in      → upsert customer consent record for given category
 * customer_opt_out     → upsert customer consent record (granted: false)
 * order_created        → upsert customer + upsert CrmPedido (status: pending)
 * order_completed      → upsert customer + upsert CrmPedido (status: confirmed)
 * add_to_cart          → no persistence (behavioral signal — event log only)
 * upsell_clicked       → no persistence (behavioral signal — event log only)
 *
 * All events are also stored in the raw event log (handled in route.ts,
 * not here, so processors stay focused on structured data).
 */

import type { ValidatedCrmEvent } from './schemas'
import type { CrmCliente, CrmPedido, ConsentRecord, MessageCategory, OrderAttribution } from '@/types/crm'
import { supabaseCrmAdapter as adapter } from '@/services/adapters/supabaseCrmAdapter'
import { appendConsentLog } from '@/services/adapters/supabaseCrmAdapter'
import { calcSegments } from '@/utils/crmSegmentation'
import { runTriggers } from '@/utils/crmTriggers'

// ─── Attribution normalizer ───────────────────────────────────────────────────
//
// Accepts any incoming attribution shape (v0: touch records only; v1: full schema)
// and always returns a canonical v1 object. For v0 events, flat fields are derived
// from lastTouch with firstTouch as fallback. Values are lowercased for consistency.

type RawAttribution = Record<string, unknown> | null | undefined

function normalizeAttribution(raw: RawAttribution): OrderAttribution {
  if (!raw) {
    return {
      schema_version: 1,
      utm_source: null, utm_medium: null, utm_campaign: null,
      utm_content: null, utm_term: null, fbclid: null, gclid: null,
      referrer: null, landing_path: null,
      firstTouch: null, lastTouch: null,
    }
  }

  // If already v1, return as-is (all flat fields already present).
  if (raw.schema_version === 1) return raw as unknown as OrderAttribution

  // Legacy v0: only firstTouch/lastTouch present — derive flat fields from them.
  const first = (raw.firstTouch ?? null) as Record<string, unknown> | null
  const last  = (raw.lastTouch  ?? null) as Record<string, unknown> | null

  function pick(field: string): string | null {
    const v = (last?.[field] ?? first?.[field]) as string | undefined
    if (!v) return null
    // Lowercase everything except referrer (URLs are case-sensitive) and captured_at
    return field === 'referrer' ? v : v.toLowerCase()
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
    firstTouch: first as OrderAttribution['firstTouch'],
    lastTouch:  last  as OrderAttribution['lastTouch'],
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConsentRecord(granted: boolean, ts: string, source: ConsentRecord['source']): ConsentRecord {
  return { granted, grantedAt: ts, source }
}

async function upsertCustomer(params: {
  phone: string
  name: string
  email?: string
  consentOrderUpdates?: boolean
  consentPromotional?: boolean
  consentSource?: ConsentRecord['source']
  ts: string
}): Promise<void> {
  const existing = await adapter.buscarCliente(params.phone)
  const source = params.consentSource ?? 'checkout_form'

  const orderUpdatesRecord: ConsentRecord | undefined =
    params.consentOrderUpdates !== undefined
      ? makeConsentRecord(params.consentOrderUpdates, params.ts, source)
      : existing?.preferencias?.orderUpdates

  const promotionalRecord: ConsentRecord | undefined =
    params.consentPromotional !== undefined
      ? makeConsentRecord(params.consentPromotional, params.ts, source)
      : existing?.preferencias?.promotional

  const cliente: CrmCliente = {
    phone: params.phone,
    name: params.name,
    email: params.email ?? existing?.email,
    birthday: existing?.birthday,
    preferencias: {
      channel: existing?.preferencias?.channel ?? 'whatsapp',
      orderUpdates: orderUpdatesRecord,
      relational: existing?.preferencias?.relational,
      promotional: promotionalRecord,
    },
    orderCount: existing?.orderCount ?? 0,
    totalSpentCentavos: existing?.totalSpentCentavos ?? 0,
    firstSeenAt: existing?.firstSeenAt ?? params.ts,
    lastSeenAt: params.ts,
    lastOrderAt: existing?.lastOrderAt,
    ordersLast30Days: existing?.ordersLast30Days ?? 0,
    ...calcSegments(existing?.lastOrderAt, existing?.ordersLast30Days ?? 0),
  }

  await adapter.salvarCliente(cliente)
}

// ─── Per-event processors ─────────────────────────────────────────────────────

export async function processCustomerIdentified(event: ValidatedCrmEvent): Promise<void> {
  if (event.payload.event !== 'customer_identified') return
  const { customer } = event.payload.data
  await upsertCustomer({
    phone: customer.phone,
    name: customer.name,
    email: customer.email,
    consentOrderUpdates: customer.consentOrderUpdates,
    consentPromotional: customer.consentPromotional,
    consentSource: customer.consentSource,
    ts: event.ts,
  })
}

export async function processOptIn(event: ValidatedCrmEvent): Promise<void> {
  if (event.payload.event !== 'customer_opt_in') return
  const { customer, category } = event.payload.data

  const existing = await adapter.buscarCliente(customer.phone)
  if (!existing) return  // customer must exist first (customer_identified fires before opt_in)

  const record = makeConsentRecord(true, event.ts, customer.consentSource ?? 'checkout_form')
  const prefs = { ...existing.preferencias }

  const catMap: Record<MessageCategory, keyof typeof prefs> = {
    transactional: 'orderUpdates',
    relational:    'relational',
    promotional:   'promotional',
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(prefs as any)[catMap[category]] = record

  await adapter.salvarCliente({ ...existing, preferencias: prefs, lastSeenAt: event.ts })

  // Immutable consent log entry.
  await appendConsentLog({
    customerPhone: customer.phone,
    category,
    granted: true,
    grantedAt: event.ts,
    source: customer.consentSource ?? 'checkout_form',
    eventId: event.id,
  })
}

export async function processOptOut(event: ValidatedCrmEvent): Promise<void> {
  if (event.payload.event !== 'customer_opt_out') return
  const { customer, category } = event.payload.data

  const existing = await adapter.buscarCliente(customer.phone)
  if (!existing) return

  const record = makeConsentRecord(false, event.ts, customer.consentSource ?? 'checkout_form')
  const prefs = { ...existing.preferencias }

  const catMap: Record<MessageCategory, keyof typeof prefs> = {
    transactional: 'orderUpdates',
    relational:    'relational',
    promotional:   'promotional',
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(prefs as any)[catMap[category]] = record

  await adapter.salvarCliente({ ...existing, preferencias: prefs, lastSeenAt: event.ts })

  // Immutable consent log entry.
  await appendConsentLog({
    customerPhone: customer.phone,
    category,
    granted: false,
    grantedAt: event.ts,
    source: customer.consentSource ?? 'checkout_form',
    eventId: event.id,
  })
}

export async function processOrderCompleted(event: ValidatedCrmEvent): Promise<void> {
  if (event.payload.event !== 'order_completed') return
  const d = event.payload.data

  // 1. Upsert customer — increment order count and total spend.
  const existing = await adapter.buscarCliente(d.customer.phone)
  await upsertCustomer({
    phone: d.customer.phone,
    name: d.customer.name,
    email: d.customer.email,
    consentOrderUpdates: d.customer.consentOrderUpdates,
    consentPromotional: d.customer.consentPromotional,
    consentSource: d.customer.consentSource,
    ts: event.ts,
  })

  // Update order count, lifetime spend, rolling 30-day count, and segment tags.
  const updated = await adapter.buscarCliente(d.customer.phone)
  if (updated) {
    const thirtyDaysAgo = new Date(new Date(event.ts).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const previousOrdersInWindow =
      existing?.lastOrderAt && existing.lastOrderAt >= thirtyDaysAgo
        ? (existing.ordersLast30Days ?? 0)
        : 0
    const ordersLast30Days = previousOrdersInWindow + 1
    const newSegments = calcSegments(event.ts, ordersLast30Days)

    await adapter.salvarCliente({
      ...updated,
      orderCount: (existing?.orderCount ?? 0) + 1,
      totalSpentCentavos: (existing?.totalSpentCentavos ?? 0) + d.total,
      lastOrderAt: event.ts,
      ordersLast30Days,
      ...newSegments,
    })

    // Fire automation triggers.
    // Pass null as `previous` when this is the customer's first completed order,
    // regardless of whether a record was already created by customer_identified
    // or customer_opt_in. orderCount is the authoritative signal for "first order".
    const isFirstOrder = !existing || (existing.orderCount ?? 0) === 0
    const previousForTriggers = isFirstOrder ? null : existing
    console.log(`[processOrderCompleted] calling runTriggers — phone=${d.customer.phone} isFirstOrder=${isFirstOrder} newSegments=${JSON.stringify(newSegments)}`)
    await runTriggers(
      previousForTriggers,
      newSegments,
      d.customer.phone
    )
    console.log(`[processOrderCompleted] runTriggers returned for phone=${d.customer.phone}`)
  }

  // 2. Upsert CrmPedido — always write normalized v1 attribution.
  const attribution = normalizeAttribution(d.attribution as RawAttribution)
  console.log(
    '[processor] order_completed — operation:', event.operationId,
    'orderId:', d.orderId,
    'attribution:', JSON.stringify(attribution),
  )
  // TODO(multi-store): when crm_pedidos gains an operation_id column, pass event.operationId here.
  const pedido: CrmPedido = {
    id: d.orderId,
    customerPhone: d.customer.phone,
    customerName: d.customer.name,
    context: d.context,
    tableId: d.tableId,
    source: d.source,
    items: d.items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      total: i.total,
      variations: i.variations,
    })),
    subtotal: d.total,
    discount: 0,
    serviceFee: 0,
    total: d.total,
    paymentMethod: d.paymentMethod,
    createdAt: event.ts,
    status: 'new',
    attribution,  // always v1 — normalizeAttribution() guarantees schema_version: 1
  }
  await adapter.salvarPedido(pedido)
}

export async function processOrderCreated(event: ValidatedCrmEvent): Promise<void> {
  if (event.payload.event !== 'order_created') return
  const d = event.payload.data

  console.log('[processor] order_created — operation:', event.operationId, 'orderId:', d.orderId)
  // TODO(multi-store): when crm_pedidos gains an operation_id column, pass event.operationId here.

  await upsertCustomer({
    phone: d.customer.phone,
    name: d.customer.name,
    email: d.customer.email,
    consentOrderUpdates: d.customer.consentOrderUpdates,
    consentPromotional: d.customer.consentPromotional,
    consentSource: d.customer.consentSource,
    ts: event.ts,
  })

  const pedido: CrmPedido = {
    id: d.orderId,
    customerPhone: d.customer.phone,
    customerName: d.customer.name,
    context: d.context,
    tableId: d.tableId,
    source: d.source,
    items: d.items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      total: i.total,
      variations: i.variations,
    })),
    subtotal: d.total,
    discount: 0,
    serviceFee: 0,
    total: d.total,
    createdAt: event.ts,
    status: 'new',
    attribution: null,
  }
  await adapter.salvarPedido(pedido)
}
