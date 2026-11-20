import { useState, type ReactNode } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { maxDisplayNameLength, type Theme } from '../data'
import { translate, type AppLanguage } from '../language'
import './settings.css'

interface SettingsPageProps {
  account?: ReactNode
  theme: Theme
  language: 'en' | 'ru'
  timeFormat: '12' | '24'
  onTimeFormatChange: (format: '12' | '24') => void
  onLanguageChange: (language: 'en' | 'ru') => void
  onThemeChange: (theme: Theme) => void
  displayName: string
  onDisplayNameChange: (name: string) => boolean
}

const themes = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
] as const

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

export default function SettingsPage({
  account, theme, onThemeChange, language, onLanguageChange,
  timeFormat, onTimeFormatChange, displayName, onDisplayNameChange,
}: SettingsPageProps) {
  const t = (text: string) => translate(language, text)
  return (
    <main className="settings-page" aria-labelledby="settings-page-title">
      <div className="settings-page__header">
        <h1 id="settings-page-title">{t('Settings')}</h1>
      </div>
      <div className="settings-page__group">
        <div className="settings-page__panel">
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
            <legend>{language === 'ru' ? 'Формат времени' : 'Time format'}</legend>
            <div className="settings-page__theme-options">
              {(['12', '24'] as const).map(value => <label className="settings-page__theme" key={value}>
                <input type="radio" name="lifeos-time-format" checked={timeFormat === value} onChange={() => onTimeFormatChange(value)} />
                <span>{value === '12' ? (language === 'ru' ? '12 часов' : '12-hour') : (language === 'ru' ? '24 часа' : '24-hour')}</span>
              </label>)}
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
          <div><DisplayNameForm key={displayName} name={displayName} onSave={onDisplayNameChange} language={language} /></div>
          {account}
        </div>
      </div>
    </main>
  )
}
