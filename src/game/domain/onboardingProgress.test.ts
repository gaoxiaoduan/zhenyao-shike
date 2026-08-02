import { describe, expect, it } from 'vitest'
import { completeOnboardingStep, createOnboardingProgress, nextOnboardingStep } from './onboardingProgress'

describe('首次历练教学进度', () => {
  it('即使操作事件早到，也会记住并按固定顺序给出下一步', () => {
    let progress = createOnboardingProgress()
    progress = completeOnboardingStep(progress, 'auto-attack')
    progress = completeOnboardingStep(progress, 'move')

    expect(nextOnboardingStep(progress)).toBe('collect-spirit')
  })

  it('完成五个首次操作后结束教学', () => {
    let progress = createOnboardingProgress()
    for (const step of ['move', 'auto-attack', 'collect-spirit', 'cast-spell', 'level-up'] as const) {
      progress = completeOnboardingStep(progress, step)
    }

    expect(nextOnboardingStep(progress)).toBeNull()
  })
})
