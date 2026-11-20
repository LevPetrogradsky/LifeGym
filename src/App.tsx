import MainDashboard from './MainDashboard'
import MainFocus from './MainFocus'
import TaskHistory from './TaskHistory'
import AskLifeOS from './home/AskLifeOS'
import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode, type SetStateAction } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, ClipboardList, Dumbbell, House, Leaf, MessageCircle, Play, Settings2, Sparkles } from 'lucide-react'
import { elapsedClock, focusedDuration, loadData, recordUnratedSession, restoreBackup, saveData, shortcuts, shortcutVisible, timerView, visibleShortcuts, STORAGE_KEY, type Factor, type JournalFolderAppearance, type LifeOSData, type PlannedWorkout, type Shortcut, type Task } from './data'
import { base64ToBytes, buildNoteBlocks, makeImportedNote, type SourceIndex } from './notes'
import JournalPage, { type JournalDraft } from './journal/JournalPage'
import ServiceOnboarding from './onboarding/ServiceOnboarding'
import { completionKey, initialOnboardingMode } from './onboarding/state'
import WorkoutsPage from './workouts/WorkoutsPage'
import { emptyExercise } from './journal/workout'
import { clearJournalDraft, readJournalDraft, writeJournalDraft } from './journal/drafts'
import { JournalCloudSync, guestJournalCount, withJournalChanges } from './journal/cloud-sync'
import { cloudConsentKey, guestRecoveryStorageKey, normalizeRecoveryCode, readRecoveryCode } from './journal/guest-recovery'
import FlowEnginePage from './flow/FlowEnginePage'
import BreakReminder from './settings/BreakReminder'
import SettingsPage from './settings/SettingsPage'
import JournalCloudPanel from './settings/JournalCloudPanel'
import PostFocusChoice from './PostFocusChoice'
import { findFocusPreset } from './presets/focusPresets'
import { useDeleteUndo } from './delete-undo'
import type { AccountEntryMode } from './settings/AccountPanel'
import { translate, type AppLanguage } from './language'
import './reflection-confirmation.css'
import './mobile-navigation.css'

type View = Exclude<Shortcut, 'focus'> | 'main' | 'ask' | 'settings' | 'focus-history' | 'workouts'
const shortcutIcons = { tasks: ClipboardList, journal: BookOpen, focus: Play, flow: MessageCircle }
const factors: Factor[] = ['Meaningful Goal', 'Personal Control', 'Fast Feedback', 'Other']

