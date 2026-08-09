import type { AscensionRecipe, UpgradeChoice } from '../domain/artifactInventory'
import type { ZhouTianOption } from '../domain/deductionAndZhouTian'
import type { InputIntent } from '../domain/inputIntent'
import type { BaseArtifact, BaseArtifactId } from '../domain/initialArtifactSelection'
import type { OnboardingStep } from '../domain/onboardingProgress'
import type { AudioIntent } from '../audio/audioDirector'
import type { DamageSource, RunResult, RunSummary } from '../domain/runSummary'
import type { RunArtifactSummary } from '../domain/runSummary'
import type { BattleViewport } from '../platform/viewportPolicy'

export type PauseReason = 'manual' | 'orientation' | 'viewport' | 'visibility' | 'upgrade' | 'tutorial'
export type { OnboardingStep } from '../domain/onboardingProgress'

export interface BattleHudSnapshot {
  readonly health: number
  readonly maxHealth: number
  readonly level: number
  readonly experience: number
  readonly experienceToNextLevel: number
  readonly elapsedMs: number
  readonly enemyCount: number
  readonly stageLabel: string
  readonly spellCooldownMs: number
  readonly artifacts: readonly RunArtifactSummary[]
}

export type GameSessionEvent =
  | { readonly type: 'initial-artifact-selection-requested'; readonly candidates: readonly BaseArtifact[] }
  | {
      readonly type: 'upgrade-requested'
      readonly choices: readonly (UpgradeChoice | ZhouTianOption)[]
      readonly deductionCount: number
      readonly isZhouTian?: boolean
    }
  | { readonly type: 'ascension-requested'; readonly choices: readonly AscensionRecipe[] }
  | { readonly type: 'onboarding-step-completed'; readonly step: OnboardingStep }
  | { readonly type: 'pause-requested' }
  | { readonly type: 'audio-intent'; readonly intent: AudioIntent }
  | { readonly type: 'hud-updated'; readonly snapshot: BattleHudSnapshot }
  | { readonly type: 'run-ending'; readonly result: RunResult; readonly source: DamageSource }
  | { readonly type: 'run-ended'; readonly summary: RunSummary }

export interface GameSession {
  pause(reason: PauseReason): void
  resume(reason: PauseReason): void
  selectInitialArtifact(artifactId: BaseArtifactId): void
  selectUpgrade(choiceId: string): void
  selectAscension(choiceId: string): void
  skipAscension(): void
  deduceUpgrade(): void
  tunaHeal(): void
  skipOnboarding(): void
  setInputIntent(intent: InputIntent): void
  castSpell(): void
  resize(viewport: BattleViewport): void
  setReducedMotion(reducedMotion: boolean): void
  dispose(): void
}

export interface CreateGameSessionOptions {
  readonly parent: HTMLElement
  readonly onEvent: (event: GameSessionEvent) => void
  readonly viewport: BattleViewport
  readonly renderScale: number
  readonly reducedMotion: boolean
  readonly compactRadar?: boolean
  readonly runSeed?: number
}
