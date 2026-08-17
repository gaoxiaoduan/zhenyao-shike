import { completeOnboardingStep, createOnboardingProgress, nextOnboardingStep } from '../domain/onboardingProgress'
import { createInputIntent, type InputIntent } from '../domain/inputIntent'
import type { BaseArtifactId } from '../domain/initialArtifactSelection'
import type { BattleViewport } from '../platform/viewportPolicy'
import type {
  BattleRuntimeOutput,
  GameSession,
  GameSessionCallbacks,
  GameSessionDecision,
  GameSessionLifecycle,
  GameSessionResult,
  GameSessionSnapshot,
  PausePresentation,
  PlatformPauseReason,
} from './GameSession'

export interface BattleRuntime {
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
  setPaused(paused: boolean): void
  destroy(): void
}

export interface GameSessionController {
  readonly session: GameSession
  readonly reportRuntimeOutput: (output: BattleRuntimeOutput) => void
}

const NOOP_CALLBACKS: GameSessionCallbacks = {
  onSnapshot: () => undefined,
  onEffect: () => undefined,
}

type SessionPauseReason = PlatformPauseReason | 'manual' | 'decision'

interface PauseReasonUpdate {
  readonly reason: SessionPauseReason
  readonly active: boolean
  readonly clearInput?: boolean
}

function freezeDecision(decision: GameSessionDecision): GameSessionDecision {
  if (decision.type === 'initial-artifact-selection') {
    return Object.freeze({
      ...decision,
      candidates: Object.freeze(decision.candidates.map((candidate) => Object.freeze({ ...candidate }))),
    })
  }
  if (decision.type === 'upgrade') {
    return Object.freeze({
      ...decision,
      choices: Object.freeze(decision.choices.map((choice) => Object.freeze({ ...choice }))),
    })
  }
  if (decision.type === 'ascension') {
    return Object.freeze({
      ...decision,
      choices: Object.freeze(decision.choices.map((choice) => Object.freeze({
        ...choice,
        sourceIds: Object.freeze([...choice.sourceIds]) as typeof choice.sourceIds,
        sourceNames: Object.freeze([...choice.sourceNames]) as typeof choice.sourceNames,
      }))),
    })
  }
  return Object.freeze({
    ...decision,
    event: Object.freeze({ ...decision.event }),
  })
}

function freezeRunSummary(summary: Extract<GameSessionResult, { state: 'ended' }>['summary']) {
  return Object.freeze({
    ...summary,
    artifacts: Object.freeze(summary.artifacts.map((artifact) => Object.freeze({ ...artifact }))),
  })
}

