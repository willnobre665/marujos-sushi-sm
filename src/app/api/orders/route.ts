/**
 * POST /api/orders
 *
 * Server-side handler for Saipos order creation.
 *
 * Why this route exists:
 *   Saipos credentials (SAIPOS_PARTNER_ID, SAIPOS_SECRET, SAIPOS_COD_STORE)
 *   are server-only env vars. The checkout runs client-side, so the saiposAdapter
 *   cannot access them. This route runs on the server and holds all real Saipos
 *   HTTP logic: auth, payload build, POST to Saipos, response mapping.
 *
 * Active only when NEXT_PUBLIC_ORDER_ADAPTER=saipos.
 * Returns the internal Pedido object used by the client for CRM and routing.
 *
 * Debug logging:
 *   Set SAIPOS_DEBUG=true in .env.local to log the full Saipos wire payload.
 *   Never enable in production (contains PII).
 *
 * Required env vars (server-only):
 *   SAIPOS_API_URL      — homolog: https://homolog-order-api.saipos.com
 *   SAIPOS_PARTNER_ID   — provided by Saipos at credentialing
 *   SAIPOS_SECRET       — provided by Saipos at credentialing
 *   SAIPOS_COD_STORE    — store identifier from Saipos back-office
 */

import { NextRequest, NextResponse } from 'next/server'
import { buildSaiposPayload } from '@/services/adapters/saiposPayload'
import { getToken, refreshToken, getBaseUrl } from '@/services/adapters/saiposAuth'
import { gerarUUID } from '@/utils/uuid'
import { CURRENT_OPERATION, OPERATION_LABEL } from '@/config/operation'
import { products } from '@/data/products'
import type { NovoPedido, Pedido, ItemPedido } from '@/types/order'
import type { SaiposErrorResponse } from '@/types/saipos'

// ─── Fail-fast env validation ─────────────────────────────────────────────────

function validateEnv(): string | null {
  const required = ['SAIPOS_API_URL', 'SAIPOS_PARTNER_ID', 'SAIPOS_SECRET', 'SAIPOS_COD_STORE']
  const missing = required.filter((k) => !process.env[k])
  return missing.length > 0 ? `Missing required env vars: ${missing.join(', ')}` : null
}

function getCodStore(): string {
  return process.env.SAIPOS_COD_STORE!
}

// ─── Input validation ─────────────────────────────────────────────────────────

function validatePedido(dados: NovoPedido): string | null {
  if (!dados.cliente?.nome || dados.cliente.nome.trim().length === 0) {
    return 'cliente.nome is required'
  }
  if (dados.cliente.nome.length > 120) {
    return 'cliente.nome must be at most 120 characters'
  }
  if (dados.cliente.telefone && dados.cliente.telefone.length > 15) {
    return 'cliente.telefone must be at most 15 characters'
  }
  if (dados.observacaoGeral && dados.observacaoGeral.length > 500) {
    return 'observacaoGeral must be at most 500 characters'
  }
  return null
}

// ─── Server-side price recalculation ─────────────────────────────────────────
//
// Rejects client-sent precoTotal and precoUnitario.
// Prices are recomputed from the server-side product catalog.
// If a product ID is not found in the catalog, the request is rejected.

const productMap = new Map(products.map((p) => [p.id, p]))

function recalcularPrecos(dados: NovoPedido): string | null {
  for (const item of dados.itens) {
    const produto = productMap.get(item.produto.id)
    if (!produto) {
      return `produto não encontrado no catálogo: ${item.produto.id}`
    }

    // Recalculate unit price: base price + sum of selected variation additions.
    const adicionais = item.variacoesSelecionadas.reduce(
      (acc, v) => acc + v.precoAdicional,
      0,
    )
    const precoUnitarioReal = produto.preco + adicionais
    const precoTotalReal = precoUnitarioReal * item.quantidade

    // Overwrite client-sent prices with server-authoritative values.
    item.precoUnitario = precoUnitarioReal
    item.precoTotal = precoTotalReal
  }
  return null
}

// ─── Display ID ───────────────────────────────────────────────────────────────
//
// Saipos returns {} on success — it does not assign a sequential order number.
// We generate our own display_id: 4-digit zero-padded counter from epoch mod 10000.
// Collision-safe for a single restaurant in homologation.
// Replace with a Supabase atomic sequence before high-volume production use.

