import { describe, expect, it } from 'vitest'
import {
  createDemonLairState,
  damageDemonLair,
  DEMON_LAIR_TRIGGER_TIME_MS,
  generateQingShiRidgeLayout,
  updateDemonLairTrigger,
  advanceDemonLairEvent,
  createLingquanEventState,
  updateLingquanTrigger,
  advanceLingquanEvent,
  LINGQUAN_TRIGGER_TIME_MS,
  LINGQUAN_GUIDE_DURATION_MS,
  DEMON_LAIR_TRAVEL_WINDOW_MS,
  DEMON_LAIR_BATTLE_WINDOW_MS,
  markDemonLairGuardDefeated,
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

  it('妖巢把前往期限和抵达后的战斗期限分开计算', () => {
    let lair = updateDemonLairTrigger(createDemonLairState(), 90_000)
    expect(lair.phase).toBe('travel')

    const travelling = advanceDemonLairEvent(lair, DEMON_LAIR_TRAVEL_WINDOW_MS - 1, false)
    expect(travelling.nextState.travelRemainingMs).toBe(1)
    const started = advanceDemonLairEvent(travelling.nextState, 16, true)
    expect(started.justStarted).toBe(true)
    expect(started.nextState.phase).toBe('battle')
    expect(started.nextState.battleRemainingMs).toBe(DEMON_LAIR_BATTLE_WINDOW_MS)
  })

  it('妖巢毁坏后仍需击败守巢精英才能完成事件', () => {
    let lair = updateDemonLairTrigger(createDemonLairState(), 90_000)
    lair = advanceDemonLairEvent(lair, 1, true).nextState
    lair = damageDemonLair(lair, 999).nextState
    expect(lair.phase).toBe('destroyed')
    expect(markDemonLairGuardDefeated(lair).nextState.phase).toBe('completed')
  })

  it('妖巢超时后不会在后续帧重新激活', () => {
    let lair = updateDemonLairTrigger(createDemonLairState(), 90_000)
    lair = advanceDemonLairEvent(lair, DEMON_LAIR_TRAVEL_WINDOW_MS, false).nextState
    expect(lair.phase).toBe('expired')
    expect(updateDemonLairTrigger(lair, 600_000).phase).toBe('expired')
  })

  it('灵泉在 5:30 出现，离开缓慢衰减，完成后只结算一次', () => {
    let fountain = updateLingquanTrigger(createLingquanEventState(2, 3), LINGQUAN_TRIGGER_TIME_MS)
    expect(fountain.phase).toBe('available')
    fountain = advanceLingquanEvent(fountain, { deltaMs: 1_000, withinGuideArea: true }).nextState
    expect(fountain.phase).toBe('guiding')
    fountain = advanceLingquanEvent(fountain, { deltaMs: 500, withinGuideArea: false }).nextState
    expect(fountain.guideProgressMs).toBeGreaterThan(0)
    const completed = advanceLingquanEvent(fountain, {
      deltaMs: LINGQUAN_GUIDE_DURATION_MS,
      withinGuideArea: true,
    })
    expect(completed.justCompleted).toBe(true)
    expect(completed.nextState.phase).toBe('completed')
    expect(advanceLingquanEvent(completed.nextState, { deltaMs: 5_000, withinGuideArea: true }).justCompleted).toBe(false)
  })
})
