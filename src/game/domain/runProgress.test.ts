import { describe, expect, it } from 'vitest'
import {
  GROWTH_PHASE_DURATION_MS,
  advanceRunProgress,
  createRunProgress,
  endRun,
  experienceRequiredForLevel,
  formatElapsedTime,
  grantExperience,
} from './runProgress'

describe('run progress', () => {
  it('enters the boss phase when ten minutes of active time elapse', () => {
    const progress = advanceRunProgress(createRunProgress(), GROWTH_PHASE_DURATION_MS)

    expect(progress.phase).toBe('boss')
    expect(progress.elapsedMs).toBe(GROWTH_PHASE_DURATION_MS)
  })

  it('does not advance the clock after entering the boss phase', () => {
    const bossProgress = advanceRunProgress(createRunProgress(), GROWTH_PHASE_DURATION_MS)

    expect(advanceRunProgress(bossProgress, 5_000)).toBe(bossProgress)
  })

  it('marks the run as ended without changing the final elapsed time', () => {
    const bossProgress = advanceRunProgress(createRunProgress(), GROWTH_PHASE_DURATION_MS)

    const endedProgress = endRun(bossProgress)

    expect(endedProgress.phase).toBe('ended')
    expect(endedProgress.elapsedMs).toBe(GROWTH_PHASE_DURATION_MS)
  })

  it('carries excess experience into following levels', () => {
    expect(createRunProgress().experienceToNextLevel).toBe(22)
    const result = grantExperience(createRunProgress(), 60)

    expect(result.levelsGained).toBe(2)
    expect(result.progress.level).toBe(3)
    expect(result.progress.experience).toBe(4)
    expect(result.progress.experienceToNextLevel).toBe(experienceRequiredForLevel(3))
  })

  it('formats elapsed time for the battle HUD', () => {
    expect(formatElapsedTime(65_900)).toBe('01:05')
  })
})
