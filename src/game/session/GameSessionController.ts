import type { InputIntent } from '../domain/inputIntent'
import type { BaseArtifactId } from '../domain/initialArtifactSelection'
import type { GameSession, PauseReason } from './GameSession'

export interface BattleRuntime {
  selectInitialArtifact(artifactId: BaseArtifactId): void
  selectUpgrade(choiceId: string): void
  selectAscension(choiceId: string): void
  skipAscension(): void
  skipOnboarding(): void
  setInputIntent(intent: InputIntent): void
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
