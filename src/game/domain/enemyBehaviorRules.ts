import type { EnemyRole } from './combatRules'

export type EnemyAction = 'approach' | 'windup' | 'charge' | 'recover'

export interface EnemyBehaviorState {
  readonly action: EnemyAction
  readonly actionRemainingMs: number
  readonly rangedCooldownMs: number
  readonly chargeConnected: boolean
  readonly recoveryIsVulnerable: boolean
}

export interface EnemyBehaviorInput {
  readonly deltaMs: number
  readonly distanceToPlayer: number
  readonly chargeConnected?: boolean
}

export interface EnemyBehaviorResult {
  readonly nextState: EnemyBehaviorState
  readonly speedMultiplier: number
  readonly contactEnabled: boolean
  readonly shouldFireProjectile: boolean
  readonly vulnerableMultiplier: number
}

export function createEnemyBehaviorState(): EnemyBehaviorState {
  return {
    action: 'approach',
    actionRemainingMs: 0,
    rangedCooldownMs: 1_200,
    chargeConnected: false,
    recoveryIsVulnerable: false,
  }
}

export function advanceEnemyBehavior(
  role: EnemyRole,
  state: EnemyBehaviorState,
  input: EnemyBehaviorInput,
): EnemyBehaviorResult {
  const deltaMs = Math.max(0, input.deltaMs)
  let nextState: EnemyBehaviorState = {
    ...state,
    rangedCooldownMs: Math.max(0, state.rangedCooldownMs - deltaMs),
  }
  let shouldFireProjectile = false

  if (role === 'ranged-kiter' && nextState.rangedCooldownMs === 0 && input.distanceToPlayer <= 360) {
    shouldFireProjectile = true
    nextState = { ...nextState, rangedCooldownMs: 1_800 }
  }

  const isCharger = role === 'armored-charger' || role === 'elite-pouncer'
  if (isCharger) {
    const triggerDistance = role === 'elite-pouncer' ? 280 : 170
    const windupMs = role === 'elite-pouncer' ? 800 : 650
    const chargeMs = role === 'elite-pouncer' ? 520 : 550
    const recoveryMs = role === 'elite-pouncer' ? 900 : 700

    if (state.action === 'approach' && input.distanceToPlayer <= triggerDistance) {
      nextState = {
        ...nextState,
        action: 'windup',
        actionRemainingMs: windupMs,
        chargeConnected: false,
        recoveryIsVulnerable: false,
      }
    } else if (state.action !== 'approach') {
      const remaining = state.actionRemainingMs - deltaMs
      if (remaining > 0) {
        nextState = { ...nextState, actionRemainingMs: remaining }
      } else if (state.action === 'windup') {
        nextState = { ...nextState, action: 'charge', actionRemainingMs: chargeMs }
      } else if (state.action === 'charge') {
        const chargeConnected = input.chargeConnected ?? state.chargeConnected
        nextState = {
          ...nextState,
          action: 'recover',
          actionRemainingMs: recoveryMs,
          chargeConnected,
          recoveryIsVulnerable: role === 'elite-pouncer' && !chargeConnected,
        }
      } else {
        nextState = {
          ...nextState,
          action: 'approach',
          actionRemainingMs: 0,
          chargeConnected: false,
          recoveryIsVulnerable: false,
        }
      }
    }
  }

  const speedMultiplier = nextState.action === 'charge'
    ? role === 'elite-pouncer' ? 4.8 : 3.4
    : nextState.action === 'recover'
      ? 0.25
      : nextState.action === 'windup'
        ? 0
        : 1

  return {
    nextState,
    speedMultiplier,
    contactEnabled: nextState.action !== 'windup' && nextState.action !== 'recover',
    shouldFireProjectile,
    vulnerableMultiplier: role === 'elite-pouncer' && nextState.recoveryIsVulnerable ? 1.65 : 1,
  }
}
