import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react'
import { ArrowLeft, BookOpen, ChevronDown, Folder, ImagePlus, Link2, MapPin, Mic, MoreHorizontal, Pencil, Search, Sparkles, Square, Trash2, X } from 'lucide-react'
import type { JournalEntry, JournalFolder, JournalFolderAppearance } from '../data'
import JournalFolders from './JournalFolders'
import EntryFolderDrag from './EntryFolderDrag'
import { FolderGlyph } from './FolderGlyph'
import FolderPicker, { FolderSheet } from './FolderPicker'
import { JournalSheet } from './JournalSheet'
import UnifiedSearch from '../search/UnifiedSearch'
import { prepareJournalPhoto } from './photo'
import { clearJournalDraft, readJournalDraft, readOpenJournalEditor, writeJournalDraft, writeOpenJournalEditor } from './drafts'
import { locationLabel, requestApproximateLocation, type ApproximateLocation } from './location'
import { groupJournalEntries, journalDate, journalTime } from './timeline'
import { dictationLanguages, useJournalDictation } from './useJournalDictation'
import WorkoutFields from './WorkoutFields'
import { validWorkout, type WorkoutRecord } from './workout'
import { translate, type AppLanguage } from '../language'
import './journal.css'

export interface JournalDraft {
  text: string
  workout?: WorkoutRecord
  plannedWorkoutId?: string
  photo?: string
  location?: ApproximateLocation
  linkedEntryId?: string
}

interface JournalPageProps {
  language?: AppLanguage
  timeFormat: '12' | '24'
  onReturn: () => void
  returnLabel: string
  entries: JournalEntry[]
  folders: JournalFolder[]
  cloudStatus?: string
  guestImportCount?: number
  onImportGuest?: () => void
  onSaveFolder: (name: string, appearance: JournalFolderAppearance, id?: string) => boolean
  onReorderFolders: (from: string, to: string) => boolean
  onDeleteFolder: (id: string) => boolean
  onMoveEntry: (id: string, folderId?: string) => boolean
  draft: JournalDraft
  focusExerciseRequest?: number
  draftSaveError?: boolean
  onDraftChange: Dispatch<SetStateAction<JournalDraft>>
  draftStorageKey?: string
  onDraftStorageError?: () => void
  linkedTaskTitle?: string
  onUnlinkTask?: () => void
  sessionPrompt: boolean
  onDismissPrompt: () => void
  onCreate: (draft: JournalDraft, folderId?: string) => boolean
  onEdit: (id: string, draft: JournalDraft) => boolean
  onDelete: (id: string) => boolean
  searchResult?: { id: string }
  onSelectSearchEntry: (id: string) => void
}

interface JournalFormProps {
  language?: AppLanguage
  id: string
  draft: JournalDraft
  draftSaveError?: boolean
  onDraftChange: Dispatch<SetStateAction<JournalDraft>>
  onSubmit: (draft: JournalDraft) => boolean
  folders?: JournalFolder[]
  folderId?: string
  onFolderChange?: (folderId: string) => void
  entries: JournalEntry[]
  currentEntryId?: string
  linkedTaskTitle?: string
  onUnlinkTask?: () => void
  onCancel?: () => void
}

function entryLabel(entry: JournalEntry, language: AppLanguage) {
  const excerpt = entry.text.trim().replace(/\s+/g, ' ').slice(0, 65)
  return excerpt || entry.workout?.exercises[0]?.name || `${language === 'ru' ? 'Запись от' : 'Entry from'} ${journalDate(entry.createdAt, language)}`
}

