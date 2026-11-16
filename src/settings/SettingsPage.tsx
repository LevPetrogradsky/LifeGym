import { useState, type ChangeEvent, type ReactNode } from 'react'
import { ChevronRight, Compass, Copy, Download, ExternalLink, Github, HardDrive, Info, Monitor, Moon, Palette, Sun, Timer, Upload, UserRound } from 'lucide-react'
import { breakReminderMinutes, maxDisplayNameLength, shortcuts, type BreakReminderMinutes, type PostFocusAction, type Shortcut, type ShortcutLocation, type Theme } from '../data'
import './settings.css'

interface SettingsPageProps {
  account?: ReactNode
  theme: Theme
  onThemeChange: (theme: Theme) => void
  showHome: boolean
  onHomeVisibilityChange: (visible: boolean) => void
  showAskLifeOS: boolean
  onAskLifeOSVisibilityChange: (visible: boolean) => void
  shortcutVisible: (id: Shortcut, location: ShortcutLocation) => boolean
  onShortcutChange: (id: Shortcut, location: ShortcutLocation, visible: boolean) => void
  onExport: () => void
  onImport: (event: ChangeEvent<HTMLInputElement>) => void
  repoUrl: string
  reminderMinutes: BreakReminderMinutes
  onReminderMinutesChange: (minutes: BreakReminderMinutes) => void
  displayName: string
  onDisplayNameChange: (name: string) => boolean
  focusCheckin?: { enabled: boolean; onChange: (enabled: boolean) => void }
  postFocusAction?: { value?: PostFocusAction; onChange: (action: PostFocusAction) => void }
  onOpenPresets?: () => void
}

const themes = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
] as const

function SettingsGroup({ title, icon, summary, defaultOpen, children }: {
  title: string
  icon: ReactNode
  summary?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [expanded, setExpanded] = useState(defaultOpen ?? false)
  return (
    <details className="settings-page__group" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
      <summary className="settings-page__row">
        <span className="settings-page__icon" aria-hidden="true">{icon}</span>
        <span className="settings-page__label">{title}</span>
        {summary && <span className="settings-page__value">{summary}</span>}
        <ChevronRight className="settings-page__chevron" size={18} aria-hidden="true" />
      </summary>
      <div className="settings-page__panel">{children}</div>
    </details>
  )
}

function DisplayNameForm({ name, onSave }: { name: string; onSave: (name: string) => boolean }) {
  const [draft, setDraft] = useState(name)
  return (
    <form className="settings-page__name-form" onSubmit={event => {
      event.preventDefault()
      const value = draft.trim()
      if (onSave(value)) setDraft(value)
    }}>
      <label className="settings-page__field">
        <strong>Display name</strong>
        <input type="text" value={draft} maxLength={maxDisplayNameLength} autoComplete="nickname"
          placeholder="Optional" onChange={event => setDraft(event.currentTarget.value)} />
      </label>
      <button type="submit" className="settings-page__action" disabled={draft.trim() === name}>Save name</button>
    </form>
  )
}

const demoUrl = 'https://lifeos-demo-kappa.vercel.app/'

function AboutLifeOS({ repoUrl }: { repoUrl: string }) {
  const [message, setMessage] = useState('')

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(demoUrl)
      setMessage('Demo link copied.')
    } catch {
      setMessage('Select the demo link to copy it.')
    }
  }

  return (
    <>
      <label className="settings-page__field">
        <strong>Demo link</strong>
        <input type="url" readOnly value={demoUrl} onFocus={event => event.currentTarget.select()} />
      </label>
      <div className="settings-page__actions">
        <button type="button" className="settings-page__action" onClick={copyLink}>
          <Copy size={17} aria-hidden="true" /> Copy demo link
        </button>
        <a className="settings-page__action" href={repoUrl} target="_blank" rel="noreferrer">
          <Github size={17} aria-hidden="true" /> View on GitHub
          <ExternalLink className="settings-page__external" size={15} aria-hidden="true" />
        </a>
      </div>
      {message && <p role="status" className="settings-page__description">{message}</p>}
    </>
  )
}

