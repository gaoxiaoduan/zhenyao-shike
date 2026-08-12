export const WOLF_KING_ID = 'xiaoyue-wolf-king' as const
// A reasonable build (one ascended artifact plus two mid-level basics) now
// needs roughly ninety to one hundred twenty seconds to finish the encounter;
// a complete build is faster, but cannot skip the second phase.
export const WOLF_KING_MAX_HEALTH = 30_000
export const WOLF_KING_INTRO_DURATION_MS = 3_000
export const WOLF_KING_SUMMON_INTERVAL_MS = 7_000
export const WOLF_KING_ENRAGED_SUMMON_INTERVAL_MS = 4_500
export const WOLF_KING_HOWL_INTERVAL_MS = 9_000
export const WOLF_KING_ENRAGED_HOWL_INTERVAL_MS = 7_000
export const WOLF_KING_ENRAGED_HEALTH_RATIO = 0.55
export const WOLF_KING_COMBAT_SPEED = 28
export const WOLF_KING_ENRAGED_SPEED = 42
export const WOLF_KING_CONTACT_DAMAGE_PER_SECOND = 24
export const WOLF_KING_MINION_ID = 'xiaoyue-wolf-king-moon-shadow' as const
export const WOLF_KING_CHARGE_WARNING_MS = 900
export const WOLF_KING_CHARGE_DURATION_MS = 650
export const WOLF_KING_ASSAULT_WARNING_MS = 1_000
export const WOLF_KING_ASSAULT_DURATION_MS = 700
export const WOLF_KING_ATTACK_INTERVAL_MS = 6_500
export const WOLF_KING_ENRAGED_ATTACK_INTERVAL_MS = 4_800
export const WOLF_KING_BREACH_DURATION_MS = 1_800
export const WOLF_KING_BREACH_DAMAGE_MULTIPLIER = 1.25
export const WOLF_KING_MOON_SHADOW_LIMIT = 8

export type WolfKingAttack =
  | 'none'
  | 'charge-warning'
  | 'charge'
  | 'assault-warning'
  | 'assault'

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
  readonly attack: WolfKingAttack
  readonly attackRemainingMs: number
  readonly attackCooldownMs: number
  readonly breachRemainingMs: number
}

export type WolfKingEvent =
  | { readonly type: 'combat-started' }
  | { readonly type: 'enraged' }
  | { readonly type: 'summon-requested'; readonly count: number }
  | { readonly type: 'charge-warning' }
  | { readonly type: 'charge-started' }
  | { readonly type: 'charge-resolved' }
  | { readonly type: 'moon-shadow-assault-warning' }
  | { readonly type: 'moon-shadow-assault' }
  | { readonly type: 'breach-opened' }
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
    attack: 'none',
    attackRemainingMs: 0,
    attackCooldownMs: WOLF_KING_ATTACK_INTERVAL_MS,
    breachRemainingMs: 0,
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
      attack: 'none',
      attackRemainingMs: 0,
      attackCooldownMs: WOLF_KING_ATTACK_INTERVAL_MS,
      breachRemainingMs: 0,
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
  let attackCooldownMs = encounter.attackCooldownMs - deltaMs
  let attack = encounter.attack
  let attackRemainingMs = Math.max(0, encounter.attackRemainingMs - deltaMs)
  let breachRemainingMs = Math.max(0, encounter.breachRemainingMs - deltaMs)
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

  // Heavy attacks are a readable state machine.  The scene can decide
  // whether the player crossed the warning out of harm's way and then call
  // resolveWolfKingAttack to open a breach.
  if (attack === 'none' && attackCooldownMs <= 0) {
    attack = encounter.phase === 'enraged' ? 'assault-warning' : 'charge-warning'
    attackRemainingMs = encounter.phase === 'enraged'
      ? WOLF_KING_ASSAULT_WARNING_MS
      : WOLF_KING_CHARGE_WARNING_MS
    attackCooldownMs = encounter.phase === 'enraged'
      ? WOLF_KING_ENRAGED_ATTACK_INTERVAL_MS
      : WOLF_KING_ATTACK_INTERVAL_MS
    events.push({
      type: encounter.phase === 'enraged' ? 'moon-shadow-assault-warning' : 'charge-warning',
    })
  } else if (attack === 'charge-warning' && attackRemainingMs === 0) {
    attack = 'charge'
    attackRemainingMs = WOLF_KING_CHARGE_DURATION_MS
    events.push({ type: 'charge-started' })
  } else if (attack === 'charge' && attackRemainingMs === 0) {
    attack = 'none'
    events.push({ type: 'charge-resolved' })
  } else if (attack === 'assault-warning' && attackRemainingMs === 0) {
    attack = 'assault'
    attackRemainingMs = WOLF_KING_ASSAULT_DURATION_MS
    events.push({ type: 'moon-shadow-assault' })
  } else if (attack === 'assault' && attackRemainingMs === 0) {
    attack = 'none'
    events.push({ type: 'charge-resolved' })
  }

  return {
    encounter: {
      ...encounter,
      introRemainingMs: 0,
      summonCooldownMs,
      howlCooldownMs,
      attack,
      attackRemainingMs,
      attackCooldownMs,
      breachRemainingMs,
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

  const appliedDamage = encounter.breachRemainingMs > 0
    ? damage * WOLF_KING_BREACH_DAMAGE_MULTIPLIER
    : damage
  const health = Math.max(0, encounter.health - appliedDamage)
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

export function resolveWolfKingAttack(
  encounter: WolfKingEncounter,
  avoided: boolean,
): WolfKingEncounterResult {
  if (!avoided || encounter.phase === 'arrival' || encounter.phase === 'defeated') {
    return { encounter, events: [] }
  }

  return {
    encounter: { ...encounter, breachRemainingMs: WOLF_KING_BREACH_DURATION_MS },
    events: [{ type: 'breach-opened' }],
  }
}
