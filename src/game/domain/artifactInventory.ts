import type { BaseArtifactId } from './initialArtifactSelection'

export const MAX_ARTIFACT_SLOTS = 4
export const MAX_ARTIFACT_LEVEL = 5
export const MAX_ASCENDED_ARTIFACTS = 2

export type AscendedArtifactId =
  | 'zhu-xie-jian-zhen'
  | 'liu-guang-jian-yi'
  | 'jiu-xiao-lei-zhen'

export type ArtifactId = BaseArtifactId | AscendedArtifactId

export interface ArtifactStats {
  readonly damage: number
  readonly intervalMs: number
  readonly moveSpeedMultiplier: number
  readonly aoeRadius: number
}

export interface ArtifactDefinition {
  readonly id: ArtifactId
  readonly name: string
  readonly description: string
  readonly attackColor: number
  readonly getStats: (level: number) => ArtifactStats
}

export const ARTIFACT_DEFINITIONS: Record<ArtifactId, ArtifactDefinition> = {
  'qing-feng-jian-xia': {
    id: 'qing-feng-jian-xia',
    name: '青锋剑匣',
    description: '自动锁定最近妖物，连续放出飞剑。擅长高频穿透与单体打击。',
    attackColor: 0xe9d5ff,
    getStats: (level: number) => {
      const lvl = Math.min(Math.max(1, level), MAX_ARTIFACT_LEVEL)
      const damages = [12, 16, 20, 26, 34]
      const intervals = [420, 390, 360, 330, 300]
      return {
        damage: damages[lvl - 1] ?? 12,
        intervalMs: intervals[lvl - 1] ?? 420,
        moveSpeedMultiplier: 1.0,
        aoeRadius: 0,
      }
    },
  },
  'lei-zhuan-fu-ce': {
    id: 'lei-zhuan-fu-ce',
    name: '雷篆符册',
    description: '自动向妖群密集处投放雷符，爆炸造成范围毁灭打击。',
    attackColor: 0xfde68a,
    getStats: (level: number) => {
      const lvl = Math.min(Math.max(1, level), MAX_ARTIFACT_LEVEL)
      const damages = [20, 28, 38, 50, 66]
      const intervals = [720, 660, 600, 540, 480]
      const radiuses = [48, 56, 66, 78, 92]
      return {
        damage: damages[lvl - 1] ?? 20,
        intervalMs: intervals[lvl - 1] ?? 720,
        moveSpeedMultiplier: 1.0,
        aoeRadius: radiuses[lvl - 1] ?? 48,
      }
    },
  },
  'si-xiang-zhen-qi': {
    id: 'si-xiang-zhen-qi',
    name: '四象阵旗',
    description: '在主角四周展开四象法阵，周期性扫荡靠近的敌人。',
    attackColor: 0xa7f3d0,
    getStats: (level: number) => {
      const lvl = Math.min(Math.max(1, level), MAX_ARTIFACT_LEVEL)
      const damages = [8, 12, 17, 23, 30]
      const intervals = [500, 450, 400, 350, 300]
      const radiuses = [68, 78, 90, 104, 120]
      return {
        damage: damages[lvl - 1] ?? 8,
        intervalMs: intervals[lvl - 1] ?? 500,
        moveSpeedMultiplier: 1.0,
        aoeRadius: radiuses[lvl - 1] ?? 68,
      }
    },
  },
  'fu-yao-yu-yi': {
    id: 'fu-yao-yu-yi',
    name: '扶摇羽衣',
    description: '提升移动速度，并在行进中不断向周围切出清场风刃。',
    attackColor: 0x7dd3fc,
    getStats: (level: number) => {
      const lvl = Math.min(Math.max(1, level), MAX_ARTIFACT_LEVEL)
      const damages = [10, 14, 19, 25, 32]
      const intervals = [460, 420, 380, 340, 300]
      const speeds = [1.35, 1.40, 1.45, 1.50, 1.60]
      return {
        damage: damages[lvl - 1] ?? 10,
        intervalMs: intervals[lvl - 1] ?? 460,
        moveSpeedMultiplier: speeds[lvl - 1] ?? 1.35,
        aoeRadius: 0,
      }
    },
  },
  'zhu-xie-jian-zhen': {
    id: 'zhu-xie-jian-zhen',
    name: '诛邪剑阵',
    description: '青锋与四象合流，剑阵覆盖周身并周期性斩落妖群。已成型，不再升级。',
    attackColor: 0xf0abfc,
    getStats: () => ({
      damage: 68,
      intervalMs: 320,
      moveSpeedMultiplier: 1,
      aoeRadius: 112,
    }),
  },
  'liu-guang-jian-yi': {
    id: 'liu-guang-jian-yi',
    name: '流光剑翼',
    description: '青锋化作六翼流光，提升身法并向四方投射穿透剑芒。已成型，不再升级。',
    attackColor: 0x93c5fd,
    getStats: () => ({
      damage: 52,
      intervalMs: 360,
      moveSpeedMultiplier: 1.7,
      aoeRadius: 0,
    }),
  },
  'jiu-xiao-lei-zhen': {
    id: 'jiu-xiao-lei-zhen',
    name: '九霄雷阵',
    description: '雷篆引动四象天威，在最密集处降下范围雷击。已成型，不再升级。',
    attackColor: 0xfef08a,
    getStats: () => ({
      damage: 132,
      intervalMs: 900,
      moveSpeedMultiplier: 1,
      aoeRadius: 172,
    }),
  },
}