function JournalForm({ id, draft, draftSaveError, onDraftChange, onSubmit, folders, folderId, onFolderChange, entries, currentEntryId, linkedTaskTitle, onUnlinkTask, onCancel, language = 'en' }: JournalFormProps) {
  const t = (text: string) => translate(language, text)
  const [photoError, setPhotoError] = useState('')
  const [saveError, setSaveError] = useState(false)
  const [loadingPhoto, setLoadingPhoto] = useState(false)
  const submitted = useRef(false)
  const [locating, setLocating] = useState(false)
  const [locationMessage, setLocationMessage] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const linkDialog = useRef<HTMLDialogElement>(null)
  const textArea = useRef<HTMLTextAreaElement>(null)
  const languageMenu = useRef<HTMLDetailsElement>(null)
  const dictation = useJournalDictation(text => {
    onDraftChange(current => ({
      ...current,
      text: current.text && !/\s$/.test(current.text) ? current.text + ' ' + text : current.text + text,
    }))
  })
  const dictating = dictation.status !== 'idle'
  const workoutReady = draft.workout !== undefined && validWorkout(draft.workout)
  const workoutStarted = draft.workout?.exercises.some(exercise => exercise.name.trim() ||
    exercise.sets.some(set => set.reps > 0 || set.weightKg !== undefined))
  const canSave = !loadingPhoto && (!draft.workout || workoutReady) && (draft.text.trim().length > 0 || !!draft.photo || workoutReady)
  const selectedLanguage = dictationLanguages.find(([code]) => code === dictation.language) ?? dictationLanguages[0]
  const selectedEntry = entries.find(entry => entry.id === draft.linkedEntryId)

  useEffect(() => {
    if (!onCancel || !textArea.current) return
    const field = textArea.current
    let active = true
    const resize = () => {
      if (!active || !field.getClientRects().length) return
      field.style.height = 'auto'
      field.style.height = `${field.scrollHeight + field.offsetHeight - field.clientHeight}px`
    }
    resize()
    void document.fonts.ready.then(resize)
    document.fonts.addEventListener('loadingdone', resize)
    window.addEventListener('resize', resize)
    return () => {
      active = false
      document.fonts.removeEventListener('loadingdone', resize)
      window.removeEventListener('resize', resize)
    }
  }, [draft.text, onCancel])

  useEffect(() => {
    const flush = () => {
      if (submitted.current || !textArea.current) return
      const text = textArea.current.value
      onDraftChange(current => current.text === text ? current : { ...current, text })
    }
    const hidden = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', flush)
    }
  }, [onDraftChange])

  const attachPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setPhotoError('')
    setLoadingPhoto(true)
    try {
      const photo = await prepareJournalPhoto(file)
      if (fileInput.current) onDraftChange(current => ({ ...current, photo }))
    } catch (error) {
      if (fileInput.current) setPhotoError(error instanceof Error ? error.message : 'This photo could not be opened.')
    } finally {
      if (fileInput.current) setLoadingPhoto(false)
    }
  }

  const addLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage(language === 'ru' ? 'Геолокация недоступна. Запись можно сохранить без места.' : 'Location is unavailable. You can save without it.')
      return
    }
    setLocating(true)
    setLocationMessage('')
    void requestApproximateLocation(navigator.geolocation).then(location => {
      onDraftChange(current => ({ ...current, location }))
      setLocating(false)
    }).catch(() => {
      setLocating(false)
      setLocationMessage(language === 'ru' ? 'Доступ к месту не получен. Запись можно сохранить без него.' : 'Location permission was not granted. You can save without it.')
    })
  }

  return (
    <form className={onCancel ? 'journal-form journal-form-edit' : 'journal-form journal-form-new'} onSubmit={event => {
      event.preventDefault()
      if (!canSave) return
      const saved = onSubmit({ ...draft, text: draft.text.trim(), workout: draft.workout && {
        exercises: draft.workout.exercises.map(exercise => ({ ...exercise, name: exercise.name.trim() })),
      } })
      setSaveError(!saved)
      if (saved) {
        submitted.current = true
        dictation.reset()
        setPhotoError('')
      }
    }}>
      {linkedTaskTitle !== undefined && onUnlinkTask && <div className="journal-task-link">
        <span>{t('Linked to:')} <strong>{linkedTaskTitle}</strong></span>
        <button type="button" className="journal-icon" aria-label={t('Unlink task')} onClick={onUnlinkTask}><X size={17} aria-hidden="true" /></button>
      </div>}
      <WorkoutFields language={language} workout={draft.workout} onChange={workout => onDraftChange(current => ({ ...current, workout }))} />
      {draft.workout && workoutStarted && !workoutReady && <p className="workout-required" role="status">{language === 'ru'
        ? 'Проверьте название упражнения, повторы, вес и отдых.'
        : 'Check exercise name, reps, weight, and rest.'}</p>}
      <label htmlFor={id}>{draft.workout ? (language === 'ru' ? 'Заметки (необязательно)' : 'Notes (optional)') : t('Brain dump')}</label>
      <textarea
        ref={textArea}
        id={id}
        aria-label={onCancel ? t('Entry text') : undefined}
        placeholder={draft.workout ? (language === 'ru' ? 'Как прошла тренировка?' : 'How did it go?') : t('What’s on your mind?')}
        rows={onCancel ? 3 : 2}
        value={draft.text}
        onInput={event => {
          submitted.current = false
          const text = event.currentTarget.value
          onDraftChange(current => current.text === text ? current : { ...current, text })
        }}
        onBlur={event => {
          if (submitted.current) return
          const text = event.currentTarget.value
          onDraftChange(current => current.text === text ? current : { ...current, text })
        }}
        onCompositionEnd={event => {
          submitted.current = false
          const text = event.currentTarget.value
          onDraftChange(current => current.text === text ? current : { ...current, text })
        }}
        onChange={event => {
          const text = event.currentTarget.value
          onDraftChange(current => ({ ...current, text }))
        }}
      />
      <details className="journal-workout-advanced" open={Boolean(onCancel || draft.photo || draft.location || draft.linkedEntryId || folderId)}>
        <summary>{language === 'ru' ? 'Дополнительно: папка, фото и место' : 'More options: folder, photo, location'}</summary>
        <div className="journal-workout-advanced-content">
      {!onCancel && folders && onFolderChange && <div className="journal-form-folder">
        <span className="journal-form-folder-label">{t('Save in folder')}</span>
        <FolderPicker label={t('Save in folder')} value={folderId ?? ''} dialogClassName="journal-sheet--centered"
          options={[{ value: '', label: t('No folder') }, ...folders.map(folder => ({ value: folder.id, label: folder.name, folder }))]}
          onChange={onFolderChange} />
      </div>}
      <div className="journal-note-link">
        <button type="button" className="journal-folder-trigger journal-note-link-trigger" aria-haspopup="dialog"
          onClick={() => linkDialog.current?.showModal()}>
          <span className="journal-form-folder-label">{language === 'ru' ? 'Связать заметку' : 'Link a note'}</span>
          <span className="journal-note-link-value">
            <Link2 size={17} aria-hidden="true" />
            <span>{selectedEntry ? entryLabel(selectedEntry, language) : (language === 'ru' ? 'Выбрать заметку' : 'Choose a note')}</span>
            <ChevronDown size={16} aria-hidden="true" />
          </span>
        </button>
        <JournalSheet dialog={linkDialog} label={language === 'ru' ? 'Связать заметку' : 'Link a note'}
          closeLabel={language === 'ru' ? 'Закрыть выбор заметки' : 'Close note picker'} className="journal-sheet--centered">
          {entries.filter(entry => entry.id !== currentEntryId).length === 0
            ? <p className="journal-note-link-empty">{language === 'ru' ? 'Сначала сохраните другую заметку, чтобы связать её с этой.' : 'Save another note first, then link it here.'}</p>
            : <ul>{entries.filter(entry => entry.id !== currentEntryId).map(entry => <li key={entry.id}>
              <button type="button" aria-pressed={draft.linkedEntryId === entry.id} onClick={() => {
                onDraftChange(current => ({ ...current, linkedEntryId: entry.id }))
                linkDialog.current?.close()
              }}><Link2 size={17} aria-hidden="true" /><span>{entryLabel(entry, language)}</span></button>
            </li>)}</ul>}
        </JournalSheet>
        {draft.linkedEntryId && <div className="journal-note-link-selected">
          <Link2 size={15} aria-hidden="true" />
          <span>{selectedEntry ? entryLabel(selectedEntry, language) : (language === 'ru' ? 'Связанная заметка удалена' : 'Linked note was deleted')}</span>
          <button type="button" className="journal-icon" aria-label={language === 'ru' ? 'Убрать связь' : 'Remove linked note'}
            onClick={() => onDraftChange(current => ({ ...current, linkedEntryId: undefined }))}><X size={16} aria-hidden="true" /></button>
        </div>}
      </div>
      {draft.photo && (
        <div className="journal-photo-preview">
          <img src={draft.photo} alt={t('Attached photo preview')} />
          <button type="button" className="journal-icon" disabled={loadingPhoto} onClick={() => onDraftChange(current => ({ ...current, photo: undefined }))} aria-label={t('Remove attached photo')}><X size={17} /></button>
        </div>
      )}
      {photoError && <p className="journal-photo-error" role="alert">{t(photoError)}</p>}
      <div className="journal-location">
        {draft.location ? <span><MapPin size={15} aria-hidden="true" />{locationLabel(draft.location, language)}
          <button type="button" className="journal-icon" aria-label={language === 'ru' ? 'Убрать место' : 'Remove location'}
            onClick={() => onDraftChange(current => ({ ...current, location: undefined }))}><X size={15} /></button></span>
          : <button type="button" className="journal-location-add" disabled={locating} onClick={addLocation}>
            <MapPin size={15} aria-hidden="true" />{locating ? (language === 'ru' ? 'Определяем место…' : 'Finding location…') : (language === 'ru' ? 'Добавить место' : 'Add location')}
          </button>}
      </div>
      {locationMessage && <p className="journal-local-note" role="status">{locationMessage}</p>}
      <div className="journal-workout-media-actions">
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={attachPhoto} hidden />
        <button type="button" className="journal-icon journal-photo-action" aria-label={t(draft.photo ? 'Replace photo' : 'Attach photo')} disabled={loadingPhoto} onClick={() => fileInput.current?.click()}><ImagePlus size={19} /></button>
        {!onCancel && (
          <button type="button" className="journal-icon journal-voice-action"
            aria-label={t(dictation.status === 'listening' ? 'Stop dictation' : dictating ? 'Cancel dictation' : 'Start dictation')}
            data-listening={dictating} onClick={dictation.toggle}>
            {dictating ? <Square size={16} fill="currentColor" aria-hidden="true" /> : <Mic size={19} aria-hidden="true" />}
          </button>
        )}
        {!onCancel && !dictating && (
          <details className="journal-dictation-language" ref={languageMenu}>
            <summary aria-label={`Dictation language: ${selectedLanguage[1]}`}>
              <span aria-hidden="true">{selectedLanguage[0].toUpperCase()}</span>
              <ChevronDown size={14} aria-hidden="true" />
            </summary>
            <div className="journal-dictation-languages" role="group" aria-label="Choose dictation language">
              {dictationLanguages.map(([code, label]) => <button type="button" key={code}
                aria-label={label} aria-pressed={dictation.language === code}
                onClick={() => {
                  dictation.setLanguage(code)
                  languageMenu.current?.removeAttribute('open')
                }}>{code.toUpperCase()}</button>)}
            </div>
          </details>
        )}
        {dictation.status !== 'idle' && <span className="journal-local-note" role="status">{{
          starting: 'Starting microphone…', listening: 'Recording… Tap to finish.',
          preparing: 'Preparing dictation… The first time may take a minute.',
          transcribing: 'Turning speech into text…',
        }[dictation.status]}</span>}
        {loadingPhoto && <span className="journal-local-note" role="status">{t('Preparing photo…')}</span>}
      </div>
        </div>
      </details>
      {dictation.message && <p className="journal-dictation-message" role="status">{t(dictation.message)}</p>}
      {saveError && <p className="journal-photo-error" role="alert">{t('Couldn’t save this entry. Your draft is still here.')}</p>}
      {draftSaveError && <p className="journal-photo-error" role="alert">{language === 'ru'
        ? 'Черновик не удалось сохранить на устройстве. Сохраните запись сейчас или скопируйте текст.'
        : 'This device could not keep the draft. Save now or copy your text.'}</p>}
      <div className="journal-form-actions">
        {onCancel && <button type="button" className="journal-text-action" onClick={onCancel}>{t('Cancel')}</button>}
        <button type="submit" className="journal-save" disabled={!canSave}
          aria-label={onCancel ? t('Save changes') : draft.workout ? (language === 'ru' ? 'Сохранить тренировку' : 'Save workout') : t('Save entry')}>
          {onCancel ? t('Save changes') : draft.workout ? (language === 'ru' ? 'Сохранить тренировку' : 'Save workout') : t('Save')}
        </button>
      </div>
    </form>
  )
}

