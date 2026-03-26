import { categories } from '@/data/categories'
import { products } from '@/data/products'
import type { NovoPedido, Pedido } from '@/types/order'
import type { NovaPesquisa, PesquisaSatisfacao } from '@/types/survey'
import type { CrmCliente, CrmPedido, MensagemLog, Campaign } from '@/types/crm'
import type { MenuAdapter, OrderAdapter, SurveyAdapter, CrmAdapter } from './types'
import { gerarUUID } from '@/utils/uuid'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const PEDIDOS_KEY = 'marujos_pedidos'
const PESQUISAS_KEY = 'marujos_pesquisas'
const CONTADOR_KEY = 'marujos_pedido_contador'
const CRM_CLIENTES_KEY  = 'marujos_crm_clientes'
const CRM_PEDIDOS_KEY   = 'marujos_crm_pedidos'
const CRM_MENSAGENS_KEY = 'marujos_crm_mensagens'
const CRM_CAMPANHAS_KEY = 'marujos_crm_campanhas'

function getPedidos(): Pedido[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(PEDIDOS_KEY) ?? '[]')
  } catch {
    return []
  }
}

function savePedidos(pedidos: Pedido[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(PEDIDOS_KEY, JSON.stringify(pedidos))
}

function getNextNumeroPedido(): number {
  if (typeof window === 'undefined') return 1
  const atual = parseInt(localStorage.getItem(CONTADOR_KEY) ?? '0', 10)
  const proximo = atual + 1
  localStorage.setItem(CONTADOR_KEY, String(proximo))
  return proximo
}

function getPesquisas(): PesquisaSatisfacao[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(PESQUISAS_KEY) ?? '[]')
  } catch {
    return []
  }
}

function savePesquisas(pesquisas: PesquisaSatisfacao[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(PESQUISAS_KEY, JSON.stringify(pesquisas))
}

export const mockMenuAdapter: MenuAdapter = {
  async fetchCategorias() {
    await delay(300)
    return categories.filter((c) => c.ativa).sort((a, b) => a.ordemExibicao - b.ordemExibicao)
  },

  async fetchProdutos(categoriaSlug: string) {
    await delay(300)
    const categoria = categories.find((c) => c.slug === categoriaSlug)
    if (!categoria) return []
    return products
      .filter((p) => p.categoriaId === categoria.id && p.disponivel)
      .sort((a, b) => a.ordemExibicao - b.ordemExibicao)
  },

  async fetchProdutoPorSlug(slug: string) {
    await delay(200)
    return products.find((p) => p.slug === slug && p.disponivel) ?? null
  },

  async fetchProdutosPorIds(ids: string[]) {
    await delay(200)
    return products.filter((p) => ids.includes(p.id) && p.disponivel)
  },
}

export const mockOrderAdapter: OrderAdapter = {
  async criarPedido(dados: NovoPedido): Promise<Pedido> {
    await delay(500)

    const subtotal = dados.itens.reduce((acc, item) => acc + item.precoTotal, 0)
    const taxaServico = 0
    const total = subtotal + taxaServico

    const pedido: Pedido = {
      id: gerarUUID(),
      numeroPedido: getNextNumeroPedido(),
      status: 'recebido',
      mesa: dados.mesa,
      endereco: dados.endereco,
      cliente: dados.cliente,
      itens: dados.itens.map((item) => ({
        id: gerarUUID(),
        produtoId: item.produto.id,
        produtoNome: item.produto.nome,
        produtoPreco: item.precoUnitario,
        variacoes: item.variacoesSelecionadas.map((v) => v.opcaoLabel).join(', '),
        observacao: item.observacao,
        quantidade: item.quantidade,
        subtotal: item.precoTotal,
      })),
      formaPagamento: dados.formaPagamento,
      trocoPara: dados.trocoPara,
      observacaoGeral: dados.observacaoGeral,
      subtotal,
      taxaServico,
      total,
      criadoEm: new Date().toISOString(),
    }

    const pedidos = getPedidos()
    pedidos.push(pedido)
    savePedidos(pedidos)

    return pedido
  },

  async buscarPedido(id: string): Promise<Pedido | null> {
    await delay(200)
    const pedidos = getPedidos()
    return pedidos.find((p) => p.id === id) ?? null
  },
}

export const mockSurveyAdapter: SurveyAdapter = {
  async enviarPesquisa(dados: NovaPesquisa): Promise<PesquisaSatisfacao> {
    await delay(400)

    const pesquisa: PesquisaSatisfacao = {
      ...dados,
      id: gerarUUID(),
      criadoEm: new Date().toISOString(),
    }

    const pesquisas = getPesquisas()
    pesquisas.push(pesquisa)
    savePesquisas(pesquisas)

    return pesquisa
  },

  async buscarPesquisaPorPedido(pedidoId: string): Promise<PesquisaSatisfacao | null> {
    await delay(200)
    const pesquisas = getPesquisas()
    return pesquisas.find((p) => p.pedidoId === pedidoId) ?? null
  },
}

// ─── CRM mock adapter ─────────────────────────────────────────────────────────
// Persists to localStorage. Replace with supabaseCrmAdapter when backend is ready.
// All CRM writes are silent background operations — no artificial delay.

function readJson<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') } catch { return [] }
}

