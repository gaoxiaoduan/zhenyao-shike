import {
  applyAscensionChoice,
  applyFlexibleUpgradeChoice,
  applyUpgradeChoice,
  createArtifactInventory,
  createUpgradeDraftState,
  draftUpgradeChoices,
  getAvailableAscensionChoices,
  getArtifactLevel,
  getArtifactStats,
  type ArtifactId,
  type ArtifactInventory,
  type AscendedArtifactId,
  type UpgradeDraftChoice,
  type UpgradeDraftState,
  type UpgradeChoice,
} from './artifactInventory'
import {
  createEnemyStats,
  getDemonWaveStage,
  getWaveSpawnDirective,
  shouldSpawnElite,
} from './combatRules'
import type { BaseArtifactId } from './initialArtifactSelection'
import { advanceRunProgress, createRunProgress, grantExperience } from './runProgress'

interface SimulatedEnemy {
  health: number
  experience: number
}

export type RepresentativeBuildId = 'sword-wings' | 'thunder-array' | 'sword-array'

interface RepresentativeBuildPlan {
  initialArtifactId: BaseArtifactId
  partnerArtifactId: BaseArtifactId
  ascendedArtifactId: AscendedArtifactId
}

export interface GrowthPacingSimulation {
  readonly upgradeOpportunityTimesMs: readonly number[]
  readonly firstAscensionMs: number | null
  readonly ascendedArtifactId: AscendedArtifactId | null
  readonly defeatedEnemyCount: number
}

const STEP_MS = 50
const BUILD_PLANS: Readonly<Record<RepresentativeBuildId, RepresentativeBuildPlan>> = {
  'sword-wings': {
    initialArtifactId: 'qing-feng-jian-xia',
    partnerArtifactId: 'fu-yao-yu-yi',
    ascendedArtifactId: 'liu-guang-jian-yi',
  },
  'thunder-array': {
    initialArtifactId: 'lei-zhuan-fu-ce',
    partnerArtifactId: 'si-xiang-zhen-qi',
    ascendedArtifactId: 'jiu-xiao-lei-zhen',
  },
  'sword-array': {
    initialArtifactId: 'qing-feng-jian-xia',
    partnerArtifactId: 'si-xiang-zhen-qi',
    ascendedArtifactId: 'zhu-xie-jian-zhen',
  },
}

const CROWD_DAMAGE_EFFICIENCY: Readonly<Record<ArtifactId, number>> = {
  'qing-feng-jian-xia': 1,
  'lei-zhuan-fu-ce': 1.45,
  'si-xiang-zhen-qi': 2,
  'fu-yao-yu-yi': 1.15,
  'zhu-xie-jian-zhen': 2.4,
  'liu-guang-jian-yi': 1.7,
  'jiu-xiao-lei-zhen': 2.6,
}

function calculateBuildDamagePerSecond(
  inventory: ArtifactInventory,
  damageMultiplier: number,
  attackIntervalMultiplier: number,
) {
  return inventory.slots.reduce((sum, slot) => {
    const stats = getArtifactStats(slot.id, slot.level)
    const attacksPerSecond = 1_000 / (stats.intervalMs * attackIntervalMultiplier)
    return sum + stats.damage * attacksPerSecond * CROWD_DAMAGE_EFFICIENCY[slot.id]
  }, 0) * damageMultiplier
}

function chooseBuildProgression(
  choices: readonly UpgradeDraftChoice[],
  inventory: ArtifactInventory,
  plan: RepresentativeBuildPlan,
  opportunityNumber: number,
  ascended: boolean,
): UpgradeDraftChoice {
  if (opportunityNumber <= 2) {
    const flexible = choices.find((choice) => choice.type === 'flex')
    if (flexible) {
      return flexible
    }
  }

  if (!ascended && getArtifactLevel(inventory, plan.partnerArtifactId) === 0) {
    const partner = choices.find((choice) => (
      choice.type === 'acquire' && choice.artifactId === plan.partnerArtifactId
    ))
    if (partner) {
      return partner
    }
  }

  if (!ascended) {
    const sourceUpgrade = choices
      .filter((choice): choice is UpgradeChoice => (
        choice.type === 'upgrade'
        && (choice.artifactId === plan.initialArtifactId || choice.artifactId === plan.partnerArtifactId)
      ))
      .sort((left, right) => left.currentLevel - right.currentLevel)[0]
    if (sourceUpgrade) {
      return sourceUpgrade
    }
  }

  return choices.find((choice) => choice.type === 'flex') ?? choices[0]!
}

