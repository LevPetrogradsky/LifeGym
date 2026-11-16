import type { BreakReminderMinutes, LifeOSData } from '../data'

export type FocusPresetId = 'work' | 'creativity' | 'grounding' | 'bible-reading'

export interface FocusPreset {
  id: FocusPresetId
  label: string
  description: string
  reminderMinutes: BreakReminderMinutes
  silenceBreakReminders: boolean
}

export const focusPresets: readonly FocusPreset[] = [
  {
    id: 'work',
    label: 'Работа',
    description: 'Сосредоточьтесь на одной задаче.',
    reminderMinutes: 20,
    silenceBreakReminders: false,
  },
  {
    id: 'creativity',
    label: 'Творчество',
    description: 'Оставьте больше пространства для идей.',
    reminderMinutes: 0,
    silenceBreakReminders: true,
  },
  {
    id: 'grounding',
    label: 'Заземление',
    description: 'Короткая пауза и внимание к себе.',
    reminderMinutes: 5,
    silenceBreakReminders: false,
  },
  {
    id: 'bible-reading',
    label: 'Чтение Библии',
    description: 'Спокойное время для внимательного чтения.',
    reminderMinutes: 15,
    silenceBreakReminders: false,
  },
]

export function findFocusPreset(id: FocusPresetId | undefined): FocusPreset | undefined {
  return focusPresets.find(preset => preset.id === id)
}

export function applyFocusPreset(data: LifeOSData, id: FocusPresetId): LifeOSData & { focusPresetId: FocusPresetId } {
  const preset = findFocusPreset(id)
  if (!preset) throw new Error('Unknown focus preset')

  return {
    ...data,
    focusPresetId: id,
    breakReminderMinutes: preset.reminderMinutes,
    activeSession: data.activeSession
      ? { ...data.activeSession, silenceBreakReminders: preset.silenceBreakReminders }
      : null,
  }
}
