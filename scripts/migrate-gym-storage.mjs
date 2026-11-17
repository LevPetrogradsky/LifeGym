import { readFile } from 'node:fs/promises'
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
if (process.env.GYM_STORAGE_MIGRATION_CONFIRMED !== 'true') {
  throw new Error('Set GYM_STORAGE_MIGRATION_CONFIRMED=true after verifying this is the dedicated LiveGym database')
}
const sql = neon(process.env.DATABASE_URL)
const existingHub = await sql`SELECT to_regclass('public.lifeos_journal_items') AS hub_items`
if (existingHub[0]?.hub_items) throw new Error('Refusing to migrate a database containing Hub Journal tables')
const schema = await readFile(new URL('../db/gym-storage.sql', import.meta.url), 'utf8')
for (const statement of schema.split(';').map(part => part.trim()).filter(Boolean)) {
  await sql.query(statement)
}
const rows = await sql`SELECT to_regclass('public.livegym_storage_items') AS items,
  to_regclass('public.livegym_guest_vaults') AS guests`
if (!rows[0]?.items || !rows[0]?.guests) throw new Error('LiveGym tables were not created')
process.stdout.write('LiveGym storage tables are ready.\n')
