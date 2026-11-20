import { journalFolderColors, journalFolderIcons, maxJournalFolderNameLength, type JournalEntry, type JournalFolder, type PlannedWorkout } from '../data.ts'
import { isJournalPhoto } from './photo.ts'
import { validApproximateLocation } from './location.ts'
import { validWorkout } from './workout.ts'

export type CloudKind = 'folder' | 'entry' | 'plan'
type CloudBase = {
  id: string
  deleted: boolean
}
export type CloudItem =
  | (CloudBase & { kind: 'folder'; payload: JournalFolder | null })
  | (CloudBase & { kind: 'entry'; payload: JournalEntry | null })
  | (CloudBase & { kind: 'plan'; payload: PlannedWorkout | null })
export type CloudOperation = CloudItem & { mode: 'import' | 'change'; previous?: JournalFolder | JournalEntry | PlannedWorkout | null }

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200
const timestamp = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 50 && Number.isFinite(Date.parse(value))

export function validCloudFolder(value: unknown): value is JournalFolder {
  return record(value) && id(value.id) && typeof value.name === 'string' &&
    value.name.length > 0 && value.name.length <= maxJournalFolderNameLength &&
    value.name === value.name.trim() &&
    (value.order === undefined || (typeof value.order === 'number' && Number.isSafeInteger(value.order) && value.order >= 0)) &&
    (value.color === undefined || journalFolderColors.some(color => color === value.color)) &&
    (value.icon === undefined || journalFolderIcons.some(icon => icon === value.icon))
}

export function validCloudEntry(value: unknown): value is JournalEntry {
  return record(value) && id(value.id) && typeof value.text === 'string' &&
    value.text.length <= 3_000_000 && timestamp(value.createdAt) &&
    (value.updatedAt === undefined || timestamp(value.updatedAt)) &&
    (value.photo === undefined || isJournalPhoto(value.photo)) &&
    (value.taskId === undefined || id(value.taskId)) &&
    (value.linkedEntryId === undefined || (id(value.linkedEntryId) && value.linkedEntryId !== value.id)) &&
    (value.location === undefined || validApproximateLocation(value.location)) &&
    (value.workout === undefined || validWorkout(value.workout)) &&
    (value.folderId === undefined || id(value.folderId))
}

export function validCloudPlan(value: unknown): value is PlannedWorkout {
  if (!record(value) || !id(value.id) || typeof value.title !== 'string' ||
    !value.title.trim() || value.title.length > 140 || !timestamp(value.createdAt)) return false
  if (value.plannedFor === undefined) return true
  if (typeof value.plannedFor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.plannedFor)) return false
  const date = new Date(`${value.plannedFor}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value.plannedFor
}

export function validCloudItem(value: unknown): value is CloudItem {
  if (!record(value) || (value.kind !== 'folder' && value.kind !== 'entry' && value.kind !== 'plan') ||
    !id(value.id) || typeof value.deleted !== 'boolean') return false
  if (value.deleted) return value.payload === null
  return value.kind === 'folder'
    ? validCloudFolder(value.payload) && value.payload.id === value.id
    : value.kind === 'entry'
      ? validCloudEntry(value.payload) && value.payload.id === value.id
      : validCloudPlan(value.payload) && value.payload.id === value.id
}

export function validCloudOperation(value: unknown): value is CloudOperation {
  if (!record(value)) return false
  const mode = value.mode
  const previous = value.previous
  return (mode === 'import' || mode === 'change') &&
    validCloudItem(value) && (mode !== 'import' || !value.deleted) &&
    (previous === undefined || previous === null ||
      (value.kind === 'folder' ? validCloudFolder(previous) : value.kind === 'entry' ? validCloudEntry(previous) : validCloudPlan(previous)))
}
