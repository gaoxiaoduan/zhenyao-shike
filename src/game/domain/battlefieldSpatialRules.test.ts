import { describe, expect, it } from 'vitest'
import {
  aggregateRadarPoints,
  computeCombatCamera,
  isInsideTargetingEnvelope,
  projectRadarPoint,
} from './battlefieldSpatialRules'

describe('战斗视野、锁敌窗口与战场雷达', () => {
  it('16:9 显示地图横向 35%，21:9 只扩展横向世界范围', () => {
    expect(computeCombatCamera({ viewportWidth: 1280, viewportHeight: 720, worldSize: 2048 })).toEqual({
      worldWidth: 716.8,
      worldHeight: 403.2,
      zoom: 720 / 403.2,
    })
    expect(computeCombatCamera({ viewportWidth: 1680, viewportHeight: 720, worldSize: 2048 })).toEqual({
      worldWidth: 940.8,
      worldHeight: 403.2,
      zoom: 720 / 403.2,
    })
  })

  it('只在可见视野及每侧 5% 缓冲内选择新目标', () => {
    const view = { x: 500, y: 600, width: 716.8, height: 403.2 }

    expect(isInsideTargetingEnvelope({ x: 1_250, y: 800 }, view)).toBe(true)
    expect(isInsideTargetingEnvelope({ x: 1_260, y: 800 }, view)).toBe(false)
    expect(isInsideTargetingEnvelope({ x: 700, y: 570 }, view)).toBe(false)
  })

  it('把世界坐标投影到雷达并将普通妖物与灵蕴聚合到稳定网格', () => {
    expect(projectRadarPoint({ x: 1_024, y: 512 }, 2_048, { x: 10, y: 20, size: 200 })).toEqual({
      x: 110,
      y: 70,
    })

    expect(aggregateRadarPoints([
      { x: 100, y: 120, value: 1 },
      { x: 130, y: 140, value: 3 },
      { x: 1_900, y: 1_900, value: 2 },
    ], 2_048, 8)).toEqual([
      { gridX: 0, gridY: 0, count: 2, totalValue: 4 },
      { gridX: 7, gridY: 7, count: 1, totalValue: 2 },
    ])
  })
})
