import type { AscensionRecipe, UpgradeDraftChoice } from '../domain/artifactInventory'
import type { ZhouTianOption } from '../domain/deductionAndZhouTian'
import type { InputIntent } from '../domain/inputIntent'
import type { BaseArtifact, BaseArtifactId } from '../domain/initialArtifactSelection'
import type { OnboardingStep } from '../domain/onboardingProgress'
import type { AudioIntent } from '../audio/audioDirector'
import type { DamageSource, RunResult, RunSummary } from '../domain/runSummary'
import type { RunArtifactSummary } from '../domain/runSummary'
import type { BattleViewport } from '../platform/viewportPolicy'

export type PlatformPauseReason = 'orientation' | 'viewport' | 'visibility' | 'input'
export type { OnboardingStep } from '../domain/onboardingProgress'

export interface BattleHudSnapshot {
  readonly health: number
  readonly maxHealth: number
  readonly level: number
  readonly experience: number
  readonly experienceToNextLevel: number
  readonly elapsedMs: number
  readonly enemyCount: number
  readonly eliteCount: number
  readonly weakestEliteHealthPercent: number | null
  readonly stageLabel: string
  readonly spellCooldownMs: number
  readonly spellShieldRemainingMs?: number
  readonly hitProtectionRemainingMs?: number
  readonly pickupRadiusBoostRemainingMs?: number
  readonly boss?: BossHudSnapshot
  readonly battlefieldEvent?: BattlefieldEventSnapshot
  readonly artifacts: readonly RunArtifactSummary[]
}

export interface BossHudSnapshot {
  readonly name: string
  readonly phase: 'arrival' | 'combat' | 'enraged' | 'defeated'
  readonly health: number
  readonly maxHealth: number
  readonly enragedThreshold: number
  readonly breachRemainingMs: number
}

export type BattlefieldEventKind = 'demon-lair' | 'lingquan'
export type BattlefieldEventPhase = 'travel' | 'battle' | 'available' | 'guiding' | 'destroyed' | 'completed' | 'expired'

export interface BattlefieldEventSnapshot {
  readonly kind: BattlefieldEventKind
  readonly phase: BattlefieldEventPhase
  readonly name: string
  readonly objective: string
  readonly remainingMs: number
  readonly progress?: number
  readonly reward: string
}

export interface BattleInstrumentationSnapshot {
  readonly distanceTravelled: number
  readonly radarRendered: boolean
  readonly radarEnemyRegions: number
  readonly radarSpiritRegions: number
  readonly radarLandmarks: number
  readonly presentationCheckpoint: string | null
}

export type GameSessionDecision =
  | {
      readonly type: 'initial-artifact-selection'
      readonly id: string
      readonly candidates: readonly BaseArtifact[]
    }
  | {
      readonly type: 'upgrade'
      readonly id: string
      readonly choices: readonly (UpgradeDraftChoice | ZhouTianOption)[]
      readonly deductionCount: number
      readonly canDeduce: boolean
      readonly isZhouTian: boolean
    }
  | { readonly type: 'ascension'; readonly id: string; readonly choices: readonly AscensionRecipe[] }
  | { readonly type: 'battlefield-event'; readonly id: string; readonly event: BattlefieldEventSnapshot }

export type GameSessionResult =
  | { readonly state: 'ending'; readonly result: RunResult; readonly source: DamageSource }
  | { readonly state: 'ended'; readonly summary: RunSummary }

export type GameSessionEffect = { readonly type: 'audio'; readonly intent: AudioIntent }

export type BattleRuntimeOutput =
  | { readonly type: 'initial-artifact-selection-requested'; readonly candidates: readonly BaseArtifact[] }
  | {
      readonly type: 'upgrade-requested'
      readonly choices: readonly (UpgradeDraftChoice | ZhouTianOption)[]
      readonly deductionCount: number
      readonly canDeduce: boolean
      readonly isZhouTian?: boolean
    }
  | { readonly type: 'ascension-requested'; readonly choices: readonly AscensionRecipe[] }
  | { readonly type: 'onboarding-step-completed'; readonly step: OnboardingStep }
  | {
      readonly type: 'battlefield-event-requested'
      readonly event: BattlefieldEventSnapshot
      readonly firstEncounter: boolean
    }
  | { readonly type: 'effect'; readonly effect: GameSessionEffect }
  | { readonly type: 'hud-updated'; readonly snapshot: BattleHudSnapshot }
  | { readonly type: 'run-ending'; readonly result: RunResult; readonly source: DamageSource }
  | { readonly type: 'run-ended'; readonly summary: RunSummary }

export type GameSessionLifecycle = 'active' | 'ended' | 'disposed'
export type PausePresentation = PlatformPauseReason | 'manual' | 'decision' | 'orientation-confirmation' | null

export interface GameSessionSnapshot {
  readonly lifecycle: GameSessionLifecycle
  readonly pause: {
    readonly active: boolean
    readonly presentation: PausePresentation
  }
  readonly decision: GameSessionDecision | null
  readonly hud: BattleHudSnapshot | null
  readonly onboardingStep: OnboardingStep | null
  readonly onboardingCompleted: boolean
  readonly result: GameSessionResult | null
}

export interface GameSessionCallbacks {
  readonly onSnapshot: (snapshot: GameSessionSnapshot) => void
  readonly onEffect: (effect: GameSessionEffect) => void
}

export interface GameSession {
  requestManualPause(): void
  releaseManualPause(): void
  confirmOrientation(): void
  setPlatformPause(reason: PlatformPauseReason, paused: boolean): void
  setPageVisible(visible: boolean): void
  setInputSuspended(suspended: boolean): void
  clearInputIntent(): void
  selectInitialArtifact(decisionId: string, artifactId: BaseArtifactId): void
  selectUpgrade(decisionId: string, choiceId: string): void
  selectAscension(decisionId: string, choiceId: string): void
  skipAscension(decisionId: string): void
  deduceUpgrade(decisionId: string): void
  tunaHeal(decisionId: string): void
  confirmBattlefieldEvent(decisionId: string): void
  skipOnboarding(): void
  setInputIntent(intent: InputIntent): void
  castSpell(): void
  resize(viewport: BattleViewport): void
  setReducedMotion(reducedMotion: boolean): void
  dispose(): void
}

export interface CreateGameSessionOptions {
  readonly parent: HTMLElement
  readonly onSnapshot: (snapshot: GameSessionSnapshot) => void
  readonly onEffect: (effect: GameSessionEffect) => void
  readonly viewport: BattleViewport
  readonly renderScale: number
  readonly reducedMotion: boolean
  readonly compactRadar?: boolean
  readonly runSeed?: number
  /** Test-harness clock compression. Product callers should leave this unset. */
  readonly elapsedTimeScale?: number
  /** DEV-only typed instrumentation seam for browser acceptance tests. */
  readonly onInstrumentation?: (snapshot: BattleInstrumentationSnapshot) => void
  /** DEV-only deterministic placement for browser acceptance fixtures. */
  readonly deterministicAcceptance?: boolean
  /** Starts directly at the unlocked, no-reward 妖王演练. */
  readonly practiceMode?: boolean
}
