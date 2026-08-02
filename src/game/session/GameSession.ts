import type { UpgradeChoice } from '../domain/artifactInventory'
import type { InputIntent } from '../domain/inputIntent'
import type { BaseArtifact, BaseArtifactId } from '../domain/initialArtifactSelection'
import type { OnboardingStep } from '../domain/onboardingProgress'

export type PauseReason = 'manual' | 'orientation' | 'visibility' | 'upgrade' | 'tutorial'
export type { OnboardingStep } from '../domain/onboardingProgress'

export type GameSessionEvent =
  | { readonly type: 'initial-artifact-selection-requested'; readonly candidates: readonly BaseArtifact[] }
  | { readonly type: 'upgrade-requested'; readonly choices: readonly UpgradeChoice[] }
  | { readonly type: 'onboarding-step-completed'; readonly step: OnboardingStep }
  | { readonly type: 'pause-requested' }
  | { readonly type: 'run-ended'; readonly result: 'victory' | 'defeat' }

export interface GameSession {
  pause(reason: PauseReason): void
  resume(reason: PauseReason): void
  selectInitialArtifact(artifactId: BaseArtifactId): void
  selectUpgrade(choiceId: string): void
  skipOnboarding(): void
  setInputIntent(intent: InputIntent): void
  dispose(): void
}

export interface CreateGameSessionOptions {
  readonly parent: HTMLElement
  readonly onEvent: (event: GameSessionEvent) => void
}

