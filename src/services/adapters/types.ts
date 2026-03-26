import type { Categoria, Produto } from '@/types/product'
import type { NovoPedido, Pedido } from '@/types/order'
import type { NovaPesquisa, PesquisaSatisfacao } from '@/types/survey'
import type { CrmCliente, CrmPedido, MensagemLog, Campaign } from '@/types/crm'

export interface MenuAdapter {
  fetchCategorias(): Promise<Categoria[]>
  fetchProdutos(categoriaSlug: string): Promise<Produto[]>
  fetchProdutoPorSlug(slug: string): Promise<Produto | null>
  fetchProdutosPorIds(ids: string[]): Promise<Produto[]>
}

export interface OrderAdapter {
  criarPedido(dados: NovoPedido): Promise<Pedido>
  buscarPedido(id: string): Promise<Pedido | null>
}

export interface SurveyAdapter {
  enviarPesquisa(dados: NovaPesquisa): Promise<PesquisaSatisfacao>
  buscarPesquisaPorPedido(pedidoId: string): Promise<PesquisaSatisfacao | null>
}

/**
 * CrmAdapter — persistence interface for customer identity, orders, message logs,
 * and campaigns.
 *
 * Design rules:
 * - All write operations are upserts (idempotent on the primary key).
 * - Message logs are append-only — never update, never delete.
 * - Campaigns cannot be dispatched without an 'approved' status.
 * - Provider (WhatsApp, email, SMS) is never referenced here — that belongs
 *   in a separate CommunicationAdapter that this one does NOT compose.
 *
 * Mock implementation: localStorage.
 * Future implementation: Supabase (or any REST/RPC backend) — swap the one
 * `adapter` constant in crmService.ts without touching anything else.
 */
export interface CrmAdapter {
  // ── Customer identity ──────────────────────────────────────────────────────

  /** Upsert customer by phone. Merges consent records with existing data. */
  salvarCliente(cliente: CrmCliente): Promise<void>

  /** Fetch customer profile by phone number. */
  buscarCliente(phone: string): Promise<CrmCliente | null>

  // ── Orders ─────────────────────────────────────────────────────────────────

  /** Persist a normalized CRM order snapshot. Shares id with Pedido. */
  salvarPedido(pedido: CrmPedido): Promise<void>

  /** Fetch all CRM orders for a given customer phone. */
  buscarPedidosPorCliente(phone: string): Promise<CrmPedido[]>

  // ── Message log ────────────────────────────────────────────────────────────
  // Append-only. Every outbound message attempt must produce a log entry,
  // regardless of success or failure.

  /** Append a new message log entry. Never updates existing entries. */
  registrarMensagem(log: MensagemLog): Promise<void>

  /**
   * Fetch message history for a customer, optionally filtered by category.
   * Used to enforce frequency caps and deduplication before sending.
   */
  buscarMensagensPorCliente(
    phone: string,
    options?: { category?: MensagemLog['category']; limit?: number }
  ): Promise<MensagemLog[]>

  // ── Campaigns ──────────────────────────────────────────────────────────────
  // Campaigns target segments, not raw phone lists.
  // Safety controls (approval, batch limits) are enforced at the service layer,
  // not here — the adapter is only responsible for persistence.

  /** Upsert a campaign definition. */
  salvarCampanha(campaign: Campaign): Promise<void>

  /** Fetch a campaign by ID. */
  buscarCampanha(id: string): Promise<Campaign | null>

  /**
   * Fetch customers matching ALL of the given segment tags.
   * Used by the future campaign runner to resolve the target audience
   * at send time — never pre-computed as a static list.
   */
  buscarClientesPorSegmento(tags: CrmCliente['segmentTags']): Promise<CrmCliente[]>
}

// ─── Communication provider (separate concern) ────────────────────────────────
//
// Sending messages is NOT part of CrmAdapter.
// It lives in a separate CommunicationAdapter so the CRM data layer can be
// fully tested without any WhatsApp / email dependency, and so providers
// (unofficial tooling → official WABA provider) can be swapped independently.
//
// This interface is defined here for architectural clarity but intentionally
// NOT implemented in this MVP. The menu app never calls it directly.

export interface CommunicationAdapter {
  /**
   * Send a single templated message to one recipient.
   * Returns the provider-assigned message ID for log correlation.
   *
   * Safety contract:
   * - Caller MUST verify consent before calling this.
   * - Caller MUST log the attempt via CrmAdapter.registrarMensagem.
   * - This method MUST NOT be called in batch loops without rate limiting.
   */
  enviarMensagem(params: {
    to: string              // phone or email — provider-formatted
    channel: MensagemLog['channel']
    templateId: string
    variables?: Record<string, string>
    category: MensagemLog['category']
  }): Promise<{ providerMessageId: string }>
}
