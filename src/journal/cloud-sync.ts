import { loadData, validateLifeOSData, type JournalEntry, type JournalFolder, type LifeOSData, type PlannedWorkout } from '../data.ts'
import { validCloudItem, validCloudOperation, type CloudItem, type CloudOperation } from './cloud-model.ts'

type Meta = NonNullable<LifeOSData['journalCloud']>
type Client = {
  getData: () => LifeOSData
  save: (data: LifeOSData) => boolean
  token: () => Promise<string | null>
  status: (text: string) => void
}

function meta(data: LifeOSData): Meta {
  const value = data.journalCloud
  if (value === undefined) return { version: 1, migrated: false, pending: [] }
  if (value.version !== 1 || typeof value.migrated !== 'boolean' ||
    (value.plansMigrated !== undefined && typeof value.plansMigrated !== 'boolean') ||
    (value.endpoint !== undefined && value.endpoint !== 'gym-storage-v1') ||
    !Array.isArray(value.pending) || !value.pending.every(validCloudOperation)) {
    throw new Error('Saved Journal sync state is unreadable. Your local Journal was kept.')
  }
  return value
}

function changes<T extends JournalFolder | JournalEntry | PlannedWorkout>(kind: 'folder' | 'entry' | 'plan', before: T[], after: T[]): CloudOperation[] {
  const old = new Map(before.map(item => [item.id, item]))
  const next = new Map(after.map(item => [item.id, item]))
  const operations: CloudOperation[] = []
  for (const item of after) {
    if (JSON.stringify(old.get(item.id)) !== JSON.stringify(item)) {
      operations.push({ mode: 'change', kind, id: item.id, deleted: false, payload: item, previous: old.get(item.id) ?? null } as unknown as CloudOperation)
    }
  }
  for (const item of before) {
    if (!next.has(item.id)) operations.push({ mode: 'change', kind, id: item.id, deleted: true, payload: null, previous: item })
  }
  return operations
}

export function withJournalChanges(before: LifeOSData, after: LifeOSData): LifeOSData {
  const ordered = { ...after, journalFolders: (after.journalFolders ?? []).map((folder, order) => ({ ...folder, order })) }
  const pending = [
    ...changes('folder', before.journalFolders ?? [], ordered.journalFolders),
    ...changes('entry', before.journal, after.journal),
    ...(before.journalCloud?.endpoint === 'gym-storage-v1' && before.journalCloud.plansMigrated
      ? changes('plan', before.plannedWorkouts ?? [], after.plannedWorkouts ?? []) : []),
  ]
  if (!pending.length) return after
  const previous = meta(before)
  return { ...ordered, journalCloud: { ...previous, pending: [...previous.pending, ...pending] } }
}

const priority = (item: CloudItem) =>
  item.kind === 'folder' ? (item.deleted ? 4 : 0) : item.kind === 'entry' ? (item.deleted ? 3 : 1) : 2

function importOperations(data: LifeOSData): CloudOperation[] {
  return [
    ...(data.journalFolders ?? []).map((folder, order) => ({ mode: 'import', kind: 'folder', id: folder.id, deleted: false, payload: { ...folder, order } })),
    ...data.journal.map(payload => ({ mode: 'import', kind: 'entry', id: payload.id, deleted: false, payload })),
    ...(data.plannedWorkouts ?? []).map(payload => ({ mode: 'import', kind: 'plan', id: payload.id, deleted: false, payload })),
  ] as CloudOperation[]
}

async function collisionId(kind: 'folder' | 'entry' | 'plan', item: JournalFolder | JournalEntry | PlannedWorkout) {
  const bytes = new TextEncoder().encode(JSON.stringify([kind, item.id, item]))
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return `import-${Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 40)}`
}