/**
 * Fixed-seed headless balance model for three supported builds. It executes the shipped draft,
 * inventory, flexible-choice, ascension, wave, enemy-health, elite-reward, artifact-stat and XP rules.
 */
export function simulateGrowthPacing(
  buildId: RepresentativeBuildId,
  seed = 7_301,
): GrowthPacingSimulation {
  const plan = BUILD_PLANS[buildId]
  let progress = createRunProgress()
  let inventory = createArtifactInventory(plan.initialArtifactId)
  let draftState: UpgradeDraftState = createUpgradeDraftState(seed)
  let damageMultiplier = 1
  let attackIntervalMultiplier = 1
  let damagePerSecond = calculateBuildDamagePerSecond(inventory, damageMultiplier, attackIntervalMultiplier)
  let spawnElapsedMs = 0
  let spawnOrdinal = 0
  let lastEliteSpawnMs: number | null = null
  let firstAscensionMs: number | null = null
  let ascendedArtifactId: AscendedArtifactId | null = null
  let defeatedEnemyCount = 0
  const enemies: SimulatedEnemy[] = []
  const upgradeOpportunityTimesMs: number[] = []

  while (progress.phase === 'growth') {
    progress = advanceRunProgress(progress, STEP_MS)
    spawnElapsedMs += STEP_MS

    if (shouldSpawnElite({
      elapsedMs: progress.elapsedMs,
      lastEliteSpawnMs,
      activeEliteCount: 0,
    })) {
      const elite = createEnemyStats('qing-shi-ridge-elite-wolf')
      enemies.push({ health: elite.health, experience: 8 })
      lastEliteSpawnMs = progress.elapsedMs
    }

    const stage = getDemonWaveStage(progress.elapsedMs)
    const directive = getWaveSpawnDirective(progress.elapsedMs, spawnOrdinal)
    const spawnIntervalMs = stage.spawnIntervalMs * directive.intervalMultiplier
    if (spawnElapsedMs >= spawnIntervalMs && enemies.length < stage.activeEnemyTarget) {
      spawnElapsedMs = 0
      for (
        let index = 0;
        index < directive.burstCount && enemies.length < stage.activeEnemyTarget;
        index += 1
      ) {
        const nextDirective = getWaveSpawnDirective(progress.elapsedMs, spawnOrdinal)
        const stats = createEnemyStats(nextDirective.enemyId)
        enemies.push({ health: stats.health, experience: 1 })
        spawnOrdinal += 1
      }
    }

    let damageBudget = damagePerSecond * STEP_MS / 1_000
    while (damageBudget > 0 && enemies.length > 0) {
      const target = enemies[0]!
      if (damageBudget < target.health) {
        target.health -= damageBudget
        break
      }

      damageBudget -= target.health
      enemies.shift()
      defeatedEnemyCount += 1
      const experienceResult = grantExperience(progress, target.experience)
      progress = experienceResult.progress
      for (let level = 0; level < experienceResult.levelsGained; level += 1) {
        upgradeOpportunityTimesMs.push(progress.elapsedMs)
        const draft = draftUpgradeChoices(inventory, draftState, { count: 3 })
        draftState = draft.nextState
        if (draft.choices.length === 0) {
          continue
        }

        const choice = chooseBuildProgression(
          draft.choices,
          inventory,
          plan,
          upgradeOpportunityTimesMs.length,
          ascendedArtifactId !== null,
        )
        if (choice.type === 'flex') {
          const flexible = applyFlexibleUpgradeChoice(draftState, choice.choiceId)
          draftState = flexible.nextState
          damageMultiplier += flexible.damageMultiplierDelta
          attackIntervalMultiplier = Math.max(
            0.5,
            attackIntervalMultiplier + flexible.attackIntervalMultiplierDelta,
          )
        } else {
          inventory = applyUpgradeChoice(inventory, choice.artifactId)
        }

        if (ascendedArtifactId === null) {
          const ascension = getAvailableAscensionChoices(inventory)
            .find((candidate) => candidate.resultId === plan.ascendedArtifactId)
          if (ascension) {
            inventory = applyAscensionChoice(inventory, ascension.choiceId)
            firstAscensionMs = progress.elapsedMs
            ascendedArtifactId = ascension.resultId
          }
        }
        damagePerSecond = calculateBuildDamagePerSecond(
          inventory,
          damageMultiplier,
          attackIntervalMultiplier,
        )
      }
    }
  }

  return {
    upgradeOpportunityTimesMs,
    firstAscensionMs,
    ascendedArtifactId,
    defeatedEnemyCount,
  }
}
