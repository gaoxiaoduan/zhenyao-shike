import { describe, expect, it } from 'vitest'
import { simulateGrowthPacing } from './growthPacingSimulation'

describe('可复现的成长节奏基线', () => {
  it.each([
    ['sword-wings', '流光剑翼', 'liu-guang-jian-yi'],
    ['thunder-array', '九霄雷阵', 'jiu-xiao-lei-zhen'],
    ['sword-array', '诛邪剑阵', 'zhu-xie-jian-zhen'],
  ] as const)('%s 构筑真实形成%s并满足成长窗口', (buildId, _buildName, ascendedArtifactId) => {
    const pacing = simulateGrowthPacing(buildId, 7_301)
    const firstUpgradeMs = pacing.upgradeOpportunityTimesMs[0]!

    expect(firstUpgradeMs).toBeGreaterThanOrEqual(20_000)
    expect(firstUpgradeMs).toBeLessThanOrEqual(30_000)
    expect(pacing.upgradeOpportunityTimesMs.length).toBeGreaterThanOrEqual(14)
    expect(pacing.upgradeOpportunityTimesMs.length).toBeLessThanOrEqual(17)
    expect(pacing.firstAscensionMs).toBeGreaterThanOrEqual(390_000)
    expect(pacing.firstAscensionMs).toBeLessThanOrEqual(480_000)
    expect(pacing.ascendedArtifactId).toBe(ascendedArtifactId)
  })
})