export async function preserveInitialJournal(data: LifeOSData, remote: CloudItem[]): Promise<LifeOSData> {
  const existing = new Map(remote.map(item => [`${item.kind}:${item.id}`, item]))
  const remoteNames = new Set(remote.filter(item => item.kind === 'folder' && !item.deleted && item.payload)
    .map(item => (item.payload as JournalFolder).name.toLocaleLowerCase()))
  const folderIds = new Map<string, string>()
  const folders = await Promise.all((data.journalFolders ?? []).map(async (folder, order) => {
    const found = existing.get(`folder:${folder.id}`)
    const collision = found && (found.deleted || JSON.stringify(found.payload) !== JSON.stringify({ ...folder, order }))
    const id = collision ? await collisionId('folder', folder) : folder.id
    if (collision) folderIds.set(folder.id, id)
    const imported = existing.get(`folder:${id}`)
    if (collision && imported && !imported.deleted && imported.payload) return imported.payload as JournalFolder
    let name = folder.name
    if (remoteNames.has(name.toLocaleLowerCase()) && (!found || collision)) {
      const base = name.slice(0, 45)
      let suffix = 1
      do { name = `${base} (local ${suffix++})` } while (remoteNames.has(name.toLocaleLowerCase()))
    }
    remoteNames.add(name.toLocaleLowerCase())
    return { ...folder, id, name }
  }))
  const entryIds = new Map<string, string>()
  for (const entry of data.journal) {
    const found = existing.get(`entry:${entry.id}`)
    if (found && (found.deleted || JSON.stringify(found.payload) !== JSON.stringify(entry))) {
      entryIds.set(entry.id, await collisionId('entry', entry))
    }
  }
  const journal = data.journal.map(entry => {
    const id = entryIds.get(entry.id) ?? entry.id
    const imported = existing.get(`entry:${id}`)
    if (id !== entry.id && imported && !imported.deleted && imported.payload) return imported.payload as JournalEntry
    return {
      ...entry, id,
      ...(entry.folderId && folderIds.has(entry.folderId) ? { folderId: folderIds.get(entry.folderId) } : {}),
      ...(entry.linkedEntryId && entryIds.has(entry.linkedEntryId) ? { linkedEntryId: entryIds.get(entry.linkedEntryId) } : {}),
    }
  })
  const plannedWorkouts = await Promise.all((data.plannedWorkouts ?? []).map(async plan => {
    const found = existing.get(`plan:${plan.id}`)
    if (!found || (!found.deleted && JSON.stringify(found.payload) === JSON.stringify(plan))) return plan
    const id = await collisionId('plan', plan)
    const imported = existing.get(`plan:${id}`)
    return imported && !imported.deleted && imported.payload ? imported.payload as PlannedWorkout : { ...plan, id }
  }))
  const result = { ...data, journalFolders: folders, journal, plannedWorkouts }
  if (!validateLifeOSData(result)) throw new Error('Local Journal could not be merged safely. Your notes were kept.')
  return result
}

function applyItems(data: LifeOSData, items: CloudItem[]): LifeOSData {
  const byKey = new Map(items.map(item => [`${item.kind}:${item.id}`, item]))
  const pendingKeys = new Set(meta(data).pending.map(item => `${item.kind}:${item.id}`))
  for (const [kind, saved] of [
    ['folder', data.journalFolders ?? []], ['entry', data.journal], ['plan', data.plannedWorkouts ?? []],
  ] as const) {
    for (const item of saved) {
      const key = `${kind}:${item.id}`
      if (!byKey.has(key) && !pendingKeys.has(key)) {
        throw new Error('Cloud storage omitted a local item. Your local copy was kept.')
      }
    }
  }
  for (const item of meta(data).pending) byKey.set(`${item.kind}:${item.id}`, item)
  const folders = [...byKey.values()].filter((item): item is CloudItem & { kind: 'folder'; payload: JournalFolder } =>
    item.kind === 'folder' && !item.deleted && item.payload !== null).map(item => item.payload)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const entries = [...byKey.values()].filter((item): item is CloudItem & { kind: 'entry'; payload: JournalEntry } =>
    item.kind === 'entry' && !item.deleted && item.payload !== null).map(item => item.payload)
  const plannedWorkouts = [...byKey.values()].filter((item): item is CloudItem & { kind: 'plan'; payload: PlannedWorkout } =>
    item.kind === 'plan' && !item.deleted && item.payload !== null).map(item => item.payload)
  const next = {
    ...data,
    journalFolders: folders,
    journal: entries.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    plannedWorkouts: plannedWorkouts.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
  }
  if (!validateLifeOSData(next)) throw new Error('Cloud Journal response is incomplete. Your local Journal was kept.')
  return next
}