function JournalCard({ entry, entries, folders, onEdit, onDelete, onMove, onOpenLinked, isSearchResult, draftStorageKey, onDraftStorageError, timeFormat, language = 'en' }: {
  language?: AppLanguage
  timeFormat: '12' | '24'
  entry: JournalEntry
  entries: JournalEntry[]
  folders: JournalFolder[]
  onEdit: (draft: JournalDraft) => boolean
  onDelete: () => void
  onMove: (folderId?: string) => boolean
  onOpenLinked: (id: string) => void
  isSearchResult: boolean
  draftStorageKey?: string
  onDraftStorageError?: () => void
}) {
  const t = (text: string) => translate(language, text)
  const [action, setAction] = useState<'read' | 'edit' | 'delete'>(() => readOpenJournalEditor(draftStorageKey) === entry.id ? 'edit' : 'read')
  const folder = folders.find(folder => folder.id === entry.folderId)
  const linkedEntry = entries.find(item => item.id === entry.linkedEntryId)
  const [draft, setDraft] = useState<JournalDraft>(() => readOpenJournalEditor(draftStorageKey) === entry.id
    ? readJournalDraft(draftStorageKey, entry.id) ?? { text: entry.text, photo: entry.photo, location: entry.location, linkedEntryId: entry.linkedEntryId, workout: entry.workout }
    : { text: entry.text, photo: entry.photo, location: entry.location, linkedEntryId: entry.linkedEntryId, workout: entry.workout })
  const draftRef = useRef(draft)
  const [draftSaveError, setDraftSaveError] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const actionMenu = useRef<HTMLDetailsElement>(null)
  const editDialog = useRef<HTMLDialogElement>(null)
  const moveDialog = useRef<HTMLDialogElement>(null)
  const photoId = `journal-photo-${entry.id}`

  useLayoutEffect(() => {
    if (action !== 'edit') return
    editDialog.current?.showModal()
    editDialog.current?.querySelector('textarea')?.focus()
  }, [action])

  useEffect(() => {
    if (action !== 'edit') return
    const restore = () => {
      if (document.visibilityState === 'visible' && !editDialog.current?.open) editDialog.current?.showModal()
    }
    document.addEventListener('visibilitychange', restore)
    window.addEventListener('pageshow', restore)
    return () => {
      document.removeEventListener('visibilitychange', restore)
      window.removeEventListener('pageshow', restore)
    }
  }, [action])

  const startEditing = () => {
    if (actionMenu.current) {
      actionMenu.current.open = false
      actionMenu.current.querySelector('summary')?.focus()
    }
    const next = readJournalDraft(draftStorageKey, entry.id) ?? { text: entry.text, photo: entry.photo, location: entry.location, linkedEntryId: entry.linkedEntryId, workout: entry.workout }
    draftRef.current = next
    setDraft(next)
    if (!writeOpenJournalEditor(entry.id, draftStorageKey)) onDraftStorageError?.()
    setAction('edit')
  }

  const changeDraft: Dispatch<SetStateAction<JournalDraft>> = change => {
    const next = typeof change === 'function' ? change(draftRef.current) : change
    draftRef.current = next
    const persisted = writeJournalDraft(next, draftStorageKey, entry.id)
    setDraftSaveError(!persisted)
    if (!persisted) onDraftStorageError?.()
    setDraft(next)
  }

  const closeEditor = () => {
    if (!writeOpenJournalEditor(null, draftStorageKey)) onDraftStorageError?.()
    editDialog.current?.close()
    setAction('read')
  }

  return (
    <article className="journal-entry" id={`journal-entry-${entry.id}`}
      tabIndex={isSearchResult ? -1 : undefined} data-search-result={isSearchResult || undefined}>
      <div className="journal-entry-content">
        {entry.photo && <button className="journal-thumbnail" type="button" onClick={() => setExpanded(value => !value)}
          aria-expanded={expanded} aria-controls={photoId} aria-label={t(expanded ? 'Hide entry photo' : 'View entry photo')}>
          <img src={entry.photo} alt="" loading="lazy" />
        </button>}
        <div className="journal-entry-copy">
          <div className="journal-entry-time">
            <time dateTime={entry.createdAt}>{journalDate(entry.createdAt, language)} · {journalTime(entry.createdAt, language, timeFormat)}</time>
            {entry.updatedAt && <span title={journalDate(entry.updatedAt, language)}>{t('Edited')}</span>}
            {entry.location && <span className="journal-entry-location"><MapPin size={12} aria-hidden="true" />{locationLabel(entry.location, language)}</span>}
            {folder && <span className="journal-entry-folder"><FolderGlyph {...folder} size={12} />{folder.name}</span>}
          </div>
          {entry.workout && <div className="workout-summary">{entry.workout.exercises.map((exercise, index) => <div key={index}>
            <strong>{exercise.name}</strong>
            <span>{exercise.sets.map((set, position) => `${position + 1}: ${set.reps} ${language === 'ru' ? 'повт.' : 'reps'}${set.weightKg === undefined ? '' : ` · ${set.weightKg} kg`}`).join('  ·  ')}</span>
            {exercise.restSeconds !== undefined && <small>{language === 'ru' ? 'Отдых' : 'Rest'}: ${exercise.restSeconds} {language === 'ru' ? 'сек' : 'sec'}</small>}
          </div>)}</div>}
          {entry.text && <p>{entry.text}</p>}
          {entry.linkedEntryId && (linkedEntry
            ? <button type="button" className="journal-entry-linked" onClick={() => onOpenLinked(linkedEntry.id)}>
              <Link2 size={14} aria-hidden="true" />{entryLabel(linkedEntry, language)}
            </button>
            : <span className="journal-entry-linked journal-entry-linked-missing"><Link2 size={14} aria-hidden="true" />{language === 'ru' ? 'Связанная заметка удалена' : 'Linked note was deleted'}</span>)}
        </div>
        {action !== 'delete' && folders.length > 0 && <EntryFolderDrag folders={folders} entry={entry}
          onMove={onMove} onChooseFolder={() => {
            if (actionMenu.current) actionMenu.current.open = false
            moveDialog.current?.showModal()
          }} />}
        {action !== 'delete' && <button type="button" className="journal-icon journal-entry-edit"
          aria-label={t('Edit entry')} aria-haspopup="dialog" onClick={startEditing}>
          <Pencil size={18} aria-hidden="true" />
        </button>}
        <details className="journal-entry-actions" ref={actionMenu} onKeyDown={event => {
          if (event.key === 'Escape' && actionMenu.current?.open) {
            actionMenu.current.open = false
            actionMenu.current.querySelector('summary')?.focus()
          }
        }}>
          <summary className="journal-icon" aria-label={t('Entry actions')}><MoreHorizontal size={20} /></summary>
          <div className="journal-actions-popover">
            <button type="button" aria-haspopup="dialog" onClick={startEditing}><Pencil size={15} /> {t('Edit entry')}</button>
            {folders.length > 0 && <button type="button" aria-haspopup="dialog" onClick={() => {
              if (actionMenu.current) {
                actionMenu.current.open = false
                actionMenu.current.querySelector('summary')?.focus()
              }
              moveDialog.current?.showModal()
            }}><Folder size={15} /> {t('Move to folder')}</button>}
            <button type="button" onClick={() => {
              if (actionMenu.current) actionMenu.current.open = false
              setAction('delete')
            }}><Trash2 size={15} /> {t('Delete entry')}</button>
          </div>
        </details>
      </div>
      {entry.photo && <div id={photoId} hidden={!expanded} className="journal-expanded-photo">
        {expanded && <img src={entry.photo} alt={t('Photo attached to this entry')} />}
      </div>}
      {folders.length > 0 && <FolderSheet dialog={moveDialog} label={t('Move to folder')}
        value={entry.folderId ?? ''} onChange={folderId => onMove(folderId || undefined)} options={[
          { value: '', label: t('No folder') },
          ...folders.map(folder => ({ value: folder.id, label: folder.name, folder })),
        ]} />}
      {action === 'delete' && (
        <div className="journal-delete-confirm">
          <span>{t('Delete this entry?')}</span>
          <button type="button" onClick={() => setAction('read')}>{t('Cancel')}</button>
          <button type="button" onClick={onDelete}>{t('Delete')}</button>
        </div>
      )}
      <JournalSheet dialog={editDialog} label={t('Edit entry')} closeLabel={t('Close entry editor')} onRequestClose={closeEditor}>
        {action === 'edit' && <JournalForm language={language} id={`journal-edit-${entry.id}`} draft={draft} draftSaveError={draftSaveError} onDraftChange={changeDraft} entries={entries} currentEntryId={entry.id}
          onSubmit={next => {
            const saved = onEdit(next)
            if (saved) {
              if (!clearJournalDraft(draftStorageKey, entry.id)) onDraftStorageError?.()
              closeEditor()
            }
            return saved
          }} onCancel={closeEditor} />}
      </JournalSheet>
    </article>
  )
}

