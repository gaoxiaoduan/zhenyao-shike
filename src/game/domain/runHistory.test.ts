import { describe, expect, it } from 'vitest'
import { createInMemoryRunHistoryStorage } from '../platform/runHistoryStorage'
import { createRunHistory } from './runHistory'
import type { RunSummary } from './runSummary'

function createSummary(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    result: 'defeat',
    elapsedMs: 225_000,
    defeatedEnemies: 42,
    defeatedElites: 1,
    bossElapsedMs: null,
    bossReachedEnraged: false,
    completedEvents: [],
    artifacts: [{ id: 'qing-feng-jian-xia', name: '青锋剑匣', level: 4 }],
    spiritStones: 10,
    demonCores: 0,
    finalDamageSource: 'ordinary-enemy',
    hint: '保持移动。',
    ...overrides,
  }
}

describe('run history', () => {
  it('settles a standard run into one observable state that is restored on returning home', async () => {
    const storage = createInMemoryRunHistoryStorage()
    const runHistory = createRunHistory(storage)
    const beforeRun = await runHistory.restore()

    const settlement = await runHistory.completeStandardRun(createSummary({
      result: 'victory',
      elapsedMs: 642_000,
      defeatedEnemies: 55,
      defeatedElites: 2,
      bossElapsedMs: 42_000,
      bossReachedEnraged: true,
      completedEvents: ['demon-lair', 'lingquan'],
      finalDamageSource: 'unknown',
    }))

    expect(settlement).toMatchObject({
      isNewRecord: true,
      previousReplayTarget: beforeRun.replayTarget,
      previousReplayTargetCompleted: true,
      summary: { demonCores: 1 },
      state: {
        history: {
          best: {
            fastestVictoryMs: 642_000,
            mostKills: 55,
            longestSurvivalMs: 642_000,
          },
          entries: [{
            result: 'victory',
            elapsedMs: 642_000,
            completedEvents: ['demon-lair', 'lingquan'],
          }],
        },
        replayTarget: { kind: 'fast-victory', goalMs: 627_000 },
        bossPracticeUnlocked: true,
        persistenceStatus: 'persisted',
      },
    })

    expect(await runHistory.restore()).toEqual(settlement.state)
    expect(await createRunHistory(storage).restore()).toEqual(settlement.state)
  })

  it('keeps a completed standard run observable when durable storage is unavailable', async () => {
    const storage = createInMemoryRunHistoryStorage({
      hydrationStatus: 'degraded',
      flushResult: false,
    })
    const runHistory = createRunHistory(storage)

    const settlement = await runHistory.completeStandardRun(createSummary({ elapsedMs: 180_000 }))

    expect(settlement.state).toMatchObject({
      hydrationStatus: 'degraded',
      persistenceStatus: 'session-only',
      history: {
        entries: [{ elapsedMs: 180_000, result: 'defeat' }],
        best: { longestSurvivalMs: 180_000 },
      },
      replayTarget: { kind: 'survival', goalMs: 210_000 },
    })
  })

  it('does not report persistence after a run record write fails before the practice unlock is saved', async () => {
    const storage = createInMemoryRunHistoryStorage({ writeResults: [false, true] })
    const runHistory = createRunHistory(storage)

    const settlement = await runHistory.completeStandardRun(createSummary({ elapsedMs: 642_000 }))

    expect(settlement.state.persistenceStatus).toBe('session-only')
  })

  it('keeps a boss practice result outside the standard history and rewards', async () => {
    const runHistory = createRunHistory(createInMemoryRunHistoryStorage())
    const beforePractice = await runHistory.restore()

    const practiceSummary = await runHistory.completeBossPractice(createSummary({
      result: 'victory',
      elapsedMs: 642_000,
      spiritStones: 18,
      demonCores: 1,
    }))

    expect(practiceSummary).toMatchObject({ spiritStones: 0, demonCores: 0 })
    expect(await runHistory.restore()).toEqual(beforePractice)
  })
})
