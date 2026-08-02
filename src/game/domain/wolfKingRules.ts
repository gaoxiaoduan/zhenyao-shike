export const WOLF_KING_ID = 'xiaoyue-wolf-king' as const
export const WOLF_KING_MAX_HEALTH = 1_200
export const WOLF_KING_INTRO_DURATION_MS = 3_000
export const WOLF_KING_SUMMON_INTERVAL_MS = 7_000
export const WOLF_KING_ENRAGED_SUMMON_INTERVAL_MS = 4_500
export const WOLF_KING_HOWL_INTERVAL_MS = 9_000
export const WOLF_KING_ENRAGED_HOWL_INTERVAL_MS = 7_000
export const WOLF_KING_ENRAGED_HEALTH_RATIO = 0.5
export const WOLF_KING_COMBAT_SPEED = 28
export const WOLF_KING_ENRAGED_SPEED = 42
export const WOLF_KING_CONTACT_DAMAGE_PER_SECOND = 24
export const WOLF_KING_MINION_ID = 'xiaoyue-wolf-king-moon-shadow' as const

export interface WolfKingMinionStats {
  readonly id: typeof WOLF_KING_MINION_ID
  readonly health: number
  readonly radius: number
  readonly speed: number
  readonly color: number
}

export type WolfKingPhase = 'arrival' | 'combat' | 'enraged' | 'defeated'

export interface WolfKingEncounter {
  readonly id: typeof WOLF_KING_ID
  readonly phase: WolfKingPhase
  readonly health: number
  readonly maxHealth: number
  readonly introRemainingMs: number
  readonly summonCooldownMs: number
  readonly howlCooldownMs: number
}

export type WolfKingEvent =
  | { readonly type: 'combat-started' }
  | { readonly type: 'enraged' }
  | { readonly type: 'summon-requested'; readonly count: number }
  | { readonly type: 'moon-howl' }
  | { readonly type: 'defeated' }

export interface WolfKingEncounterResult {
  readonly encounter: WolfKingEncounter
  readonly events: readonly WolfKingEvent[]
}

export function createWolfKingEncounter(): WolfKingEncounter {
  return {
    id: WOLF_KING_ID,
    phase: 'arrival',
    health: WOLF_KING_MAX_HEALTH,
    maxHealth: WOLF_KING_MAX_HEALTH,
    introRemainingMs: WOLF_KING_INTRO_DURATION_MS,
    summonCooldownMs: WOLF_KING_SUMMON_INTERVAL_MS,
    howlCooldownMs: WOLF_KING_HOWL_INTERVAL_MS,
  }
}

export function createWolfKingMinionStats(enraged: boolean): WolfKingMinionStats {
  return {
    id: WOLF_KING_MINION_ID,
    health: enraged ? 65 : 52,
    radius: 14,
    speed: enraged ? 48 : 42,
    color: enraged ? 0xb91c1c : 0x9f6847,
  }
}

export function advanceWolfKingEncounter(
  encounter: WolfKingEncounter,
  deltaMs: number,
): WolfKingEncounterResult {
  if (deltaMs <= 0 || encounter.phase === 'defeated') {
    return { encounter, events: [] }
  }

  if (encounter.phase === 'arrival') {
    const introRemainingMs = encounter.introRemainingMs - deltaMs
    if (introRemainingMs > 0) {
      return {
        encounter: { ...encounter, introRemainingMs },
        events: [],
      }
    }

    const combatEncounter: WolfKingEncounter = {
      ...encounter,
      phase: 'combat',
      introRemainingMs: 0,
      summonCooldownMs: WOLF_KING_SUMMON_INTERVAL_MS,
      howlCooldownMs: WOLF_KING_HOWL_INTERVAL_MS,
    }
    const combatResult = advanceWolfKingEncounter(combatEncounter, -introRemainingMs)
    return {
      encounter: combatResult.encounter,
      events: [{ type: 'combat-started' }, ...combatResult.events],
    }
  }

  const summonInterval =
    encounter.phase === 'enraged'
      ? WOLF_KING_ENRAGED_SUMMON_INTERVAL_MS
      : WOLF_KING_SUMMON_INTERVAL_MS
  const howlInterval =
    encounter.phase === 'enraged'
      ? WOLF_KING_ENRAGED_HOWL_INTERVAL_MS
      : WOLF_KING_HOWL_INTERVAL_MS
  let summonCooldownMs = encounter.summonCooldownMs - deltaMs
  let howlCooldownMs = encounter.howlCooldownMs - deltaMs
  const events: WolfKingEvent[] = []
  const summonCount = encounter.phase === 'enraged' ? 3 : 2

  while (summonCooldownMs <= 0) {
    events.push({ type: 'summon-requested', count: summonCount })
    summonCooldownMs += summonInterval
  }

  while (howlCooldownMs <= 0) {
    events.push({ type: 'moon-howl' })
    howlCooldownMs += howlInterval
  }

  return {
    encounter: {
      ...encounter,
      introRemainingMs: 0,
      summonCooldownMs,
      howlCooldownMs,
    },
    events,
  }
}

export function damageWolfKing(
  encounter: WolfKingEncounter,
  damage: number,
): WolfKingEncounterResult {
  if (damage <= 0 || encounter.phase === 'arrival' || encounter.phase === 'defeated') {
    return { encounter, events: [] }
  }

  const health = Math.max(0, encounter.health - damage)
  if (health === 0) {
    return {
      encounter: { ...encounter, health, phase: 'defeated' },
      events: [{ type: 'defeated' }],
    }
  }

  if (encounter.phase === 'combat' && health <= encounter.maxHealth * WOLF_KING_ENRAGED_HEALTH_RATIO) {
    return {
      encounter: { ...encounter, health, phase: 'enraged' },
      events: [{ type: 'enraged' }],
    }
  }

  return {
    encounter: { ...encounter, health },
    events: [],
  }
}