export default function JournalPage({
  language = 'en', timeFormat,
  onReturn, returnLabel,
  entries, folders, cloudStatus, guestImportCount = 0, onImportGuest, onSaveFolder, onReorderFolders, onDeleteFolder, onMoveEntry, draft, draftSaveError, onDraftChange, focusExerciseRequest = 0, draftStorageKey, onDraftStorageError, linkedTaskTitle, onUnlinkTask, sessionPrompt, onDismissPrompt, onCreate, onEdit, onDelete, searchResult, onSelectSearchEntry,
}: JournalPageProps) {
  const t = (text: string) => translate(language, text)
  const [searchOpen, setSearchOpen] = useState(false)
  const [folderFilter, setFolderFilter] = useState('all')
  const [composerFolderId, setComposerFolderId] = useState('')
  const [notice, setNotice] = useState('')
  const currentFolder = folders.find(folder => `folder:${folder.id}` === folderFilter)
  const selectedFolderId = folders.some(folder => folder.id === composerFolderId) ? composerFolderId : ''
  const scopedEntries = folderFilter === 'unfiled'
    ? entries.filter(entry => !entry.folderId)
    : currentFolder ? entries.filter(entry => entry.folderId === currentFolder.id) : entries
  const groups = groupJournalEntries(scopedEntries, '', new Date(), language)
  const resultCount = scopedEntries.length

  useEffect(() => {
    if (sessionPrompt) window.scrollTo(0, 0)
  }, [sessionPrompt])

  useEffect(() => {
    if (!focusExerciseRequest) return
    const inputs = document.querySelectorAll<HTMLInputElement>('.journal-form-new [data-workout-name]')
    const name = inputs.item(inputs.length - 1)
    name?.focus({ preventScroll: true })
    name?.scrollIntoView({ block: 'center' })
  }, [focusExerciseRequest])

  useEffect(() => {
    if (!searchResult) return
    const card = document.getElementById(`journal-entry-${searchResult.id}`)
    card?.focus({ preventScroll: true })
    card?.scrollIntoView({ block: 'center' })
  }, [searchResult])

  return (
    <main className="journal-page">
      <header className="journal-title">
        <div className="journal-title-heading">
          <button type="button" className="journal-icon journal-search-toggle" aria-label={t(returnLabel)} onClick={onReturn}>
            <ArrowLeft size={21} aria-hidden="true" />
          </button>
          <h1>{t('Workout Tracker')}</h1>
        </div>
        <button type="button" className="journal-icon journal-search-toggle" aria-label={t('Search workouts')}
          aria-haspopup="dialog" onClick={() => setSearchOpen(true)}>
          <Search size={21} aria-hidden="true" />
        </button>
      </header>
      <UnifiedSearch language={language} journalOnly open={searchOpen} entries={entries} onClose={() => setSearchOpen(false)}
        onSelectEntry={id => {
          if (!scopedEntries.some(entry => entry.id === id)) setFolderFilter('all')
          onSelectSearchEntry(id)
        }} />
      {sessionPrompt && (
        <div className="journal-session-prompt" role="status">
          <Sparkles size={17} aria-hidden="true" />
          <span>{t('Session saved. Want to capture a thought while it’s fresh?')}</span>
          <button className="journal-icon" type="button" onClick={onDismissPrompt} aria-label="Dismiss prompt"><X size={17} /></button>
        </div>
      )}
      {cloudStatus && <p className="journal-cloud-status" role="status">{cloudStatus}</p>}
      {guestImportCount > 0 && onImportGuest && <div className="journal-guest-import">
        <span>{language === 'ru' ? `Гостевых записей на этом устройстве: ${guestImportCount}` : `Guest entries on this device: ${guestImportCount}`}</span>
        <button type="button" onClick={onImportGuest}>{language === 'ru' ? 'Импортировать в аккаунт' : 'Import into account'}</button>
      </div>}
      <JournalForm language={language} id="journal-entry" draft={draft} draftSaveError={draftSaveError} onDraftChange={onDraftChange} entries={entries}
        folders={folders} folderId={selectedFolderId} onFolderChange={setComposerFolderId}
        linkedTaskTitle={linkedTaskTitle} onUnlinkTask={onUnlinkTask} onSubmit={next => {
        const saved = onCreate(next, selectedFolderId || undefined)
        if (saved) {
          setComposerFolderId('')
          setNotice('Entry saved.')
        }
        return saved
      }} />
      <details className="journal-history-options" open={Boolean(currentFolder || folderFilter === 'unfiled')}>
        <summary>{language === 'ru' ? 'Папки и фильтры' : 'Folders and filters'}</summary>
      <JournalFolders language={language} folders={folders} entries={entries} filter={currentFolder || folderFilter === 'unfiled' ? folderFilter : 'all'}
        onFilterChange={setFolderFilter} onSave={onSaveFolder} onReorder={onReorderFolders} onDelete={id => {
          const deleted = onDeleteFolder(id)
          if (deleted && currentFolder?.id === id) setFolderFilter('unfiled')
          if (deleted && composerFolderId === id) setComposerFolderId('')
          return deleted
        }} />
      </details>
      <section className="journal-timeline" aria-labelledby="journal-timeline-title">
        <header className="journal-timeline-heading">
          <h2 id="journal-timeline-title">{language === 'ru' ? 'История' : 'History'}</h2>
          <span className="journal-entry-count" aria-live="polite">{resultCount} {t(resultCount === 1 ? 'entry' : 'entries')}</span>
        </header>
        <span className="journal-sr-only" role="status">{notice}</span>
        {groups.length === 0 ? (
          <div className="journal-timeline-empty">
            <BookOpen size={23} aria-hidden="true" />
            <p>{folderFilter === 'unfiled' || currentFolder
              ? t('No entries here yet.')
              : language === 'ru' ? 'Здесь появятся сохранённые тренировки.' : 'Your saved workouts will appear here.'}</p>
          </div>
        ) : groups.map(group => (
          <section className="journal-day" key={group.key}>
            <h3>{group.label}</h3>
            <div className="journal-day-entries">
              {group.entries.map(entry => (
                <JournalCard language={language} timeFormat={timeFormat} key={entry.id} entry={entry} entries={entries} folders={folders}
                  onOpenLinked={id => {
                    if (!scopedEntries.some(item => item.id === id)) setFolderFilter('all')
                    onSelectSearchEntry(id)
                  }}
                  draftStorageKey={draftStorageKey} onDraftStorageError={onDraftStorageError} onMove={folderId => {
                  const saved = onMoveEntry(entry.id, folderId)
                  if (saved) setNotice('Entry moved.')
                  return saved
                }} isSearchResult={searchResult?.id === entry.id} onEdit={next => {
                  if (!onEdit(entry.id, next)) return false
                  setNotice('Entry updated.')
                  return true
                }} onDelete={() => {
                  onDelete(entry.id)
                }} />
              ))}
            </div>
          </section>
        ))}
      </section>
    </main>
  )
}
