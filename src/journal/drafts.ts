import { STORAGE_KEY } from '../data.ts'
import { isJournalPhoto } from './photo.ts'
import { validApproximateLocation, type ApproximateLocation } from './location.ts'

export type SavedDraft = { text: string; photo?: string; location?: ApproximateLocation }

export function draftStorageKey(storageKey = STORAGE_KEY, id = 'new') {
  return `${storageKey}.journal-draft.v1.${id}`
}

export function readJournalDraft(storageKey?: string, id?: string): SavedDraft | null {
  try {
    const raw = localStorage.getItem(draftStorageKey(storageKey, id))
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || !('text' in value) ||
      typeof value.text !== 'string' || value.text.length > 3_000_000 ||
      ('photo' in value && value.photo !== undefined &&
        (typeof value.photo !== 'string' || !isJournalPhoto(value.photo))) ||
      ('location' in value && value.location !== undefined && !validApproximateLocation(value.location))) return null
    return value as SavedDraft
  } catch { return null }
}

export function writeJournalDraft(draft: SavedDraft, storageKey?: string, id?: string): boolean {
  try {
    const key = draftStorageKey(storageKey, id)
    if (!draft.text && !draft.photo && !draft.location) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(draft))
    return true
  } catch { return false }
}

export function clearJournalDraft(storageKey?: string, id?: string): boolean {
  try {
    localStorage.removeItem(draftStorageKey(storageKey, id))
    return true
  } catch { return false }
}
