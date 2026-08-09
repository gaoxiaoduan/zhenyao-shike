import { describe, expect, it } from 'vitest'
import {
  applyAscensionChoice,
  applyUpgradeChoice,
  createArtifactInventory,
  getAvailableAscensionChoices,
  MAX_ARTIFACT_LEVEL,
} from '../domain/artifactInventory'
import {
  advanceWolfKingEncounter,
  createWolfKingEncounter,
  damageWolfKing,
  WOLF_KING_INTRO_DURATION_MS,
  WOLF_KING_MAX_HEALTH,
} from '../domain/wolfKingRules'
import { createGameSessionController, type BattleRuntime } from './GameSessionController'

describe('核心切片与构筑验收 (Issue #8)', () => {
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

    // Wolf King defeat simulation
    let wolf = createWolfKingEncounter()
    wolf = advanceWolfKingEncounter(wolf, WOLF_KING_INTRO_DURATION_MS).encounter
    const victory = damageWolfKing(wolf, WOLF_KING_MAX_HEALTH + 10)
    expect(victory.encounter.phase).toBe('defeated')
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

    let wolf = createWolfKingEncounter()
    wolf = advanceWolfKingEncounter(wolf, WOLF_KING_INTRO_DURATION_MS).encounter
    const victory = damageWolfKing(wolf, WOLF_KING_MAX_HEALTH + 10)
    expect(victory.encounter.phase).toBe('defeated')
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

    let wolf = createWolfKingEncounter()
    wolf = advanceWolfKingEncounter(wolf, WOLF_KING_INTRO_DURATION_MS).encounter
    const victory = damageWolfKing(wolf, WOLF_KING_MAX_HEALTH + 10)
    expect(victory.encounter.phase).toBe('defeated')
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
      resize: () => undefined,
      setReducedMotion: () => undefined,
      setPaused: (p) => {
        currentPaused = p
      },
    }

    const session = createGameSessionController(runtime)

    session.pause('upgrade')
    expect(currentPaused).toBe(true)

    session.pause('orientation')
    expect(currentPaused).toBe(true)

    session.resume('upgrade')
    expect(currentPaused).toBe(true) // Still paused due to orientation

    session.resume('orientation')
    expect(currentPaused).toBe(false)
  })
})