function writeJson<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(data))
}

export const mockCrmAdapter: CrmAdapter = {
  // ── Customer identity ────────────────────────────────────────────────────

  async salvarCliente(cliente: CrmCliente): Promise<void> {
    const all = readJson<CrmCliente>(CRM_CLIENTES_KEY)
    const idx = all.findIndex((c) => c.phone === cliente.phone)
    if (idx >= 0) { all[idx] = cliente } else { all.push(cliente) }
    writeJson(CRM_CLIENTES_KEY, all)
  },

  async buscarCliente(phone: string): Promise<CrmCliente | null> {
    return readJson<CrmCliente>(CRM_CLIENTES_KEY).find((c) => c.phone === phone) ?? null
  },

  // ── Orders ───────────────────────────────────────────────────────────────

  async salvarPedido(pedido: CrmPedido): Promise<void> {
    const all = readJson<CrmPedido>(CRM_PEDIDOS_KEY)
    const idx = all.findIndex((p) => p.id === pedido.id)
    if (idx >= 0) { all[idx] = pedido } else { all.push(pedido) }
    writeJson(CRM_PEDIDOS_KEY, all)
  },

  async buscarPedidosPorCliente(phone: string): Promise<CrmPedido[]> {
    return readJson<CrmPedido>(CRM_PEDIDOS_KEY).filter((p) => p.customerPhone === phone)
  },

  // ── Message log (append-only) ────────────────────────────────────────────

  async registrarMensagem(log: MensagemLog): Promise<void> {
    // Append-only — never overwrite. If the same provider ID appears twice,
    // the second entry wins (handles provider webhook retries).
    const all = readJson<MensagemLog>(CRM_MENSAGENS_KEY)
    const idx = log.providerMessageId
      ? all.findIndex((m) => m.providerMessageId === log.providerMessageId)
      : -1
    if (idx >= 0) { all[idx] = log } else { all.push(log) }
    writeJson(CRM_MENSAGENS_KEY, all)
  },

  async buscarMensagensPorCliente(
    phone: string,
    options?: { category?: MensagemLog['category']; limit?: number }
  ): Promise<MensagemLog[]> {
    let all = readJson<MensagemLog>(CRM_MENSAGENS_KEY)
      .filter((m) => m.customerPhone === phone)
      .sort((a, b) => b.statusUpdatedAt.localeCompare(a.statusUpdatedAt)) // newest first

    if (options?.category) {
      all = all.filter((m) => m.category === options.category)
    }
    if (options?.limit) {
      all = all.slice(0, options.limit)
    }
    return all
  },

  // ── Campaigns ────────────────────────────────────────────────────────────

  async salvarCampanha(campaign: Campaign): Promise<void> {
    const all = readJson<Campaign>(CRM_CAMPANHAS_KEY)
    const idx = all.findIndex((c) => c.id === campaign.id)
    if (idx >= 0) { all[idx] = campaign } else { all.push(campaign) }
    writeJson(CRM_CAMPANHAS_KEY, all)
  },

  async buscarCampanha(id: string): Promise<Campaign | null> {
    return readJson<Campaign>(CRM_CAMPANHAS_KEY).find((c) => c.id === id) ?? null
  },

  async buscarClientesPorSegmento(tags: CrmCliente['segmentTags']): Promise<CrmCliente[]> {
    if (tags.length === 0) return []
    return readJson<CrmCliente>(CRM_CLIENTES_KEY).filter((c) =>
      tags.every((tag) => c.segmentTags.includes(tag))
    )
  },
}
