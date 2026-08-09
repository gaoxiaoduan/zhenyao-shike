import { describe, expect, it } from 'vitest'
import {
  applyEnemyPressure,
  chooseCommonEnemyForWave,
  createEnemyStats,
  getDemonWaveStage,
  getWaveSpawnDirective,
  getOffscreenSpawnPosition,
  shouldSpawnElite,
  resolveDamage,
} from './combatRules'

describe('青石岭基础战斗规则', () => {
  it('按妖物职责提供稳定的基础数值（包含精英妖物）', () => {
    expect(createEnemyStats('qing-shi-ridge-boar-demon')).toEqual({
      id: 'qing-shi-ridge-boar-demon', role: 'armored-charger', health: 54, radius: 17, speed: 22, color: 0x8b5a3c,
    })
    expect(createEnemyStats('qing-shi-ridge-mist-moth')).toEqual({
      id: 'qing-shi-ridge-mist-moth', role: 'ranged-kiter', health: 30, radius: 15, speed: 25, color: 0x81648a,
    })

    const elite = createEnemyStats('qing-shi-ridge-elite-wolf')
    expect(elite.isElite).toBe(true)
    expect(elite.health).toBe(240)
    expect(elite.radius).toBeGreaterThan(20)
  })

  it('在 0:00、2:30、5:30、8:00 推进公开的妖潮阶段与密度预算', () => {
    expect(getDemonWaveStage(0)).toMatchObject({ index: 0, activeEnemyTarget: 18, spawnIntervalMs: 900 })
    expect(getDemonWaveStage(150_000)).toMatchObject({ index: 1, activeEnemyTarget: 45, spawnIntervalMs: 520 })
    expect(getDemonWaveStage(330_000)).toMatchObject({ index: 2, activeEnemyTarget: 70, spawnIntervalMs: 360 })
    expect(getDemonWaveStage(480_000)).toMatchObject({ index: 3, activeEnemyTarget: 90, spawnIntervalMs: 250 })
    expect(getDemonWaveStage(599_999).activeEnemyTarget).toBeLessThanOrEqual(100)
  })

  it('按阶段与固定随机值复现职责组合，并按公开节奏生成精英妖物', () => {
    expect(chooseCommonEnemyForWave(0, 0.9)).toBe('qing-shi-ridge-wood-wolf')
    expect(chooseCommonEnemyForWave(1, 0.9)).toBe('qing-shi-ridge-mist-moth')
    expect(shouldSpawnElite({ elapsedMs: 119_999, lastEliteSpawnMs: null, activeEliteCount: 0 })).toBe(false)
    expect(shouldSpawnElite({ elapsedMs: 120_000, lastEliteSpawnMs: null, activeEliteCount: 0 })).toBe(true)
    expect(shouldSpawnElite({ elapsedMs: 500_000, lastEliteSpawnMs: 410_000, activeEliteCount: 1 })).toBe(true)
    expect(shouldSpawnElite({ elapsedMs: 500_000, lastEliteSpawnMs: 410_000, activeEliteCount: 2 })).toBe(false)
  })

  it('以可复现的职责组合编排妖潮，并在短窗口制造密度峰值', () => {
    expect([0, 1, 2, 3].map((ordinal) => getWaveSpawnDirective(160_000, ordinal).enemyId)).toEqual([
      'qing-shi-ridge-boar-demon',
      'qing-shi-ridge-wood-wolf',
      'qing-shi-ridge-mist-moth',
      'qing-shi-ridge-wood-wolf',
    ])
    expect(getWaveSpawnDirective(160_000, 0)).toMatchObject({ intervalMultiplier: 1, burstCount: 1 })
    expect(getWaveSpawnDirective(180_000, 0)).toMatchObject({ intervalMultiplier: 0.58, burstCount: 2 })
  })

  it('将接触到主角的妖物数量转化为确定的生命损失', () => {
    expect(applyEnemyPressure(100, 2, 100)).toBeCloseTo(98.2)
    expect(applyEnemyPressure(1, 3, 100)).toBe(0)
  })

  it('伤害不会把妖物生命压低到零以下', () => {
    expect(resolveDamage(12, 5)).toBe(7)
    expect(resolveDamage(4, 9)).toBe(0)
  })

  it('计算出严格位于当前镜头视口之外的生成点', () => {
    const camera = { x: 500, y: 500, width: 400, height: 300 }
    const worldSize = 2048

    // Test multiple deterministic mock random calls
    for (let side = 0; side < 4; side++) {
      let step = 0
      const mockRandom = () => {
        step++
        if (step === 1) return side / 4 // side index
        return 0.5
      }

      const pos = getOffscreenSpawnPosition(camera, worldSize, 60, mockRandom)
      const isInsideView =
        pos.x > camera.x &&
        pos.x < camera.x + camera.width &&
        pos.y > camera.y &&
        pos.y < camera.y + camera.height

      expect(isInsideView).toBe(false)
      expect(pos.x).toBeGreaterThanOrEqual(36)
      expect(pos.x).toBeLessThanOrEqual(worldSize - 36)
      expect(pos.y).toBeGreaterThanOrEqual(36)
      expect(pos.y).toBeLessThanOrEqual(worldSize - 36)
    }
  })
})