function App({ storageKey, account, existingAccount = false, journalCloudToken, guestCloud = false }: { storageKey?: string; account?: (language: AppLanguage, initialMode?: AccountEntryMode) => ReactNode; existingAccount?: boolean; journalCloudToken?: () => Promise<string | null>; guestCloud?: boolean }) {
  const effectiveStorageKey = storageKey ?? STORAGE_KEY
  const [cloudEnabled, setCloudEnabled] = useState(() => {
    try { return Boolean(journalCloudToken && localStorage.getItem(cloudConsentKey(effectiveStorageKey)) === 'true' && (!guestCloud || readRecoveryCode())) }
    catch { return false }
  })
  const [recoveryCode, setRecoveryCode] = useState(() => guestCloud ? readRecoveryCode() : null)
  const [loadResult, setLoadResult] = useState(() => loadData(storageKey))
  const [onboardingMode, setOnboardingMode] = useState(() =>
    initialOnboardingMode(storageKey, localStorage, window.location.search, existingAccount))
  const data = loadResult.data
  const language = data.language ?? 'en'
  const timeFormat = data.timeFormat ?? (language === 'ru' ? '24' : '12')
  const t = (text: string) => translate(language, text)
  const accountContent = account?.(language)
  const dataRef = useRef(data)
  const hiddenSections = data.hiddenSections ?? []
  const showHome = !hiddenSections.includes('main')
  const inBar = (id: Shortcut) => shortcutVisible(data, id, 'bar')
  const defaultView = showHome ? 'main' : (['journal', 'tasks'] as const).find(inBar) ?? 'settings'
  const [requestedView, setView] = useState<View>(() => {
    try { return localStorage.getItem(`${storageKey ?? STORAGE_KEY}.last-view`) === 'journal' ? 'journal' : defaultView }
    catch { return defaultView }
  })
  const [homeNavigationKey, setHomeNavigationKey] = useState(0)
  const [reflectionReturnView, setReflectionReturnView] = useState<View>(defaultView)
  const [reflectionNotice, setReflectionNotice] = useState('')
  const [postFocusReflection, setPostFocusReflection] = useState(false)
  const isHidden = (page: View) => page === 'main' ? !showHome : page === 'flow' && !postFocusReflection
  const view = isHidden(requestedView) ? defaultView : requestedView
  const showJournal = !isHidden('journal')
  const [journalSearchResult, setJournalSearchResult] = useState<{ id: string }>()
  const [storageError, setStorageError] = useState(false)
  const [showTime, setShowTime] = useState(() => {
    try { return localStorage.getItem(`${storageKey ?? STORAGE_KEY}.focus-time`) !== 'hidden' }
    catch { return true }
  })
  const [pausedFocusScreen, setPausedFocusScreen] = useState<string>()
  const [minimizedFocusScreen, setMinimizedFocusScreen] = useState<string | undefined>(() => {
    try {
      const id = loadResult.data.activeSession?.id
      return id && localStorage.getItem(`${storageKey ?? STORAGE_KEY}.focus-minimized`) === id ? id : undefined
    } catch { return undefined }
  })
  const [now, setNow] = useState(Date.now())
  const [interest, setInterest] = useState(0)
  const [continueDesire, setContinueDesire] = useState(0)
  const [progress, setProgress] = useState(0)
  const [checkingIn, setCheckingIn] = useState(false)
  const [selectedFactors, setSelectedFactors] = useState<Factor[]>([])
  const [taskHistoryId, setTaskHistoryId] = useState<string | null>(null)
  const [journalTaskId, setJournalTaskId] = useState<string | undefined>()
  const [journalDraft, setJournalDraft] = useState<JournalDraft>(() => readJournalDraft(storageKey) ?? { text: '', workout: { exercises: [emptyExercise()] } })
  const [addExerciseRequest, setAddExerciseRequest] = useState(0)
  const [journalDraftError, setJournalDraftError] = useState(false)
  const journalDraftRef = useRef(journalDraft)
  const journalCloud = useRef<JournalCloudSync | null>(null)
  const [journalCloudStatus, setJournalCloudStatus] = useState('')
  const [journalCloudError, setJournalCloudError] = useState(false)
  const [journalLastSavedAt, setJournalLastSavedAt] = useState<string | null>(() => {
    if (!journalCloudToken || !cloudEnabled) return null
    try {
      const value = localStorage.getItem(`${effectiveStorageKey}.journal-last-synced`)
      return value && Number.isFinite(Date.parse(value)) ? value : null
    } catch { return null }
  })
  const [guestNotesAvailable, setGuestNotesAvailable] = useState(() => journalCloudToken && !guestCloud ? guestJournalCount(loadResult.data) : 0)
  const [journalPrompt, setJournalPrompt] = useState(false)
  const [backupMessage, setBackupMessage] = useState('')

  useEffect(() => {
    if (journalCloudToken && !guestCloud) setGuestNotesAvailable(guestJournalCount(data))
  }, [journalCloudToken, guestCloud, data.journal])

  useEffect(() => { document.documentElement.lang = language }, [language])
  useEffect(() => {
    try { localStorage.setItem(`${storageKey ?? STORAGE_KEY}.last-view`, view === 'journal' ? 'journal' : 'other') }
    catch { /* Navigation still works when browser storage is unavailable. */ }
  }, [storageKey, view])

  useEffect(() => {
    const selected = data.theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : data.theme
    document.documentElement.dataset.theme = selected
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => { if (data.theme === 'system') document.documentElement.dataset.theme = media.matches ? 'dark' : 'light' }
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [data.theme])
  useEffect(() => {
    if (!data.activeSession || data.activeSession.pausedAt) return
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    const refresh = () => setNow(Date.now())
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    document.addEventListener('visibilitychange', refresh)
    refresh()
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [data.activeSession])
  const changeJournalDraft = (change: SetStateAction<JournalDraft>) => {
    const next = typeof change === 'function' ? change(journalDraftRef.current) : change
    journalDraftRef.current = next
    const persisted = writeJournalDraft(next, storageKey)
    setJournalDraftError(!persisted)
    if (!persisted) setStorageError(true)
    setJournalDraft(next)
  }
  const toggleFocusTime = () => {
    const next = !showTime
    setShowTime(next)
    try { localStorage.setItem(`${storageKey ?? STORAGE_KEY}.focus-time`, next ? 'visible' : 'hidden') }
    catch { setStorageError(true) }
  }
  useEffect(() => {
    if (!reflectionNotice) return
    const timeout = window.setTimeout(() => setReflectionNotice(''), 4000)
    return () => window.clearTimeout(timeout)
  }, [reflectionNotice])

  const update = (change: (current: LifeOSData) => LifeOSData) => {
    if (loadResult.error) { setStorageError(true); return false }
    let next = change(dataRef.current)
    try {
      if (cloudEnabled) next = withJournalChanges(dataRef.current, next)
    } catch {
      setStorageError(true)
      return false
    }
    const persisted = saveData(next, storageKey)
    setStorageError(!persisted)
    if (persisted) {
      dataRef.current = next
      setLoadResult({ data: next, error: null })
      if (cloudEnabled && next.journalCloud?.pending.length) void journalCloud.current?.sync()
    }
    return persisted
  }

  useEffect(() => {
    if (!journalCloudToken || !cloudEnabled || loadResult.error) return
    const sync = new JournalCloudSync({
      getData: () => dataRef.current,
      save: next => {
        if (!saveData(next, storageKey)) return false
        dataRef.current = next
        setLoadResult({ data: next, error: null })
        return true
      },
      token: journalCloudToken,
      status: message => {
        setJournalCloudStatus(message)
        if (message === 'Syncing Life Storage…') setJournalCloudError(false)
        if (message === 'Life Storage saved in cloud.') {
          setJournalCloudError(false)
          const savedAt = new Date().toISOString()
          setJournalLastSavedAt(savedAt)
          try { localStorage.setItem(`${effectiveStorageKey}.journal-last-synced`, savedAt) } catch { /* Status remains visible for this session. */ }
        } else if (message !== 'Syncing Life Storage…') setJournalCloudError(true)
      },
    })
    journalCloud.current = sync
    sync.start()
    return () => {
      sync.stop()
      if (journalCloud.current === sync) journalCloud.current = null
    }
  }, [storageKey, cloudEnabled, loadResult.error])

  const verifyRecoveryCode = async (code: string) => {
    const normalized = normalizeRecoveryCode(code)
    if (!normalized) return false
    try {
      const response = await fetch('/api/gym-storage?guest=status', { headers: { Authorization: `Guest ${normalized}` }, cache: 'no-store' })
      return response.ok && (await response.json()).exists === true
    } catch { return false }
  }

  const enableJournalCloud = async (code: string | null) => {
    if (!journalCloudToken || loadResult.error || cloudEnabled) return false
    if (guestCloud) {
      const normalized = normalizeRecoveryCode(code ?? '')
      if (!normalized) return false
      try {
        const response = await fetch('/api/gym-storage?guest=create', { method: 'POST', headers: { Authorization: `Guest ${normalized}` }, cache: 'no-store' })
        if (!response.ok) return false
        localStorage.setItem(guestRecoveryStorageKey, normalized)
        localStorage.setItem(cloudConsentKey(effectiveStorageKey), 'true')
        setRecoveryCode(normalized)
      } catch { return false }
    } else {
      try {
        const token = await journalCloudToken()
        if (!token) return false
        const response = await fetch('/api/gym-storage', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
        if (!response.ok) return false
        localStorage.setItem(cloudConsentKey(effectiveStorageKey), 'true')
      }
      catch { return false }
    }
    setCloudEnabled(true)
    return true
  }

  const recoverJournalCloud = async (code: string) => {
    const normalized = normalizeRecoveryCode(code)
    if (!guestCloud || !normalized || loadResult.error || !(await verifyRecoveryCode(normalized))) return false
    const current = dataRef.current
    const next = { ...current, journalCloud: { version: 1 as const, migrated: false, pending: [] } }
    if (!saveData(next, storageKey)) return false
    try {
      localStorage.setItem(guestRecoveryStorageKey, normalized)
      localStorage.setItem(cloudConsentKey(effectiveStorageKey), 'true')
    } catch { return false }
    dataRef.current = next
    setLoadResult({ data: next, error: null })
    setRecoveryCode(normalized)
    setJournalLastSavedAt(null)
    setCloudEnabled(true)
    return true
  }

  const importGuestJournal = async () => {
    if (!window.confirm('Copy guest workouts, workout plans, and Journal entries into this account? The guest copy will stay on this device.')) return
    try {
      await journalCloud.current?.importGuest()
      setGuestNotesAvailable(0)
      setBackupMessage('Guest workouts and Journal copied into this account. The guest copy is still on this device.')
    } catch (error) {
      setJournalCloudError(true)
      setJournalCloudStatus(error instanceof Error ? error.message : 'Guest workouts could not be copied. Their local copy was kept.')
    }
  }

  const { deleteTask, deleteJournalEntry, clearUndo, undoNotice } = useDeleteUndo(dataRef, update)

  const importBytes = async (name: string, type: string, bytes: Uint8Array, index?: SourceIndex): Promise<boolean> => {
    const note = await makeImportedNote(name, type, bytes)
    const blocks = index ? buildNoteBlocks(note, index) : null
    if (blocks) note.noteBlocks = blocks
    const existing = dataRef.current.importedNotes.find(item => item.sha256 === note.sha256)
    if (existing) {
      if (existing.rawBytesBase64 !== note.rawBytesBase64) throw new Error('Stored source bytes differ from the original')
      if (blocks && JSON.stringify(existing.noteBlocks) !== JSON.stringify(blocks)) {
        if (!update(current => ({ ...current, importedNotes: current.importedNotes.map(item => item.id === existing.id ? { ...item, noteBlocks: blocks } : item) }))) throw new Error('Local storage is unavailable')
      }
      return false
    }
    if (!update(current => ({ ...current, importedNotes: [...current.importedNotes, note] }))) throw new Error('Local storage is unavailable')
    return true
  }

  useEffect(() => {
    if (storageKey) return
    let cancelled = false
    async function importLocalSources() {
      try {
        const response = await fetch('/__lifeos_local_notes', { cache: 'no-store' })
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return
        const sources = await response.json() as { name: string; type: string; bytesBase64: string; index?: SourceIndex }[]
        if (!Array.isArray(sources)) return
        for (const source of sources) {
          if (cancelled) return
          await importBytes(source.name, source.type, base64ToBytes(source.bytesBase64), source.index)
        }
      } catch { /* A production build has no private local seed endpoint. */ }
    }
    void importLocalSources()
    return () => { cancelled = true }
  }, [])

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const backupText = await file.text()
      const next = await restoreBackup(backupText, dataRef.current, localStorage, () => window.confirm('Replace your current tasks, sessions, journal, and settings with this backup? Any readable imported Notes will be kept. Unreadable saved data will be preserved for recovery.'), storageKey,
        cloudEnabled ? restored => withJournalChanges(dataRef.current, { ...restored, journalCloud: dataRef.current.journalCloud }) : undefined)
      if (!next) return
      clearUndo()
      dataRef.current = next
      setLoadResult({ data: next, error: null })
      setStorageError(false)
      void journalCloud.current?.sync()
      setBackupMessage('Backup restored. Readable imported Notes were kept; previous unreadable data was preserved for recovery.')
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : 'Backup could not be restored.')
    } finally {
      event.target.value = ''
    }
  }

  const startFocus = (task?: Task) => {
    if (dataRef.current.activeSession || dataRef.current.pendingSession) return false
    const now = Date.now()
    const sessionId = crypto.randomUUID()
    const compact = timerView(dataRef.current) === 'compact'
    const started = update(current => ({
      ...current,
      activeSession: {
        id: sessionId,
        taskId: task?.id ?? null,
        taskTitle: task?.title ?? findFocusPreset(current.focusPresetId)?.label ?? 'Open focus',
        startedAt: new Date(now).toISOString(),
        silenceBreakReminders: findFocusPreset(current.focusPresetId)?.silenceBreakReminders,
      },
    }))
    if (started) {
      if (compact) {
        try { localStorage.setItem(`${storageKey ?? STORAGE_KEY}.focus-minimized`, sessionId) } catch { setStorageError(true) }
        setMinimizedFocusScreen(sessionId)
        if (view !== 'main' && view !== 'tasks') navigate(showHome ? 'main' : defaultView)
      } else {
        try { localStorage.removeItem(`${storageKey ?? STORAGE_KEY}.focus-minimized`) } catch { /* Focus still opens. */ }
        setMinimizedFocusScreen(undefined)
      }
      setPausedFocusScreen(undefined)
      setNow(now)
    }
    return started
  }

  const pauseSession = (stayInFocus: boolean, returnHome = true) => {
    const session = dataRef.current.activeSession
    if (!session) return
    if (!session.pausedAt) {
      const pausedAt = new Date()
      if (!update(current => ({ ...current, activeSession: { ...session, pausedAt: pausedAt.toISOString(), breakReminderDismissed: undefined } }))) return
      setNow(pausedAt.getTime())
    }
    setPausedFocusScreen(stayInFocus ? session.id : undefined)
    if (!stayInFocus && returnHome) navigate(showHome ? 'main' : defaultView)
  }

  const resumeSession = (stayCompact = false) => {
    const session = dataRef.current.activeSession
    if (!session?.pausedAt) return
    const now = Date.now()
    const pausedDurationMs = (session.pausedDurationMs ?? 0) + Math.max(0, now - Date.parse(session.pausedAt))
    if (update(current => ({
      ...current,
      activeSession: { ...session, pausedAt: undefined, pausedDurationMs, breakReminderDismissed: undefined },
    }))) {
      setMinimizedFocusScreen(stayCompact ? session.id : undefined)
      try {
        if (stayCompact) localStorage.setItem(`${storageKey ?? STORAGE_KEY}.focus-minimized`, session.id)
        else localStorage.removeItem(`${storageKey ?? STORAGE_KEY}.focus-minimized`)
      } catch { setStorageError(true) }
      setPausedFocusScreen(undefined)
      setNow(now)
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }

  const returnToFocus = () => {
    setPausedFocusScreen(dataRef.current.activeSession?.pausedAt ? dataRef.current.activeSession.id : undefined)
    setMinimizedFocusScreen(undefined)
    try { localStorage.removeItem(`${storageKey ?? STORAGE_KEY}.focus-minimized`) } catch { /* Focus still opens. */ }
    setNow(Date.now())
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const minimizeFocus = () => {
    const session = dataRef.current.activeSession
    if (!session || session.pausedAt) return
    try { localStorage.setItem(`${storageKey ?? STORAGE_KEY}.focus-minimized`, session.id) }
    catch { setStorageError(true) }
    setMinimizedFocusScreen(session.id)
    navigate(showHome ? 'main' : defaultView)
  }

  const toggleFocusSilence = () => {
    const session = dataRef.current.activeSession
    if (!session) return
    update(current => ({
      ...current,
      activeSession: { ...session, silenceBreakReminders: !session.silenceBreakReminders },
      focusPresetId: undefined,
    }))
  }

  const dismissBreakReminder = () => {
    const session = dataRef.current.activeSession
    if (!session?.pausedAt) return
    update(current => ({ ...current, activeSession: { ...session, breakReminderDismissed: true } }))
  }

  const endSession = () => {
    const current = dataRef.current
    if (!current.activeSession) return
    const finished = { ...current.activeSession, endedAt: new Date().toISOString() }
    if (!update(data => ({ ...recordUnratedSession({ ...data, activeSession: null }, finished), pendingSession: finished }))) return
    setMinimizedFocusScreen(undefined)
    try { localStorage.removeItem(`${storageKey ?? STORAGE_KEY}.focus-minimized`) } catch { /* Session is already saved. */ }
    setCheckingIn(false)
    setInterest(0)
    setContinueDesire(0)
    setProgress(0)
    setSelectedFactors([])
  }

  const cancelSession = () => {
    if (!dataRef.current.activeSession) return
    if (!update(current => ({ ...current, activeSession: null }))) return
    setPausedFocusScreen(undefined)
    setMinimizedFocusScreen(undefined)
    try { localStorage.removeItem(`${storageKey ?? STORAGE_KEY}.focus-minimized`) } catch { setStorageError(true) }
  }

  const choosePostFocusAction = (action: 'reflection' | 'check-in') => {
    const pending = dataRef.current.pendingSession
    if (!pending) return
    if (action === 'check-in') {
      setCheckingIn(true)
      return
    }
    if (update(current => recordUnratedSession(current, pending))) {
      setCheckingIn(false)
      setPostFocusReflection(true)
      setReflectionReturnView(showHome ? 'main' : defaultView)
      setView('flow')
    }
  }

  const skipPostFocus = () => {
    const pending = dataRef.current.pendingSession
    if (!pending) return
    if (!update(current => recordUnratedSession(current, pending))) return
    setCheckingIn(false)
    navigate(showHome ? 'main' : defaultView)
  }

  const saveCheckin = (event: FormEvent) => {
    event.preventDefault()
    const pending = dataRef.current.pendingSession
    if (!interest || !continueDesire || !progress || !pending) return
    const saved = update(current => {
      const ratedSession = {
        id: pending.id, taskId: pending.taskId, taskTitle: pending.taskTitle,
        startedAt: pending.startedAt, endedAt: pending.endedAt,
        durationMs: focusedDuration(pending, Date.parse(pending.endedAt)),
        interest, continueDesire, progress, factors: selectedFactors,
      }
      return {
        ...current,
        pendingSession: null,
        sessions: current.sessions.some(session => session.id === pending.id)
          ? current.sessions.map(session => session.id === pending.id ? ratedSession : session)
          : [ratedSession, ...current.sessions],
      }
    })
    if (!saved) return
    if (showJournal) {
      setJournalPrompt(true)
      setView('journal')
    } else {
      navigate(defaultView)
    }
  }

  const createJournalEntry = (draft: JournalDraft, folderId?: string) => {
    const { plannedWorkoutId, ...entryDraft } = draft
    const saved = update(current => ({
      ...current,
      plannedWorkouts: draft.workout && plannedWorkoutId
        ? (current.plannedWorkouts ?? []).filter(plan => plan.id !== plannedWorkoutId)
        : current.plannedWorkouts,
      journal: [{
        ...entryDraft, id: crypto.randomUUID(), createdAt: new Date().toISOString(), taskId: journalTaskId,
        folderId: current.journalFolders?.some(folder => folder.id === folderId) ? folderId : undefined,
      }, ...current.journal],
    }))
    if (saved) {
      if (!clearJournalDraft(storageKey)) setStorageError(true)
      setJournalDraftError(false)
      const nextDraft = { text: '', workout: { exercises: [emptyExercise()] } }
      journalDraftRef.current = nextDraft
      setJournalDraft(nextDraft)
      setJournalTaskId(undefined)
      setJournalPrompt(false)
    }
    return saved
  }

  const editJournalEntry = (id: string, draft: JournalDraft) => update(current => ({
    ...current,
    journal: current.journal.map(entry => entry.id === id ? { ...entry, text: draft.text, photo: draft.photo, location: draft.location, workout: draft.workout,
      linkedEntryId: draft.linkedEntryId === id ? undefined : draft.linkedEntryId, updatedAt: new Date().toISOString() } : entry),
  }))

  const saveJournalFolder = (name: string, appearance: JournalFolderAppearance, id?: string) => {
    const folders = dataRef.current.journalFolders ?? []
    if (folders.some(folder => folder.id !== id && folder.name.toLowerCase() === name.toLowerCase())) return false
    const journalFolders = id
      ? folders.map(folder => folder.id === id ? { ...folder, name, ...appearance } : folder)
      : [...folders, { id: crypto.randomUUID(), name, ...appearance }]
    return update(current => ({ ...current, journalFolders }))
  }

  const reorderJournalFolders = (from: string, to: string) => {
    const folders = [...(dataRef.current.journalFolders ?? [])]
    const fromIndex = folders.findIndex(folder => folder.id === from)
    const toIndex = folders.findIndex(folder => folder.id === to)
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return false

    const [moved] = folders.splice(fromIndex, 1)
    folders.splice(toIndex, 0, moved)
    return update(current => ({ ...current, journalFolders: folders }))
  }

  const deleteJournalFolder = (id: string) => update(current => ({
    ...current,
    journalFolders: current.journalFolders?.filter(folder => folder.id !== id),
    journal: current.journal.map(entry => entry.folderId === id ? { ...entry, folderId: undefined } : entry),
  }))

  const moveJournalEntry = (id: string, folderId?: string) => {
    const current = dataRef.current
    if (folderId !== undefined && !current.journalFolders?.some(folder => folder.id === folderId)) return false
    return update(data => ({
      ...data,
      journal: data.journal.map(entry => entry.id === id ? { ...entry, folderId } : entry),
    }))
  }

  const navigate = (next: View) => {
    setJournalSearchResult(undefined)
    if (next !== 'flow') setPostFocusReflection(false)
    if (next === 'flow' && view !== 'flow') {
      setReflectionReturnView(view)
      setReflectionNotice('')
    }
    setView(isHidden(next) ? defaultView : next)
    setJournalPrompt(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openWorkoutDraft = () => {
    changeJournalDraft(current => current.workout ? current : { ...current, workout: { exercises: [emptyExercise()] } })
    setAddExerciseRequest(request => request + 1)
    navigate('journal')
  }

  const savePlannedWorkout = (title: string, plannedFor?: string, id?: string) => {
    const cleanTitle = title.trim()
    if (!cleanTitle || cleanTitle.length > 140) return false
    return update(current => {
      const plans = current.plannedWorkouts ?? []
      if (id && plans.some(plan => plan.id === id)) return { ...current, plannedWorkouts: plans.map(plan =>
        plan.id === id ? { ...plan, title: cleanTitle, plannedFor } : plan) }
      return { ...current, plannedWorkouts: [{ id: crypto.randomUUID(), title: cleanTitle,
        createdAt: new Date().toISOString(), plannedFor }, ...plans] }
    })
  }

  const removePlannedWorkout = (id: string) => update(current => ({ ...current,
    plannedWorkouts: (current.plannedWorkouts ?? []).filter(plan => plan.id !== id),
  }))

  const logPlannedWorkout = (plan: PlannedWorkout) => {
    const current = journalDraftRef.current
    const hasExerciseInput = current.workout?.exercises.some(exercise => exercise.name.trim() ||
      exercise.sets.some(set => set.reps > 0 || set.weightKg !== undefined))
    if (current.text.trim() || current.photo || current.location || current.linkedEntryId || hasExerciseInput) return false
    changeJournalDraft({ ...current, text: plan.title,
      workout: current.workout ?? { exercises: [emptyExercise()] }, plannedWorkoutId: plan.id })
    setAddExerciseRequest(request => request + 1)
    navigate('journal')
    return true
  }

  const today = new Date()
  const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const nextWorkout = (data.plannedWorkouts ?? [])
    .filter(plan => !plan.plannedFor || plan.plannedFor >= todayDate)
    .sort((a, b) => (a.plannedFor ?? '9999-12-31').localeCompare(b.plannedFor ?? '9999-12-31') ||
      Date.parse(a.createdAt) - Date.parse(b.createdAt))[0]

  const returnLabel = showHome ? 'Back to Home' : 'Back to Settings'
  const returnFromSection = () => navigate(showHome ? 'main' : 'settings')
  const reflectionReturnLabel = reflectionReturnView === 'main' ? 'Back to Home'
    : reflectionReturnView === 'ask' ? 'Back to Ask LifeOS'
      : reflectionReturnView === 'journal' ? 'Back to Workout Tracker'
        : reflectionReturnView === 'tasks' ? 'Back to Tasks' : 'Back to Settings'

  const openSearchEntry = (id: string) => {
    if (!showJournal) return
    setView('journal')
    setJournalPrompt(false)
    setJournalSearchResult({ id })
  }

  const renderHubReturn = (iconSize: number, className: string) => (
    <a className={className} href="https://lifeos-demo-kappa.vercel.app/">
      <ArrowLeft size={iconSize} aria-hidden="true" />
      <span>{language === 'ru' ? 'Вернуться в Hub' : 'Back to Hub'}</span>
    </a>
  )

  const renderNavigation = (iconSize: number, bottom = false) => <>
    {showHome && <NavButton icon={<House size={iconSize} />} label={t('Home')} selected={view === 'main'} onClick={() => {
      if (view === 'main') setHomeNavigationKey(key => key + 1)
      navigate('main')
    }} />}
    {!bottom && <NavButton icon={<Settings2 size={iconSize} />} label={t('Settings')} selected={view === 'settings'} onClick={() => navigate('settings')} />}
    {visibleShortcuts.filter(({ id }) => inBar(id)).sort((a, b) => bottom ? Number(b.id === 'tasks') - Number(a.id === 'tasks') : 0).map(({ id, label }) => {
      const Icon = shortcutIcons[id]
      return <NavButton key={id} icon={<Icon size={iconSize} />} label={t(label)} selected={view === id}
        onClick={() => {
          if (id !== 'focus') navigate(id)
          else if (data.activeSession) returnToFocus()
          else startFocus()
        }} />
    })}
    {bottom && <NavButton icon={<Settings2 size={iconSize} />} label={t('Settings')} selected={view === 'settings'} onClick={() => navigate('settings')} />}
    {bottom && <NavButton icon={<Dumbbell size={iconSize} />} label={language === 'ru' ? 'Тренировки' : 'Workouts'} selected={view === 'workouts'} onClick={() => navigate('workouts')} />}
    {bottom && renderHubReturn(iconSize, 'nav-button gym-hub-return')}
  </>

  const renderBrand = (size: number) => {
    const logo = <><span className="brand-mark"><Leaf size={size} strokeWidth={2.4} /></span><span>LifeGym<span className="brand-dot">.</span></span></>
    return showHome
      ? <button className="brand" onClick={() => navigate('main')} aria-label="LifeGym home">{logo}</button>
      : <div className="brand">{logo}</div>
  }

  const openTaskHistory = (taskId: string) => setTaskHistoryId(taskId)
  const historyTask = data.tasks.find(task => task.id === taskHistoryId)
  const linkedTaskTitle = journalTaskId === undefined ? undefined
    : data.tasks.find(task => task.id === journalTaskId)?.title ?? 'Deleted task'

  const pausedSession = data.activeSession?.pausedAt ? data.activeSession : null
  const reminderMinutes = data.breakReminderMinutes ?? 0
  const reminderDueAt = pausedSession?.pausedAt && reminderMinutes > 0 && !pausedSession.breakReminderDismissed && !pausedSession.silenceBreakReminders
    ? Date.parse(pausedSession.pausedAt) + reminderMinutes * 60_000
    : null

  const breakReminder = reminderDueAt !== null && <BreakReminder dueAt={reminderDueAt}
    onResume={resumeSession} onDismiss={dismissBreakReminder} />

  const closeOnboarding = () => {
    if (onboardingMode === 'preview') {
      const url = new URL(window.location.href)
      url.searchParams.delete('onboarding')
      window.history.replaceState(window.history.state, '', url)
    }
    setOnboardingMode(null)
  }

  if (onboardingMode) return <ServiceOnboarding mode={onboardingMode} language={language}
    onClose={closeOnboarding} onComplete={() => {
      if (onboardingMode === 'first-run') {
        try { localStorage.setItem(completionKey(storageKey), 'done') }
        catch { return false }
      }
      closeOnboarding()
      return true
    }} />

  if (data.activeSession && ((!pausedSession && minimizedFocusScreen !== data.activeSession.id) ||
    (pausedSession !== null && pausedFocusScreen === pausedSession.id))) return <>
    <MainFocus
      language={language}
      session={data.activeSession}
      showTime={showTime}
      now={now}
      storageError={storageError}
      checkinEnabled={data.focusCheckinEnabled !== false}
      showCheckinToggle={!data.postFocusAction}
      onToggleCheckin={() => update(current => ({ ...current, focusCheckinEnabled: current.focusCheckinEnabled === false }))}
      onToggleTime={toggleFocusTime}
      onToggleSilence={toggleFocusSilence}
      onPause={() => pauseSession(true)}
      onResume={() => resumeSession()}
      onLeave={() => pauseSession(false)}
      onMinimize={minimizeFocus}
      returnDestination={showHome ? 'Home' : shortcuts.find(({ id }) => id === defaultView)?.label ?? 'Settings'}
      onFinish={endSession}
    >
      {breakReminder}
    </MainFocus>
    {undoNotice}
  </>

  if (data.pendingSession && !checkingIn) return <PostFocusChoice
    language={language}
    taskTitle={data.pendingSession.taskTitle}
    storageError={storageError}
    preferred={data.postFocusAction}
    onChoose={choosePostFocusAction}
    onSkip={skipPostFocus}
  />

  if (data.pendingSession) return (<>
    <main className="checkin-screen page-container">
      {storageError && <div className="storage-error" role="alert">{t('Your browser could not save the check-in. Your answers are still here. Check available storage and try again.')}</div>}
      <div className="focus-top"><div className="brand-mark"><Leaf size={18} strokeWidth={2.3} /></div><span>{t('LifeGym / Check-in')}</span></div>
      <div className="checkin-card">
        <div className="section-icon"><Sparkles size={20} /></div>
        <p className="eyebrow">{t('A MOMENT TO REFLECT')}</p>
        <h1>{t('How did it feel?')}</h1>
        <p className="muted">{data.pendingSession.taskId === null
          ? t('Your focus session is complete.')
          : language === 'ru' ? `Сессия «${data.pendingSession.taskTitle}» завершена.` : `Your time with “${data.pendingSession.taskTitle}” is complete.`} {t('A few quick answers help you notice what works.')}</p>
        <button type="button" className="checkin-turn-off" onClick={() => setCheckingIn(false)}>{t('Back to choices')}</button>
        <form onSubmit={saveCheckin}>
          <Rating language={language} label="Interest in the process" value={interest} onChange={setInterest} />
          <Rating language={language} label="Desire to continue" value={continueDesire} onChange={setContinueDesire} />
          <Rating language={language} label="Sense of progress" value={progress} onChange={setProgress} />
          <div className="factor-field"><span className="field-label">{t('What helped?')} <span className="optional">{t('Optional')}</span></span><div className="factor-options">{factors.map(factor => <button type="button" key={factor} className={`factor-chip ${selectedFactors.includes(factor) ? 'selected' : ''}`} onClick={() => setSelectedFactors(current => current.includes(factor) ? current.filter(item => item !== factor) : [...current, factor])}>{t(factor)}</button>)}</div></div>
          <button className="button button-dark checkin-submit" disabled={!interest || !continueDesire || !progress}>{t('Save check-in')} <ArrowRight size={18} /></button>
        </form>
      </div>
    </main>
    {undoNotice}
  </>)

  return (
    <div className={view === 'flow' || view === 'focus-history' ? 'app-shell flow-shell' : 'app-shell'}>
      <aside className="sidebar">
        {renderBrand(20)}
        <nav aria-label="Main navigation">{renderNavigation(19)}</nav>
      </aside>

      <div className="main-area">
        {(storageError || loadResult.error) && <div className="storage-error" role="alert">{loadResult.error ?? 'Your browser could not save changes locally. Your unsaved text is still here. Check available storage, then try again.'} {loadResult.error && <label className="settings-page__action settings-page__upload">
          {t('Restore from a copy')}
          <input type="file" accept="application/json,.json" onChange={importBackup} />
        </label>}</div>}
        {backupMessage && <div className="storage-error" role="status">{backupMessage}</div>}
        {reflectionNotice && <div className="lifeos-reflection-confirmation" role="status">{reflectionNotice}</div>}
        {breakReminder}
        {(view === 'main' || view === 'tasks') && <MainDashboard key={`${view}:${homeNavigationKey}`}
          initialScreen={view === 'tasks' ? 'tasks' : 'home'}
          onReturnHome={view === 'tasks' ? returnFromSection : undefined}
          returnLabel={returnLabel}
          nextWorkout={nextWorkout}
          tasks={data.tasks}
          focusTaskTitle={data.activeSession?.taskTitle}
          focusRunning={Boolean(data.activeSession && !pausedSession)}
          pausedActiveTime={data.activeSession ? elapsedClock(focusedDuration(data.activeSession, now)) : undefined}
          showPausedTime={showTime}
          language={data.language ?? 'en'}
          onPauseFocus={() => pauseSession(false, false)}
          onContinueFocus={() => resumeSession(true)}
          onReturnToFocus={returnToFocus}
          onFinishPaused={endSession}
          onCancelFocus={cancelSession}
          onUpdate={update}
          onOpenTask={openTaskHistory}
          onDeleteTask={deleteTask}
          onStart={startFocus}
          onLogWorkout={openWorkoutDraft}
          onLogPlan={logPlannedWorkout}
          onWorkouts={() => navigate('workouts')}
        />}

        {view === 'workouts' && <WorkoutsPage language={language} plans={data.plannedWorkouts ?? []}
          history={data.journal.filter(entry => entry.workout)} onReturn={returnFromSection} returnLabel={returnLabel}
          onSavePlan={savePlannedWorkout} onRemovePlan={removePlannedWorkout} onLogPlan={logPlannedWorkout}
          onOpenEntry={openSearchEntry}>
          <details className="settings-page__group">
            <summary className="settings-page__row">{language === 'ru' ? 'Синхронизация тренировок' : 'Workout sync'}</summary>
            <div className="settings-page__panel">
              <JournalCloudPanel cloud={{ available: Boolean(journalCloudToken), enabled: cloudEnabled, guest: guestCloud, code: recoveryCode, status: journalCloudStatus,
              error: journalCloudError, lastSavedAt: journalLastSavedAt, pending: data.journalCloud?.pending.length ?? 0,
              onRetry: () => void journalCloud.current?.sync(), onEnable: enableJournalCloud,
              onVerifyRecovery: verifyRecoveryCode, onRecover: recoverJournalCloud }} language={language} />
              {cloudEnabled && !guestCloud && guestNotesAvailable > 0 && <div className="journal-guest-import">
                <span>{language === 'ru' ? `Гостевых тренировок, планов и записей на этом устройстве: ${guestNotesAvailable}` : `Guest workouts, plans and entries on this device: ${guestNotesAvailable}`}</span>
                <button type="button" onClick={importGuestJournal}>{language === 'ru' ? 'Скопировать в этот аккаунт' : 'Copy into this account'}</button>
              </div>}
            </div>
          </details>
        </WorkoutsPage>}

        {view === 'ask' && <main className="life-main life-main-guide-page">
          <h1>Ask LifeOS</h1>
          <AskLifeOS language={language} actions={{
            tasks: () => navigate('tasks'),
            journal: showJournal ? () => navigate('journal') : undefined,
            focus: data.activeSession ? returnToFocus : () => { startFocus() },
            settings: () => navigate('settings'),
          }} />
        </main>}

        {(view === 'flow' || view === 'focus-history') && <FlowEnginePage key={view}
          timeFormat={timeFormat}
          language={language}
          data={data} onUpdate={update}
          onReturn={view === 'flow' ? () => navigate(reflectionReturnView) : returnFromSection}
          returnLabel={view === 'flow' ? reflectionReturnLabel : returnLabel}
          onReflectionSaved={() => {
            setReflectionNotice('Reflection saved.')
            navigate(reflectionReturnView)
          }}
          sessionsOnly={view === 'focus-history'} />}

        {view === 'journal' && (
          <JournalPage language={language} timeFormat={timeFormat} entries={data.journal} folders={data.journalFolders ?? []} draft={journalDraft} onDraftChange={changeJournalDraft}
            focusExerciseRequest={addExerciseRequest}
            draftSaveError={journalDraftError}
            draftStorageKey={storageKey} onDraftStorageError={() => setStorageError(true)}
            cloudStatus={cloudEnabled ? journalCloudStatus : undefined}
            guestImportCount={0}
            onReturn={returnFromSection} returnLabel={returnLabel}
            onSaveFolder={saveJournalFolder} onReorderFolders={reorderJournalFolders} onDeleteFolder={deleteJournalFolder} onMoveEntry={moveJournalEntry}
            linkedTaskTitle={linkedTaskTitle} onUnlinkTask={() => setJournalTaskId(undefined)}
            sessionPrompt={journalPrompt} onDismissPrompt={() => setJournalPrompt(false)}
            searchResult={journalSearchResult} onSelectSearchEntry={openSearchEntry}
            onCreate={createJournalEntry} onEdit={editJournalEntry} onDelete={deleteJournalEntry} />
        )}

        {view === 'settings' && (
          <SettingsPage
            account={accountContent}
            theme={data.theme}
            language={data.language ?? 'en'}
            timeFormat={timeFormat}
            onTimeFormatChange={timeFormat => update(current => ({ ...current, timeFormat }))}
            onLanguageChange={language => update(current => ({ ...current, language }))}
            onThemeChange={theme => update(current => ({ ...current, theme }))}
            displayName={data.displayName ?? ''}
            onDisplayNameChange={displayName => update(current => ({ ...current, displayName: displayName || undefined }))}
          />
        )}
      </div>
      {historyTask && <TaskHistory
        timeFormat={timeFormat}
        language={language}
        key={historyTask.id}
        task={historyTask}
        sessions={data.sessions.filter(session => session.taskId === historyTask.id).sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt))}
        entries={data.journal.filter(entry => entry.taskId === historyTask.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))}
        availableEntries={data.journal.filter(entry => entry.taskId === undefined).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))}
        linksExistingDraft={Boolean((journalDraft.text.trim() || journalDraft.photo) && journalTaskId !== historyTask.id)}
        focusAction={data.activeSession?.pausedAt && data.activeSession.taskId === historyTask.id ? 'resume' : data.activeSession || data.pendingSession ? 'unavailable' : 'start'}
        focusMessage={data.activeSession?.pausedAt && data.activeSession.taskId !== historyTask.id ? 'Finish or resume your current focus before starting this task.' : data.pendingSession ? 'Finish your focus check-in first.' : undefined}
        onClose={() => setTaskHistoryId(null)}
        onFocus={() => {
          if (dataRef.current.activeSession?.pausedAt && dataRef.current.activeSession.taskId === historyTask.id) resumeSession()
          else if (!dataRef.current.activeSession && !dataRef.current.pendingSession) startFocus(historyTask)
          else return
          setTaskHistoryId(null)
        }}
        onLinkNote={id => {
          if (!dataRef.current.journal.some(entry => entry.id === id && entry.taskId === undefined)) return false
          return update(current => ({
            ...current,
            journal: current.journal.map(entry => entry.id === id ? { ...entry, taskId: historyTask.id } : entry),
          }))
        }}
        onWriteReflection={showJournal ? () => {
          setTaskHistoryId(null)
          setJournalTaskId(historyTask.id)
          navigate('journal')
        } : undefined}
      />}
      {renderHubReturn(19, "nav-button gym-hub-return gym-hub-return--desktop")}
      <nav className="mobile-nav" aria-label="Main navigation">{renderNavigation(21, true)}</nav>
      {undoNotice}
    </div>
  )
}

