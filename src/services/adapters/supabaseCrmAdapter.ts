/**
 * supabaseCrmAdapter — Production CrmAdapter backed by Supabase.
 *
 * Implements the same CrmAdapter contract as jsonFileAdapter.
 * To activate: change the one import line in processors.ts and rawEventLog.ts
 * (see bottom of this file).
 *
 * Table mapping:
 *   CrmCliente   → crm_clientes      (upsert on phone)
 *   CrmPedido    → crm_pedidos       (upsert on id)
 *   MensagemLog  → crm_mensagens     (append-only, dedup on provider_message_id)
 *   Campaign     → crm_campanhas     (upsert on id)
 *   raw events   → crm_events_raw    (append-only, dedup on id) — via appendRawEventSupabase()
 *   consent log  → crm_consent_logs  (append-only insert) — via appendConsentLog()
 *
 * Consent model:
 *   crm_clientes.preferencias stores the LATEST consent state (for fast reads).
 *   crm_consent_logs stores every change as an immutable record (for audit trail).
 *   Both are always written together when consent changes.
 */

import { supabase } from '@/lib/supabaseServer'
import type { CrmAdapter } from './types'
import type {
  CrmCliente,
  CrmPedido,
  MensagemLog,
  Campaign,
  MessageCategory,
  ConsentSource,
  TimeSegment,
  FrequencySegment,
  AutomationLog,
} from '@/types/crm'

// ─── Type helpers ─────────────────────────────────────────────────────────────
// Map between TypeScript CrmCliente and the flat Supabase row shape.

interface ClienteRow {
  phone: string
  name: string
  email: string | null
  birthday: string | null
  channel: string
  consent_order_updates: boolean | null
  consent_order_updates_at: string | null
  consent_order_updates_source: string | null
  consent_relational: boolean | null
  consent_relational_at: string | null
  consent_relational_source: string | null
  consent_promotional: boolean | null
  consent_promotional_at: string | null
  consent_promotional_source: string | null
  time_segment: string
  frequency_segment: string
  segment_tags: string[]
  order_count: number
  total_spent_centavos: number
  first_seen_at: string
  last_seen_at: string
  last_order_at: string | null
  orders_last_30_days: number
}

function rowToCliente(row: ClienteRow): CrmCliente {
  return {
    phone: row.phone,
    name: row.name,
    email: row.email ?? undefined,
    birthday: row.birthday ?? undefined,
    preferencias: {
      channel: (row.channel as CrmCliente['preferencias']['channel']) ?? 'whatsapp',
      orderUpdates: row.consent_order_updates !== null ? {
        granted: row.consent_order_updates,
        grantedAt: row.consent_order_updates_at!,
        source: row.consent_order_updates_source as ConsentSource,
      } : undefined,
      relational: row.consent_relational !== null ? {
        granted: row.consent_relational,
        grantedAt: row.consent_relational_at!,
        source: row.consent_relational_source as ConsentSource,
      } : undefined,
      promotional: row.consent_promotional !== null ? {
        granted: row.consent_promotional,
        grantedAt: row.consent_promotional_at!,
        source: row.consent_promotional_source as ConsentSource,
      } : undefined,
    },
    timeSegment: (row.time_segment ?? 'new') as TimeSegment,
    frequencySegment: (row.frequency_segment ?? 'regular') as FrequencySegment,
    segmentTags: (row.segment_tags ?? []) as CrmCliente['segmentTags'],
    orderCount: row.order_count,
    totalSpentCentavos: row.total_spent_centavos,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    lastOrderAt: row.last_order_at ?? undefined,
    ordersLast30Days: row.orders_last_30_days ?? 0,
  }
}