export default function SettingsPage({
  account,
  theme, onThemeChange, showHome, onHomeVisibilityChange, showAskLifeOS, onAskLifeOSVisibilityChange, shortcutVisible, onShortcutChange, onExport, onImport, repoUrl, focusCheckin, postFocusAction, onOpenPresets,
  reminderMinutes, onReminderMinutesChange, displayName, onDisplayNameChange,
}: SettingsPageProps) {
  return (
    <main className="settings-page" aria-labelledby="settings-page-title">
      <h1 id="settings-page-title">Settings</h1>

      <div className="settings-page__groups">
        {account && <SettingsGroup title="Account" icon={<UserRound size={18} />} defaultOpen>{account}</SettingsGroup>}
        <SettingsGroup title="Profile & appearance" icon={<Palette size={18} />} defaultOpen
          summary={themes.find(option => option.value === theme)?.label}>
          <fieldset className="settings-page__themes">
            <legend>Theme</legend>
            <div className="settings-page__theme-options">
              {themes.map(({ value, label, Icon }) => (
                <label className="settings-page__theme" key={value}>
                  <input type="radio" name="lifeos-theme" checked={theme === value}
                    onChange={() => onThemeChange(value)} />
                  <span><Icon size={17} aria-hidden="true" />{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <DisplayNameForm key={displayName} name={displayName} onSave={onDisplayNameChange} />
        </SettingsGroup>

        <SettingsGroup title="Focus" icon={<Timer size={18} />} defaultOpen>
          {onOpenPresets && <button type="button" className="settings-page__action" onClick={onOpenPresets}>
            Presets <ChevronRight size={17} aria-hidden="true" />
          </button>}
          {postFocusAction && <fieldset className="settings-page__post-focus">
            <legend>After focus</legend>
            {([
              { value: 'reflection', title: 'Reflection', description: 'Think about what helped.' },
              { value: 'check-in', title: 'Quick rating', description: 'Rate how the session went.' },
            ] as const).map(option => <label key={option.value} className="settings-page__post-focus-option">
              <input type="radio" name="lifeos-post-focus" value={option.value}
                checked={postFocusAction.value === option.value}
                onChange={() => postFocusAction.onChange(option.value)} />
              <span><strong>{option.title}</strong><small>{option.description}</small></span>
            </label>)}
          </fieldset>}
          {focusCheckin && !postFocusAction?.value && <details className="settings-page__submore">
            <summary>More focus options</summary>
            <label className="settings-page__toggle">
              <span className="settings-page__toggle-copy"><strong>Offer a quick rating</strong></span>
              <input type="checkbox" role="switch" aria-label="Offer a quick rating" checked={focusCheckin.enabled}
                onChange={event => focusCheckin.onChange(event.currentTarget.checked)} />
            </label>
          </details>}
          <label className="settings-page__field">
            <strong>Break reminder</strong>
            <select value={reminderMinutes} onChange={event => {
              const selected = breakReminderMinutes.find(minutes => String(minutes) === event.currentTarget.value)
              if (selected !== undefined) onReminderMinutesChange(selected)
            }}>
              {breakReminderMinutes.map(minutes => (
                <option key={minutes} value={minutes}>{minutes ? `${minutes} min` : 'Off'}</option>
              ))}
            </select>
          </label>
        </SettingsGroup>

        <SettingsGroup title="Backups" icon={<HardDrive size={18} />} defaultOpen>
          <p className="settings-page__description">Your data stays in this browser. Save a copy to move it to another device.</p>
          <div className="settings-page__actions">
            <button type="button" className="settings-page__action" onClick={onExport}>
              <Download size={17} aria-hidden="true" />Save a copy
            </button>
            <label className="settings-page__action settings-page__upload">
              <Upload size={17} aria-hidden="true" />Restore from a copy
              <input type="file" accept="application/json,.json" onChange={onImport} />
            </label>
          </div>
        </SettingsGroup>

        <details className="settings-page__more">
          <summary>More options <ChevronRight size={18} aria-hidden="true" /></summary>
          <div className="settings-page__more-content">
        <SettingsGroup title="Home & navigation" icon={<Compass size={18} />}>
          <label className="settings-page__toggle settings-page__navigation-toggle">
            <span className="settings-page__toggle-copy"><strong>Home in bottom bar</strong></span>
            <input type="checkbox" role="switch" aria-label="Home in navigation bar" checked={showHome}
              onChange={event => onHomeVisibilityChange(event.currentTarget.checked)} />
          </label>
          <label className="settings-page__toggle settings-page__navigation-toggle">
            <span className="settings-page__toggle-copy"><strong>Ask LifeOS in bottom bar</strong></span>
            <input type="checkbox" role="switch" aria-label="Ask LifeOS in navigation bar" checked={showAskLifeOS}
              onChange={event => onAskLifeOSVisibilityChange(event.currentTarget.checked)} />
          </label>
          {!showHome && <p className="settings-page__description">Home shortcuts appear when Home is visible.</p>}
          {shortcuts.map(({ id, label }) => <fieldset key={id} className="settings-page__shortcut">
            <legend>{label}</legend>
            {([['home', 'On Home'], ['bar', 'In navigation bar']] as const).map(([location, text]) => <label
              className="settings-page__toggle settings-page__shortcut-option" key={location}>
              <span>{text}</span>
              <input type="checkbox" role="switch" aria-label={`${label} ${text.toLowerCase()}`}
                checked={shortcutVisible(id, location)} onChange={event => onShortcutChange(id, location, event.currentTarget.checked)} />
            </label>)}
          </fieldset>)}
        </SettingsGroup>

        <SettingsGroup title="About" icon={<Info size={18} />} summary="v0.1">
          <AboutLifeOS repoUrl={repoUrl} />
        </SettingsGroup>
          </div>
        </details>
      </div>
    </main>
  )
}