export interface ArtifactSlot {
  readonly id: ArtifactId
  readonly level: number
}

export interface ArtifactInventory {
  readonly slots: readonly ArtifactSlot[]
}

export interface UpgradeChoice {
  readonly choiceId: string
  readonly type: 'acquire' | 'upgrade'
  readonly artifactId: BaseArtifactId
  readonly name: string
  readonly description: string
  readonly currentLevel: number
  readonly targetLevel: number
  readonly statsDescription: string
  readonly attackColor: number
}

export type FlexibleUpgradeChoiceId = 'flex-sharpen' | 'flex-circulate' | 'flex-fortify'

export interface FlexibleUpgradeChoice {
  readonly choiceId: FlexibleUpgradeChoiceId
  readonly type: 'flex'
  readonly name: string
  readonly description: string
  readonly currentRank: number
  readonly targetRank: number
  readonly statsDescription: string
}

export type UpgradeDraftChoice = UpgradeChoice | FlexibleUpgradeChoice

export interface AscensionRecipe {
  readonly choiceId: string
  readonly sourceIds: readonly [BaseArtifactId, BaseArtifactId]
  readonly resultId: AscendedArtifactId
  readonly name: string
  readonly description: string
  readonly sourceNames: readonly [string, string]
  readonly slotCountBefore: number
  readonly slotCountAfter: number
  readonly attackColor: number
}

const ASCENSION_RECIPES: readonly AscensionRecipe[] = [
  {
    choiceId: 'ascend-qing-feng-si-xiang',
    sourceIds: ['qing-feng-jian-xia', 'si-xiang-zhen-qi'],
    resultId: 'zhu-xie-jian-zhen',
    name: ARTIFACT_DEFINITIONS['zhu-xie-jian-zhen'].name,
    description: ARTIFACT_DEFINITIONS['zhu-xie-jian-zhen'].description,
    sourceNames: [
      ARTIFACT_DEFINITIONS['qing-feng-jian-xia'].name,
      ARTIFACT_DEFINITIONS['si-xiang-zhen-qi'].name,
    ],
    slotCountBefore: 2,
    slotCountAfter: 1,
    attackColor: ARTIFACT_DEFINITIONS['zhu-xie-jian-zhen'].attackColor,
  },
  {
    choiceId: 'ascend-qing-feng-fu-yao',
    sourceIds: ['qing-feng-jian-xia', 'fu-yao-yu-yi'],
    resultId: 'liu-guang-jian-yi',
    name: ARTIFACT_DEFINITIONS['liu-guang-jian-yi'].name,
    description: ARTIFACT_DEFINITIONS['liu-guang-jian-yi'].description,
    sourceNames: [
      ARTIFACT_DEFINITIONS['qing-feng-jian-xia'].name,
      ARTIFACT_DEFINITIONS['fu-yao-yu-yi'].name,
    ],
    slotCountBefore: 2,
    slotCountAfter: 1,
    attackColor: ARTIFACT_DEFINITIONS['liu-guang-jian-yi'].attackColor,
  },
  {
    choiceId: 'ascend-lei-zhuan-si-xiang',
    sourceIds: ['lei-zhuan-fu-ce', 'si-xiang-zhen-qi'],
    resultId: 'jiu-xiao-lei-zhen',
    name: ARTIFACT_DEFINITIONS['jiu-xiao-lei-zhen'].name,
    description: ARTIFACT_DEFINITIONS['jiu-xiao-lei-zhen'].description,
    sourceNames: [
      ARTIFACT_DEFINITIONS['lei-zhuan-fu-ce'].name,
      ARTIFACT_DEFINITIONS['si-xiang-zhen-qi'].name,
    ],
    slotCountBefore: 2,
    slotCountAfter: 1,
    attackColor: ARTIFACT_DEFINITIONS['jiu-xiao-lei-zhen'].attackColor,
  },
]

