/**
 * orderService — Criação e consulta de pedidos.
 *
 * Adapter selection:
 *   NEXT_PUBLIC_ORDER_ADAPTER=saipos  → saiposOrderAdapter (real Saipos integration)
 *   anything else (or unset)          → mockOrderAdapter   (localStorage, default)
 *
 * The env var is read at module load time. In development, leave it unset to
 * keep using the mock. Set it to "saipos" in production when credentials
 * (SAIPOS_API_URL, SAIPOS_PARTNER_ID, SAIPOS_SECRET, SAIPOS_COD_STORE) are set.
 */
import { mockOrderAdapter } from './adapters/mockAdapter'
import { saiposOrderAdapter } from './adapters/saiposAdapter'
import type { OrderAdapter } from './adapters/types'
import type { NovoPedido } from '@/types/order'

function resolveAdapter(): OrderAdapter {
  if (process.env.NEXT_PUBLIC_ORDER_ADAPTER === 'saipos') {
    console.log('[orderService] using saiposOrderAdapter')
    return saiposOrderAdapter
  }
  return mockOrderAdapter
}

const adapter: OrderAdapter = resolveAdapter()

export const orderService = {
  criarPedido: (dados: NovoPedido) => adapter.criarPedido(dados),
  buscarPedido: (id: string) => adapter.buscarPedido(id),
}
