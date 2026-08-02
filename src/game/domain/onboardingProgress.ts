export type OnboardingStep = 'move' | 'auto-attack' | 'collect-spirit' | 'cast-spell' | 'level-up'

const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  'move',
  'auto-attack',
  'collect-spirit',
  'cast-spell',
  'level-up',
]

export interface OnboardingProgress {
  readonly completedSteps: ReadonlySet<OnboardingStep>
}

export function createOnboardingProgress(): OnboardingProgress {
  return { completedSteps: new Set() }
}

export function completeOnboardingStep(
  progress: OnboardingProgress,
  step: OnboardingStep,
): OnboardingProgress {
  return { completedSteps: new Set([...progress.completedSteps, step]) }
}

export function nextOnboardingStep(progress: OnboardingProgress): OnboardingStep | null {
  return ONBOARDING_STEPS.find((step) => !progress.completedSteps.has(step)) ?? null
}
