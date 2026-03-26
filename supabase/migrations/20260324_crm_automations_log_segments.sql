-- Migration: add segment and engagement fields to crm_automations_log
--
-- The original table used a generic `flow` text column.
-- This migration adds the explicit segment dimensions and the resolved
-- engagement action so every log entry is self-describing and queryable
-- without joining other tables.
--
-- Existing rows retain their original `flow` value unchanged.
-- New rows written by crmTriggers.ts will populate all new columns.

alter table crm_automations_log
  add column if not exists trigger_id         text,
  add column if not exists time_segment       text,
  add column if not exists frequency_segment  text,
  add column if not exists engagement_action  text;

-- Index: find all pending entries for a given trigger (automation runner query)
create index if not exists crm_automations_log_trigger_status_idx
  on crm_automations_log (trigger_id, status)
  where trigger_id is not null;

-- Index: customer history by segment (manager panel + dedup checks)
create index if not exists crm_automations_log_phone_time_idx
  on crm_automations_log (customer_phone, triggered_at desc)
  where trigger_id is not null;

-- Index: filter by engagement action (campaign runner + analytics)
create index if not exists crm_automations_log_action_idx
  on crm_automations_log (engagement_action)
  where engagement_action is not null;