export function createGameSessionController(
  runtime: BattleRuntime,
  callbacks: Partial<GameSessionCallbacks> = {},
): GameSessionController {
  const sessionCallbacks: GameSessionCallbacks = { ...NOOP_CALLBACKS, ...callbacks }
  const pauseReasons = new Set<SessionPauseReason>()
  let disposed = false
  let paused = false
  let lifecycle: GameSessionLifecycle = 'active'
  let decision: GameSessionDecision | null = null
  let decisionSequence = 0
  let hud = null as GameSessionSnapshot['hud']
  let result: GameSessionResult | null = null
  let onboardingProgress = createOnboardingProgress()
  let onboardingSkipped = false
  let lastInputIntent = createInputIntent()
  let lastAudioPauseMode: 'active' | 'choice' | 'full' | undefined
  let transactionDepth = 0
  let publishPending = false

  function nextDecisionId() {
    decisionSequence += 1
    return `decision-${decisionSequence}`
  }

  function getPausePresentation(): PausePresentation {
    if (pauseReasons.has('orientation')) {
      return 'orientation'
    }
    if (pauseReasons.has('viewport')) {
      return 'viewport'
    }
    if (pauseReasons.has('visibility')) {
      return 'visibility'
    }
    if (pauseReasons.has('input')) {
      return 'input'
    }
    if (pauseReasons.has('manual')) {
      return 'manual'
    }
    if (pauseReasons.has('decision')) {
      return 'decision'
    }
    return null
  }

  function getAudioPauseMode(): 'active' | 'choice' | 'full' {
    if (pauseReasons.has('manual')
      || pauseReasons.has('orientation')
      || pauseReasons.has('viewport')
      || pauseReasons.has('visibility')
      || pauseReasons.has('input')) {
      return 'full'
    }
    if (decision?.type === 'initial-artifact-selection'
      || decision?.type === 'upgrade'
      || decision?.type === 'ascension') {
      return 'choice'
    }
    if (decision?.type === 'battlefield-event') {
      return 'full'
    }
    return 'active'
  }

  function createSnapshot(): GameSessionSnapshot {
    const onboardingStep = onboardingSkipped ? null : nextOnboardingStep(onboardingProgress)
    return Object.freeze({
      lifecycle,
      pause: Object.freeze({
        active: paused,
        presentation: getPausePresentation(),
      }),
      decision,
      hud,
      onboardingStep,
      onboardingCompleted: onboardingSkipped || onboardingStep === null,
      result,
    })
  }

  function publishSnapshot() {
    const snapshot = createSnapshot()
    sessionCallbacks.onSnapshot(snapshot)
    const nextAudioPauseMode = getAudioPauseMode()
    if (nextAudioPauseMode !== lastAudioPauseMode) {
      lastAudioPauseMode = nextAudioPauseMode
      sessionCallbacks.onEffect({
        type: 'audio',
        intent: { type: 'pause', mode: nextAudioPauseMode },
      })
    }
  }

  function publish() {
    if (transactionDepth > 0) {
      publishPending = true
      return
    }
    publishPending = false
    publishSnapshot()
  }

  function flushPendingPublish() {
    if (!publishPending || transactionDepth > 0) {
      return
    }
    publishPending = false
    publishSnapshot()
  }

  function clearMovementIntent() {
    lastInputIntent = createInputIntent()
    runtime.setInputIntent(lastInputIntent)
  }

  function syncPauseState() {
    const nextPaused = pauseReasons.size > 0
    if (paused === nextPaused) {
      return
    }

    paused = nextPaused
    runtime.setPaused(paused)
    if (!paused) {
      runtime.setInputIntent(lastInputIntent)
    }
  }

  function setPauseReasons(updates: readonly PauseReasonUpdate[]): boolean {
    if (disposed || lifecycle !== 'active') {
      return false
    }

    let changed = false
    for (const update of updates) {
      if (update.active) {
        if (pauseReasons.has(update.reason)) {
          continue
        }
        if (update.clearInput) {
          clearMovementIntent()
        }
        pauseReasons.add(update.reason)
        changed = true
        continue
      }

      if (pauseReasons.delete(update.reason)) {
        changed = true
      }
    }

    if (!changed) {
      return false
    }
    syncPauseState()
    publish()
    return true
  }

  function setPauseReason(
    reason: SessionPauseReason,
    active: boolean,
    clearInput = false,
  ): boolean {
    return setPauseReasons([{ reason, active, clearInput }])
  }

  function beginDecision(nextDecision: GameSessionDecision) {
    const alreadyHasDecisionPause = pauseReasons.has('decision')
    decision = freezeDecision(nextDecision)
    setPauseReason('decision', true)
    if (alreadyHasDecisionPause) {
      publish()
    }
  }

  function isCurrentDecision(id: string, type: GameSessionDecision['type']) {
    return decision?.id === id && decision.type === type
  }

  function acceptDecision(
    id: string,
    type: GameSessionDecision['type'],
    isValid: (current: GameSessionDecision) => boolean,
    apply: () => void,
  ) {
    if (disposed || lifecycle !== 'active' || !isCurrentDecision(id, type) || !decision || !isValid(decision)) {
      return
    }

    decision = null
    transactionDepth += 1
    try {
      apply()
    } finally {
      transactionDepth -= 1
    }
    if (!decision) {
      const pauseReleased = setPauseReason('decision', false)
      if (!pauseReleased) {
        publish()
      }
    } else {
      publish()
    }
    flushPendingPublish()
  }

  function reportRuntimeOutput(output: BattleRuntimeOutput) {
    if (disposed || lifecycle !== 'active') {
      return
    }

    if (output.type === 'initial-artifact-selection-requested') {
      beginDecision({
        type: 'initial-artifact-selection',
        id: nextDecisionId(),
        candidates: [...output.candidates],
      })
      return
    }

    if (output.type === 'upgrade-requested') {
      beginDecision({
        type: 'upgrade',
        id: decision?.type === 'upgrade' ? decision.id : nextDecisionId(),
        choices: [...output.choices],
        deductionCount: output.deductionCount,
        canDeduce: output.canDeduce,
        isZhouTian: output.isZhouTian ?? false,
      })
      return
    }

    if (output.type === 'ascension-requested') {
      beginDecision({
        type: 'ascension',
        id: decision?.type === 'ascension' ? decision.id : nextDecisionId(),
        choices: [...output.choices],
      })
      return
    }

    if (output.type === 'battlefield-event-requested') {
      if (output.firstEncounter) {
        beginDecision({
          type: 'battlefield-event',
          id: nextDecisionId(),
          event: { ...output.event },
        })
      }
      return
    }

    if (output.type === 'onboarding-step-completed') {
      if (!onboardingSkipped) {
        onboardingProgress = completeOnboardingStep(onboardingProgress, output.step)
        publish()
      }
      return
    }

    if (output.type === 'effect') {
      sessionCallbacks.onEffect(output.effect)
      return
    }

    if (output.type === 'hud-updated') {
      hud = Object.freeze({
        ...output.snapshot,
        artifacts: Object.freeze(output.snapshot.artifacts.map((artifact) => Object.freeze({ ...artifact }))),
        battlefieldEvent: output.snapshot.battlefieldEvent
          ? Object.freeze({ ...output.snapshot.battlefieldEvent })
          : undefined,
        boss: output.snapshot.boss ? Object.freeze({ ...output.snapshot.boss }) : undefined,
      })
      publish()
      return
    }

    if (output.type === 'run-ending') {
      result = Object.freeze({ state: 'ending', result: output.result, source: output.source })
      publish()
      return
    }

    lifecycle = 'ended'
    result = Object.freeze({ state: 'ended', summary: freezeRunSummary(output.summary) })
    decision = null
    pauseReasons.clear()
    if (!paused) {
      paused = true
      runtime.setPaused(true)
    }
    lastInputIntent = createInputIntent()
    publish()
  }

  const session: GameSession = {
    requestManualPause() {
      setPauseReason('manual', true, true)
    },
    releaseManualPause() {
      setPauseReason('manual', false)
    },
    setPlatformPause(reason, pausedByPlatform) {
      setPauseReason(reason, pausedByPlatform, pausedByPlatform && (reason === 'visibility' || reason === 'input'))
    },
    setPageVisible(visible) {
      setPauseReason('visibility', !visible, !visible)
    },
    setInputSuspended(suspended) {
      setPauseReason('input', suspended, suspended)
    },
    clearInputIntent() {
      if (disposed || lifecycle !== 'active') {
        return
      }
      clearMovementIntent()
    },
    selectInitialArtifact(decisionId, artifactId) {
      acceptDecision(
        decisionId,
        'initial-artifact-selection',
        (current) => current.type === 'initial-artifact-selection'
          && current.candidates.some((candidate) => candidate.id === artifactId),
        () => runtime.selectInitialArtifact(artifactId),
      )
    },
    selectUpgrade(decisionId, choiceId) {
      acceptDecision(
        decisionId,
        'upgrade',
        (current) => current.type === 'upgrade'
          && current.choices.some((choice) => choice.choiceId === choiceId),
        () => runtime.selectUpgrade(choiceId),
      )
    },
    selectAscension(decisionId, choiceId) {
      acceptDecision(
        decisionId,
        'ascension',
        (current) => current.type === 'ascension'
          && current.choices.some((choice) => choice.choiceId === choiceId),
        () => runtime.selectAscension(choiceId),
      )
    },
    skipAscension(decisionId) {
      acceptDecision(decisionId, 'ascension', () => true, () => runtime.skipAscension())
    },
    deduceUpgrade(decisionId) {
      acceptDecision(
        decisionId,
        'upgrade',
        (current) => current.type === 'upgrade' && current.canDeduce && !current.isZhouTian,
        () => runtime.deduceUpgrade(),
      )
    },
    tunaHeal(decisionId) {
      if (decision?.type !== 'upgrade' && decision?.type !== 'ascension') {
        return
      }
      const type = decision.type
      acceptDecision(decisionId, type, () => true, () => runtime.tunaHeal())
    },
    confirmBattlefieldEvent(decisionId) {
      acceptDecision(decisionId, 'battlefield-event', () => true, () => undefined)
    },
    skipOnboarding() {
      if (disposed || lifecycle !== 'active') {
        return
      }
      runtime.skipOnboarding()
      onboardingSkipped = true
      publish()
    },
    setInputIntent(intent) {
      if (disposed || lifecycle !== 'active') {
        return
      }
      if (pauseReasons.has('manual') || pauseReasons.has('visibility') || pauseReasons.has('input')) {
        return
      }
      lastInputIntent = intent
      runtime.setInputIntent(intent)
    },
    castSpell() {
      if (disposed || lifecycle !== 'active') {
        return
      }
      runtime.castSpell()
    },
    resize(viewport) {
      if (disposed || lifecycle !== 'active') {
        return
      }
      runtime.resize(viewport)
      setPauseReasons([
        { reason: 'orientation', active: viewport.requiresOrientation },
        { reason: 'viewport', active: viewport.requiresLargerWindow },
      ])
    },
    setReducedMotion(reducedMotion) {
      if (disposed || lifecycle !== 'active') {
        return
      }
      runtime.setReducedMotion(reducedMotion)
    },
    dispose() {
      if (disposed) {
        return
      }
      disposed = true
      lifecycle = 'disposed'
      decision = null
      pauseReasons.clear()
      if (!paused) {
        paused = true
        runtime.setPaused(true)
      }
      runtime.destroy()
      publish()
    },
  }

  publish()
  return { session, reportRuntimeOutput }
}
