/**
 * operation.ts — Single source of truth for the current operation context.
 *
 * Marujos Sushi has two independent operations:
 *   'santa_maria'     — Santa Maria (delivery only). THIS app.
 *   'cacapava_do_sul' — Caçapava do Sul (delivery + physical store). Future app.
 *
 * This app is locked to Santa Maria. Every order, customer record, CRM event,
 * and Saipos order created here belongs to Santa Maria exclusively.
 *
 * When multi-store support is added:
 *   1. Add an `operation_id` column to crm_pedidos, crm_clientes, crm_events_raw.
 *   2. Replace this constant with a runtime lookup (env var or subdomain).
 *   3. Pass CURRENT_OPERATION wherever the DB row is written.
 *   The constant below is the only change point for that migration.
 */

export type OperationId = 'santa_maria' | 'cacapava_do_sul'

/** The operation this app instance belongs to. Locked to Santa Maria. */
export const CURRENT_OPERATION: OperationId = 'santa_maria'

/** Human-readable label — use in logs and debug output only, never in DB queries. */
export const OPERATION_LABEL: Record<OperationId, string> = {
  santa_maria:     'Santa Maria',
  cacapava_do_sul: 'Caçapava do Sul',
}
