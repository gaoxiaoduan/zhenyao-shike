import type { InputIntent } from '../domain/inputIntent'
import type { BaseArtifactId } from '../domain/initialArtifactSelection'
import type { BattleViewport } from '../platform/viewportPolicy'
import type { GameSession, PauseReason } from './GameSession'

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

export function createGameSessionController(runtime: BattleRuntime): GameSession {
  const pauseReasons = new Set<PauseReason>()
  let disposed = false
  let paused = false

  function syncPauseState() {
    const nextPaused = pauseReasons.size > 0
    if (paused === nextPaused) {
      return
    }

    paused = nextPaused
    runtime.setPaused(paused)
  }

  return {
    pause(reason) {
      if (disposed) {
        return
      }

      pauseReasons.add(reason)
      syncPauseState()
    },
    resume(reason) {
      if (disposed) {
        return
      }

      pauseReasons.delete(reason)
      syncPauseState()
    },
    selectInitialArtifact(artifactId) {
      if (disposed) {
        return
      }

      runtime.selectInitialArtifact(artifactId)
    },
    selectUpgrade(choiceId) {
      if (disposed) {
        return
      }

      runtime.selectUpgrade(choiceId)
    },
    selectAscension(choiceId) {
      if (disposed) {
        return
      }

      runtime.selectAscension(choiceId)
    },
    skipAscension() {
      if (disposed) {
        return
      }

      runtime.skipAscension()
    },
    deduceUpgrade() {
      if (disposed) {
        return
      }

      runtime.deduceUpgrade()
    },
    tunaHeal() {
      if (disposed) {
        return
      }

      runtime.tunaHeal()
    },
    skipOnboarding() {
      if (disposed) {
        return
      }

      runtime.skipOnboarding()
    },
    setInputIntent(intent) {
      if (disposed) {
        return
      }

      runtime.setInputIntent(intent)
    },
    castSpell() {
      if (disposed) {
        return
      }

      runtime.castSpell()
    },
    resize(viewport) {
      if (disposed) {
        return
      }

      runtime.resize(viewport)
    },
    setReducedMotion(reducedMotion) {
      if (disposed) {
        return
      }

      runtime.setReducedMotion(reducedMotion)
    },
    dispose() {
      if (disposed) {
        return
      }

      disposed = true
      pauseReasons.clear()
      runtime.destroy()
    },
  }
}
