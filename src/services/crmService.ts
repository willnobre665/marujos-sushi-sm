/**
 * crmService — Customer identity, order persistence, message logging, campaigns.
 *
 * Follows the same adapter pattern as orderService.
 * To switch to Supabase: create supabaseCrmAdapter implementing CrmAdapter,
 * then change the one `adapter` line. Nothing else changes.
 *
 * WhatsApp safety contract (enforced here, not in the adapter):
 * - registrarMensagem must be called for EVERY outbound message attempt.
 * - verificarConsentimento must return true before any message is dispatched.
 * - campanhas cannot be dispatched without status === 'approved'.
 * - Frequency caps and deduplication checks live in this service layer,
 *   not in the adapter (storage) or in the communication provider (transport).
 */
import { mockCrmAdapter } from './adapters/mockAdapter'
import type { CrmAdapter } from './adapters/types'
import type {
  CrmCliente,
  CrmPedido,
  CrmSession,
  MensagemLog,
  MessageCategory,
  Campaign,
} from '@/types/crm'
import type { ItemCarrinho } from '@/types/cart'
import { gerarUUID } from '@/utils/uuid'

const adapter: CrmAdapter = mockCrmAdapter

// ─── Re-export raw adapter operations ────────────────────────────────────────

export const crmService = {

  // ── Customer ────────────────────────────────────────────────────────────────

  salvarCliente: (cliente: CrmCliente) => adapter.salvarCliente(cliente),
  buscarCliente: (phone: string) => adapter.buscarCliente(phone),

  // ── Orders ──────────────────────────────────────────────────────────────────

  salvarPedido: (pedido: CrmPedido) => adapter.salvarPedido(pedido),
  buscarPedidosPorCliente: (phone: string) => adapter.buscarPedidosPorCliente(phone),

  /**
   * Build and persist a CrmPedido from raw checkout data.
   * Called by useCheckout immediately after the Saipos/mock order is confirmed.
   * The pedidoId is the same UUID as Pedido.id — the two records are joinable.
   */
  async registrarPedido(params: {
    pedidoId: string
    cliente: { phone: string; name: string }
    session: CrmSession
    itens: ItemCarrinho[]
    notes?: string
    paymentMethod?: string
  }): Promise<void> {
    const subtotal = params.itens.reduce((acc, i) => acc + i.precoTotal, 0)

    const crmPedido: CrmPedido = {
      id: params.pedidoId,
      customerPhone: params.cliente.phone,
      customerName: params.cliente.name,
      context: params.session.orderContext,
      tableId: params.session.tableId,
      source: params.session.entrySource,
      items: params.itens.map((i) => ({
        productId: i.produto.id,
        productName: i.produto.nome,
        unitPrice: i.precoUnitario,
        quantity: i.quantidade,
        total: i.precoTotal,
        variations: i.variacoesSelecionadas.map((v) => v.opcaoLabel).join(', ') || undefined,
        note: i.observacao,
      })),
      subtotal,
      discount: 0,
      serviceFee: 0,
      total: subtotal,
      notes: params.notes,
      paymentMethod: params.paymentMethod,
      createdAt: new Date().toISOString(),
      status: 'new',
      attribution: null,
    }

    return adapter.salvarPedido(crmPedido)
  },

  // ── Message log ─────────────────────────────────────────────────────────────

  /**
   * Log an outbound message attempt.
   * Always call this — even when blocked or failed — so the audit trail is complete.
   */
  async registrarMensagem(params: {
    customerPhone: string
    channel: MensagemLog['channel']
    category: MessageCategory
    templateId: string
    orderId?: string
    campaignId?: string
    status: MensagemLog['status']
    blockedReason?: string
    providerMessageId?: string
  }): Promise<void> {
    const log: MensagemLog = {
      id: gerarUUID(),
      customerPhone: params.customerPhone,
      channel: params.channel,
      category: params.category,
      templateId: params.templateId,
      orderId: params.orderId,
      campaignId: params.campaignId,
      status: params.status,
      blockedReason: params.blockedReason,
      sentAt: params.status === 'sent' ? new Date().toISOString() : undefined,
      statusUpdatedAt: new Date().toISOString(),
      providerMessageId: params.providerMessageId,
    }
    return adapter.registrarMensagem(log)
  },

  // ── Consent verification ─────────────────────────────────────────────────────
  //
  // This is the safety gate that sits between the CRM and the communication
  // provider. ALWAYS call this before dispatching any message.

  /**
   * Check whether a customer has valid consent for a given message category.
   *
   * Rules:
   * - transactional: requires orderUpdates consent granted === true
   * - relational:    requires relational consent granted === true
   * - promotional:   requires promotional consent granted === true
   *                  AND orderUpdates must also be granted (promotional implies
   *                  the customer wants to hear from us at all)
   *
   * Returns false if consent was never recorded (absence ≠ consent).
   */
  async verificarConsentimento(
    phone: string,
    category: MessageCategory
  ): Promise<{ permitted: boolean; reason: string }> {
    const cliente = await adapter.buscarCliente(phone)

    if (!cliente) {
      return { permitted: false, reason: 'customer_not_found' }
    }

    const prefs = cliente.preferencias

    switch (category) {
      case 'transactional':
        if (!prefs.orderUpdates?.granted) {
          return { permitted: false, reason: 'no_order_updates_consent' }
        }
        return { permitted: true, reason: 'ok' }

      case 'relational':
        if (!prefs.relational?.granted) {
          return { permitted: false, reason: 'no_relational_consent' }
        }
        return { permitted: true, reason: 'ok' }

      case 'promotional':
        if (!prefs.orderUpdates?.granted) {
          return { permitted: false, reason: 'no_base_consent' }
        }
        if (!prefs.promotional?.granted) {
          return { permitted: false, reason: 'no_promotional_consent' }
        }
        return { permitted: true, reason: 'ok' }
    }
  },

  // ── Campaigns ───────────────────────────────────────────────────────────────

  salvarCampanha: (campaign: Campaign) => adapter.salvarCampanha(campaign),
  buscarCampanha: (id: string) => adapter.buscarCampanha(id),

  /**
   * Approve a campaign. Only approved campaigns can be dispatched.
   * In production: this requires a manager-level auth check before calling.
   */
  async aprovarCampanha(id: string, approvedBy: string): Promise<void> {
    const campaign = await adapter.buscarCampanha(id)
    if (!campaign) throw new Error(`Campaign ${id} not found`)
    if (campaign.status !== 'pending') {
      throw new Error(`Campaign ${id} must be in 'pending' status to approve (got '${campaign.status}')`)
    }
    await adapter.salvarCampanha({
      ...campaign,
      status: 'approved',
      approvedBy,
      approvedAt: new Date().toISOString(),
    })
  },

  // ── Segmentation ────────────────────────────────────────────────────────────

  /**
   * Resolve which customers match a segment.
   * Used by the campaign runner to build the send list at dispatch time.
   * Never pre-computed as a static list — always resolved fresh.
   */
  buscarClientesPorSegmento: (tags: CrmCliente['segmentTags']) =>
    adapter.buscarClientesPorSegmento(tags),

  // ── Frequency cap helper ────────────────────────────────────────────────────

  /**
   * Check how many messages of a given category were sent to a customer
   * in the last N hours. Use this before dispatching to enforce rate limits.
   *
   * Recommended limits (not enforced here — enforced by the caller):
   * - transactional: no cap (event-triggered, one per order event)
   * - relational:    max 1 per 7 days
   * - promotional:   max 1 per 30 days
   */
  async contarMensagensRecentes(
    phone: string,
    category: MessageCategory,
    withinHours: number
  ): Promise<number> {
    const mensagens = await adapter.buscarMensagensPorCliente(phone, { category })
    const cutoff = new Date(Date.now() - withinHours * 60 * 60 * 1000).toISOString()
    return mensagens.filter(
      (m) => m.status !== 'blocked' && m.status !== 'failed' && m.statusUpdatedAt >= cutoff
    ).length
  },
}
