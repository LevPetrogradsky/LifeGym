import { neon } from '@neondatabase/serverless'
import type { CloudItem, CloudOperation } from '../src/journal/cloud-model.ts'
import type { JournalStore } from './journal-handler.ts'

export function createJournalStore(connectionString: string): JournalStore {
  const sql = neon(connectionString)
  return {
    async list(userId, after) {
      const kind = after?.[0] ?? ''
      const id = after?.[1] ?? ''
      const rows = await sql`
        SELECT kind, id, payload, deleted
        FROM lifeos_journal_items
        WHERE user_id = ${userId} AND (kind, id) > (${kind}, ${id})
        ORDER BY kind, id
        LIMIT 2
      `
      const items = rows.slice(0, 1).map(row => ({
        kind: row.kind, id: row.id, payload: row.payload, deleted: row.deleted,
      })) as CloudItem[]
      const last = items.at(-1)
      return { items, next: rows.length > 1 && last ? [last.kind, last.id] as [string, string] : null }
    },
    async write(userId, operation: CloudOperation) {
      const payload = operation.deleted ? null : JSON.stringify(operation.payload)
      if (operation.kind === 'entry' && !operation.deleted && operation.payload?.folderId) {
        const folders = await sql`
          SELECT 1 FROM lifeos_journal_items
          WHERE user_id = ${userId} AND kind = 'folder'
            AND id = ${operation.payload.folderId} AND NOT deleted
          LIMIT 1
        `
        if (!folders.length) throw new Error('Folder missing')
      }
      if (operation.mode === 'import') {
        await sql`
          INSERT INTO lifeos_journal_items (user_id, kind, id, payload, deleted)
          VALUES (${userId}, ${operation.kind}, ${operation.id}, ${payload}::jsonb, false)
          ON CONFLICT (user_id, kind, id) DO NOTHING
        `
        return
      }
      await sql`
        INSERT INTO lifeos_journal_items (user_id, kind, id, payload, deleted)
        VALUES (${userId}, ${operation.kind}, ${operation.id}, ${payload}::jsonb, ${operation.deleted})
        ON CONFLICT (user_id, kind, id) DO UPDATE SET
          payload = EXCLUDED.payload,
          deleted = EXCLUDED.deleted,
          changed_at = now()
      `
      if (operation.kind === 'folder' && operation.deleted) {
        await sql`
          UPDATE lifeos_journal_items SET payload = payload - 'folderId', changed_at = now()
          WHERE user_id = ${userId} AND kind = 'entry' AND NOT deleted
            AND payload->>'folderId' = ${operation.id}
        `
      }
    },
  }
}
