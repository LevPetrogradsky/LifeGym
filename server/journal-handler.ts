import { validCloudOperation, type CloudItem, type CloudOperation } from '../src/journal/cloud-model.ts'

export type JournalStore = {
  list: (userId: string, after: [string, string] | null) => Promise<{ items: CloudItem[]; next: [string, string] | null }>
  write: (userId: string, operation: CloudOperation) => Promise<void>
}

const json = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
})

function cursorFromUrl(url: URL): [string, string] | null {
  const raw = url.searchParams.get('after')
  if (!raw) return null
  const decoded: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
  if (!Array.isArray(decoded) || decoded.length !== 2 ||
    (decoded[0] !== 'folder' && decoded[0] !== 'entry') ||
    typeof decoded[1] !== 'string' || decoded[1].length > 200) throw new Error('Invalid cursor')
  return [decoded[0], decoded[1]]
}

export function createJournalHandler(
  verify: (token: string) => Promise<string | null>,
  store: JournalStore,
  enabled: () => boolean,
) {
  return async (request: Request): Promise<Response> => {
    if (!enabled()) return json({ error: 'Journal sync is not enabled for this preview.' }, 404)
    if (request.method !== 'GET' && request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
    const authorization = request.headers.get('authorization')
    if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sign in required.' }, 401)
    const userId = await verify(authorization.slice(7))
    if (!userId) return json({ error: 'Sign in required.' }, 401)
    try {
      if (request.method === 'GET') {
        const result = await store.list(userId, cursorFromUrl(new URL(request.url)))
        return json({ items: result.items, after: result.next ? Buffer.from(JSON.stringify(result.next)).toString('base64url') : null })
      }
      const length = Number(request.headers.get('content-length'))
      if (Number.isFinite(length) && length > 3_500_000) return json({ error: 'Journal item is too large.' }, 413)
      const raw = await request.text()
      if (raw.length > 3_500_000) return json({ error: 'Journal item is too large.' }, 413)
      let operation: unknown
      try { operation = JSON.parse(raw) } catch { return json({ error: 'Invalid JSON.' }, 400) }
      if (!validCloudOperation(operation)) return json({ error: 'Invalid Journal item.' }, 400)
      await store.write(userId, operation)
      return json({ saved: true })
    } catch (error) {
      if (error instanceof Error && error.message === 'Invalid cursor') return json({ error: 'Invalid cursor.' }, 400)
      if (error instanceof Error && error.message === 'Folder missing') return json({ error: 'Folder missing.' }, 409)
      return json({ error: 'Journal storage is unavailable. Local data was kept.' }, 503)
    }
  }
}
