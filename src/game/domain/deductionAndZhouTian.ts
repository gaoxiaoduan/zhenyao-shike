import type { ArtifactInventory, UpgradeChoice } from './artifactInventory'
import { generateUpgradeChoices } from './artifactInventory'

export interface DeductionState {
  readonly remainingCount: number
}

export function createDeductionState(initialCount = 1): DeductionState {
  return {
    remainingCount: Math.max(0, initialCount),
  }
}

export function canPerformDeduction(state: DeductionState): boolean {
  return state.remainingCount > 0
}

export function performDeduction(
  state: DeductionState,
  currentChoices: readonly UpgradeChoice[],
  inventory: ArtifactInventory,
): {
  readonly nextState: DeductionState
  readonly newChoices: readonly UpgradeChoice[]
} {
  if (!canPerformDeduction(state)) {
    throw new Error('推演次数已用尽。')
  }

  const allChoices = generateUpgradeChoices(inventory, 10)
  const currentChoiceIds = new Set(currentChoices.map((c) => c.choiceId))

  let filtered = allChoices.filter((c) => !currentChoiceIds.has(c.choiceId))
  if (filtered.length === 0) {
    filtered = [...allChoices]
  }

  const newChoices = filtered.slice(0, 3)

  return {
    nextState: {
      remainingCount: state.remainingCount - 1,
    },
    newChoices,
  }
}

export function calculateTunaHeal(maxHealth: number): number {
  return Math.max(1, Math.floor(maxHealth * 0.15))
}

export type ZhouTianOptionId = 'yu-qi' | 'xing-qi' | 'lian-ti'

export interface ZhouTianOption {
  readonly choiceId: ZhouTianOptionId
  readonly name: string
  readonly description: string
  readonly statsDescription: string
  readonly count: number
  readonly maxCount: number
}

export interface ZhouTianState {
  readonly yuQiCount: number
  readonly xingQiCount: number
  readonly lianTiCount: number
}

export const MAX_ZHOU_TIAN_COUNT = 3

export function createZhouTianState(): ZhouTianState {
  return {
    yuQiCount: 0,
    xingQiCount: 0,
    lianTiCount: 0,
  }
}

export function generateZhouTianChoices(state: ZhouTianState): readonly ZhouTianOption[] {
  const options: ZhouTianOption[] = []

  if (state.yuQiCount < MAX_ZHOU_TIAN_COUNT) {
    options.push({
      choiceId: 'yu-qi',
      name: '周天运转 · 御器',
      description: '引导灵气贯通法器，全品阶法器基础伤害提升 10%。',
      statsDescription: `已选择 ${state.yuQiCount}/${MAX_ZHOU_TIAN_COUNT} · 伤害 +10%`,
      count: state.yuQiCount,
      maxCount: MAX_ZHOU_TIAN_COUNT,
    })
  }

  if (state.xingQiCount < MAX_ZHOU_TIAN_COUNT) {
    options.push({
      choiceId: 'xing-qi',
      name: '周天运转 · 行气',
      description: '身法游龙轻盈，主角移动速度提升 8%。',
      statsDescription: `已选择 ${state.xingQiCount}/${MAX_ZHOU_TIAN_COUNT} · 移速 +8%`,
      count: state.xingQiCount,
      maxCount: MAX_ZHOU_TIAN_COUNT,
    })
  }

  if (state.lianTiCount < MAX_ZHOU_TIAN_COUNT) {
    options.push({
      choiceId: 'lian-ti',
      name: '周天运转 · 炼体',
      description: '强健气血根基，最大生命值提升 15% 并回复等量生命。',
      statsDescription: `已选择 ${state.lianTiCount}/${MAX_ZHOU_TIAN_COUNT} · 生命 +15%`,
      count: state.lianTiCount,
      maxCount: MAX_ZHOU_TIAN_COUNT,
    })
  }

  return options
}

export function applyZhouTianChoice(
  state: ZhouTianState,
  optionId: ZhouTianOptionId,
): {
  readonly nextState: ZhouTianState
  readonly damageMultiplierDelta: number
  readonly moveSpeedMultiplierDelta: number
  readonly maxHealthMultiplierDelta: number
} {
  if (optionId === 'yu-qi') {
    if (state.yuQiCount >= MAX_ZHOU_TIAN_COUNT) {
      throw new RangeError('御器强化已达到上限 (3/3)。')
    }
    return {
      nextState: { ...state, yuQiCount: state.yuQiCount + 1 },
      damageMultiplierDelta: 0.1,
      moveSpeedMultiplierDelta: 0,
      maxHealthMultiplierDelta: 0,
    }
  }

  if (optionId === 'xing-qi') {
    if (state.xingQiCount >= MAX_ZHOU_TIAN_COUNT) {
      throw new RangeError('行气强化已达到上限 (3/3)。')
    }
    return {
      nextState: { ...state, xingQiCount: state.xingQiCount + 1 },
      damageMultiplierDelta: 0,
      moveSpeedMultiplierDelta: 0.08,
      maxHealthMultiplierDelta: 0,
    }
  }

  if (optionId === 'lian-ti') {
    if (state.lianTiCount >= MAX_ZHOU_TIAN_COUNT) {
      throw new RangeError('炼体强化已达到上限 (3/3)。')
    }
    return {
      nextState: { ...state, lianTiCount: state.lianTiCount + 1 },
      damageMultiplierDelta: 0,
      moveSpeedMultiplierDelta: 0,
      maxHealthMultiplierDelta: 0.15,
    }
  }

  throw new Error(`未知的周天运转选项: ${optionId}`)
}
