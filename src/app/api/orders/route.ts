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

  const doRequest = async (token: string): Promise<Response> =>
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,   // Saipos: raw token, no "Bearer" prefix
      },
      body: JSON.stringify(body),
    })

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

  if (process.env.SAIPOS_DEBUG === 'true') {
    console.log('[POST /api/orders] SAIPOS_DEBUG payload →', JSON.stringify(payload, null, 2))
  }

  try {
    await saiposPost('/criar-pedido', payload)
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
