export const GROWTH_PHASE_DURATION_MS = 10 * 60 * 1000

export type RunPhase = 'growth' | 'boss' | 'ended'

export interface RunProgress {
  readonly elapsedMs: number
  readonly experience: number
  readonly experienceToNextLevel: number
  readonly level: number
  readonly phase: RunPhase
}

export interface ExperienceResult {
  readonly progress: RunProgress
  readonly levelsGained: number
}

export function createRunProgress(): RunProgress {
  return {
    elapsedMs: 0,
    experience: 0,
    experienceToNextLevel: experienceRequiredForLevel(1),
    level: 1,
    phase: 'growth',
  }
}

export function advanceRunProgress(progress: RunProgress, deltaMs: number): RunProgress {
  if (progress.phase !== 'growth' || deltaMs <= 0) {
    return progress
  }

  const elapsedMs = Math.min(progress.elapsedMs + deltaMs, GROWTH_PHASE_DURATION_MS)

  return {
    ...progress,
    elapsedMs,
    phase: elapsedMs >= GROWTH_PHASE_DURATION_MS ? 'boss' : 'growth',
  }
}

export function endRun(progress: RunProgress): RunProgress {
  if (progress.phase === 'ended') {
    return progress
  }

  return { ...progress, phase: 'ended' }
}

export function grantExperience(progress: RunProgress, amount: number): ExperienceResult {
  if (amount <= 0 || progress.phase === 'ended') {
    return { progress, levelsGained: 0 }
  }

  let experience = progress.experience + amount
  let level = progress.level
  let experienceToNextLevel = progress.experienceToNextLevel
  let levelsGained = 0

  while (experience >= experienceToNextLevel) {
    experience -= experienceToNextLevel
    level += 1
    levelsGained += 1
    experienceToNextLevel = experienceRequiredForLevel(level)
  }

  return {
    progress: {
      ...progress,
      experience,
      experienceToNextLevel,
      level,
    },
    levelsGained,
  }
}

export function experienceRequiredForLevel(level: number): number {
  return 18 + Math.max(0, level - 1) * 5
}

export function formatElapsedTime(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}
