export interface WorkoutSet {
  reps: number
  weightKg?: number
}

export interface WorkoutExercise {
  name: string
  sets: WorkoutSet[]
  restSeconds?: number
}

export interface WorkoutRecord {
  exercises: WorkoutExercise[]
}

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

export function validWorkout(value: unknown, allowIncomplete = false): value is WorkoutRecord {
  if (!record(value) || !Array.isArray(value.exercises) || value.exercises.length < 1 || value.exercises.length > 20) return false
  return value.exercises.every(exercise => record(exercise) &&
    typeof exercise.name === 'string' && exercise.name.length <= 120 &&
    (allowIncomplete || exercise.name.trim().length > 0) &&
    Array.isArray(exercise.sets) && exercise.sets.length >= 1 && exercise.sets.length <= 30 &&
    exercise.sets.every(set => record(set) && typeof set.reps === 'number' && Number.isFinite(set.reps) &&
      (allowIncomplete ? set.reps >= 0 && set.reps <= 1_000_000 : Number.isSafeInteger(set.reps) && set.reps >= 1 && set.reps <= 1000) &&
      (set.weightKg === undefined || (typeof set.weightKg === 'number' && Number.isFinite(set.weightKg) &&
        set.weightKg >= 0 && set.weightKg <= (allowIncomplete ? 1_000_000 : 10000)))) &&
    (exercise.restSeconds === undefined || (typeof exercise.restSeconds === 'number' && Number.isFinite(exercise.restSeconds) &&
      (allowIncomplete ? exercise.restSeconds >= 0 && exercise.restSeconds <= 1_000_000
        : Number.isSafeInteger(exercise.restSeconds) && exercise.restSeconds >= 0 && exercise.restSeconds <= 3600))))
}