export function createArtifactInventory(initialArtifactId?: BaseArtifactId): ArtifactInventory {
  if (!initialArtifactId) {
    return { slots: [] }
  }
  return {
    slots: [{ id: initialArtifactId, level: 1 }],
  }
}

export function getArtifactLevel(inventory: ArtifactInventory, artifactId: ArtifactId): number {
  const found = inventory.slots.find((slot) => slot.id === artifactId)
  return found ? found.level : 0
}

export function getArtifactStats(artifactId: ArtifactId, level: number): ArtifactStats {
  return ARTIFACT_DEFINITIONS[artifactId].getStats(level)
}

export function isAscendedArtifactId(artifactId: ArtifactId): artifactId is AscendedArtifactId {
  return (
    artifactId === 'zhu-xie-jian-zhen' ||
    artifactId === 'liu-guang-jian-yi' ||
    artifactId === 'jiu-xiao-lei-zhen'
  )
}

export function getAvailableAscensionChoices(
  inventory: ArtifactInventory,
): readonly AscensionRecipe[] {
  const ascendedCount = inventory.slots.filter((slot) => isAscendedArtifactId(slot.id)).length
  if (ascendedCount >= MAX_ASCENDED_ARTIFACTS) {
    return []
  }

  return ASCENSION_RECIPES.filter((recipe) => {
    if (inventory.slots.some((slot) => slot.id === recipe.resultId)) {
      return false
    }

    return recipe.sourceIds.every((artifactId) => getArtifactLevel(inventory, artifactId) >= MAX_ARTIFACT_LEVEL)
  })
}

export function applyAscensionChoice(
  inventory: ArtifactInventory,
  choiceId: string,
): ArtifactInventory {
  const recipe = ASCENSION_RECIPES.find((candidate) => candidate.choiceId === choiceId)
  if (!recipe || !getAvailableAscensionChoices(inventory).some((choice) => choice.choiceId === choiceId)) {
    throw new RangeError('所选升阶配方当前不可用。')
  }

  return {
    slots: [
      ...inventory.slots.filter((slot) => !recipe.sourceIds.some((sourceId) => sourceId === slot.id)),
      { id: recipe.resultId, level: 1 },
    ],
  }
}

export function generateUpgradeChoices(
  inventory: ArtifactInventory,
  count = 3,
): readonly UpgradeChoice[] {
  const choices: UpgradeChoice[] = []
  const allIds: BaseArtifactId[] = [
    'qing-feng-jian-xia',
    'lei-zhuan-fu-ce',
    'si-xiang-zhen-qi',
    'fu-yao-yu-yi',
  ]

  const slotsFull = inventory.slots.length >= MAX_ARTIFACT_SLOTS

  for (const id of allIds) {
    const currentLevel = getArtifactLevel(inventory, id)
    const def = ARTIFACT_DEFINITIONS[id]

    if (currentLevel === 0) {
      if (!slotsFull) {
        const stats = def.getStats(1)
        let statsDesc = `获得法器 · 伤害 ${stats.damage}`
        if (stats.aoeRadius > 0) {
          statsDesc += ` · 范围 ${stats.aoeRadius}`
        }
        if (stats.moveSpeedMultiplier > 1) {
          statsDesc += ` · 移速 +${Math.round((stats.moveSpeedMultiplier - 1) * 100)}%`
        }

        choices.push({
          choiceId: `acquire-${id}`,
          type: 'acquire',
          artifactId: id,
          name: def.name,
          description: def.description,
          currentLevel: 0,
          targetLevel: 1,
          statsDescription: statsDesc,
          attackColor: def.attackColor,
        })
      }
    } else if (currentLevel < MAX_ARTIFACT_LEVEL) {
      const nextLevel = currentLevel + 1
      const nextStats = def.getStats(nextLevel)
      let statsDesc = `Lv.${currentLevel} ➔ Lv.${nextLevel} · 伤害 ${nextStats.damage}`
      if (nextStats.aoeRadius > 0) {
        statsDesc += ` · 范围 ${nextStats.aoeRadius}`
      }
      if (nextStats.moveSpeedMultiplier > 1) {
        statsDesc += ` · 移速 +${Math.round((nextStats.moveSpeedMultiplier - 1) * 100)}%`
      }

      choices.push({
        choiceId: `upgrade-${id}`,
        type: 'upgrade',
        artifactId: id,
        name: def.name,
        description: def.description,
        currentLevel,
        targetLevel: nextLevel,
        statsDescription: statsDesc,
        attackColor: def.attackColor,
      })
    }
  }

  return choices.slice(0, count)
}

