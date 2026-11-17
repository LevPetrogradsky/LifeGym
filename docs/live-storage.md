# Live Storage for LiveGym

The client keeps its local copy. When account storage is enabled, the existing
Journal sync endpoint also carries `plan` items for Workouts. Saved workout
entries remain Journal `entry` items. Tasks, settings, and drafts are not sent.

## Deployment prerequisites

Use the same approved Neon Auth issuer as LivePortableHub. Configure the
existing LifeGym Vercel project with `VITE_NEON_AUTH_URL`,
`VITE_LIFEOS_ACCOUNTS_ENABLED=true`, `NEON_AUTH_BASE_URL`, `DATABASE_URL`,
`VITE_JOURNAL_SYNC_ENABLED=true`, and `JOURNAL_SYNC_ENABLED=true`. The Auth URL
and server issuer must match. Apply `db/journal-sync.sql` for a new database or
`db/workout-plans-migration.sql` to an existing Journal database before
enabling sync. Do not copy credentials into source files.

The user enables cloud storage in Settings → Live Storage. The client verifies
the authenticated endpoint before enabling it, then imports account-local
workouts and plans. A signed-in user can copy guest workouts and plans into the
chosen account from the same section after confirming the account. The guest
copy stays on the device. Conflicting IDs get stable alternate IDs so a retry
does not duplicate imported data. Existing Journal sync queues and old backups
remain readable; older synced accounts import their local plans once.

## Release gate

Before publishing, verify the shared account session and account isolation on
the existing demo, apply the database migration, and test a real save on one
device followed by a read on another. The current LifeGym project has no
production or preview environment variables; its deployed `/api/journal`
returns 404. Until these prerequisites are met, the UI must report local-only
storage and no cloud success.