export class JournalCloudSync {
  private running: Promise<boolean> | null = null
  private stopped = false
  private readonly client: Client
  private readonly onVisible = () => {
    if (document.visibilityState === 'visible') void this.sync()
  }
  private readonly onOnline = () => { void this.sync() }

  constructor(client: Client) { this.client = client }

  start() {
    document.addEventListener('visibilitychange', this.onVisible)
    window.addEventListener('online', this.onOnline)
    void this.sync()
  }

  stop() {
    this.stopped = true
    document.removeEventListener('visibilitychange', this.onVisible)
    window.removeEventListener('online', this.onOnline)
  }

  sync() {
    if (this.stopped) return Promise.resolve(false)
    if (this.running) return this.running
    let again = false
    this.running = this.perform().then(() => {
      again = meta(this.client.getData()).pending.length > 0
      return true
    }).catch(error => {
      this.client.status(error instanceof Error ? error.message : 'Could not sync Journal. Your local copy was kept.')
      return false
    }).finally(() => {
      this.running = null
      if (again && !this.stopped) void this.sync()
    })
    return this.running
  }

  async importGuest() {
    if (!(await this.sync())) throw new Error('Account Journal must finish syncing before guest import. The guest copy was kept.')
    const guest = loadData()
    if (guest.error) throw new Error('Guest Journal is unreadable. Restore a backup first.')
    const token = await this.requireToken()
    const preserved = await preserveInitialJournal(guest.data, await this.list(token))
    for (const operation of importOperations(preserved)) await this.send(token, operation)
    const items = await this.list(token)
    const current = this.client.getData()
    if (items.length === 0 && (guest.data.journal.length || guest.data.journalFolders?.length || guest.data.plannedWorkouts?.length || current.journal.length || current.plannedWorkouts?.length)) {
      throw new Error('Cloud Journal returned empty data. Guest and account copies were kept.')
    }
    if (!this.client.save(applyItems(current, items))) throw new Error('Guest Journal reached the cloud, but the local view could not update. The guest copy was kept.')
    this.client.status('Life Storage saved in cloud.')
  }

  private async requireToken() {
    const token = await this.client.token()
    if (!token) throw new Error('Journal cloud access is unavailable. Your local copy was kept.')
    return token
  }

