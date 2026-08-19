import { describe, expect, it } from 'vitest'
import type { RunSummary } from './runSummary'
import {
  createEmptyRunHistory,
  hasBossPracticeUnlocked,
  isValidRunHistoryStorageValue,
  readRunHistory,
  recordRunResult,
  RUN_HISTORY_STORAGE_KEY,
  unlockBossPractice,
} from './runRecord'

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

function createStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }
}

describe('run record', () => {
  it('persists failed and victorious runs with personal replay metrics', () => {
    const storage = createStorage()

    const first = recordRunResult(storage, createSummary(), 1_700_000_000_000)
    const second = recordRunResult(storage, createSummary({
      result: 'victory',
      elapsedMs: 180_000,
      defeatedEnemies: 55,
      defeatedElites: 2,
      bossElapsedMs: 42_000,
      bossReachedEnraged: true,
      completedEvents: ['demon-lair', 'lingquan'],
      finalDamageSource: 'unknown',
    }), 1_700_000_001_000)

    expect(first.isNewRecord).toBe(true)
    expect(first.demonCoreEarned).toBe(false)
    expect(second).toMatchObject({ isNewRecord: true, demonCoreEarned: true })
    expect(second.history.best).toEqual({
      fastestVictoryMs: 180_000,
      mostKills: 55,
      longestSurvivalMs: 225_000,
    })
    expect(second.history.entries.map((entry) => entry.result)).toEqual(['victory', 'defeat'])
    expect(second.history.entries[0]).toMatchObject({
      elapsedMs: 180_000,
      defeatedEnemies: 55,
      bossElapsedMs: 42_000,
      bossReachedEnraged: true,
      completedEvents: ['demon-lair', 'lingquan'],
    })
    expect(readRunHistory(storage)).toEqual(second.history)
  })

  it('keeps the first victory reward and personal bests beyond the twelve newest runs', () => {
    const storage = createStorage()

    const firstVictory = recordRunResult(storage, createSummary({
      result: 'victory',
      elapsedMs: 100_000,
      defeatedEnemies: 100,
    }), 1_700_000_000_000)
    expect(firstVictory.demonCoreEarned).toBe(true)

    for (let index = 0; index < 12; index += 1) {
      recordRunResult(storage, createSummary({ elapsedMs: 120_000 + index * 1_000, defeatedEnemies: 10 }), 1_700_000_000_001 + index)
    }

    const laterVictory = recordRunResult(storage, createSummary({ result: 'victory', elapsedMs: 180_000, defeatedEnemies: 10 }), 1_700_000_000_100)

    expect(laterVictory.demonCoreEarned).toBe(false)
    expect(laterVictory.isNewRecord).toBe(false)
    expect(laterVictory.history.entries).toHaveLength(12)
    expect(laterVictory.history.entries.at(-1)?.recordedAtMs).toBe(1_700_000_000_002)
    expect(laterVictory.history.best).toEqual({
      fastestVictoryMs: 100_000,
      mostKills: 100,
      longestSurvivalMs: 180_000,
    })
  })

  it('does not call a slower victory a new record when the kill count is unchanged', () => {
    const storage = createStorage()

    recordRunResult(storage, createSummary({ result: 'victory', elapsedMs: 180_000, defeatedEnemies: 55 }), 1_700_000_000_000)
    const slowerVictory = recordRunResult(storage, createSummary({ result: 'victory', elapsedMs: 240_000, defeatedEnemies: 55 }), 1_700_000_000_001)

    expect(slowerVictory.isNewRecord).toBe(false)
  })

  it('returns an empty history when the saved payload is missing or malformed', () => {
    const storage = createStorage()

    expect(readRunHistory(storage)).toEqual(createEmptyRunHistory())
    storage.setItem(RUN_HISTORY_STORAGE_KEY, '{"version":2,"entries":[null]}')
    expect(readRunHistory(storage)).toEqual(createEmptyRunHistory())
  })

  it('detects a tampered history payload through its checksum', () => {
    const storage = createStorage()
    recordRunResult(storage, createSummary(), 1_700_000_000_000)
    const raw = storage.getItem(RUN_HISTORY_STORAGE_KEY)

    expect(raw).not.toBeNull()
    expect(isValidRunHistoryStorageValue(raw!)).toBe(true)
    storage.setItem(RUN_HISTORY_STORAGE_KEY, raw!.replace('"mostKills":42', '"mostKills":0'))

    expect(isValidRunHistoryStorageValue(storage.getItem(RUN_HISTORY_STORAGE_KEY)!)).toBe(false)
    expect(readRunHistory(storage)).toEqual(createEmptyRunHistory())
  })

  it('unlocks the no-reward 妖王演练 independently from victory rewards', () => {
    const storage = createStorage()

    expect(hasBossPracticeUnlocked(storage)).toBe(false)
    unlockBossPractice(storage)
    expect(hasBossPracticeUnlocked(storage)).toBe(true)
  })
})
