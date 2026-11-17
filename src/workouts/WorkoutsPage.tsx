import { useState, type FormEvent } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import type { JournalEntry, PlannedWorkout } from '../data'
import { translate, type AppLanguage } from '../language'
import './workouts.css'

interface Props {
  language: AppLanguage
  plans: PlannedWorkout[]
  history: JournalEntry[]
  onReturn: () => void
  returnLabel: string
  onSavePlan: (title: string, plannedFor?: string, id?: string) => boolean
  onRemovePlan: (id: string) => boolean
  onLogPlan: (plan: PlannedWorkout) => boolean
  onOpenEntry: (id: string) => void
}

export default function WorkoutsPage({ language, plans, history, onReturn, returnLabel,
  onSavePlan, onRemovePlan, onLogPlan, onOpenEntry }: Props) {
  const ru = language === 'ru'
  const t = (value: string) => translate(language, value)
  const [editingId, setEditingId] = useState<string>()
  const [title, setTitle] = useState('')
  const [plannedFor, setPlannedFor] = useState('')
  const [notice, setNotice] = useState('')
  const sortedPlans = [...plans].sort((a, b) =>
    (a.plannedFor ?? '9999-12-31').localeCompare(b.plannedFor ?? '9999-12-31') ||
    Date.parse(a.createdAt) - Date.parse(b.createdAt))
  const sortedHistory = [...history].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  const formatDate = (value: string) => new Intl.DateTimeFormat(ru ? 'ru-RU' : 'en-US', { dateStyle: 'medium' }).format(new Date(value))

  const save = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    if (!onSavePlan(title, plannedFor || undefined, editingId)) {
      setNotice(ru ? 'Не удалось сохранить план. Попробуйте ещё раз.' : 'Could not save the plan. Please try again.')
      return
    }
    setTitle('')
    setPlannedFor('')
    setEditingId(undefined)
    setNotice(ru ? 'План сохранён.' : 'Plan saved.')
  }

  return <main className="workouts-page">
    <header className="workouts-page-heading">
      <button type="button" aria-label={t(returnLabel)} onClick={onReturn}><ArrowLeft size={21} aria-hidden="true" /></button>
      <div><h1>{ru ? 'Тренировки' : 'Workouts'}</h1>
        <p>{ru ? 'Планы и история ваших тренировок.' : 'Your plans and completed workouts.'}</p></div>
    </header>

    <section className="workouts-panel" aria-labelledby="workouts-planned-title">
      <h2 id="workouts-planned-title">{ru ? 'Запланировано' : 'Planned'}</h2>
      <form className="workouts-plan-form" onSubmit={save}>
        <label>{ru ? 'Название тренировки' : 'Workout name'}
          <input type="text" maxLength={140} value={title} onChange={event => setTitle(event.currentTarget.value)}
            placeholder={ru ? 'Например, ноги и спина' : 'e.g. Legs and back'} required /></label>
        <label>{ru ? 'Дата (необязательно)' : 'Date (optional)'}
          <input type="date" value={plannedFor} onChange={event => setPlannedFor(event.currentTarget.value)} /></label>
        <button type="submit" disabled={!title.trim()}><Plus size={17} aria-hidden="true" />
          {editingId ? (ru ? 'Сохранить план' : 'Save plan') : (ru ? 'Добавить план' : 'Add plan')}</button>
        {editingId && <button type="button" className="workouts-secondary" onClick={() => {
          setEditingId(undefined); setTitle(''); setPlannedFor('')
        }}>{ru ? 'Отмена' : 'Cancel'}</button>}
      </form>
      {sortedPlans.length === 0 ? <p className="workouts-empty">{ru ? 'Пока нет запланированных тренировок.' : 'No planned workouts yet.'}</p>
        : <ul className="workouts-list">{sortedPlans.map(plan => <li key={plan.id}>
          <div><strong>{plan.title}</strong>
            {plan.plannedFor && <span>{formatDate(`${plan.plannedFor}T12:00:00`)}</span>}</div>
          <div className="workouts-plan-actions">
            <button type="button" onClick={() => {
              if (!onLogPlan(plan)) setNotice(ru
                ? 'Сначала сохраните текущий черновик в трекере.' : 'Save the current Tracker draft before starting this plan.')
            }}>{ru ? 'Записать тренировку' : 'Log workout'}</button>
            <button type="button" className="workouts-secondary" onClick={() => {
              setEditingId(plan.id); setTitle(plan.title); setPlannedFor(plan.plannedFor ?? ''); setNotice('')
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}>{ru ? 'Изменить' : 'Edit'}</button>
            <button type="button" className="workouts-secondary" onClick={() => {
              if (window.confirm(ru ? 'Удалить этот план тренировки?' : 'Remove this workout plan?')) onRemovePlan(plan.id)
            }}>{ru ? 'Убрать' : 'Remove'}</button>
          </div>
        </li>)}</ul>}
    </section>

    <section className="workouts-panel" aria-labelledby="workouts-history-title">
      <h2 id="workouts-history-title">{ru ? 'История тренировок' : 'Workout history'}</h2>
      {sortedHistory.length === 0 ? <p className="workouts-empty">{ru ? 'Сохранённые тренировки появятся здесь.' : 'Saved workouts will appear here.'}</p>
        : <ul className="workouts-list">{sortedHistory.map(entry => {
          const workout = entry.workout
          if (!workout) return null
          return <li key={entry.id}>
            <div><strong>{entry.text.trim() || workout.exercises.map(exercise => exercise.name).join(', ')}</strong>
              <span>{formatDate(entry.createdAt)} · {workout.exercises.length} {ru ? 'упр.' : 'exercises'}</span>
              <small>{workout.exercises.map(exercise => exercise.name).join(' · ')}</small></div>
            <button type="button" onClick={() => onOpenEntry(entry.id)}>{ru ? 'Открыть запись' : 'View entry'}</button>
          </li>
        })}</ul>}
    </section>
    <p className="workouts-notice" role="status">{notice}</p>
  </main>
}
