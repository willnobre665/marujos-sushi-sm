-- Migration: crm_automations_log v2
-- Adds delivery queue robustness fields

alter table crm_automations_log
  add column if not exists attempt_count  integer     not null default 0,
  add column if not exists last_error     text,
  add column if not exists processing_at  timestamptz;

-- Index for finding stale "processing" entries (cleanup / timeout recovery)
create index if not exists crm_automations_log_processing_at_idx
  on crm_automations_log (processing_at)
  where processing_at is not null;

-- Index for bulk reprocess query (failed + attempt_count < 3)
create index if not exists crm_automations_log_failed_retryable_idx
  on crm_automations_log (status, attempt_count)
  where status = 'failed' and attempt_count < 3;
