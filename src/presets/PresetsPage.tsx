import { useEffect, useState } from 'react'
import { ArrowLeft, BellOff, BookOpen, BriefcaseBusiness, Check, Leaf, Lightbulb, Timer } from 'lucide-react'
import { findFocusPreset, focusPresets, type FocusPresetId } from './focusPresets'
import './presets.css'

interface FocusPresetsProps {
  appliedPresetId?: FocusPresetId
  sessionState: 'idle' | 'active' | 'pending'
  onApply: (id: FocusPresetId) => boolean
  onBack: () => void
}

const icons = {
  work: BriefcaseBusiness,
  creativity: Lightbulb,
  grounding: Leaf,
  'bible-reading': BookOpen,
} as const

export default function FocusPresets({ appliedPresetId, sessionState, onApply, onBack }: FocusPresetsProps) {
  const [selectedId, setSelectedId] = useState<FocusPresetId>(appliedPresetId ?? 'work')
  const [message, setMessage] = useState('')
  const selected = findFocusPreset(selectedId)!

  useEffect(() => {
    if (appliedPresetId) setSelectedId(appliedPresetId)
  }, [appliedPresetId])

  const apply = () => {
    const saved = onApply(selectedId)
    setMessage(saved ? `${selected.label} applied.` : 'Could not save preset. Please try again.')
  }

  const actionLabel = sessionState === 'idle' ? 'Apply and start focus'
    : sessionState === 'active' ? 'Apply to current focus'
      : 'Save for next focus'

  return <main className="life-presets-page">
    <div className="life-presets-content">
      <header className="life-presets-header">
        <button type="button" className="life-presets-back" aria-label="Back" onClick={onBack}>
          <ArrowLeft size={22} aria-hidden="true" />
        </button>
        <div>
          <p className="life-presets-eyebrow">FOCUS MODE</p>
          <h1>Presets</h1>
        </div>
      </header>

      <p className="life-presets-intro">Choose a setup for your focus time.</p>

      <section aria-labelledby="life-presets-list-title">
        <h2 id="life-presets-list-title" className="life-presets-section-title">Choose a preset</h2>
        <div className="life-presets-grid" role="group" aria-label="Focus presets">
          {focusPresets.map(preset => {
            const Icon = icons[preset.id]
            const isSelected = selectedId === preset.id
            const isApplied = appliedPresetId === preset.id
            return <button key={preset.id} type="button" className="life-presets-card"
              aria-pressed={isSelected} onClick={() => { setSelectedId(preset.id); setMessage('') }}>
              <span className="life-presets-card-top">
                <span className="life-presets-icon"><Icon size={20} aria-hidden="true" /></span>
                {isApplied && <span className="life-presets-applied"><Check size={13} aria-hidden="true" /> Applied</span>}
              </span>
              <strong>{preset.label}</strong>
              <span className="life-presets-card-description">{preset.description}</span>
            </button>
          })}
        </div>
      </section>

      <section className="life-presets-summary" aria-live="polite" aria-label="Selected preset settings">
        <h2>{selected.label}</h2>
        <div className="life-presets-summary-detail">
          <Timer size={17} aria-hidden="true" />
          <span>{selected.reminderMinutes ? `Break reminder after ${selected.reminderMinutes} minutes` : 'Break reminders off'}</span>
        </div>
        <div className="life-presets-summary-detail">
          <BellOff size={17} aria-hidden="true" />
          <span>{selected.silenceBreakReminders ? 'LifeOS reminders silenced' : 'LifeOS reminders on'}</span>
        </div>
      </section>

      <button type="button" className="life-presets-apply" onClick={apply}>{actionLabel}</button>
      {message && <p className="life-presets-message" role="status">{message}</p>}
    </div>
  </main>
}
