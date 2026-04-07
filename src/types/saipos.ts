/**
 * saipos.ts — Wire types for the Saipos Order API.
 *
 * These types match the REAL Saipos API field names exactly.
 * Source: https://saipos-docs-order-api.readme.io/reference/estrutura-campos-endpoints
 *
 * Monetary values here are in REAIS (decimal), not centavos.
 * Conversion happens in saiposPayload.ts (÷ 100) before building these objects.
 *
 * These types never leak into components, hooks, or the CRM layer.
 * Our internal schema (NovoPedido, Pedido) remains in centavos throughout.
 */

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface SaiposAuthRequest {
  idPartner: string
  secret: string
}

export interface SaiposAuthResponse {
  token: string
}

// ─── Payment types ────────────────────────────────────────────────────────────

/**
 * Payment method codes as used by Saipos.
 * Docs: https://saipos-docs-order-api.readme.io/reference/rotinas-pdv
 *
 * DIN            = Cash (Dinheiro). Use change_for for troco.
 * CRE            = Credit card (in-person).
 * DEB            = Debit card (in-person).
 * VALE           = Meal/food voucher (VR / VA).
 * PARTNER_PAYMENT = Payment already processed online (e.g. Pix paid online).
 *
 * Pix paid IN PERSON at the restaurant: configure a named method in Saipos
 * back-office (e.g. "PIX") and match it via the `complement` field.
 * If you have not done that yet, use "DIN" as a fallback.
 */
export type SaiposPaymentCode = 'DIN' | 'CRE' | 'DEB' | 'VALE' | 'PARTNER_PAYMENT' | 'OTHER'

export interface SaiposPaymentType {
  code: SaiposPaymentCode
  amount: number        // reais, decimal
  change_for: number    // reais — troco target; set to 0 when not cash
}

// ─── Order items ──────────────────────────────────────────────────────────────

export interface SaiposChoiceItem {
  integration_code: string   // option code registered in Saipos
  desc_item_choice: string   // option label
  aditional_price: number    // reais — extra charge for this option
  quantity: number
  notes?: string
}

export interface SaiposItem {
  integration_code: string   // product code registered in Saipos (must match back-office)
  desc_item: string          // product name (snapshot)
  quantity: number
  unit_price: number         // reais, decimal
  notes?: string             // per-item observation for the kitchen
  id_store_waiter?: string   // waiter ID — optional for TABLE mode
  choice_items: SaiposChoiceItem[]
}

// ─── Delivery address ─────────────────────────────────────────────────────────

export interface SaiposDeliveryAddress {
  street_name: string        // logradouro
  street_number: string      // número
  district: string           // bairro
  reference?: string         // ponto de referência
}

// ─── Order method ─────────────────────────────────────────────────────────────

export type SaiposOrderMode = 'TABLE' | 'TAKEOUT' | 'DELIVERY' | 'TICKET'

export interface SaiposOrderMethod {
  mode: SaiposOrderMode
  scheduled: boolean
  delivery_date_time: string | null
  pickupCode: string | null
  delivery_by?: 'PARTNER' | 'RESTAURANT'  // required for DELIVERY
  address?: SaiposDeliveryAddress           // required when delivery_by === 'RESTAURANT'
  desc_sale?: string
}

// ─── Table ────────────────────────────────────────────────────────────────────

export interface SaiposTable {
  desc_table: string         // table number/name — mirrors order_method.table_reference
  desc_order_pad?: string    // comanda number (not used in our flow)
  integration_code?: string
}

// ─── Customer ─────────────────────────────────────────────────────────────────

export interface SaiposCustomer {
  id: string                 // use "-1" for unidentified / dine-in table guest
  name?: string
  phone?: string
  email?: string
}

// ─── Full order request ───────────────────────────────────────────────────────

/**
 * Body sent to POST /criar-pedido.
 *
 * Required fields: order_id, display_id, cod_store, created_at,
 *                  total_amount, order_method, table, items, payment_types.
 */
export interface SaiposCriarPedidoRequest {
  order_id: string           // our UUID — idempotency key; Saipos returns 904 on duplicate
  display_id: string         // human-readable order number shown in the POS kanban
  cod_store: string          // store identifier provided by Saipos at credentialing
  created_at: string         // ISO 8601 with timezone, e.g. "2026-03-24T19:30:00-03:00"
  notes?: string             // general order observation
  total_amount: number       // reais — final amount charged to the customer
  customer: SaiposCustomer
  order_method: SaiposOrderMethod
  table?: SaiposTable        // only for TABLE mode
  items: SaiposItem[]
  payment_types: SaiposPaymentType[]
}

// ─── Response ─────────────────────────────────────────────────────────────────

/**
 * Saipos returns HTTP 200 with an empty object on success.
 * All order metadata (IDs, numbers) are supplied by us in the request.
 */
export type SaiposCriarPedidoResponse = Record<string, never>

/**
 * Error body returned on 4xx/5xx.
 */
export interface SaiposErrorResponse {
  t: string
  dateTime: string
  errorMessage: string
  guidRequest: string        // Saipos support trace ID — log this on errors
}

/**
 * Parsed result of a create-order call — success or typed error.
 */
export type SaiposCriarPedidoResult =
  | { ok: true }
  | { ok: false; status: number; errorMessage: string; guidRequest: string }
