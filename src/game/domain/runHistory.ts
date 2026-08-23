import { GROWTH_PHASE_DURATION_MS } from './runProgress'
import {
  createEmptyRunHistory,
  hasBossPracticeUnlocked,
  readRunHistory,
  recordRunResult,
  unlockBossPractice,
  type RunHistorySnapshot,
  type RunRecordStorage,
} from './runRecord'
import { createReplayTarget, isReplayTargetCompleted, type ReplayTarget } from './replayTarget'
import type { RunSummary } from './runSummary'

export type RunHistoryHydrationStatus = 'ready' | 'recovered' | 'degraded'
export type RunHistoryPersistenceStatus = 'persisted' | 'session-only'

export interface RunHistoryStorage extends RunRecordStorage {
  readonly ready: Promise<RunHistoryHydrationStatus>
  flush(): Promise<boolean>
}

export interface RunHistoryState {
  readonly history: RunHistorySnapshot
  readonly replayTarget: ReplayTarget
  readonly bossPracticeUnlocked: boolean
  readonly hydrationStatus: RunHistoryHydrationStatus
  readonly persistenceStatus: RunHistoryPersistenceStatus
}

export interface StandardRunSettlement {
  readonly summary: RunSummary
  readonly isNewRecord: boolean
  readonly previousReplayTarget: ReplayTarget
  readonly previousReplayTargetCompleted: boolean
  readonly state: RunHistoryState
}

export interface RunHistory {
  restore(): Promise<RunHistoryState>
  completeStandardRun(summary: RunSummary): Promise<StandardRunSettlement>
  completeBossPractice(summary: RunSummary): Promise<RunSummary>
}

export function createInitialRunHistoryState(): RunHistoryState {
  const history = createEmptyRunHistory()
  return {
    history,
    replayTarget: createReplayTarget(history),
    bossPracticeUnlocked: false,
    hydrationStatus: 'ready',
    persistenceStatus: 'persisted',
  }
}

export function createRunHistory(storage: RunHistoryStorage): RunHistory {
  let state = createInitialRunHistoryState()
  let restorePromise: Promise<RunHistoryState> | null = null

  return {
    restore,
    async completeBossPractice(summary) {
      return { ...summary, spiritStones: 0, demonCores: 0 }
    },
    async completeStandardRun(summary) {
      const previousState = await restore()
      const previousReplayTarget = previousState.replayTarget
      const record = recordRunResult(storage, summary)

      if (summary.elapsedMs >= GROWTH_PHASE_DURATION_MS) {
        unlockBossPractice(storage)
      }

      const persistenceStatus = await storage.flush() ? 'persisted' : 'session-only'
      state = createState(
        record.history,
        hasBossPracticeUnlocked(storage),
        previousState.hydrationStatus,
        persistenceStatus,
      )
      restorePromise = Promise.resolve(state)

      return {
        summary: { ...summary, demonCores: record.demonCoreEarned ? 1 : 0 },
        isNewRecord: record.isNewRecord,
        previousReplayTarget,
        previousReplayTargetCompleted: isReplayTargetCompleted(previousReplayTarget, summary),
        state,
      }
    },
  }

  function restore(): Promise<RunHistoryState> {
    restorePromise ??= storage.ready.then((hydrationStatus) => {
      const history = readRunHistory(storage)
      state = createState(
        history,
        hasBossPracticeUnlocked(storage),
        hydrationStatus,
        hydrationStatus === 'degraded' ? 'session-only' : 'persisted',
      )
      return state
    })
    return restorePromise
  }
}

function createState(
  history: RunHistorySnapshot,
  bossPracticeUnlocked: boolean,
  hydrationStatus: RunHistoryHydrationStatus,
  persistenceStatus: RunHistoryPersistenceStatus,
): RunHistoryState {
  return {
    history,
    replayTarget: createReplayTarget(history),
    bossPracticeUnlocked,
    hydrationStatus,
    persistenceStatus,
  }
}