function NavButton({ icon, label, selected, onClick }: { icon: React.ReactNode; label: string; selected: boolean; onClick: () => void }) {
  const button = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    const nav = button.current?.closest('.mobile-nav')
    if (selected && nav && nav.scrollWidth > nav.clientWidth) {
      const center = button.current!.offsetLeft + button.current!.offsetWidth / 2 - nav.clientWidth / 2
      nav.scrollTo({ left: center, behavior: 'smooth' })
    }
  })

  return <button ref={button} className={`nav-button ${selected ? 'selected' : ''}`} onClick={onClick}
    aria-current={selected ? 'page' : undefined}>{icon}<span>{label}</span></button>
}
function Rating({ label, value, onChange, language }: { label: string; value: number; onChange: (value: number) => void; language: AppLanguage }) {
  const t = (text: string) => translate(language, text)
  return <fieldset className="rating-field"><legend>{t(label)}</legend><div className="rating-buttons">{[1, 2, 3, 4, 5].map(number => <button type="button" className={value === number ? 'selected' : ''} key={number} onClick={() => onChange(number)} aria-label={language === 'ru' ? `${t(label)}: ${number} из 5` : `${label}: ${number} out of 5`} aria-pressed={value === number}>{number}</button>)}</div><div className="rating-ends"><span>{t('Not much')}</span><span>{t('Very much')}</span></div></fieldset>
}

export default App