function gerarDisplayId(): string {
  const seq = Date.now() % 10000
  return String(seq).padStart(4, '0')
}

// ─── Saipos HTTP helpers ──────────────────────────────────────────────────────

async function parseSaiposError(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const body = JSON.parse(text) as Partial<SaiposErrorResponse>
    const trace = body.guidRequest ? ` (guidRequest: ${body.guidRequest})` : ''
    return `${body.errorMessage ?? 'Unknown error'}${trace}`
  } catch {
    return text || `HTTP ${res.status}`
  }
}

async function saiposPost<T>(path: string, body: unknown): Promise<T> {
  const baseUrl = getBaseUrl()
  const url = `${baseUrl}${path}`

  const doRequest = async (token: string): Promise<Response> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    try {
      return await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token,   // Saipos: raw token, no "Bearer" prefix
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }
  }

  let token = await getToken()
  let res = await doRequest(token)

  // On 401, evict cached token and retry once.
  if (res.status === 401) {
    console.warn('[POST /api/orders] 401 received — refreshing token and retrying')
    token = await refreshToken()
    res = await doRequest(token)
  }

  if (!res.ok) {
    const message = await parseSaiposError(res)
    throw new Error(`[POST /api/orders] Saipos POST ${path} failed — HTTP ${res.status}: ${message}`)
  }

  const text = await res.text()
  if (!text || text === '{}') return {} as T
  return JSON.parse(text) as T
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  console.log('[POST /api/orders] request received')
  const envError = validateEnv()
  if (envError) {
    console.error('[POST /api/orders] Env validation failed:', envError)
    return NextResponse.json({ error: envError }, { status: 500 })
  }

  let dados: NovoPedido
  try {
    dados = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!dados?.itens?.length) {
    return NextResponse.json({ error: 'itens is required and must not be empty' }, { status: 400 })
  }

  const validationError = validatePedido(dados)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  const priceError = recalcularPrecos(dados)
  if (priceError) {
    return NextResponse.json({ error: priceError }, { status: 400 })
  }

  const orderId   = gerarUUID()
  const displayId = gerarDisplayId()
  const criadoEm  = new Date().toISOString()
  const codStore  = getCodStore()

  const payload = buildSaiposPayload(dados, orderId, displayId, codStore, criadoEm)

  console.log(
    '[POST /api/orders] criarPedido → operation:', OPERATION_LABEL[CURRENT_OPERATION],
    'order_id:', orderId,
    'display_id:', displayId,
    'mesa:', dados.mesa,
    'items:', dados.itens.length,
    'total (reais):', payload.total_amount,
  )

  console.log('[POST /api/orders] saipos payload →', JSON.stringify({
    ...payload,
    customer: { ...payload.customer, phone: payload.customer.phone ? '***' : undefined, email: payload.customer.email ? '***' : undefined },
  }, null, 2))

  try {
    await saiposPost('/order', payload)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/orders] saiposPost failed:', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }

  console.log('[POST /api/orders] criarPedido OK → order_id:', orderId)

  // Build and return our internal Pedido.
  // Saipos returns {} so we construct from what we sent.
  const subtotal = dados.itens.reduce((acc, i) => acc + i.precoTotal, 0)

  const pedido: Pedido = {
    id:                orderId,
    numeroPedido:      parseInt(displayId, 10),
    status:            'recebido',
    mesa:              dados.mesa,
    endereco:          dados.endereco,
    cliente:           dados.cliente,
    itens: dados.itens.map((item): ItemPedido => ({
      id:            gerarUUID(),
      produtoId:     item.produto.id,
      produtoNome:   item.produto.nome,
      produtoPreco:  item.precoUnitario,
      variacoes:     item.variacoesSelecionadas.map((v) => v.opcaoLabel).join(', '),
      observacao:    item.observacao,
      quantidade:    item.quantidade,
      subtotal:      item.precoTotal,
    })),
    formaPagamento:    dados.formaPagamento,
    trocoPara:         dados.trocoPara,
    observacaoGeral:   dados.observacaoGeral,
    subtotal,
    taxaServico:       0,
    total:             subtotal,
    criadoEm,
    saiposPedidoId:    orderId,
    operationId:       CURRENT_OPERATION,
  }

  return NextResponse.json(pedido, { status: 200 })
}