  private async send(token: string, operation: CloudOperation) {
    if (!validCloudOperation(operation)) throw new Error('A local Journal item needs recovery before sync. It was kept.')
    const response = await fetch('/api/gym-storage', {
      method: 'POST',
      headers: { Authorization: token.startsWith('Guest ') ? token : `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(operation),
      cache: 'no-store',
    })
    if (response.status === 409) throw new Error('Journal changed on another device. Both copies were kept; review this device before retrying.')
    if (!response.ok) throw new Error('Could not save Journal to the cloud. Your local copy was kept.')
  }

  private async list(token: string) {
    const items: CloudItem[] = []
    let after: string | null = null
    const seen = new Set<string>()
    for (let page = 0; page < 10_000; page++) {
      const url: string = after ? `/api/gym-storage?after=${encodeURIComponent(after)}` : '/api/gym-storage'
      const response = await fetch(url, { headers: { Authorization: token.startsWith('Guest ') ? token : `Bearer ${token}` }, cache: 'no-store' })
      if (!response.ok) throw new Error('Could not load cloud Journal. Your local copy was kept.')
      const body: unknown = await response.json()
      if (!body || typeof body !== 'object' || !('items' in body) || !Array.isArray(body.items) ||
        !body.items.every(validCloudItem) || !('after' in body) ||
        (body.after !== null && typeof body.after !== 'string')) {
        throw new Error('Cloud Journal response is incomplete. Your local copy was kept.')
      }
      for (const item of body.items) {
        const key = `${item.kind}:${item.id}`
        if (seen.has(key)) throw new Error('Cloud Journal response repeated an item. Your local copy was kept.')
        seen.add(key)
        items.push(item)
      }
      if (body.after === null) return items
      if (body.after === after || !body.items.length) throw new Error('Cloud Journal response is incomplete. Your local copy was kept.')
      after = body.after
    }
    throw new Error('Cloud Journal has too many pages. Your local copy was kept.')
  }

  private async perform() {
    this.client.status('Syncing Life Storage…')
    const token = await this.requireToken()
    const original = this.client.getData()
    if (!meta(original).migrated || meta(original).endpoint !== 'gym-storage-v1') {
      const remote = await this.list(token)
      let preserved: LifeOSData | null = null
      for (let attempt = 0; attempt < 5; attempt++) {
        const current = this.client.getData()
        const snapshot = JSON.stringify(current)
        const candidate = await preserveInitialJournal(current, remote)
        if (JSON.stringify(this.client.getData()) === snapshot) { preserved = candidate; break }
      }
      if (!preserved) throw new Error('Local workouts changed during cloud preparation. Your local copy was kept; retry sync.')
      preserved.journalCloud = { ...meta(preserved), pending: [] }
      if (!this.client.save(preserved)) throw new Error('Could not prepare local Journal for cloud merge. Your notes were kept.')
      for (const operation of importOperations(preserved)) await this.send(token, operation)
      const current = this.client.getData()
      if (!this.client.save({ ...current, journalCloud: { ...meta(current), migrated: true, plansMigrated: true, endpoint: 'gym-storage-v1' } })) {
        throw new Error('Could not mark Journal migration complete. Your local copy was kept.')
      }
    }
    if (!meta(this.client.getData()).plansMigrated) {
      const remote = await this.list(token)
      let next: LifeOSData | null = null
      for (let attempt = 0; attempt < 5; attempt++) {
        const current = this.client.getData()
        const snapshot = JSON.stringify(current)
        const preserved = await preserveInitialJournal({ ...current, journal: [], journalFolders: [] }, remote)
        if (JSON.stringify(this.client.getData()) === snapshot) {
          next = { ...current, plannedWorkouts: preserved.plannedWorkouts }
          break
        }
      }
      if (!next) throw new Error('Local workout plans changed during cloud preparation. Your local copy was kept; retry sync.')
      if (!this.client.save(next)) throw new Error('Could not prepare workout plans for cloud merge. Your plans were kept.')
      for (const plan of next.plannedWorkouts ?? []) {
        await this.send(token, { mode: 'import', kind: 'plan', id: plan.id, deleted: false, payload: plan })
      }
      const current = this.client.getData()
      if (!this.client.save({ ...current, journalCloud: { ...meta(current), plansMigrated: true } })) {
        throw new Error('Could not mark workout plan migration complete. Your local copy was kept.')
      }
    }
    while (!this.stopped) {
      const current = this.client.getData()
      const pending = [...meta(current).pending].sort((a, b) => priority(a) - priority(b))
      if (!pending.length) break
      const operation = pending[0]
      await this.send(token, operation)
      const latest = this.client.getData()
      const nextPending = [...meta(latest).pending]
      const completedIndex = nextPending.findIndex(item => JSON.stringify(item) === JSON.stringify(operation))
      if (completedIndex < 0) throw new Error('A local change was replaced during sync. Your local copy was kept.')
      nextPending.splice(completedIndex, 1)
      if (!this.client.save({ ...latest, journalCloud: { ...meta(latest), pending: nextPending } })) {
        throw new Error('Could not confirm Journal sync locally. Your local copy was kept.')
      }
    }
    if (this.stopped) return
    const items = await this.list(token)
    const latest = this.client.getData()
    if (items.length === 0 && (latest.journal.length || latest.journalFolders?.length || latest.plannedWorkouts?.length)) {
      throw new Error('Cloud Journal returned empty data. Your local copy was kept.')
    }
    if (!this.client.save(applyItems(latest, items))) {
      throw new Error('Could not save cloud Journal locally. Your local copy was kept.')
    }
    this.client.status('Life Storage saved in cloud.')
  }
}

export function guestJournalCount(account?: LifeOSData) {
  const guest = loadData()
  const existing = new Set(account?.journal.map(entry => entry.id))
  const existingPlans = new Set((account?.plannedWorkouts ?? []).map(plan => plan.id))
  return guest.error ? 0 : guest.data.journal.filter(entry => !existing.has(entry.id)).length +
    (guest.data.plannedWorkouts ?? []).filter(plan => !existingPlans.has(plan.id)).length
}
