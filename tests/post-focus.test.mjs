import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyData, loadData, parseBackup, validateLifeOSData } from '../src/data.ts'

test('older LifeOS backups remain valid without post-focus or preset choices', () => {
  const legacy = emptyData()
  assert.equal(validateLifeOSData(legacy), true)
  assert.equal(parseBackup(JSON.stringify(legacy)).postFocusAction, undefined)
})

test('explicit post-focus and preset choices survive a backup round trip', () => {
  const data = { ...emptyData(), postFocusAction: 'reflection', focusPresetId: 'bible-reading' }
  assert.equal(validateLifeOSData(data), true)
  assert.deepEqual(parseBackup(JSON.stringify(data)), data)
  assert.equal(validateLifeOSData({ ...data, postFocusAction: 'unexpected' }), false)
  assert.equal(validateLifeOSData({ ...data, focusPresetId: 'unexpected' }), false)
})

test('a first pending session survives reload when legacy check-ins are off', () => {
  const pendingSession = {
    id: 'first', taskId: null, taskTitle: 'Open focus',
    startedAt: '2026-11-13T10:00:00.000Z',
    endedAt: '2026-11-13T10:01:00.000Z',
  }
  const data = { ...emptyData(), focusCheckinEnabled: false, pendingSession }
  const previousStorage = globalThis.localStorage
  globalThis.localStorage = { getItem: () => JSON.stringify(data) }
  try {
    const loaded = loadData().data
    assert.equal(loaded.pendingSession?.id, 'first')
    assert.equal(loaded.sessions.length, 0)
  } finally {
    globalThis.localStorage = previousStorage
  }
})

test('an established legacy user still auto-saves an unrated pending session', () => {
  const previous = {
    id: 'previous', taskId: null, taskTitle: 'Open focus',
    startedAt: '2026-11-13T09:00:00.000Z',
    endedAt: '2026-11-13T09:01:00.000Z',
    durationMs: 60_000,
    interest: null, continueDesire: null, progress: null, factors: [],
  }
  const pendingSession = {
    id: 'next', taskId: null, taskTitle: 'Open focus',
    startedAt: '2026-11-13T10:00:00.000Z',
    endedAt: '2026-11-13T10:01:00.000Z',
  }
  const data = { ...emptyData(), sessions: [previous], focusCheckinEnabled: false, pendingSession }
  const previousStorage = globalThis.localStorage
  globalThis.localStorage = { getItem: () => JSON.stringify(data) }
  try {
    const loaded = loadData().data
    assert.equal(loaded.pendingSession, null)
    assert.equal(loaded.sessions[0].id, 'next')
    assert.equal(loaded.sessions.length, 2)
  } finally {
    globalThis.localStorage = previousStorage
  }
})

test('an explicit check-in choice keeps its pending session after reload', () => {
  const pendingSession = {
    id: 'next', taskId: null, taskTitle: 'Open focus',
    startedAt: '2026-11-13T10:00:00.000Z',
    endedAt: '2026-11-13T10:01:00.000Z',
  }
  const data = { ...emptyData(), postFocusAction: 'check-in', focusCheckinEnabled: false, pendingSession }
  const previousStorage = globalThis.localStorage
  globalThis.localStorage = { getItem: () => JSON.stringify(data) }
  try {
    const loaded = loadData().data
    assert.equal(loaded.pendingSession?.id, 'next')
    assert.equal(loaded.sessions.length, 0)
  } finally {
    globalThis.localStorage = previousStorage
  }
})
