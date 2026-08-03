import { describe, expect, it } from 'vitest'
import {
  applyEnemyPressure,
  createEnemyStats,
  getOffscreenSpawnPosition,
  resolveDamage,
} from './combatRules'

describe('青石岭基础战斗规则', () => {
  it('按妖物职责提供稳定的基础数值（包含精英妖物）', () => {
    expect(createEnemyStats('qing-shi-ridge-boar-demon')).toEqual({
      id: 'qing-shi-ridge-boar-demon', health: 24, radius: 13, speed: 24, color: 0x8b5a3c,
    })
    expect(createEnemyStats('qing-shi-ridge-mist-moth')).toEqual({
      id: 'qing-shi-ridge-mist-moth', health: 44, radius: 17, speed: 36, color: 0x81648a,
    })

    const elite = createEnemyStats('qing-shi-ridge-elite-wolf')
    expect(elite.isElite).toBe(true)
    expect(elite.health).toBe(180)
    expect(elite.radius).toBeGreaterThan(20)
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
