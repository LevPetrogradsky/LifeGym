import { useState, type ChangeEvent, type ReactNode } from 'react'
import { ChevronRight, Compass, Copy, Download, ExternalLink, Github, HardDrive, Info, Monitor, Moon, Palette, Sun, Timer, Upload, UserRound } from 'lucide-react'
import { breakReminderMinutes, maxDisplayNameLength, visibleShortcuts, type BreakReminderMinutes, type PostFocusAction, type Shortcut, type ShortcutLocation, type Theme } from '../data'
import { translate, type AppLanguage } from '../language'
import InteractiveTip from '../InteractiveTip'
import './settings.css'

interface SettingsPageProps {
  account?: ReactNode
  theme: Theme
  language: 'en' | 'ru'
  onLanguageChange: (language: 'en' | 'ru') => void
  onThemeChange: (theme: Theme) => void
  interactiveTips: boolean
  onInteractiveTipsChange: (enabled: boolean) => void
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

type SettingsSection = 'account' | 'profile' | 'focus' | 'focusOptions' | 'backups' | 'more' | 'navigation' | 'about' | 'advanced'

function SettingsGroup({ title, icon, summary, open, onOpenChange, children }: {
  title: string
  icon: ReactNode
  summary?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) {
  return (
    <details className="settings-page__group" open={open}>
      <summary className="settings-page__row" onClick={event => { event.preventDefault(); onOpenChange(!open) }}>
        <span className="settings-page__icon" aria-hidden="true">{icon}</span>
        <span className="settings-page__label">{title}</span>
        {summary && <span className="settings-page__value">{summary}</span>}
        <ChevronRight className="settings-page__chevron" size={18} aria-hidden="true" />
      </summary>
      <div className="settings-page__panel">{children}</div>
    </details>
  )
}

function DisplayNameForm({ name, onSave, language }: { name: string; onSave: (name: string) => boolean; language: AppLanguage }) {
  const [draft, setDraft] = useState(name)
  const t = (text: string) => translate(language, text)
  return (
    <form className="settings-page__name-form" onSubmit={event => {
      event.preventDefault()
      const value = draft.trim()
      if (onSave(value)) setDraft(value)
    }}>
      <label className="settings-page__field">
        <strong>{t('Display name')}</strong>
        <input type="text" value={draft} maxLength={maxDisplayNameLength} autoComplete="nickname"
          placeholder={t('Optional')} onChange={event => setDraft(event.currentTarget.value)} />
      </label>
      <button type="submit" className="settings-page__action" disabled={draft.trim() === name}>{t('Save name')}</button>
    </form>
  )
}

const demoUrl = 'https://lifeos-demo-kappa.vercel.app/'

function AboutLifeOS({ repoUrl, language }: { repoUrl: string; language: AppLanguage }) {
  const [message, setMessage] = useState('')
  const t = (text: string) => translate(language, text)

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
        <strong>{t('Demo link')}</strong>
        <input type="url" readOnly value={demoUrl} onFocus={event => event.currentTarget.select()} />
      </label>
      <div className="settings-page__actions">
        <button type="button" className="settings-page__action" onClick={copyLink}>
          <Copy size={17} aria-hidden="true" /> {t('Copy demo link')}
        </button>
        <a className="settings-page__action" href={repoUrl} target="_blank" rel="noreferrer">
          <Github size={17} aria-hidden="true" /> {t('View on GitHub')}
          <ExternalLink className="settings-page__external" size={15} aria-hidden="true" />
        </a>
      </div>
      {message && <p role="status" className="settings-page__description">{t(message)}</p>}
    </>
  )
}

export default function SettingsPage({
  account,
  theme, onThemeChange, language, onLanguageChange, interactiveTips, onInteractiveTipsChange, showHome, onHomeVisibilityChange, showAskLifeOS, onAskLifeOSVisibilityChange, shortcutVisible, onShortcutChange, onExport, onImport, repoUrl, focusCheckin, postFocusAction, onOpenPresets,
  reminderMinutes, onReminderMinutesChange, displayName, onDisplayNameChange,
}: SettingsPageProps) {
  const t = (text: string) => translate(language, text)
  const [openSections, setOpenSections] = useState<Record<SettingsSection, boolean>>({
    account: true, profile: true, focus: true, focusOptions: false,
    backups: false, more: false, navigation: false, about: false, advanced: false,
  })
  const sectionIds: SettingsSection[] = [
    ...(account ? ['account' as const] : []), 'profile', 'focus',
    ...(focusCheckin && !postFocusAction?.value ? ['focusOptions' as const] : []),
    'more', 'backups', 'navigation', 'about', 'advanced',
  ]
  const anyOpen = sectionIds.some(id => openSections[id])
  const setSection = (id: SettingsSection, open: boolean) =>
    setOpenSections(current => current[id] === open ? current : { ...current, [id]: open })
  const toggleAll = () => setOpenSections(current => ({ ...current,
    ...Object.fromEntries(sectionIds.map(id => [id, !anyOpen])),
  }))
  return (
    <main className="settings-page" aria-labelledby="settings-page-title">
      <div className="settings-page__header">
        <h1 id="settings-page-title">{t('Settings')}</h1>
        <div className="settings-page__toggle-all-wrap">
          <button type="button" className="settings-page__toggle-all" onClick={toggleAll}>
            {t(anyOpen ? 'Collapse All' : 'Expand All')}
          </button>
          {interactiveTips && <InteractiveTip className="settings-page__toggle-tip"
            label={t(anyOpen ? 'Collapse all sections' : 'Expand all sections')} />}
        </div>
      </div>

      <div className="settings-page__groups">
        {account && <SettingsGroup title={t('Account')} icon={<UserRound size={18} />} open={openSections.account} onOpenChange={open => setSection('account', open)}>{account}</SettingsGroup>}
        <SettingsGroup title={t('Profile & appearance')} icon={<Palette size={18} />} open={openSections.profile} onOpenChange={open => setSection('profile', open)}
          summary={t(themes.find(option => option.value === theme)?.label ?? '')}>
          <fieldset className="settings-page__themes">
            <legend>{t('Theme')}</legend>
            <div className="settings-page__theme-options">
              {themes.map(({ value, label, Icon }) => (
                <label className="settings-page__theme" key={value}>
                  <input type="radio" name="lifeos-theme" checked={theme === value}
                    onChange={() => onThemeChange(value)} />
                  <span><Icon size={17} aria-hidden="true" />{t(label)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="settings-page__themes">
            <legend>{t('Language / Язык')}</legend>
            <div className="settings-page__theme-options">
              {(['en', 'ru'] as const).map(value => <label className="settings-page__theme" key={value}>
                <input type="radio" name="lifeos-language" checked={language === value} onChange={() => onLanguageChange(value)} />
                <span>{value === 'en' ? 'English' : 'Русский'}</span>
              </label>)}
            </div>
          </fieldset>
          <DisplayNameForm key={displayName} name={displayName} onSave={onDisplayNameChange} language={language} />
        </SettingsGroup>

        <SettingsGroup title={t('Focus')} icon={<Timer size={18} />} open={openSections.focus} onOpenChange={open => setSection('focus', open)}>
          <label className="settings-page__toggle">
            <span className="settings-page__toggle-copy"><strong>{t('Interactive tips')}</strong><span>{t('Show hints for focus actions on Home and Tasks.')}</span></span>
            <input type="checkbox" role="switch" aria-label={t('Interactive tips')} checked={interactiveTips}
              onChange={event => onInteractiveTipsChange(event.currentTarget.checked)} />
          </label>
          {onOpenPresets && <button type="button" className="settings-page__action" onClick={onOpenPresets}>
            {t('Presets')} <ChevronRight size={17} aria-hidden="true" />
          </button>}
          {postFocusAction && <fieldset className="settings-page__post-focus">
            <legend>{t('After focus')}</legend>
            {([
              { value: 'reflection', title: 'Reflection', description: 'Think about what helped.' },
              { value: 'check-in', title: 'Quick rating', description: 'Rate how the session went.' },
            ] as const).map(option => <label key={option.value} className="settings-page__post-focus-option">
              <input type="radio" name="lifeos-post-focus" value={option.value}
                checked={postFocusAction.value === option.value}
                onChange={() => postFocusAction.onChange(option.value)} />
              <span><strong>{t(option.title)}</strong><small>{t(option.description)}</small></span>
            </label>)}
          </fieldset>}
          {focusCheckin && !postFocusAction?.value && <details className="settings-page__submore" open={openSections.focusOptions}>
            <summary onClick={event => { event.preventDefault(); setSection('focusOptions', !openSections.focusOptions) }}>{t('More focus options')}</summary>
            <label className="settings-page__toggle">
              <span className="settings-page__toggle-copy"><strong>{t('Offer a quick rating')}</strong></span>
              <input type="checkbox" role="switch" aria-label={t('Offer a quick rating')} checked={focusCheckin.enabled}
                onChange={event => focusCheckin.onChange(event.currentTarget.checked)} />
            </label>
          </details>}
          <label className="settings-page__field">
            <strong>{t('Break reminder')}</strong>
            <select value={reminderMinutes} onChange={event => {
              const selected = breakReminderMinutes.find(minutes => String(minutes) === event.currentTarget.value)
              if (selected !== undefined) onReminderMinutesChange(selected)
            }}>
              {breakReminderMinutes.map(minutes => (
                <option key={minutes} value={minutes}>{minutes ? `${minutes} ${language === 'ru' ? 'мин' : 'min'}` : t('Off')}</option>
              ))}
            </select>
          </label>
        </SettingsGroup>

        <details className="settings-page__more" open={openSections.more}>
          <summary onClick={event => { event.preventDefault(); setSection('more', !openSections.more) }}>{t('More options')} <ChevronRight size={18} aria-hidden="true" /></summary>
          <div className="settings-page__more-content">
        <SettingsGroup title={t('Backups')} icon={<HardDrive size={18} />} open={openSections.backups} onOpenChange={open => setSection('backups', open)}>
          <div className="settings-page__actions">
            <button type="button" className="settings-page__action" onClick={onExport}>
              <Download size={17} aria-hidden="true" />{t('Save a copy')}
            </button>
            <label className="settings-page__action settings-page__upload">
              <Upload size={17} aria-hidden="true" />{t('Restore from a copy')}
              <input type="file" accept="application/json,.json" onChange={onImport} />
            </label>
          </div>
        </SettingsGroup>
        <SettingsGroup title={t('Home & navigation')} icon={<Compass size={18} />} open={openSections.navigation} onOpenChange={open => setSection('navigation', open)}>
          <label className="settings-page__toggle settings-page__navigation-toggle">
            <span className="settings-page__toggle-copy"><strong>{t('Home in bottom bar')}</strong></span>
            <input type="checkbox" role="switch" aria-label={t('Home in navigation bar')} checked={showHome}
              onChange={event => onHomeVisibilityChange(event.currentTarget.checked)} />
          </label>
          <label className="settings-page__toggle settings-page__navigation-toggle">
            <span className="settings-page__toggle-copy"><strong>{t('Ask LifeOS in bottom bar')}</strong></span>
            <input type="checkbox" role="switch" aria-label={t('Ask LifeOS in navigation bar')} checked={showAskLifeOS}
              onChange={event => onAskLifeOSVisibilityChange(event.currentTarget.checked)} />
          </label>
          {!showHome && <p className="settings-page__description">{t('Home shortcuts appear when Home is visible.')}</p>}
          {visibleShortcuts.map(({ id, label }) => <fieldset key={id} className="settings-page__shortcut">
            <legend>{t(label)}</legend>
            {([['home', 'On Home'], ['bar', 'In navigation bar']] as const).map(([location, text]) => <label
              className="settings-page__toggle settings-page__shortcut-option" key={location}>
              <span>{t(text)}</span>
              <input type="checkbox" role="switch" aria-label={`${t(label)} ${t(text).toLowerCase()}`}
                checked={shortcutVisible(id, location)} onChange={event => onShortcutChange(id, location, event.currentTarget.checked)} />
            </label>)}
          </fieldset>)}
        </SettingsGroup>

        <SettingsGroup title={t('About')} icon={<Info size={18} />} summary="v0.1" open={openSections.about} onOpenChange={open => setSection('about', open)}>
          <AboutLifeOS repoUrl={repoUrl} language={language} />
        </SettingsGroup>
          </div>
        </details>
        <SettingsGroup title={t('Advanced Options')} icon={<Github size={18} />} open={openSections.advanced} onOpenChange={open => setSection('advanced', open)}>
          <a className="settings-page__action" href="https://github.com/ProgrammerLevpetrogradsky/LifeOS-Public/fork"
            target="_blank" rel="noopener noreferrer">
            <Github size={17} aria-hidden="true" />{t('Fork on GitHub')}
            <ExternalLink className="settings-page__external" size={16} aria-hidden="true" />
          </a>
        </SettingsGroup>
      </div>
    </main>
  )
}
