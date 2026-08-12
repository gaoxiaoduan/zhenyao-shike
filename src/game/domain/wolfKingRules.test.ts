import { describe, expect, it } from 'vitest'
import {
  WOLF_KING_ENRAGED_HEALTH_RATIO,
  WOLF_KING_INTRO_DURATION_MS,
  WOLF_KING_MAX_HEALTH,
  advanceWolfKingEncounter,
  createWolfKingMinionStats,
  createWolfKingEncounter,
  damageWolfKing,
  WOLF_KING_BREACH_DAMAGE_MULTIPLIER,
  WOLF_KING_BREACH_DURATION_MS,
  resolveWolfKingAttack,
} from './wolfKingRules'

describe('啸月狼王决战规则', () => {
  it('以更高生命让合理构筑拥有九十秒级决战，并在 55% 进入狂月', () => {
    expect(WOLF_KING_MAX_HEALTH).toBeGreaterThan(10_000)
    expect(WOLF_KING_ENRAGED_HEALTH_RATIO).toBe(0.55)
  })
  it('完成三秒转场后才进入战斗阶段', () => {
    const arrival = createWolfKingEncounter()

    const beforeCombat = advanceWolfKingEncounter(arrival, WOLF_KING_INTRO_DURATION_MS - 1)
    expect(beforeCombat.encounter.phase).toBe('arrival')
    expect(beforeCombat.events).toEqual([])

    const combat = advanceWolfKingEncounter(beforeCombat.encounter, 1)
    expect(combat.encounter.phase).toBe('combat')
    expect(combat.events).toEqual([{ type: 'combat-started' }])
  })

  it('生命降至一半时进入狂月阶段并提高召唤规模', () => {
    const combat = advanceWolfKingEncounter(
      createWolfKingEncounter(),
      WOLF_KING_INTRO_DURATION_MS,
    ).encounter

    const result = damageWolfKing(combat, WOLF_KING_MAX_HEALTH / 2)

    expect(result.encounter.phase).toBe('enraged')
    expect(result.encounter.health).toBe(WOLF_KING_MAX_HEALTH / 2)
    expect(result.events).toEqual([{ type: 'enraged' }])

    const summon = advanceWolfKingEncounter(result.encounter, result.encounter.summonCooldownMs)
    expect(summon.events).toContainEqual({ type: 'summon-requested', count: 3 })
  })

  it('按战斗节奏请求召唤和月啸', () => {
    const combat = advanceWolfKingEncounter(
      createWolfKingEncounter(),
      WOLF_KING_INTRO_DURATION_MS,
    ).encounter

    const result = advanceWolfKingEncounter(combat, 9_000)

    expect(result.events).toContainEqual({ type: 'summon-requested', count: 2 })
    expect(result.events).toContainEqual({ type: 'moon-howl' })
  })

  it('被击杀后进入终结阶段且不再发出战斗事件', () => {
    const combat = advanceWolfKingEncounter(
      createWolfKingEncounter(),
      WOLF_KING_INTRO_DURATION_MS,
    ).encounter

    const defeated = damageWolfKing(combat, WOLF_KING_MAX_HEALTH + 1)
    expect(defeated.encounter.phase).toBe('defeated')
    expect(defeated.encounter.health).toBe(0)
    expect(defeated.events).toEqual([{ type: 'defeated' }])

    expect(advanceWolfKingEncounter(defeated.encounter, 60_000).events).toEqual([])
    expect(damageWolfKing(defeated.encounter, 10).events).toEqual([])
  })

  it('成功躲开重击后打开短暂妖王破绽，破绽期间伤害提高 25%', () => {
    const combat = advanceWolfKingEncounter(
      createWolfKingEncounter(),
      WOLF_KING_INTRO_DURATION_MS,
    ).encounter
    const resolved = resolveWolfKingAttack(combat, true)
    expect(resolved.encounter.breachRemainingMs).toBe(WOLF_KING_BREACH_DURATION_MS)
    expect(WOLF_KING_BREACH_DAMAGE_MULTIPLIER).toBe(1.25)

    const damaged = damageWolfKing(resolved.encounter, 100)
    expect(damaged.encounter.health).toBe(combat.health - 125)
  })

  it('为妖王提供独立的月影狼召唤物数值', () => {
    const normal = createWolfKingMinionStats(false)
    const enraged = createWolfKingMinionStats(true)

    expect(normal.id).toBe('xiaoyue-wolf-king-moon-shadow')
    expect(normal.health).toBeGreaterThan(34)
    expect(normal.color).not.toBe(0x6f884c)
    expect(enraged.health).toBeGreaterThan(normal.health)
    expect(enraged.speed).toBeGreaterThan(normal.speed)
  })
})