function clienteToRow(c: CrmCliente): ClienteRow {
  return {
    phone: c.phone,
    name: c.name,
    email: c.email ?? null,
    birthday: c.birthday ?? null,
    channel: c.preferencias.channel,
    consent_order_updates: c.preferencias.orderUpdates?.granted ?? null,
    consent_order_updates_at: c.preferencias.orderUpdates?.grantedAt ?? null,
    consent_order_updates_source: c.preferencias.orderUpdates?.source ?? null,
    consent_relational: c.preferencias.relational?.granted ?? null,
    consent_relational_at: c.preferencias.relational?.grantedAt ?? null,
    consent_relational_source: c.preferencias.relational?.source ?? null,
    consent_promotional: c.preferencias.promotional?.granted ?? null,
    consent_promotional_at: c.preferencias.promotional?.grantedAt ?? null,
    consent_promotional_source: c.preferencias.promotional?.source ?? null,
    time_segment: c.timeSegment,
    frequency_segment: c.frequencySegment,
    segment_tags: c.segmentTags,
    order_count: c.orderCount,
    total_spent_centavos: c.totalSpentCentavos,
    first_seen_at: c.firstSeenAt,
    last_seen_at: c.lastSeenAt,
    last_order_at: c.lastOrderAt ?? null,
    orders_last_30_days: c.ordersLast30Days,
  }
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export const supabaseCrmAdapter: CrmAdapter = {

  // ── Customer ────────────────────────────────────────────────────────────────

  async salvarCliente(cliente: CrmCliente): Promise<void> {
    const row = clienteToRow(cliente)
    console.log('[supabaseAdapter] salvarCliente →', row.phone)
    const { error } = await supabase
      .from('crm_clientes')
      .upsert(row, { onConflict: 'phone' })
    if (error) {
      console.error('[supabaseAdapter] salvarCliente ERROR:', error.code, error.message, error.details)
      throw error
    }
    console.log('[supabaseAdapter] salvarCliente OK →', row.phone)
  },

  async buscarCliente(phone: string): Promise<CrmCliente | null> {
    const { data, error } = await supabase
      .from('crm_clientes')
      .select('*')
      .eq('phone', phone)
      .single()
    if (error) {
      if (error.code === 'PGRST116') return null  // row not found
      console.error('[supabaseAdapter] buscarCliente ERROR:', error.code, error.message)
      throw error
    }
    return rowToCliente(data as ClienteRow)
  },

  // ── Orders ──────────────────────────────────────────────────────────────────

  async salvarPedido(pedido: CrmPedido): Promise<void> {
    console.log('[supabaseAdapter] salvarPedido →', pedido.id, 'phone:', pedido.customerPhone)
    const { error } = await supabase
      .from('crm_pedidos')
      .upsert({
        id: pedido.id,
        customer_phone: pedido.customerPhone,
        customer_name: pedido.customerName,
        context: pedido.context,
        table_id: pedido.tableId ?? null,
        source: pedido.source,
        items: pedido.items,              // stored as JSONB
        subtotal: pedido.subtotal,
        discount: pedido.discount,
        service_fee: pedido.serviceFee,
        total: pedido.total,
        notes: pedido.notes ?? null,
        payment_method: pedido.paymentMethod ?? null,
        created_at: pedido.createdAt,
        status: pedido.status,
        attribution: pedido.attribution ?? null,  // stored as JSONB
      }, { onConflict: 'id' })
    if (error) {
      console.error('[supabaseAdapter] salvarPedido ERROR:', error.code, error.message, error.details)
      throw error
    }
    console.log('[supabaseAdapter] salvarPedido OK →', pedido.id)
  },

  async buscarPedidosPorCliente(phone: string): Promise<CrmPedido[]> {
    const { data, error } = await supabase
      .from('crm_pedidos')
      .select('*')
      .eq('customer_phone', phone)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((row) => ({
      id: row.id,
      customerPhone: row.customer_phone,
      customerName: row.customer_name,
      context: row.context,
      tableId: row.table_id ?? undefined,
      source: row.source,
      items: row.items,
      subtotal: row.subtotal,
      discount: row.discount,
      serviceFee: row.service_fee,
      total: row.total,
      notes: row.notes ?? undefined,
      paymentMethod: row.payment_method ?? undefined,
      createdAt: row.created_at,
      status: row.status,
      attribution: row.attribution ?? null,
    }))
  },

  // ── Message log ─────────────────────────────────────────────────────────────

  async registrarMensagem(log: MensagemLog): Promise<void> {
    const { error } = await supabase
      .from('crm_mensagens')
      .upsert({
        id: log.id,
        customer_phone: log.customerPhone,
        channel: log.channel,
        category: log.category,
        template_id: log.templateId,
        order_id: log.orderId ?? null,
        campaign_id: log.campaignId ?? null,
        status: log.status,
        blocked_reason: log.blockedReason ?? null,
        sent_at: log.sentAt ?? null,
        status_updated_at: log.statusUpdatedAt,
        provider_message_id: log.providerMessageId ?? null,
      }, {
        onConflict: 'id',
        ignoreDuplicates: true,   // webhook retries — never overwrite
      })
    if (error) throw error
  },

  async buscarMensagensPorCliente(
    phone: string,
    options?: { category?: MensagemLog['category']; limit?: number }
  ): Promise<MensagemLog[]> {
    let query = supabase
      .from('crm_mensagens')
      .select('*')
      .eq('customer_phone', phone)
      .order('status_updated_at', { ascending: false })

    if (options?.category) {
      query = query.eq('category', options.category)
    }
    if (options?.limit) {
      query = query.limit(options.limit)
    }

    const { data, error } = await query
    if (error) throw error
    return (data ?? []).map((row) => ({
      id: row.id,
      customerPhone: row.customer_phone,
      channel: row.channel,
      category: row.category,
      templateId: row.template_id,
      orderId: row.order_id ?? undefined,
      campaignId: row.campaign_id ?? undefined,
      status: row.status,
      blockedReason: row.blocked_reason ?? undefined,
      sentAt: row.sent_at ?? undefined,
      statusUpdatedAt: row.status_updated_at,
      providerMessageId: row.provider_message_id ?? undefined,
    }))
  },

  // ── Campaigns ───────────────────────────────────────────────────────────────

  async salvarCampanha(campaign: Campaign): Promise<void> {
    const { error } = await supabase
      .from('crm_campanhas')
      .upsert({
        id: campaign.id,
        name: campaign.name,
        category: campaign.category,
        template_id: campaign.templateId,
        target_segment: campaign.targetSegment,
        consent_required: campaign.consentRequired,
        status: campaign.status,
        approved_by: campaign.approvedBy ?? null,
        approved_at: campaign.approvedAt ?? null,
        scheduled_at: campaign.scheduledAt ?? null,
        batch_size: campaign.batchSize,
        batch_interval_ms: campaign.batchIntervalMs,
        created_at: campaign.createdAt,
        total_targeted: campaign.totalTargeted ?? null,
        total_sent: campaign.totalSent ?? null,
        total_delivered: campaign.totalDelivered ?? null,
      }, { onConflict: 'id' })
    if (error) throw error
  },

  async buscarCampanha(id: string): Promise<Campaign | null> {
    const { data, error } = await supabase
      .from('crm_campanhas')
      .select('*')
      .eq('id', id)
      .single()
    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return {
      id: data.id,
      name: data.name,
      category: data.category,
      templateId: data.template_id,
      targetSegment: data.target_segment,
      consentRequired: data.consent_required,
      status: data.status,
      approvedBy: data.approved_by ?? undefined,
      approvedAt: data.approved_at ?? undefined,
      scheduledAt: data.scheduled_at ?? undefined,
      batchSize: data.batch_size,
      batchIntervalMs: data.batch_interval_ms,
      createdAt: data.created_at,
      totalTargeted: data.total_targeted ?? undefined,
      totalSent: data.total_sent ?? undefined,
      totalDelivered: data.total_delivered ?? undefined,
    }
  },

  async buscarClientesPorSegmento(tags: CrmCliente['segmentTags']): Promise<CrmCliente[]> {
    if (tags.length === 0) return []
    // Postgres: segment_tags must contain ALL requested tags (array containment).
    const { data, error } = await supabase
      .from('crm_clientes')
      .select('*')
      .contains('segment_tags', tags)
    if (error) throw error
    return (data ?? []).map((row) => rowToCliente(row as ClienteRow))
  },
}

// ─── Extra: raw event log via Supabase ────────────────────────────────────────

/**
 * Append a raw CRM event to crm_events_raw.
 * Idempotent — duplicate IDs are silently ignored.
 * Call this from rawEventLog.ts instead of writing to the JSON file.
 */
export async function appendRawEventSupabase(event: {
  id: string
  ts: string
  sessionId: string
  payload: unknown
}): Promise<void> {
  const eventName = (event.payload as { event: string }).event
  const operationId = (event as { operationId?: string }).operationId ?? 'unknown'
  console.log('[supabaseAdapter] appendRawEvent →', event.id, eventName, 'operation:', operationId)
  const { error } = await supabase
    .from('crm_events_raw')
    .upsert({
      id: event.id,
      ts: event.ts,
      session_id: event.sessionId,
      event_name: eventName,
      payload: event.payload,
      // TODO(multi-store): when crm_events_raw gains an operation_id column, add: operation_id: operationId
    }, {
      onConflict: 'id',
      ignoreDuplicates: true,
    })
  if (error) {
    console.error('[supabaseAdapter] appendRawEvent ERROR:', error.code, error.message, error.details)
    throw error
  }
  console.log('[supabaseAdapter] appendRawEvent OK →', event.id)
}

/**
 * Append an immutable consent log entry.
 * Called from processors.ts whenever consent is granted or revoked.
 */
export async function appendConsentLog(entry: {
  customerPhone: string
  category: MessageCategory
  granted: boolean
  grantedAt: string
  source: ConsentSource
  eventId: string
}): Promise<void> {
  const { error } = await supabase
    .from('crm_consent_logs')
    .insert({
      customer_phone: entry.customerPhone,
      category: entry.category,
      granted: entry.granted,
      granted_at: entry.grantedAt,
      source: entry.source,
      event_id: entry.eventId,
    })
  if (error) throw error
}

/**
 * Check whether a trigger is still within its cooldown window for a given customer.
 * Returns true (= in cooldown, skip) if a non-failed, non-skipped entry exists
 * for this trigger_id + customer_phone within the last `cooldownHours` hours.
 *
 * Fails open: if the query errors, returns false so the trigger proceeds.
 * Called from runTriggers() before firing each handler.
 */
export async function checkCooldown(params: {
  triggerId: string
  customerPhone: string
  cooldownHours: number
}): Promise<boolean> {
  const cutoff = new Date(
    Date.now() - params.cooldownHours * 60 * 60 * 1000
  ).toISOString()

  const { data, error } = await supabase
    .from('crm_automations_log')
    .select('id')
    .eq('trigger_id', params.triggerId)
    .eq('customer_phone', params.customerPhone)
    .not('status', 'in', '("failed","skipped")')
    .gte('triggered_at', cutoff)
    .limit(1)

  if (error) {
    // Fail safe: a query error must not allow a duplicate trigger to fire.
    console.error('[checkCooldown] query error (failing safe):', error.message)
    return true
  }

  return (data?.length ?? 0) > 0
}

/**
 * Append an immutable automation log entry to crm_automations_log.
 * Idempotent on id — duplicate inserts are silently ignored.
 * Called from runTriggers() in crmTriggers.ts.
 */
export async function appendAutomationLog(entry: AutomationLog): Promise<void> {
  const { error } = await supabase
    .from('crm_automations_log')
    .insert({
      id:                 entry.id,
      trigger_id:         entry.triggerId,
      customer_phone:     entry.customerPhone,
      time_segment:       entry.timeSegment,
      frequency_segment:  entry.frequencySegment,
      engagement_action:  entry.engagementAction,
      status:             entry.status,
      skip_reason:        entry.skipReason ?? null,
      triggered_at:       entry.executedAt,
    })
  if (error && error.code !== '23505') {
    // 23505 = unique_violation (dedup index) — silently ignore, all others re-throw
    throw error
  }
}

// ─── Migration instructions ───────────────────────────────────────────────────
//
// To activate Supabase persistence, make these two changes:
//
// 1. In src/app/api/crm/events/processors.ts, line 1 of imports:
//    CHANGE:  import { jsonFileCrmAdapter as adapter } from '@/services/adapters/jsonFileAdapter'
//    TO:      import { supabaseCrmAdapter as adapter } from '@/services/adapters/supabaseCrmAdapter'
//    AND add: import { appendConsentLog } from '@/services/adapters/supabaseCrmAdapter'
//             (then call appendConsentLog() inside processOptIn and processOptOut)
//
// 2. In src/app/api/crm/events/rawEventLog.ts, replace the file body with:
//    import { appendRawEventSupabase } from '@/services/adapters/supabaseCrmAdapter'
//    export async function appendRawEvent(event: ValidatedCrmEvent): Promise<void> {
//      await appendRawEventSupabase(event)
//    }
