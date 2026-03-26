-- crm_clientes — add operator suppression fields
-- suppressed_until: ISO timestamp. NULL = not suppressed. If in the future = active suppression.
-- suppressed_reason: free text, e.g. "Customer asked not to be contacted"
-- suppressed_by: identifier of operator who triggered suppression (e.g. user email or username)

ALTER TABLE crm_clientes
  ADD COLUMN IF NOT EXISTS suppressed_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suppressed_reason TEXT,
  ADD COLUMN IF NOT EXISTS suppressed_by TEXT;

-- Index for efficient filtering of unsuppressed customers
CREATE INDEX IF NOT EXISTS crm_clientes_suppressed_until_idx
  ON crm_clientes (suppressed_until)
  WHERE suppressed_until IS NOT NULL;
