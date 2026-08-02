import { describe, expect, it } from 'vitest'
import { applyEnemyPressure, createEnemyStats, resolveDamage } from './combatRules'

describe('青石岭基础战斗规则', () => {
  it('按妖物职责提供稳定的基础数值', () => {
    expect(createEnemyStats('qing-shi-ridge-boar-demon')).toEqual({
      id: 'qing-shi-ridge-boar-demon', health: 24, radius: 13, speed: 24, color: 0x8b5a3c,
    })
    expect(createEnemyStats('qing-shi-ridge-mist-moth')).toEqual({
      id: 'qing-shi-ridge-mist-moth', health: 44, radius: 17, speed: 36, color: 0x81648a,
    })
  })

  it('将接触到主角的妖物数量转化为确定的生命损失', () => {
    expect(applyEnemyPressure(100, 2, 100)).toBeCloseTo(98.2)
    expect(applyEnemyPressure(1, 3, 100)).toBe(0)
  })

  it('伤害不会把妖物生命压低到零以下', () => {
    expect(resolveDamage(12, 5)).toBe(7)
    expect(resolveDamage(4, 9)).toBe(0)
  })
})
