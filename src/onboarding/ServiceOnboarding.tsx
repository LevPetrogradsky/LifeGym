import { useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import type { AppLanguage } from '../language'
import type { OnboardingMode } from './state'
import './onboarding.css'

export default function ServiceOnboarding({ mode, language, onComplete, onClose, hubReturn }: {
  mode: Exclude<OnboardingMode, null>
  language: AppLanguage
  onComplete: () => boolean
  onClose: () => void
  hubReturn: ReactNode
}) {
  const [error, setError] = useState(false)
  const ru = language === 'ru'

  return <div className="lifeos-onboarding" role="dialog" aria-modal="true" aria-labelledby="gym-onboarding-title" style={{ height: '100dvh' }}>
    <div className="lifeos-onboarding__header"><span />{mode === 'preview' && <button type="button" className="lifeos-onboarding__close" aria-label={ru ? 'Закрыть предпросмотр' : 'Close preview'} onClick={onClose}><X size={20} /></button>}</div>
    <main className="lifeos-onboarding__content">
      <p className="lifeos-onboarding__eyebrow">LifeGym</p>
      <h1 id="gym-onboarding-title">{ru ? 'Место для ваших тренировок' : 'A place for your workouts'}</h1>
      <p className="lifeos-onboarding__description">{ru ? 'Планируйте тренировки, записывайте упражнения и возвращайтесь к истории занятий.' : 'Plan your workouts, log exercises, and revisit your training history.'}</p>
    </main>
    <div className="lifeos-onboarding__footer">
      {error && <p role="alert" className="lifeos-onboarding__error">{ru ? 'Не удалось сохранить выбор. Попробуйте ещё раз.' : 'Could not save your choice. Try again.'}</p>}
      <button type="button" className="lifeos-onboarding__primary" onClick={() => setError(!onComplete())}>{ru ? 'Открыть LifeGym' : 'Open LifeGym'}</button>
      <p className="service-onboarding__note">{ru ? 'Для гостей это вступление пропускается только на этом сайте.' : 'For guests, this intro is skipped only on this site.'}</p>
      {hubReturn}
    </div>
  </div>
}
