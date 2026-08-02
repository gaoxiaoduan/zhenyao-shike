import { describe, expect, it } from 'vitest'
import { createInputIntent, mergeMovementIntent } from './inputIntent'

describe('玩家意图', () => {
  it('将相反的方向键归一化为静止', () => {
    expect(
      mergeMovementIntent({ up: true, down: true, left: true, right: true }),
    ).toEqual(createInputIntent())
  })

  it('将斜向移动归一化，避免比直线移动更快', () => {
    const intent = mergeMovementIntent({ up: true, down: false, left: false, right: true })

    expect(Math.hypot(intent.moveX, intent.moveY)).toBeCloseTo(1)
    expect(intent.moveX).toBeGreaterThan(0)
    expect(intent.moveY).toBeLessThan(0)
  })

  it('保留术法和暂停这两个跨平台意图', () => {
    const intent = createInputIntent({ moveX: 4, moveY: -3, castSpell: true, pauseRequested: true })

    expect(intent.moveX).toBeCloseTo(0.8)
    expect(intent.moveY).toBeCloseTo(-0.6)
    expect(intent.castSpell).toBe(true)
    expect(intent.pauseRequested).toBe(true)
  })
})
