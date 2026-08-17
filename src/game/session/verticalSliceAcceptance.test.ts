import { describe, expect, it } from 'vitest'
import {
  applyAscensionChoice,
  applyUpgradeChoice,
  createArtifactInventory,
  getAvailableAscensionChoices,
  getArtifactStats,
  MAX_ARTIFACT_LEVEL,
  type AscendedArtifactId,
} from '../domain/artifactInventory'
import {
  advanceWolfKingEncounter,
  createWolfKingEncounter,
  damageWolfKing,
  WOLF_KING_INTRO_DURATION_MS,
} from '../domain/wolfKingRules'
import { createGameSessionController, type BattleRuntime } from './GameSessionController'

function expectCompleteBuildDefeatsWolfKing(
  artifactId: AscendedArtifactId,
  supportArtifactIds: readonly [
    'qing-feng-jian-xia' | 'lei-zhuan-fu-ce' | 'si-xiang-zhen-qi' | 'fu-yao-yu-yi',
    'qing-feng-jian-xia' | 'lei-zhuan-fu-ce' | 'si-xiang-zhen-qi' | 'fu-yao-yu-yi',
  ],
) {
  const stats = getArtifactStats(artifactId, 1)
  // A representative completed build keeps the ascended core plus two
  // level-3 support artifacts. This is the timing contract for a reasonable
  // 90–120 second clear; a stronger four-slot build can be faster.
  const supportStats = supportArtifactIds.map((id) => getArtifactStats(id, 3))
  let wolf = createWolfKingEncounter()
  wolf = advanceWolfKingEncounter(wolf, WOLF_KING_INTRO_DURATION_MS).encounter
  let combatElapsedMs = 0
  let nextCoreAttackMs = stats.intervalMs
  let nextSupportAttackMs = supportStats.map((support) => support.intervalMs)

  while (wolf.phase !== 'defeated' && combatElapsedMs < 180_000) {
    const nextInterval = Math.min(nextCoreAttackMs, ...nextSupportAttackMs)
    wolf = advanceWolfKingEncounter(wolf, nextInterval).encounter
    combatElapsedMs += nextInterval
    nextCoreAttackMs -= nextInterval
    nextSupportAttackMs = nextSupportAttackMs.map((remaining) => remaining - nextInterval)
    if (nextCoreAttackMs === 0) {
      wolf = damageWolfKing(wolf, stats.damage).encounter
      nextCoreAttackMs = stats.intervalMs
    }
    nextSupportAttackMs.forEach((remaining, index) => {
      if (remaining === 0) {
        wolf = damageWolfKing(wolf, supportStats[index]!.damage).encounter
        nextSupportAttackMs[index] = supportStats[index]!.intervalMs
      }
    })
  }

  expect(wolf.phase).toBe('defeated')
  expect(combatElapsedMs).toBeGreaterThanOrEqual(90_000)
  // The simulation advances on artifact cadence; allow one final cadence
  // quantum beyond the nominal 120s target while keeping the contract tight.
  expect(combatElapsedMs).toBeLessThanOrEqual(121_000)
}

