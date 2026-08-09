import { describe, expect, it } from 'vitest'
import { simulateGrowthPacing } from './growthPacingSimulation'

describe('可复现的成长节奏基线', () => {
  it.each([
    ['qing-feng-jian-xia', '剑修'],
    ['lei-zhuan-fu-ce', '雷法'],
    ['si-xiang-zhen-qi', '阵修'],
  ] as const)('%s %s 构筑满足首升、总选择数与首件高阶法器窗口', (artifactId, _buildName) => {
    const pacing = simulateGrowthPacing(artifactId)
    const firstUpgradeMs = pacing.upgradeOpportunityTimesMs[0]!
    // 一次取得配对法器、八次升满两件法器，并穿插两次临战机缘。
    const firstAscensionMs = pacing.upgradeOpportunityTimesMs[10]!

    expect(firstUpgradeMs).toBeGreaterThanOrEqual(20_000)
    expect(firstUpgradeMs).toBeLessThanOrEqual(30_000)
    expect(pacing.upgradeOpportunityTimesMs.length).toBeGreaterThanOrEqual(14)
    expect(pacing.upgradeOpportunityTimesMs.length).toBeLessThanOrEqual(17)
    expect(firstAscensionMs).toBeGreaterThanOrEqual(390_000)
    expect(firstAscensionMs).toBeLessThanOrEqual(480_000)
  })
})
