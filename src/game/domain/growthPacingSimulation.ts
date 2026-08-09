import { getArtifactStats } from './artifactInventory'
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

export interface GrowthPacingSimulation {
  readonly upgradeOpportunityTimesMs: readonly number[]
  readonly defeatedEnemyCount: number
}

const STEP_MS = 50
const REPRESENTATIVE_CHOICE_POWER_GAIN = 1.12
const INITIAL_ARTIFACT_EFFICIENCY: Readonly<Partial<Record<BaseArtifactId, number>>> = {
  'qing-feng-jian-xia': 1,
  'lei-zhuan-fu-ce': 1.03,
  'si-xiang-zhen-qi': 1.8,
}

/**
 * Deterministic headless balance model for a competent build that keeps attacking.
 * It reuses shipped enemy health, wave timing, artifact cadence, elite rewards, and XP rules.
 */
export function simulateGrowthPacing(initialArtifactId: BaseArtifactId): GrowthPacingSimulation {
  let progress = createRunProgress()
  let spawnElapsedMs = 0
  let spawnOrdinal = 0
  let lastEliteSpawnMs: number | null = null
  let defeatedEnemyCount = 0
  const enemies: SimulatedEnemy[] = []
  const upgradeOpportunityTimesMs: number[] = []
  const initialStats = getArtifactStats(initialArtifactId, 1)
  let damagePerSecond = initialStats.damage / (initialStats.intervalMs / 1_000)
    * (INITIAL_ARTIFACT_EFFICIENCY[initialArtifactId] ?? 1)

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
        damagePerSecond *= REPRESENTATIVE_CHOICE_POWER_GAIN
      }
    }
  }

  return { upgradeOpportunityTimesMs, defeatedEnemyCount }
}