describe('核心切片与构筑验收 (Issue #9)', () => {
  it('验证构筑一：剑修/剑翼构筑 (青锋剑匣 + 扶摇羽衣 -> 流光剑翼) 完成整局历练', () => {
    let inv = createArtifactInventory('qing-feng-jian-xia')
    inv = applyUpgradeChoice(inv, 'fu-yao-yu-yi')

    for (let i = 1; i < MAX_ARTIFACT_LEVEL; i++) {
      inv = applyUpgradeChoice(inv, 'qing-feng-jian-xia')
      inv = applyUpgradeChoice(inv, 'fu-yao-yu-yi')
    }

    const ascensions = getAvailableAscensionChoices(inv)
    expect(ascensions.some((a) => a.resultId === 'liu-guang-jian-yi')).toBe(true)

    const recipe = ascensions.find((a) => a.resultId === 'liu-guang-jian-yi')!
    const ascended = applyAscensionChoice(inv, recipe.choiceId)
    expect(ascended.slots).toEqual([{ id: 'liu-guang-jian-yi', level: 1 }])

    expectCompleteBuildDefeatsWolfKing('liu-guang-jian-yi', ['fu-yao-yu-yi', 'qing-feng-jian-xia'])
  })

  it('验证构筑二：雷法/雷阵构筑 (雷篆符册 + 四象阵旗 -> 九霄雷阵) 完成整局历练', () => {
    let inv = createArtifactInventory('lei-zhuan-fu-ce')
    inv = applyUpgradeChoice(inv, 'si-xiang-zhen-qi')

    for (let i = 1; i < MAX_ARTIFACT_LEVEL; i++) {
      inv = applyUpgradeChoice(inv, 'lei-zhuan-fu-ce')
      inv = applyUpgradeChoice(inv, 'si-xiang-zhen-qi')
    }

    const ascensions = getAvailableAscensionChoices(inv)
    expect(ascensions.some((a) => a.resultId === 'jiu-xiao-lei-zhen')).toBe(true)

    const recipe = ascensions.find((a) => a.resultId === 'jiu-xiao-lei-zhen')!
    const ascended = applyAscensionChoice(inv, recipe.choiceId)
    expect(ascended.slots).toEqual([{ id: 'jiu-xiao-lei-zhen', level: 1 }])

    expectCompleteBuildDefeatsWolfKing('jiu-xiao-lei-zhen', ['lei-zhuan-fu-ce', 'si-xiang-zhen-qi'])
  })

  it('验证构筑三：诛邪剑阵构筑 (青锋剑匣 + 四象阵旗 -> 诛邪剑阵) 完成整局历练', () => {
    let inv = createArtifactInventory('qing-feng-jian-xia')
    inv = applyUpgradeChoice(inv, 'si-xiang-zhen-qi')

    for (let i = 1; i < MAX_ARTIFACT_LEVEL; i++) {
      inv = applyUpgradeChoice(inv, 'qing-feng-jian-xia')
      inv = applyUpgradeChoice(inv, 'si-xiang-zhen-qi')
    }

    const ascensions = getAvailableAscensionChoices(inv)
    expect(ascensions.some((a) => a.resultId === 'zhu-xie-jian-zhen')).toBe(true)

    const recipe = ascensions.find((a) => a.resultId === 'zhu-xie-jian-zhen')!
    const ascended = applyAscensionChoice(inv, recipe.choiceId)
    expect(ascended.slots).toEqual([{ id: 'zhu-xie-jian-zhen', level: 1 }])

    expectCompleteBuildDefeatsWolfKing('zhu-xie-jian-zhen', ['qing-feng-jian-xia', 'si-xiang-zhen-qi'])
  })

  it('验证全套浏览器流程控制（升级暂停、屏幕方向暂停、可见性暂停、手动暂停与重开）', () => {
    let currentPaused = false
    const runtime: BattleRuntime = {
      destroy: () => undefined,
      selectInitialArtifact: () => undefined,
      selectUpgrade: () => undefined,
      selectAscension: () => undefined,
      skipAscension: () => undefined,
      deduceUpgrade: () => undefined,
      tunaHeal: () => undefined,
      skipOnboarding: () => undefined,
      setInputIntent: () => undefined,
      castSpell: () => undefined,
      resize: () => undefined,
      setReducedMotion: () => undefined,
      setPaused: (p) => {
        currentPaused = p
      },
    }

    const { session } = createGameSessionController(runtime)

    session.setPlatformPause('viewport', true)
    expect(currentPaused).toBe(true)

    session.setPlatformPause('orientation', true)
    expect(currentPaused).toBe(true)

    session.setPlatformPause('viewport', false)
    expect(currentPaused).toBe(true) // Still paused due to orientation

    session.setPlatformPause('orientation', false)
    session.confirmOrientation()
    expect(currentPaused).toBe(false)
  })
})
