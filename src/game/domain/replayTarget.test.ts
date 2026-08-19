import { describe, expect, it } from 'vitest'
import type { RunSummary } from './runSummary'
import {
  createEmptyRunHistory,
  recordRunResult,
} from './runRecord'
import { createReplayTarget, isReplayTargetCompleted } from './replayTarget'

function createSummary(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    result: 'defeat',
    elapsedMs: 90_000,
    defeatedEnemies: 42,
    defeatedElites: 1,
    bossElapsedMs: null,
    bossReachedEnraged: false,
    completedEvents: [],
    artifacts: [],
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

function recordHistory(summary: RunSummary) {
  return recordRunResult(createStorage(), summary, 1_700_000_000_000).history
}

describe('replay target', () => {
  it('gives a first-run survival target before any history exists', () => {
    expect(createReplayTarget(createEmptyRunHistory())).toMatchObject({
      kind: 'survival',
      goalMs: 150_000,
      title: '先撑过 02:30',
    })
  })

  it('raises the survival target after a short defeat', () => {
    expect(createReplayTarget(recordHistory(createSummary({ elapsedMs: 180_000 })))).toMatchObject({
      kind: 'survival',
      goalMs: 210_000,
      title: '再撑到 03:30',
    })
  })

  it('pushes beyond the personal longest-survival record after a weaker defeat', () => {
    const storage = createStorage()
    recordRunResult(storage, createSummary({ elapsedMs: 480_000 }), 1_700_000_000_000)
    const history = recordRunResult(storage, createSummary({ elapsedMs: 30_000 }), 1_700_000_000_001).history

    expect(createReplayTarget(history)).toMatchObject({
      kind: 'survival',
      goalMs: 510_000,
      title: '再撑到 08:30',
    })
  })

  it('points to the first unfinished battlefield event after reaching the boss', () => {
    expect(createReplayTarget(recordHistory(createSummary({
      elapsedMs: 640_000,
      bossElapsedMs: 40_000,
    })))).toMatchObject({
      kind: 'event',
      eventId: 'demon-lair',
      title: '完成妖巢暴动',
    })
  })

  it('points to the boss victory after both battlefield events are complete', () => {
    expect(createReplayTarget(recordHistory(createSummary({
      elapsedMs: 700_000,
      bossElapsedMs: 100_000,
      bossReachedEnraged: true,
      completedEvents: ['demon-lair', 'lingquan'],
    })))).toMatchObject({
      kind: 'victory',
      title: '击败啸月狼王',
    })
  })

  it('asks the next run to experience 狂月 when a boss victory skipped that phase', () => {
    expect(createReplayTarget(recordHistory(createSummary({
      result: 'victory',
      elapsedMs: 620_000,
      bossElapsedMs: 20_000,
      bossReachedEnraged: false,
      completedEvents: ['demon-lair', 'lingquan'],
    })))).toMatchObject({
      kind: 'boss-enraged',
      title: '经历啸月狼王·狂月',
    })
  })

  it('keeps the original victory target after a boss-stage defeat before 狂月', () => {
    expect(createReplayTarget(recordHistory(createSummary({
      elapsedMs: 640_000,
      bossElapsedMs: 20_000,
      bossReachedEnraged: false,
      completedEvents: ['demon-lair', 'lingquan'],
    })))).toMatchObject({
      kind: 'victory',
      title: '击败啸月狼王',
    })
  })

  it('asks for a faster victory after a victory that also leads the kill record', () => {
    expect(createReplayTarget(recordHistory(createSummary({
      result: 'victory',
      elapsedMs: 660_000,
      bossElapsedMs: 60_000,
      bossReachedEnraged: true,
      defeatedEnemies: 120,
      completedEvents: ['demon-lair', 'lingquan'],
    })))).toMatchObject({
      kind: 'fast-victory',
      goalMs: 645_000,
      title: '更快镇压妖王',
    })
  })

  it('falls back to a reachable kill target when a fifteen-second speed cut would cross the ten-minute floor', () => {
    expect(createReplayTarget(recordHistory(createSummary({
      result: 'victory',
      elapsedMs: 608_000,
      bossElapsedMs: 8_000,
      bossReachedEnraged: true,
      defeatedEnemies: 120,
      completedEvents: ['demon-lair', 'lingquan'],
    })))).toMatchObject({
      kind: 'kills',
      goalCount: 135,
      title: '再斩 135 只妖物',
    })
  })

  it('does not ask for an event already completed in an earlier personal run', () => {
    const storage = createStorage()
    recordRunResult(storage, createSummary({
      elapsedMs: 640_000,
      bossElapsedMs: 40_000,
      completedEvents: ['demon-lair'],
    }), 1_700_000_000_000)
    const history = recordRunResult(storage, createSummary({
      elapsedMs: 650_000,
      bossElapsedMs: 50_000,
      completedEvents: [],
    }), 1_700_000_000_001).history

    expect(createReplayTarget(history)).toMatchObject({
      kind: 'event',
      eventId: 'lingquan',
      title: '完成灵泉涌现',
    })
  })

  it('asks for more kills when the latest victory did not lead the kill record', () => {
    const storage = createStorage()
    recordRunResult(storage, createSummary({ defeatedEnemies: 160 }), 1_700_000_000_000)
    const history = recordRunResult(storage, createSummary({
      result: 'victory',
      elapsedMs: 660_000,
      bossElapsedMs: 60_000,
      bossReachedEnraged: true,
      defeatedEnemies: 120,
      completedEvents: ['demon-lair', 'lingquan'],
    }), 1_700_000_000_001).history

    expect(createReplayTarget(history)).toMatchObject({
      kind: 'kills',
      goalCount: 175,
      title: '再斩 175 只妖物',
    })
  })

  it('asks for a different build when consecutive victories repeat the same artifacts', () => {
    const storage = createStorage()
    const artifacts = [{ id: 'qing-feng-jian-xia' as const, name: '青锋剑匣', level: 5 }]
    recordRunResult(storage, createSummary({
      result: 'victory',
      elapsedMs: 680_000,
      bossElapsedMs: 80_000,
      bossReachedEnraged: true,
      completedEvents: ['demon-lair', 'lingquan'],
      artifacts,
    }), 1_700_000_000_000)
    const history = recordRunResult(storage, createSummary({
      result: 'victory',
      elapsedMs: 660_000,
      bossElapsedMs: 60_000,
      bossReachedEnraged: true,
      completedEvents: ['demon-lair', 'lingquan'],
      artifacts,
    }), 1_700_000_000_001).history

    expect(createReplayTarget(history)).toMatchObject({
      kind: 'build',
      title: '换一条法器构筑',
      baselineArtifactIds: ['qing-feng-jian-xia'],
    })
  })

  it('also suggests a different build after consecutive short defeats', () => {
    const storage = createStorage()
    const artifacts = [{ id: 'qing-feng-jian-xia' as const, name: '青锋剑匣', level: 2 }]
    recordRunResult(storage, createSummary({ elapsedMs: 180_000, artifacts }), 1_700_000_000_000)
    const history = recordRunResult(storage, createSummary({ elapsedMs: 210_000, artifacts }), 1_700_000_000_001).history

    expect(createReplayTarget(history)).toMatchObject({
      kind: 'build',
      title: '换一条法器构筑',
    })
  })

  it('evaluates survival, event, victory, speed and kill targets from a run summary', () => {
    const summary = createSummary({
      result: 'victory',
      elapsedMs: 645_000,
      defeatedEnemies: 175,
      completedEvents: ['demon-lair'],
    })

    expect(isReplayTargetCompleted({
      id: 'survive-120000',
      kind: 'survival',
      goalMs: 120_000,
      title: '再撑到 02:00',
      description: '',
    }, summary)).toBe(true)
    expect(isReplayTargetCompleted({
      id: 'event-demon-lair',
      kind: 'event',
      eventId: 'demon-lair',
      title: '完成妖巢暴动',
      description: '',
    }, summary)).toBe(true)
    expect(isReplayTargetCompleted({
      id: 'victory',
      kind: 'victory',
      title: '击败啸月狼王',
      description: '',
    }, summary)).toBe(true)
    expect(isReplayTargetCompleted({
      id: 'fast-victory-645000',
      kind: 'fast-victory',
      goalMs: 645_000,
      title: '更快镇压妖王',
      description: '',
    }, summary)).toBe(true)
    expect(isReplayTargetCompleted({
      id: 'kills-175',
      kind: 'kills',
      goalCount: 175,
      title: '再斩 175 只妖物',
      description: '',
    }, summary)).toBe(true)
    expect(isReplayTargetCompleted({
      id: 'boss-enraged',
      kind: 'boss-enraged',
      title: '经历啸月狼王·狂月',
      description: '',
    }, { ...summary, bossReachedEnraged: true })).toBe(true)
    expect(isReplayTargetCompleted({
      id: 'build-qing-feng-jian-xia',
      kind: 'build',
      baselineArtifactIds: ['qing-feng-jian-xia'],
      title: '换一条法器构筑',
      description: '',
    }, {
      ...summary,
      artifacts: [
        { id: 'qing-feng-jian-xia', name: '青锋剑匣', level: 3 },
        { id: 'lei-zhuan-fu-ce', name: '雷篆符册', level: 1 },
      ],
    })).toBe(true)
  })
})
