/**
 * rawEventLog — Append-only log of every received CRM event.
 *
 * Writes to crm_events_raw in Supabase.
 * Idempotent: duplicate event IDs are silently ignored (ON CONFLICT DO NOTHING).
 * Provides full audit trail and enables event replay if structured
 * processing fails or a new processor is added later.
 */

import { appendRawEventSupabase } from '@/services/adapters/supabaseCrmAdapter'
import type { ValidatedCrmEvent } from './schemas'

export async function appendRawEvent(event: ValidatedCrmEvent): Promise<void> {
  await appendRawEventSupabase(event)
}
