import type { BaseArtifactId } from './initialArtifactSelection'

export const MAX_ARTIFACT_SLOTS = 4
export const MAX_ARTIFACT_LEVEL = 5

export interface ArtifactStats {
  readonly damage: number
  readonly intervalMs: number
  readonly moveSpeedMultiplier: number
  readonly aoeRadius: number
}

export interface ArtifactDefinition {
  readonly id: BaseArtifactId
  readonly name: string
  readonly description: string
  readonly attackColor: number
  readonly getStats: (level: number) => ArtifactStats
}

export const ARTIFACT_DEFINITIONS: Record<BaseArtifactId, ArtifactDefinition> = {
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
}

export interface ArtifactSlot {
  readonly id: BaseArtifactId
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

export function createArtifactInventory(initialArtifactId?: BaseArtifactId): ArtifactInventory {
  if (!initialArtifactId) {
    return { slots: [] }
  }
  return {
    slots: [{ id: initialArtifactId, level: 1 }],
  }
}

export function getArtifactLevel(inventory: ArtifactInventory, artifactId: BaseArtifactId): number {
  const found = inventory.slots.find((slot) => slot.id === artifactId)
  return found ? found.level : 0
}

export function getArtifactStats(artifactId: BaseArtifactId, level: number): ArtifactStats {
  return ARTIFACT_DEFINITIONS[artifactId].getStats(level)
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
