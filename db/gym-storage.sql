-- Run only on a database approved for LiveGym before enabling its cloud storage.
-- Do not apply this file to the LivePortableHub production database.
CREATE TABLE IF NOT EXISTS livegym_storage_items (
  user_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('folder', 'entry', 'plan')),
  id text NOT NULL,
  payload jsonb,
  deleted boolean NOT NULL DEFAULT false,
  changed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, id),
  CHECK ((deleted AND payload IS NULL) OR (NOT deleted AND payload IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS livegym_storage_items_user_order
  ON livegym_storage_items (user_id, kind, id);

-- Guest recovery codes never enter this table. Only their SHA-256 verifier is stored.
CREATE TABLE IF NOT EXISTS livegym_guest_vaults (
  owner_id text PRIMARY KEY CHECK (owner_id ~ '^guest:[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
