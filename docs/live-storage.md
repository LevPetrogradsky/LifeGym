# Live Storage for LiveGym

The client keeps its local copy. LiveGym's own `/api/gym-storage` endpoint
carries `plan` items for Workouts and `entry` items for saved workouts. Tasks,
settings, and drafts are not sent. The endpoint never calls Hub's Journal API.

## Deployment prerequisites

Use the same approved Neon Auth production issuer as LivePortableHub. Add
`https://lifegym-preview.vercel.app` to that branch's Trusted origins and test
sign-in and password reset from Gym. Separate domain cookies may require the
user to sign in again. Configure the existing LifeGym Vercel project with
`VITE_NEON_AUTH_URL`, `VITE_LIFEOS_ACCOUNTS_ENABLED=true`,
`NEON_AUTH_BASE_URL`, and `DATABASE_URL` for Gym's dedicated database. The Auth
URL and server issuer must match. Apply `db/gym-storage.sql` only to this
approved Gym database; the migration script requires an explicit confirmation
flag and refuses a database containing Hub Journal tables. After validation,
set `VITE_GYM_STORAGE_ENABLED=true` and
`GYM_STORAGE_ENABLED=true`. Do not copy credentials into source files.

The user enables cloud storage in Settings → Live Storage. The client verifies
the authenticated endpoint before enabling it, then imports account-local
workouts and plans. A signed-in user can copy guest workouts and plans into the
chosen account from the same section after confirming the account. The guest
copy stays on the device; guests are not offered cloud storage. Conflicting IDs get stable alternate IDs so a retry
does not duplicate imported data. Existing Journal sync queues and old backups
remain readable; older synced accounts import their local plans once.

## Release gate

Before publishing, verify the shared account session and account isolation on
the existing demo, create the Gym tables, and test a real save on one device
followed by a read on another. If the backend is unavailable, the UI must
report local-only storage and no cloud success.

Use disposable accounts and workout records for the release check:

1. Verify sign-in and password-reset redirects from the existing Gym origin.
2. Confirm the Gym database has its own tables and no Hub Journal table; run
   the migration with `GYM_STORAGE_MIGRATION_CONFIRMED=true` only after checking
   the database target.
3. Save a plan and a structured workout, sign in on another browser, and read
   both. Confirm account B cannot read either item.
4. Copy a guest plan and workout into account A twice; confirm one copy of each
   in the account and the untouched guest copy on the device.
5. Simulate an offline request and a server error; confirm pending local data
   remains, the UI does not say it is saved in cloud, and retry completes.
