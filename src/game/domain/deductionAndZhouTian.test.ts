import { describe, expect, it } from 'vitest'
import {
  applyZhouTianChoice,
  calculateTunaHeal,
  canPerformDeduction,
  createDeductionState,
  createZhouTianState,
  generateZhouTianChoices,
  MAX_ZHOU_TIAN_COUNT,
  performDeduction,
} from './deductionAndZhouTian'
import { createArtifactInventory } from './artifactInventory'
import { createUpgradeDraftState, draftUpgradeChoices } from './artifactInventory'

describe('deductionAndZhouTian domain rules', () => {
  it('deduction correctly tracks count and excludes previous candidate choices when possible', () => {
    let state = createDeductionState(1)
    expect(canPerformDeduction(state)).toBe(true)

    const inv = createArtifactInventory('qing-feng-jian-xia')
    const initialChoices = [
      {
        choiceId: 'acquire-lei-zhuan-fu-ce',
        type: 'acquire' as const,
        artifactId: 'lei-zhuan-fu-ce' as const,
        name: '雷篆符册',
        description: '',
        currentLevel: 0,
        targetLevel: 1,
        statsDescription: '',
        attackColor: 0,
      },
    ]

    const result = performDeduction(state, initialChoices, inv)
    expect(result.nextState.remainingCount).toBe(0)
    expect(canPerformDeduction(result.nextState)).toBe(false)
    expect(result.newChoices.some((c) => c.choiceId === 'acquire-lei-zhuan-fu-ce')).toBe(false)

    expect(() => performDeduction(result.nextState, initialChoices, inv)).toThrow('推演次数已用尽。')
  })

  it('does not immediately repeat any of the three cards just abandoned', () => {
    const inventory = createArtifactInventory('qing-feng-jian-xia')
    const draftState = createUpgradeDraftState(42)
    const current = draftUpgradeChoices(inventory, draftState).choices

    const result = performDeduction(createDeductionState(1), current, inventory, draftState)

    expect(result.newChoices.length).toBeGreaterThan(0)
    expect(result.newChoices.every(
      (choice) => !current.some((abandoned) => abandoned.choiceId === choice.choiceId),
    )).toBe(true)
  })

  it('calculateTunaHeal restores 15% of max HP', () => {
    expect(calculateTunaHeal(100)).toBe(15)
    expect(calculateTunaHeal(200)).toBe(30)
    expect(calculateTunaHeal(50)).toBe(7)
  })

  it('generateZhouTianChoices offers yu-qi, xing-qi, and lian-ti options up to 3 times each', () => {
    let state = createZhouTianState()
    let choices = generateZhouTianChoices(state)
    expect(choices).toHaveLength(3)

    // Apply yu-qi 3 times
    for (let i = 0; i < MAX_ZHOU_TIAN_COUNT; i++) {
      const res = applyZhouTianChoice(state, 'yu-qi')
      state = res.nextState
      expect(res.damageMultiplierDelta).toBe(0.06)
    }

    choices = generateZhouTianChoices(state)
    expect(choices).toHaveLength(2)
    expect(choices.some((c) => c.choiceId === 'yu-qi')).toBe(false)

    // Verify throwing if applying yu-qi a 4th time
    expect(() => applyZhouTianChoice(state, 'yu-qi')).toThrow()

    // Apply xing-qi and lian-ti 3 times each
    for (let i = 0; i < MAX_ZHOU_TIAN_COUNT; i++) {
      const xingQi = applyZhouTianChoice(state, 'xing-qi')
      expect(xingQi.attackIntervalMultiplierDelta).toBe(-0.05)
      state = xingQi.nextState
      const lianTi = applyZhouTianChoice(state, 'lian-ti')
      expect(lianTi.maxHealthMultiplierDelta).toBe(0.08)
      state = lianTi.nextState
    }

    choices = generateZhouTianChoices(state)
    expect(choices).toHaveLength(0)
  })
})
