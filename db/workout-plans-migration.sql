-- Apply to the existing LiveGym Journal database before enabling plan sync.
-- Existing rows and per-account identifiers remain untouched.
ALTER TABLE lifeos_journal_items DROP CONSTRAINT IF EXISTS lifeos_journal_items_kind_check;
ALTER TABLE lifeos_journal_items ADD CONSTRAINT lifeos_journal_items_kind_check
  CHECK (kind IN ('folder', 'entry', 'plan'));
