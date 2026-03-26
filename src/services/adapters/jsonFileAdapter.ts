/**
 * jsonFileAdapter — Server-side CrmAdapter that persists to JSON files.
 *
 * Storage: .data/ directory at project root (gitignored).
 * Each entity type gets its own file:
 *   .data/crm_clientes.json
 *   .data/crm_pedidos.json
 *   .data/crm_mensagens.json
 *   .data/crm_campanhas.json
 *
 * This adapter is used exclusively by API routes (server-side Node.js).
 * It MUST NOT be imported in any client-side component or hook.
 *
 * Why not mockAdapter?
 *   mockAdapter uses localStorage, which only exists in the browser.
 *   This adapter uses the Node.js `fs` module and runs only on the server.
 *
 * Migration path → Supabase (or any database):
 *   1. Create supabaseCrmAdapter.ts implementing CrmAdapter.
 *   2. In src/app/api/crm/events/route.ts, change the one `adapter` import.
 *   3. Delete this file.
 *   Nothing else changes.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import type { CrmAdapter } from './types'
import type { CrmCliente, CrmPedido, MensagemLog, Campaign } from '@/types/crm'

// ─── Storage helpers ──────────────────────────────────────────────────────────

const DATA_DIR = join(process.cwd(), '.data')

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

function filePath(name: string): string {
  return join(DATA_DIR, `${name}.json`)
}

function readJson<T>(name: string): T[] {
  ensureDataDir()
  const fp = filePath(name)
  if (!existsSync(fp)) return []
  try {
    const raw = readFileSync(fp, 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeJson<T>(name: string, data: T[]): void {
  ensureDataDir()
  writeFileSync(filePath(name), JSON.stringify(data, null, 2), 'utf-8')
}

// ─── Adapter implementation ───────────────────────────────────────────────────

export const jsonFileCrmAdapter: CrmAdapter = {

  // ── Customer ────────────────────────────────────────────────────────────────

  async salvarCliente(cliente: CrmCliente): Promise<void> {
    const all = readJson<CrmCliente>('crm_clientes')
    const idx = all.findIndex((c) => c.phone === cliente.phone)
    if (idx === -1) {
      all.push(cliente)
    } else {
      all[idx] = cliente
    }
    writeJson('crm_clientes', all)
  },

  async buscarCliente(phone: string): Promise<CrmCliente | null> {
    const all = readJson<CrmCliente>('crm_clientes')
    return all.find((c) => c.phone === phone) ?? null
  },

  // ── Orders ──────────────────────────────────────────────────────────────────

  async salvarPedido(pedido: CrmPedido): Promise<void> {
    const all = readJson<CrmPedido>('crm_pedidos')
    const idx = all.findIndex((p) => p.id === pedido.id)
    if (idx === -1) {
      all.push(pedido)
    } else {
      all[idx] = pedido
    }
    writeJson('crm_pedidos', all)
  },

  async buscarPedidosPorCliente(phone: string): Promise<CrmPedido[]> {
    const all = readJson<CrmPedido>('crm_pedidos')
    return all.filter((p) => p.customerPhone === phone)
  },

  // ── Message log ─────────────────────────────────────────────────────────────

  async registrarMensagem(log: MensagemLog): Promise<void> {
    const all = readJson<MensagemLog>('crm_mensagens')
    // Dedup by providerMessageId (webhook retries).
    if (log.providerMessageId && all.some((m) => m.providerMessageId === log.providerMessageId)) {
      return
    }
    all.push(log)
    writeJson('crm_mensagens', all)
  },

  async buscarMensagensPorCliente(
    phone: string,
    options?: { category?: MensagemLog['category']; limit?: number }
  ): Promise<MensagemLog[]> {
    let all = readJson<MensagemLog>('crm_mensagens')
    all = all.filter((m) => m.customerPhone === phone)
    if (options?.category) {
      all = all.filter((m) => m.category === options.category)
    }
    if (options?.limit) {
      all = all.slice(-options.limit)
    }
    return all
  },

  // ── Campaigns ───────────────────────────────────────────────────────────────

  async salvarCampanha(campaign: Campaign): Promise<void> {
    const all = readJson<Campaign>('crm_campanhas')
    const idx = all.findIndex((c) => c.id === campaign.id)
    if (idx === -1) {
      all.push(campaign)
    } else {
      all[idx] = campaign
    }
    writeJson('crm_campanhas', all)
  },

  async buscarCampanha(id: string): Promise<Campaign | null> {
    const all = readJson<Campaign>('crm_campanhas')
    return all.find((c) => c.id === id) ?? null
  },

  async buscarClientesPorSegmento(tags: CrmCliente['segmentTags']): Promise<CrmCliente[]> {
    if (tags.length === 0) return []
    const all = readJson<CrmCliente>('crm_clientes')
    return all.filter((c) => tags.every((t) => c.segmentTags.includes(t)))
  },
}
