import { describe, expect, it } from 'vitest'
import {
  createDemonLairState,
  damageDemonLair,
  DEMON_LAIR_TRIGGER_TIME_MS,
  generateQingShiRidgeLayout,
  updateDemonLairTrigger,
} from './qingshiEventsAndTerrain'

describe('青石岭随机战场与妖巢暴动事件规则', () => {
  it('不同随机种子生成可通行的随机地形装饰', () => {
    const layout1 = generateQingShiRidgeLayout(101)
    const layout2 = generateQingShiRidgeLayout(202)

    expect(layout1.groves).toHaveLength(3)
    expect(layout2.groves).toHaveLength(3)
    expect(layout1.groves[0]!.x).not.toBe(layout2.groves[0]!.x)
    expect(layout1.village).toEqual({ x: 1160, y: 1040, width: 290, height: 190 })
  })

  it('运行到达 90 秒后正确激活妖巢暴动事件', () => {
    let lair = createDemonLairState()
    expect(lair.active).toBe(false)

    lair = updateDemonLairTrigger(lair, 60_000)
    expect(lair.active).toBe(false)

    lair = updateDemonLairTrigger(lair, DEMON_LAIR_TRIGGER_TIME_MS + 1_000)
    expect(lair.active).toBe(true)
    expect(lair.destroyed).toBe(false)
  })

  it('击毁妖巢提供高额灵蕴与 +1 推演次数奖励', () => {
    let lair = createDemonLairState()
    lair = updateDemonLairTrigger(lair, DEMON_LAIR_TRIGGER_TIME_MS)

    const partialDamage = damageDemonLair(lair, 100)
    expect(partialDamage.justDestroyed).toBe(false)
    expect(partialDamage.nextState.health).toBe(150)
    expect(partialDamage.spiritReward).toBe(0)

    const finalDamage = damageDemonLair(partialDamage.nextState, 200)
    expect(finalDamage.justDestroyed).toBe(true)
    expect(finalDamage.nextState.destroyed).toBe(true)
    expect(finalDamage.nextState.active).toBe(false)
    expect(finalDamage.spiritReward).toBe(40)
    expect(finalDamage.bonusDeduction).toBe(1)
  })
})
