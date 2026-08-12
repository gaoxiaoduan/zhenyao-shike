import { describe, expect, it } from 'vitest'
import { hasBossPracticeUnlocked, recordRunResult, unlockBossPractice } from './runRecord'

describe('run record', () => {
  it('marks and persists only longer runs as new records', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }

    expect(recordRunResult(storage, 225_000, 'defeat')).toEqual({ isNewRecord: true, demonCoreEarned: false })
    expect(recordRunResult(storage, 180_000, 'victory')).toEqual({ isNewRecord: false, demonCoreEarned: true })
    expect(recordRunResult(storage, 226_000, 'victory')).toEqual({ isNewRecord: true, demonCoreEarned: false })
  })

  it('unlocks the no-reward 妖王演练 independently from victory rewards', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }

    expect(hasBossPracticeUnlocked(storage)).toBe(false)
    unlockBossPractice(storage)
    expect(hasBossPracticeUnlocked(storage)).toBe(true)
  })
})
