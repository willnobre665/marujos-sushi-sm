-- campaigns — add paid-media performance fields
-- budget_total and spend are stored in centavos (INTEGER), consistent with
-- all other monetary values in this schema. NULL = not set / not applicable.

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS budget_total INTEGER,   -- centavos — planned media budget
  ADD COLUMN IF NOT EXISTS spend        INTEGER;   -- centavos — actual media spend to date
