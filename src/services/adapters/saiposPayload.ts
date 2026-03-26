/**
 * saiposPayload.ts — Builds the real Saipos wire payload from our internal NovoPedido.
 *
 * Rules applied here:
 *   - Monetary values are divided by 100 (centavos → reais) before being placed
 *     in the Saipos payload. All arithmetic uses centavos until this file.
 *   - Payment method codes follow the Saipos spec: DIN, CRE, DEB, VALE, PARTNER_PAYMENT.
 *   - Pix paid in-person: use complement to match the method name configured in
 *     Saipos back-office. Defaults to "PIX" — adjust PAGAMENTO_COMPLEMENT if needed.
 *   - Product integration_code defaults to our internal product.id.
 *     Add entries to PRODUCT_CODE_MAP when the Saipos back-office code differs.
 *   - Option integration_code defaults to a slug of the option label.
 *     Add entries to OPTION_CODE_MAP when needed.
 */

import type { NovoPedido, FormaPagamento } from '@/types/order'
import type {
  SaiposCriarPedidoRequest,
  SaiposItem,
  SaiposPaymentCode,
  SaiposPaymentType,
} from '@/types/saipos'
import { normalizePhone } from '@/utils/phone'

// ─── Payment mapping ──────────────────────────────────────────────────────────

const PAGAMENTO_CODE: Record<FormaPagamento, SaiposPaymentCode> = {
  pix:     'PARTNER_PAYMENT', // Pix paid in-person → configure in back-office and set complement
  credito: 'CRE',
  debito:  'DEB',
  dinheiro:'DIN',
  vr:      'VALE',
  va:      'VALE',
}

// complement must match the exact string configured in Saipos "Canais de venda".
// Leave as "" for Saipos to auto-match. Set to "PIX" if you have a named Pix method.
const PAGAMENTO_COMPLEMENT: Partial<Record<FormaPagamento, string>> = {
  pix: 'PIX',
  vr:  'VALE REFEIÇÃO',
  va:  'VALE ALIMENTAÇÃO',
}

// Online methods (already settled before arriving at the restaurant).
// TABLE-mode orders are always OFFLINE — customer pays at the table.
const PAGAMENTO_TYPE: Partial<Record<FormaPagamento, 'ONLINE' | 'OFFLINE'>> = {}

// ─── Product / option code overrides ─────────────────────────────────────────

// Add entries when the code registered in Saipos back-office differs from product.id.
// Example: { 'combo-executivo': 'COMBO001' }
const PRODUCT_CODE_MAP: Record<string, string> = {}

// Add entries when an option label in the UI differs from the code in Saipos.
// Example: { '16 peças': 'OPC-16PC' }
const OPTION_CODE_MAP: Record<string, string> = {}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const centavosParaReais = (centavos: number): number =>
  Math.round(centavos) / 100

function buildPaymentType(
  formaPagamento: FormaPagamento,
  totalReais: number,
  trocoPara?: number,
): SaiposPaymentType {
  const code = PAGAMENTO_CODE[formaPagamento]
  const complement = PAGAMENTO_COMPLEMENT[formaPagamento] ?? ''
  const type = PAGAMENTO_TYPE[formaPagamento] ?? 'OFFLINE'

  const change_for =
    formaPagamento === 'dinheiro' && trocoPara !== undefined
      ? centavosParaReais(trocoPara)
      : 0

  return { code, amount: totalReais, change_for, complement, type }
}

function buildItems(novoPedido: NovoPedido): SaiposItem[] {
  return novoPedido.itens.map((item) => {
    const integration_code = PRODUCT_CODE_MAP[item.produto.id] ?? item.produto.id

    const choice_items = item.variacoesSelecionadas.map((v) => ({
      integration_code: OPTION_CODE_MAP[v.opcaoLabel] ?? slugify(v.opcaoLabel),
      desc_item_choice: v.opcaoLabel,
      aditional_price: centavosParaReais(v.precoAdicional),
      quantity: 1,
    }))

    return {
      integration_code,
      desc_item: item.produto.nome,
      quantity: item.quantidade,
      unit_price: centavosParaReais(item.precoUnitario),
      choice_items,
      ...(item.observacao ? { notes: item.observacao } : {}),
    }
  })
}

/** Produces a stable lowercase-hyphen string usable as an integration code. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Converts our internal NovoPedido into the exact JSON body for POST /criar-pedido.
 *
 * @param novoPedido  - raw checkout data from useCheckout
 * @param orderId     - our stable UUID for this order (becomes Saipos order_id)
 * @param displayId   - human-readable order number (shown in the POS kanban)
 * @param codStore    - Saipos store identifier from env
 * @param criadoEm    - ISO 8601 creation timestamp
 */
export function buildSaiposPayload(
  novoPedido: NovoPedido,
  orderId: string,
  displayId: string,
  codStore: string,
  criadoEm: string,
): SaiposCriarPedidoRequest {
  const subtotalCentavos = novoPedido.itens.reduce((acc, i) => acc + i.precoTotal, 0)
  const totalReais = centavosParaReais(subtotalCentavos)
  const mesa = novoPedido.mesa ?? ''

  return {
    order_id:       orderId,
    display_id:     displayId,
    cod_store:      codStore,
    created_at:     criadoEm,
    total_discount: 0,
    total_increase: 0,
    total_amount:   totalReais,

    customer: {
      id:    novoPedido.cliente.telefone
               ? normalizePhone(novoPedido.cliente.telefone)
               : '-1',
      name:  novoPedido.cliente.nome,
      ...(novoPedido.cliente.telefone
        ? { phone: normalizePhone(novoPedido.cliente.telefone) }
        : {}),
      ...(novoPedido.cliente.email ? { email: novoPedido.cliente.email } : {}),
    },

    order_method: {
      mode:               'TABLE',
      table_reference:    mesa,
      scheduled:          false,
      delivery_date_time: null,
      pickupCode:         null,
      ...(novoPedido.observacaoGeral ? { desc_sale: novoPedido.observacaoGeral } : {}),
    },

    table: {
      desc_table: mesa,
    },

    items: buildItems(novoPedido),

    payment_types: [
      buildPaymentType(novoPedido.formaPagamento, totalReais, novoPedido.trocoPara),
    ],

    ...(novoPedido.observacaoGeral ? { notes: novoPedido.observacaoGeral } : {}),
  }
}
