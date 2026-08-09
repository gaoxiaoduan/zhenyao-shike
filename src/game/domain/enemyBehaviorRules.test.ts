import { describe, expect, it } from 'vitest'
import { advanceEnemyBehavior, createEnemyBehaviorState } from './enemyBehaviorRules'

describe('妖物职责行为', () => {
  it('野猪妖以预警、直线冲撞和恢复形成厚甲突进节奏', () => {
    const approaching = createEnemyBehaviorState()
    const warning = advanceEnemyBehavior('armored-charger', approaching, { deltaMs: 16, distanceToPlayer: 150 })
    const charging = advanceEnemyBehavior('armored-charger', warning.nextState, { deltaMs: 650, distanceToPlayer: 150 })
    const recovery = advanceEnemyBehavior('armored-charger', charging.nextState, { deltaMs: 550, distanceToPlayer: 80 })

    expect(warning.nextState.action).toBe('windup')
    expect(charging.nextState.action).toBe('charge')
    expect(charging.speedMultiplier).toBeGreaterThan(3)
    expect(recovery.nextState.action).toBe('recover')
  })

  it('雾蛾保持远距并按慢速冷却发射可躲雾弹', () => {
    const ready = { ...createEnemyBehaviorState(), rangedCooldownMs: 10 }
    const result = advanceEnemyBehavior('ranged-kiter', ready, { deltaMs: 20, distanceToPlayer: 260 })

    expect(result.shouldFireProjectile).toBe(true)
    expect(result.nextState.rangedCooldownMs).toBe(1_800)
  })

  it('精英妖物预警约 0.8 秒后扑袭，扑空恢复期承受额外伤害', () => {
    const warning = advanceEnemyBehavior('elite-pouncer', createEnemyBehaviorState(), {
      deltaMs: 16,
      distanceToPlayer: 240,
    })
    const pounce = advanceEnemyBehavior('elite-pouncer', warning.nextState, {
      deltaMs: 800,
      distanceToPlayer: 240,
    })
    const vulnerable = advanceEnemyBehavior('elite-pouncer', pounce.nextState, {
      deltaMs: 520,
      distanceToPlayer: 320,
      chargeConnected: false,
    })

    expect(warning.nextState.actionRemainingMs).toBe(800)
    expect(pounce.nextState.action).toBe('charge')
    expect(vulnerable.nextState.action).toBe('recover')
    expect(vulnerable.vulnerableMultiplier).toBe(1.65)
  })

  it('精英扑袭命中后只作普通收招，不进入易伤窗口', () => {
    const charging = {
      ...createEnemyBehaviorState(),
      action: 'charge' as const,
      actionRemainingMs: 20,
    }
    const recovery = advanceEnemyBehavior('elite-pouncer', charging, {
      deltaMs: 20,
      distanceToPlayer: 30,
      chargeConnected: true,
    })

    expect(recovery.nextState.action).toBe('recover')
    expect(recovery.nextState.recoveryIsVulnerable).toBe(false)
    expect(recovery.vulnerableMultiplier).toBe(1)
  })
})
