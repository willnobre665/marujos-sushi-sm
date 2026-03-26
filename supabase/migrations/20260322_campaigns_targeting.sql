-- campaigns — add CRM targeting and execution tracking
--
-- targeting: JSONB config for audience selection
--   {
--     "segment": "at_risk" | "new_customer" | "vip" | "custom" | null,
--     "filters": {
--       "minOrderCount":         number | null,
--       "maxOrderCount":         number | null,
--       "minTotalSpent":         number | null,   -- centavos
--       "maxDaysSinceLastOrder": number | null,
--       "minDaysSinceLastOrder": number | null
--     },
--     "flow": "at_risk" | "new_customer" | "vip" | "reactivation" | "upsell"
--   }
--
-- execution_stats: JSONB — written by /api/campaigns/execute
--   {
--     "lastRunAt":    ISO timestamp,
--     "targeted":     number,    -- customers matched targeting rules
--     "inserted":     number,    -- automation log entries created
--     "skipped":      number,    -- suppressed / no consent / dedup
--     "converted":    number,    -- crm_automations_log where status='sent' & campaign_id matches (updated lazily)
--     "convertedRevenue": number -- centavos
--   }

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS targeting       JSONB,
  ADD COLUMN IF NOT EXISTS execution_stats JSONB;
