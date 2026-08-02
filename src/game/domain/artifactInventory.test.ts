import { describe, expect, it } from 'vitest'
import {
  applyUpgradeChoice,
  applyAscensionChoice,
  createArtifactInventory,
  getAvailableAscensionChoices,
  generateUpgradeChoices,
  getArtifactLevel,
  getArtifactStats,
  MAX_ARTIFACT_LEVEL,
  MAX_ARTIFACT_SLOTS,
} from './artifactInventory'

describe('artifactInventory domain rules', () => {
  it('creates initial inventory with starting artifact', () => {
    const inv = createArtifactInventory('qing-feng-jian-xia')
    expect(inv.slots).toHaveLength(1)
    expect(inv.slots[0]).toEqual({ id: 'qing-feng-jian-xia', level: 1 })
    expect(getArtifactLevel(inv, 'qing-feng-jian-xia')).toBe(1)
    expect(getArtifactLevel(inv, 'lei-zhuan-fu-ce')).toBe(0)
  })

  it('generates upgrade choices respecting 4 slots limit', () => {
    const inv = createArtifactInventory('qing-feng-jian-xia')
    const choices = generateUpgradeChoices(inv, 3)

    expect(choices).toHaveLength(3)
    // qing-feng-jian-xia upgrade (Lv.1 -> Lv.2) + 2 acquire choices
    expect(choices.some((c) => c.artifactId === 'qing-feng-jian-xia' && c.type === 'upgrade')).toBe(true)
    expect(choices.filter((c) => c.type === 'acquire')).toHaveLength(2)
  })

  it('restricts upgrade candidates to owned artifacts when 4 slots are filled', () => {
    let inv = createArtifactInventory('qing-feng-jian-xia')
    inv = applyUpgradeChoice(inv, 'lei-zhuan-fu-ce')
    inv = applyUpgradeChoice(inv, 'si-xiang-zhen-qi')
    inv = applyUpgradeChoice(inv, 'fu-yao-yu-yi')

    expect(inv.slots).toHaveLength(MAX_ARTIFACT_SLOTS)

    const choices = generateUpgradeChoices(inv, 3)
    expect(choices.every((c) => c.type === 'upgrade')).toBe(true)
    expect(choices.every((c) => getArtifactLevel(inv, c.artifactId) > 0)).toBe(true)
  })

  it('does not offer upgrade choices for maxed out Lv.5 artifacts', () => {
    let inv = createArtifactInventory('qing-feng-jian-xia')
    for (let i = 1; i < MAX_ARTIFACT_LEVEL; i++) {
      inv = applyUpgradeChoice(inv, 'qing-feng-jian-xia')
    }
    expect(getArtifactLevel(inv, 'qing-feng-jian-xia')).toBe(MAX_ARTIFACT_LEVEL)

    const choices = generateUpgradeChoices(inv, 3)
    expect(choices.some((c) => c.artifactId === 'qing-feng-jian-xia')).toBe(false)
  })

  it('correctly calculates artifact stats progression for all levels', () => {
    for (let lvl = 1; lvl <= 5; lvl++) {
      const swordStats = getArtifactStats('qing-feng-jian-xia', lvl)
      expect(swordStats.damage).toBeGreaterThan(0)
      expect(swordStats.intervalMs).toBeGreaterThan(0)

      const thunderStats = getArtifactStats('lei-zhuan-fu-ce', lvl)
      expect(thunderStats.aoeRadius).toBeGreaterThan(0)
    }
  })

  it('throws when trying to acquire a 5th artifact', () => {
    let inv = createArtifactInventory('qing-feng-jian-xia')
    inv = applyUpgradeChoice(inv, 'lei-zhuan-fu-ce')
    inv = applyUpgradeChoice(inv, 'si-xiang-zhen-qi')
    inv = applyUpgradeChoice(inv, 'fu-yao-yu-yi')

    // @ts-expect-error type checking test
    expect(() => applyUpgradeChoice(inv, 'unowned-5th-artifact')).toThrow()
  })

  it('offers a public ascension recipe when both source artifacts reach Lv.5', () => {
    let inv = createArtifactInventory('qing-feng-jian-xia')
    for (let index = 1; index < MAX_ARTIFACT_LEVEL; index += 1) {
      inv = applyUpgradeChoice(inv, 'qing-feng-jian-xia')
    }
    inv = applyUpgradeChoice(inv, 'si-xiang-zhen-qi')
    for (let index = 1; index < MAX_ARTIFACT_LEVEL; index += 1) {
      inv = applyUpgradeChoice(inv, 'si-xiang-zhen-qi')
    }

    const choices = getAvailableAscensionChoices(inv)

    expect(choices).toHaveLength(1)
    expect(choices[0]).toMatchObject({
      resultId: 'zhu-xie-jian-zhen',
      sourceIds: ['qing-feng-jian-xia', 'si-xiang-zhen-qi'],
      slotCountBefore: 2,
      slotCountAfter: 1,
    })
  })

  it('consumes the two source artifacts and releases a slot after ascension', () => {
    let inv = createArtifactInventory('qing-feng-jian-xia')
    for (let index = 1; index < MAX_ARTIFACT_LEVEL; index += 1) {
      inv = applyUpgradeChoice(inv, 'qing-feng-jian-xia')
    }
    inv = applyUpgradeChoice(inv, 'si-xiang-zhen-qi')
    for (let index = 1; index < MAX_ARTIFACT_LEVEL; index += 1) {
      inv = applyUpgradeChoice(inv, 'si-xiang-zhen-qi')
    }

    const [choice] = getAvailableAscensionChoices(inv)
    expect(choice).toBeDefined()

    const ascended = applyAscensionChoice(inv, choice!.choiceId)

    expect(ascended.slots).toEqual([{ id: 'zhu-xie-jian-zhen', level: 1 }])
    expect(getArtifactLevel(ascended, 'qing-feng-jian-xia')).toBe(0)
    expect(getArtifactLevel(ascended, 'si-xiang-zhen-qi')).toBe(0)
  })
})
