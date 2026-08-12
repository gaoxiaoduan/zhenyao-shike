import { describe, expect, it } from 'vitest'
import {
  PLAYER_HIT_PROTECTION_MS,
  resolvePlayerDamage,
  type PlayerDamageState,
} from './playerDamageRules'

describe('主角受击保护规则', () => {
  const state: PlayerDamageState = {
    health: 100,
    maxHealth: 100,
    hitProtectionRemainingMs: 0,
    shieldRemainingMs: 0,
  }

  it('普通伤害首次结算后保护同一簇后续命中', () => {
    const first = resolvePlayerDamage(state, { nextHealth: 92, kind: 'ordinary' })
    expect(first.appliedDamage).toBe(8)
    expect(first.nextState.hitProtectionRemainingMs).toBe(PLAYER_HIT_PROTECTION_MS)

    const repeated = resolvePlayerDamage(first.nextState, { nextHealth: 84, kind: 'ordinary' })
    expect(repeated.appliedDamage).toBe(0)
    expect(repeated.blockedByProtection).toBe(true)
  })

  it('妖王重击不被普通受击保护吞掉', () => {
    const protectedState = { ...state, hitProtectionRemainingMs: PLAYER_HIT_PROTECTION_MS }
    const result = resolvePlayerDamage(protectedState, { nextHealth: 60, kind: 'boss-heavy' })
    expect(result.appliedDamage).toBe(40)
    expect(result.nextState.health).toBe(60)
  })

  it('护盾期间所有伤害都被挡住，并且不延长普通保护', () => {
    const shielded = { ...state, shieldRemainingMs: 500, hitProtectionRemainingMs: 80 }
    const result = resolvePlayerDamage(shielded, { nextHealth: 0, kind: 'boss-heavy' })
    expect(result.appliedDamage).toBe(0)
    expect(result.blockedByShield).toBe(true)
    expect(result.nextState).toEqual(shielded)
  })
})