export interface UpgradeDraftState {
  readonly seed: number
  readonly missedOwnedUpgrades: Readonly<Partial<Record<BaseArtifactId, number>>>
  readonly flexibleRanks: Readonly<Partial<Record<FlexibleUpgradeChoiceId, number>>>
}

export interface UpgradeDraftOptions {
  readonly count?: number
  readonly excludedChoiceIds?: readonly string[]
}

export function createUpgradeDraftState(seed: number): UpgradeDraftState {
  return {
    seed: normalizeSeed(seed),
    missedOwnedUpgrades: {},
    flexibleRanks: {},
  }
}

function generateFlexibleUpgradeChoices(state: UpgradeDraftState): readonly FlexibleUpgradeChoice[] {
  const definitions: readonly Omit<FlexibleUpgradeChoice, 'currentRank' | 'targetRank'>[] = [
    {
      choiceId: 'flex-sharpen',
      type: 'flex',
      name: '临战机缘 · 砺锋',
      description: '不改变法器槽位，小幅淬炼本局所有法器的锋锐。',
      statsDescription: '全法器伤害 +3% · 最多参悟 3 次',
    },
    {
      choiceId: 'flex-circulate',
      type: 'flex',
      name: '临战机缘 · 周流',
      description: '不改变法器槽位，小幅加快本局所有法器的灵气周转。',
      statsDescription: '全法器攻击间隔 -3% · 最多参悟 3 次',
    },
    {
      choiceId: 'flex-fortify',
      type: 'flex',
      name: '临战机缘 · 固元',
      description: '不改变法器槽位，小幅强健气血并回复等量生命。',
      statsDescription: '最大生命 +4% 并回复等量生命 · 最多参悟 3 次',
    },
  ]

  return definitions.flatMap((definition) => {
    const currentRank = state.flexibleRanks[definition.choiceId] ?? 0
    return currentRank >= 3
      ? []
      : [{ ...definition, currentRank, targetRank: currentRank + 1 }]
  })
}

