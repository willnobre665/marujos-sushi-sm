-- Migration: revenue attribution for CRM automations

alter table crm_automations_log
  add column if not exists recovered_at               timestamptz,
  add column if not exists recovered_revenue_centavos integer;

-- Index for the recovery scan: only unattributed sent entries
create index if not exists crm_automations_log_recovery_scan_idx
  on crm_automations_log (customer_phone, sent_at)
  where status = 'sent' and recovered_at is null and customer_phone is not null;

-- Index for metrics: recovered entries by date
create index if not exists crm_automations_log_recovered_at_idx
  on crm_automations_log (recovered_at)
  where recovered_at is not null;
