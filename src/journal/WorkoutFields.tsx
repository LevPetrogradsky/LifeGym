import { emptyExercise, type WorkoutExercise, type WorkoutRecord, type WorkoutSet } from './workout'
import type { AppLanguage } from '../language'

interface Props {
  workout?: WorkoutRecord
  onChange: (workout?: WorkoutRecord) => void
  language: AppLanguage
}

export default function WorkoutFields({ workout, onChange, language }: Props) {
  const ru = language === 'ru'
  const exercises = workout?.exercises ?? []
  const changeExercise = (index: number, next: WorkoutExercise) =>
    onChange({ exercises: exercises.map((exercise, position) => position === index ? next : exercise) })
  const changeSet = (exerciseIndex: number, setIndex: number, next: WorkoutSet) => {
    const exercise = exercises[exerciseIndex]
    changeExercise(exerciseIndex, { ...exercise, sets: exercise.sets.map((set, position) => position === setIndex ? next : set) })
  }

  return <section className="workout-fields" aria-label={ru ? 'Упражнения' : 'Exercises'}>
    <div className="workout-fields-heading">
      <h2>{ru ? 'Упражнения' : 'Exercises'}</h2>
      {exercises.length === 0 && <span>{ru ? 'Добавьте упражнение или сохраните обычную заметку' : 'Add an exercise or save a regular note'}</span>}
    </div>
    {exercises.map((exercise, exerciseIndex) => <div className="workout-exercise" key={exerciseIndex}>
      <div className="workout-exercise-heading">
        <h3>{ru ? 'Упражнение' : 'Exercise'} {exerciseIndex + 1}</h3>
        <button type="button" onClick={() => {
          const next = exercises.filter((_, position) => position !== exerciseIndex)
          onChange(next.length ? { exercises: next } : undefined)
        }} aria-label={ru ? `Удалить упражнение ${exerciseIndex + 1}` : `Remove exercise ${exerciseIndex + 1}`}>
          {ru ? 'Убрать' : 'Remove'}
        </button>
      </div>
      <label>
        <span>{ru ? 'Название' : 'Name'}</span>
        <input type="text" data-workout-name maxLength={120} value={exercise.name} placeholder={ru ? 'Например, жим ногами' : 'e.g. Leg press'}
          aria-label={ru ? `Название упражнения ${exerciseIndex + 1}` : `Exercise ${exerciseIndex + 1} name`}
          onChange={event => changeExercise(exerciseIndex, { ...exercise, name: event.currentTarget.value })} />
      </label>
      <div className="workout-sets">
        {exercise.sets.map((set, setIndex) => <div className="workout-set" key={setIndex}>
          <span className="workout-set-number">{ru ? 'Подход' : 'Set'} {setIndex + 1}</span>
          <label><span>{ru ? 'Повторы' : 'Reps'}</span>
            <input type="number" min="1" max="1000" step="1" inputMode="numeric" value={set.reps || ''}
              aria-label={ru ? `Повторы: упражнение ${exerciseIndex + 1}, подход ${setIndex + 1}` : `Exercise ${exerciseIndex + 1} set ${setIndex + 1} reps`}
              onChange={event => changeSet(exerciseIndex, setIndex, { ...set, reps: Number(event.currentTarget.value) || 0 })} />
          </label>
          <label><span>{ru ? 'Вес, кг' : 'Weight, kg'}</span>
            <input type="number" min="0" max="10000" step="any" inputMode="decimal" value={set.weightKg ?? ''}
              aria-label={ru ? `Вес: упражнение ${exerciseIndex + 1}, подход ${setIndex + 1}` : `Exercise ${exerciseIndex + 1} set ${setIndex + 1} weight in kg`}
              onChange={event => changeSet(exerciseIndex, setIndex, { ...set, weightKg: event.currentTarget.value === '' ? undefined : Number(event.currentTarget.value) })} />
          </label>
          {exercise.sets.length > 1 && <button type="button" className="workout-set-remove"
            aria-label={ru ? `Удалить подход ${setIndex + 1} упражнения ${exerciseIndex + 1}` : `Remove exercise ${exerciseIndex + 1} set ${setIndex + 1}`}
            onClick={() => changeExercise(exerciseIndex, { ...exercise, sets: exercise.sets.filter((_, position) => position !== setIndex) })}>×</button>}
        </div>)}
      </div>
      {exercise.sets.length < 30 && <button type="button" className="workout-add-set"
        onClick={() => changeExercise(exerciseIndex, { ...exercise, sets: [...exercise.sets, { reps: 0 }] })}>
        + {ru ? 'Добавить подход' : 'Add set'}
      </button>}
      <label className="workout-rest"><span>{ru ? 'Отдых между подходами, сек (необязательно)' : 'Rest between sets, sec (optional)'}</span>
        <input type="number" min="0" max="3600" step="1" inputMode="numeric" value={exercise.restSeconds ?? ''}
          aria-label={ru ? `Отдых после подхода: упражнение ${exerciseIndex + 1}` : `Exercise ${exerciseIndex + 1} rest seconds`}
          onChange={event => changeExercise(exerciseIndex, { ...exercise, restSeconds: event.currentTarget.value === '' ? undefined : Number(event.currentTarget.value) })} />
      </label>
    </div>)}
    {exercises.length < 20 && <button type="button" className="workout-add-exercise"
      onClick={() => onChange({ exercises: [...exercises, emptyExercise()] })}>
      + {ru ? 'Добавить упражнение' : 'Add exercise'}
    </button>}
  </section>
}