export function draftUpgradeChoices(
  inventory: ArtifactInventory,
  state: UpgradeDraftState,
  options: UpgradeDraftOptions = {},
): { readonly choices: readonly UpgradeDraftChoice[]; readonly nextState: UpgradeDraftState } {
  const count = Math.max(0, Math.floor(options.count ?? 3))
  const artifactChoices = [...generateUpgradeChoices(inventory, Number.POSITIVE_INFINITY)]
  const flexibleChoices = artifactChoices.length > 0 ? generateFlexibleUpgradeChoices(state) : []
  const allChoices: UpgradeDraftChoice[] = [...artifactChoices, ...flexibleChoices]
  const excludedIds = new Set(options.excludedChoiceIds ?? [])
  const preferredPool = allChoices.filter((choice) => !excludedIds.has(choice.choiceId))
  const pool = preferredPool.length > 0 ? preferredPool : allChoices
  const selected: UpgradeDraftChoice[] = []
  let seed = normalizeSeed(state.seed)

  function takeChoice(candidates: readonly UpgradeDraftChoice[]) {
    const remaining = candidates.filter(
      (choice) => pool.some((candidate) => candidate.choiceId === choice.choiceId)
        && !selected.some((picked) => picked.choiceId === choice.choiceId),
    )
    if (remaining.length === 0 || selected.length >= count) {
      return
    }
    const random = nextSeededFloat(seed)
    seed = random.seed
    const totalWeight = remaining.reduce((sum, choice) => sum + (choice.type === 'upgrade' ? 1.25 : choice.type === 'flex' ? 0.9 : 1), 0)
    let cursor = random.value * totalWeight
    const picked = remaining.find((choice) => {
      cursor -= choice.type === 'upgrade' ? 1.25 : choice.type === 'flex' ? 0.9 : 1
      return cursor <= 0
    }) ?? remaining[remaining.length - 1]!
    selected.push(picked)
  }

  const pityChoices = pool
    .filter((choice): choice is UpgradeChoice => choice.type === 'upgrade')
    .filter((choice) => (state.missedOwnedUpgrades[choice.artifactId] ?? 0) >= 3)
    .sort((left, right) => left.artifactId.localeCompare(right.artifactId))
  if (pityChoices[0]) {
    selected.push(pityChoices[0])
  }

  if (!selected.some((choice) => choice.type === 'upgrade')) {
    takeChoice(pool.filter((choice) => choice.type === 'upgrade'))
  }
  takeChoice(pool.filter((choice) => choice.type === 'acquire'))
  takeChoice(pool.filter((choice) => choice.type === 'flex'))
  while (selected.length < Math.min(count, pool.length)) {
    takeChoice(pool)
  }

  const nextMisses: Partial<Record<BaseArtifactId, number>> = {}
  for (const choice of artifactChoices) {
    if (choice.type !== 'upgrade') {
      continue
    }
    nextMisses[choice.artifactId] = selected.some(
      (picked) => picked.type !== 'flex' && picked.artifactId === choice.artifactId,
    )
      ? 0
      : (state.missedOwnedUpgrades[choice.artifactId] ?? 0) + 1
  }

  return {
    choices: selected,
    nextState: {
      seed,
      missedOwnedUpgrades: nextMisses,
      flexibleRanks: state.flexibleRanks,
    },
  }
}

export function applyFlexibleUpgradeChoice(
  state: UpgradeDraftState,
  choiceId: FlexibleUpgradeChoiceId,
): {
  readonly nextState: UpgradeDraftState
  readonly damageMultiplierDelta: number
  readonly attackIntervalMultiplierDelta: number
  readonly maxHealthMultiplierDelta: number
} {
  const currentRank = state.flexibleRanks[choiceId] ?? 0
  if (currentRank >= 3) {
    throw new Error('该临战机缘已达上限。')
  }

  return {
    nextState: {
      ...state,
      flexibleRanks: { ...state.flexibleRanks, [choiceId]: currentRank + 1 },
    },
    damageMultiplierDelta: choiceId === 'flex-sharpen' ? 0.03 : 0,
    attackIntervalMultiplierDelta: choiceId === 'flex-circulate' ? -0.03 : 0,
    maxHealthMultiplierDelta: choiceId === 'flex-fortify' ? 0.04 : 0,
  }
}

function normalizeSeed(seed: number): number {
  const normalized = Math.floor(seed) >>> 0
  return normalized === 0 ? 0x9e3779b9 : normalized
}

function nextSeededFloat(seed: number): { readonly seed: number; readonly value: number } {
  let next = normalizeSeed(seed)
  next ^= next << 13
  next ^= next >>> 17
  next ^= next << 5
  const normalized = next >>> 0
  return { seed: normalized, value: normalized / 0x1_0000_0000 }
}

export function applyUpgradeChoice(
  inventory: ArtifactInventory,
  artifactId: BaseArtifactId,
): ArtifactInventory {
  const currentLevel = getArtifactLevel(inventory, artifactId)
  if (currentLevel === 0) {
    if (inventory.slots.length >= MAX_ARTIFACT_SLOTS) {
      throw new Error(`法器槽位已满 (${MAX_ARTIFACT_SLOTS})，无法获得新法器。`)
    }
    return {
      slots: [...inventory.slots, { id: artifactId, level: 1 }],
    }
  }

  if (currentLevel >= MAX_ARTIFACT_LEVEL) {
    throw new Error(`法器 ${artifactId} 已达到最高等级 (${MAX_ARTIFACT_LEVEL})。`)
  }

  return {
    slots: inventory.slots.map((slot) =>
      slot.id === artifactId ? { ...slot, level: currentLevel + 1 } : slot,
    ),
  }
}
