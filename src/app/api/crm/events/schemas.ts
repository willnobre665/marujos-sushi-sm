/**
 * schemas.ts — Zod validation schemas for incoming CRM events.
 *
 * Validates the POST /api/crm/events request body.
 * All fields that are optional in the TypeScript types are also optional here,
 * so the validator never rejects a valid event due to a missing non-required field.
 *
 * Unknown keys are stripped (z.object().strip()) — forward-compatible with
 * future event fields added by the frontend before the backend is updated.
 *
 * Attribution schema tolerance:
 *   The validator accepts both legacy shape (v0: only firstTouch/lastTouch) and
 *   the current shape (v1: flat fields + schema_version). The processor always
 *   normalizes to v1 before writing to Supabase, so the DB always gets v1.
 */

import { z } from 'zod'

// ─── Shared sub-schemas ───────────────────────────────────────────────────────

const AttributionSnapshotSchema = z.object({
  utm_source:   z.string().optional(),
  utm_medium:   z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_content:  z.string().optional(),
  utm_term:     z.string().optional(),
  fbclid:       z.string().optional(),
  gclid:        z.string().optional(),
  referrer:     z.string().optional(),
  landing_path: z.string().optional(),
  captured_at:  z.string(),  // ISO 8601 — not strict datetime() to avoid silent strips
})

// Accept any attribution shape — flat fields and schema_version are all optional
// so legacy v0 events (only firstTouch/lastTouch) pass validation.
// The processor normalizes to v1 before writing.
const OrderAttributionSchema = z.object({
  schema_version: z.literal(1).optional(),
  utm_source:   z.string().nullable().optional(),
  utm_medium:   z.string().nullable().optional(),
  utm_campaign: z.string().nullable().optional(),
  utm_content:  z.string().nullable().optional(),
  utm_term:     z.string().nullable().optional(),
  fbclid:       z.string().nullable().optional(),
  gclid:        z.string().nullable().optional(),
  referrer:     z.string().nullable().optional(),
  landing_path: z.string().nullable().optional(),
  firstTouch:   AttributionSnapshotSchema.nullable().optional(),
  lastTouch:    AttributionSnapshotSchema.nullable().optional(),
})

const CustomerSchema = z.object({
  phone: z.string().min(10).max(15),
  name: z.string().min(1).max(120),
  email: z.string().email().optional(),
  consentOrderUpdates: z.boolean().optional(),
  consentPromotional: z.boolean().optional(),
  consentSource: z.enum([
    'checkout_form',
    'whatsapp_reply',
    'in_person',
    'unsubscribe_link',
  ]).optional(),
})

const OrderItemSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  categoryId: z.string().min(1),
  unitPrice: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  variations: z.string().optional(),
})

// ─── Per-event data schemas ───────────────────────────────────────────────────

const CustomerIdentifiedDataSchema = z.object({
  customer: CustomerSchema,
})

const OptInDataSchema = z.object({
  customer: CustomerSchema,
  category: z.enum(['transactional', 'relational', 'promotional']),
})

const OptOutDataSchema = z.object({
  customer: CustomerSchema,
  category: z.enum(['transactional', 'relational', 'promotional']),
})

const OrderCompletedDataSchema = z.object({
  orderId: z.string().uuid(),
  orderNumber: z.number().int().positive(),
  customer: CustomerSchema,
  context: z.enum(['dine_in', 'pickup', 'delivery']),
  tableId: z.string().optional(),
  source: z.enum(['qr', 'instagram', 'google', 'whatsapp', 'direct']),
  items: z.array(OrderItemSchema).min(1),
  total: z.number().int().nonnegative(),
  paymentMethod: z.string().min(1),
  attribution: OrderAttributionSchema,  // always present for new events; normalized to v1 in the processor
})

const OrderCreatedDataSchema = OrderCompletedDataSchema.omit({ orderNumber: true })

const AddToCartDataSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  categoryId: z.string().min(1),
  unitPrice: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
  withUpsell: z.boolean(),
  sessionId: z.string().min(1),
})

const UpsellClickedDataSchema = z.object({
  upsellProductId: z.string().min(1),
  upsellProductName: z.string().min(1),
  triggerProductId: z.string().min(1),
  accepted: z.boolean(),
  sessionId: z.string().min(1),
})

// ─── Discriminated union ──────────────────────────────────────────────────────

const CrmEventPayloadSchema = z.discriminatedUnion('event', [
  z.object({ event: z.literal('customer_identified'), data: CustomerIdentifiedDataSchema }),
  z.object({ event: z.literal('customer_opt_in'),     data: OptInDataSchema }),
  z.object({ event: z.literal('customer_opt_out'),    data: OptOutDataSchema }),
  z.object({ event: z.literal('order_created'),       data: OrderCreatedDataSchema }),
  z.object({ event: z.literal('order_completed'),     data: OrderCompletedDataSchema }),
  z.object({ event: z.literal('add_to_cart'),         data: AddToCartDataSchema }),
  z.object({ event: z.literal('upsell_clicked'),      data: UpsellClickedDataSchema }),
])

export const CrmEventSchema = z.object({
  id: z.string().uuid(),
  ts: z.string().datetime(),
  sessionId: z.string().min(1),
  operationId: z.string().min(1),  // 'santa_maria' | 'cacapava_do_sul'
  payload: CrmEventPayloadSchema,
})

export const EventBatchSchema = z.object({
  events: z.array(CrmEventSchema).min(1).max(100),
})

export type ValidatedCrmEvent = z.infer<typeof CrmEventSchema>
