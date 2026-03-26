/**
 * saiposAdapter — Client-side adapter that proxies order creation through
 * the Next.js server route /api/orders.
 *
 * WHY A PROXY ROUTE:
 *   Saipos credentials (SAIPOS_PARTNER_ID, SAIPOS_SECRET, SAIPOS_COD_STORE)
 *   are server-only env vars. useCheckout runs on the client, so the adapter
 *   cannot access them directly. The real Saipos HTTP logic lives in
 *   /api/orders/route.ts which has full access to all server env vars.
 *
 * This file stays in src/services/adapters/ and is imported by orderService.ts.
 * It is bundled into the client, but it only calls our own Next.js API — never
 * Saipos directly. Credentials never touch the browser.
 *
 * To activate:
 *   NEXT_PUBLIC_ORDER_ADAPTER=saipos  (in .env.local)
 *
 * CRM flow: untouched. useCheckout fires CRM events from the Pedido we return —
 * the Supabase persistence path does not change regardless of which adapter is active.
 */

import type { MenuAdapter, OrderAdapter, SurveyAdapter } from './types'
import type { NovoPedido, Pedido } from '@/types/order'

// ─── Order adapter ────────────────────────────────────────────────────────────

export const saiposOrderAdapter: OrderAdapter = {
  async criarPedido(dados: NovoPedido): Promise<Pedido> {
    console.log(
      '[saiposAdapter] criarPedido → forwarding to /api/orders',
      'mesa:', dados.mesa,
      'items:', dados.itens.length,
    )

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(
        `[saiposAdapter] /api/orders failed — HTTP ${res.status}: ${body.error ?? 'unknown error'}`,
      )
    }

    const pedido = await res.json() as Pedido
    console.log('[saiposAdapter] criarPedido OK → order_id:', pedido.id, 'numeroPedido:', pedido.numeroPedido)
    return pedido
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async buscarPedido(id: string): Promise<Pedido | null> {
    // GET /consultar-pedido is available but not required for the current flow.
    // Implement when the confirmation page needs live status polling.
    console.warn('[saiposAdapter] buscarPedido: not yet implemented — returning null')
    return null
  },
}

// ─── Menu adapter ─────────────────────────────────────────────────────────────
// Menu is served from our own data files. Saipos menu sync is out of scope.

export const saiposMenuAdapter: MenuAdapter = {
  fetchCategorias:    () => { throw new Error('[saiposAdapter] Menu uses mockMenuAdapter.') },
  fetchProdutos:      () => { throw new Error('[saiposAdapter] Menu uses mockMenuAdapter.') },
  fetchProdutoPorSlug:() => { throw new Error('[saiposAdapter] Menu uses mockMenuAdapter.') },
  fetchProdutosPorIds:() => { throw new Error('[saiposAdapter] Menu uses mockMenuAdapter.') },
}

// ─── Survey adapter ───────────────────────────────────────────────────────────

export const saiposSurveyAdapter: SurveyAdapter = {
  enviarPesquisa:          () => { throw new Error('[saiposAdapter] surveyAdapter: not yet implemented.') },
  buscarPesquisaPorPedido: () => { throw new Error('[saiposAdapter] surveyAdapter: not yet implemented.') },
}
