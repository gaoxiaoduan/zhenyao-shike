export const PLAYER_HIT_PROTECTION_MS = 300

export type PlayerDamageKind = 'ordinary' | 'boss-heavy'

export interface PlayerDamageState {
  readonly health: number
  readonly maxHealth: number
  readonly hitProtectionRemainingMs: number
  readonly shieldRemainingMs: number
}

export interface PlayerDamageInput {
  readonly nextHealth: number
  readonly kind: PlayerDamageKind
}

export interface PlayerDamageResult {
  readonly nextState: PlayerDamageState
  readonly appliedDamage: number
  readonly blockedByShield: boolean
  readonly blockedByProtection: boolean
}

export function advancePlayerDamageState(
  state: PlayerDamageState,
  deltaMs: number,
): PlayerDamageState {
  const delta = Math.max(0, deltaMs)
  return {
    ...state,
    hitProtectionRemainingMs: Math.max(0, state.hitProtectionRemainingMs - delta),
    shieldRemainingMs: Math.max(0, state.shieldRemainingMs - delta),
  }
}

export function resolvePlayerDamage(
  state: PlayerDamageState,
  input: PlayerDamageInput,
): PlayerDamageResult {
  const requestedHealth = Math.max(0, Math.min(state.maxHealth, input.nextHealth))
  const requestedDamage = Math.max(0, state.health - requestedHealth)
  if (state.shieldRemainingMs > 0) {
    return {
      nextState: state,
      appliedDamage: 0,
      blockedByShield: requestedDamage > 0,
      blockedByProtection: false,
    }
  }
  if (input.kind === 'ordinary' && state.hitProtectionRemainingMs > 0) {
    return {
      nextState: state,
      appliedDamage: 0,
      blockedByShield: false,
      blockedByProtection: requestedDamage > 0,
    }
  }

  const appliedDamage = requestedDamage
  return {
    nextState: {
      ...state,
      health: requestedHealth,
      hitProtectionRemainingMs: input.kind === 'ordinary' && appliedDamage > 0
        ? PLAYER_HIT_PROTECTION_MS
        : state.hitProtectionRemainingMs,
    },
    appliedDamage,
    blockedByShield: false,
    blockedByProtection: false,
  }
}
