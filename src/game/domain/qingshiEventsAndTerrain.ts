export interface BambooGrove {
  readonly x: number
  readonly y: number
  readonly radius: number
}

export interface SpiritNode {
  readonly x: number
  readonly y: number
  readonly radius: number
  readonly value: number
}

export const LINGQUAN_TRIGGER_TIME_MS = 330_000
export const LINGQUAN_TRAVEL_WINDOW_MS = 45_000
export const LINGQUAN_GUIDE_DURATION_MS = 2_000
export const LINGQUAN_HEAL_RATIO = 0.35
export const LINGQUAN_PICKUP_RADIUS_DURATION_MS = 30_000
export const LINGQUAN_PICKUP_RADIUS_MULTIPLIER = 2

export type LingquanPhase = 'dormant' | 'available' | 'guiding' | 'completed' | 'expired'

export interface LingquanEventState {
  readonly phase: LingquanPhase
  readonly nodeIndex: number
  readonly guideProgressMs: number
  readonly guideDurationMs: number
  readonly travelRemainingMs: number
  readonly healRatio: number
  readonly pickupRadiusDurationMs: number
  readonly pickupRadiusMultiplier: number
}

export function createLingquanEventState(nodeCount = 2, seed = 1): LingquanEventState {
  const safeNodeCount = Math.max(1, Math.floor(nodeCount))
  const normalizedSeed = Math.abs(Math.floor(seed))
  return {
    phase: 'dormant',
    nodeIndex: normalizedSeed % safeNodeCount,
    guideProgressMs: 0,
    guideDurationMs: LINGQUAN_GUIDE_DURATION_MS,
    travelRemainingMs: LINGQUAN_TRAVEL_WINDOW_MS,
    healRatio: LINGQUAN_HEAL_RATIO,
    pickupRadiusDurationMs: LINGQUAN_PICKUP_RADIUS_DURATION_MS,
    pickupRadiusMultiplier: LINGQUAN_PICKUP_RADIUS_MULTIPLIER,
  }
}

export function updateLingquanTrigger(
  state: LingquanEventState,
  elapsedMs: number,
): LingquanEventState {
  if (state.phase !== 'dormant' || elapsedMs < LINGQUAN_TRIGGER_TIME_MS) {
    return state
  }
  return { ...state, phase: 'available' }
}

export interface LingquanAdvanceInput {
  readonly deltaMs: number
  readonly withinGuideArea: boolean
}

export interface LingquanAdvanceResult {
  readonly nextState: LingquanEventState
  readonly justCompleted: boolean
  readonly justExpired: boolean
}

/**
 * A fountain is a small, forgiving channel: leaving pauses and slowly drains
 * progress, while taking a hit does not reset it.  The caller owns health and
 * pickup-radius application; this rule only describes the event state.
 */
export function advanceLingquanEvent(
  state: LingquanEventState,
  input: LingquanAdvanceInput,
): LingquanAdvanceResult {
  const deltaMs = Math.max(0, input.deltaMs)
  if (deltaMs === 0 || state.phase === 'dormant' || state.phase === 'completed' || state.phase === 'expired') {
    return { nextState: state, justCompleted: false, justExpired: false }
  }

  if (!input.withinGuideArea) {
    const guideProgressMs = Math.max(0, state.guideProgressMs - deltaMs * 0.15)
    // The 45 second window remains a real event deadline even after the
    // player starts guiding. Leaving the spring only slows the channel; it
    // must not freeze the decision timer indefinitely.
    const nextTravel = Math.max(0, state.travelRemainingMs - deltaMs)
    if (nextTravel === 0 && guideProgressMs < state.guideDurationMs) {
      return {
        nextState: { ...state, phase: 'expired', guideProgressMs, travelRemainingMs: 0 },
        justCompleted: false,
        justExpired: true,
      }
    }
    return {
      nextState: {
        ...state,
        phase: state.phase === 'guiding' ? 'guiding' : 'available',
        guideProgressMs,
        travelRemainingMs: nextTravel,
      },
      justCompleted: false,
      justExpired: false,
    }
  }

  const guideProgressMs = Math.min(state.guideDurationMs, state.guideProgressMs + deltaMs)
  const travelRemainingMs = Math.max(0, state.travelRemainingMs - deltaMs)
  // The channel can only complete while the event window is still open. A
  // single frame may straddle the deadline, so check the deadline before the
  // progress threshold rather than allowing a late completion.
  if (travelRemainingMs === 0) {
    return {
      nextState: { ...state, phase: 'expired', guideProgressMs, travelRemainingMs: 0 },
      justCompleted: false,
      justExpired: true,
    }
  }

  if (guideProgressMs >= state.guideDurationMs) {
    return {
      nextState: { ...state, phase: 'completed', guideProgressMs, travelRemainingMs },
      justCompleted: true,
      justExpired: false,
    }
  }

  return {
    nextState: { ...state, phase: 'guiding', guideProgressMs, travelRemainingMs },
    justCompleted: false,
    justExpired: false,
  }
}

export interface QingShiRidgeTerrainLayout {
  readonly groves: readonly BambooGrove[]
  readonly spiritNodes: readonly SpiritNode[]
  readonly village: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
}

const FIXED_VILLAGE = { x: 1160, y: 1040, width: 290, height: 190 } as const

export function generateQingShiRidgeLayout(seed = 1): QingShiRidgeTerrainLayout {
  const pseudoRandom = (offset: number) => {
    const x = Math.sin(seed + offset) * 10000
    return x - Math.floor(x)
  }

  const groves: BambooGrove[] = [
    { x: 420 + Math.floor(pseudoRandom(1) * 60 - 30), y: 440 + Math.floor(pseudoRandom(2) * 60 - 30), radius: 104 },
    { x: 1610 + Math.floor(pseudoRandom(3) * 60 - 30), y: 510 + Math.floor(pseudoRandom(4) * 60 - 30), radius: 126 },
    { x: 1420 + Math.floor(pseudoRandom(5) * 60 - 30), y: 1590 + Math.floor(pseudoRandom(6) * 60 - 30), radius: 112 },
  ]

  const spiritNodes: SpiritNode[] = [
    { x: 600 + Math.floor(pseudoRandom(7) * 80), y: 1400 + Math.floor(pseudoRandom(8) * 80), radius: 28, value: 10 },
    { x: 1700 + Math.floor(pseudoRandom(9) * 80), y: 1100 + Math.floor(pseudoRandom(10) * 80), radius: 28, value: 10 },
  ]

  return {
    groves,
    spiritNodes,
    village: FIXED_VILLAGE,
  }
}

export interface DemonLairState {
  readonly x: number
  readonly y: number
  readonly radius: number
  readonly health: number
  readonly maxHealth: number
  readonly active: boolean
  readonly destroyed: boolean
  readonly phase: DemonLairPhase
  readonly travelRemainingMs: number
  readonly battleRemainingMs: number
  readonly encounterStarted: boolean
  readonly guardEliteRequired: boolean
  readonly guardEliteDefeated: boolean
}

export type DemonLairPhase = 'dormant' | 'travel' | 'battle' | 'destroyed' | 'completed' | 'expired'

export const DEMON_LAIR_TRIGGER_TIME_MS = 90_000
export const DEMON_LAIR_TRAVEL_WINDOW_MS = 45_000
export const DEMON_LAIR_BATTLE_WINDOW_MS = 60_000
export const DEMON_LAIR_SPIRIT_REWARD = 40
export const DEMON_LAIR_LINGSTONE_REWARD = 8

export function createDemonLairState(worldSize = 2048): DemonLairState {
  return {
    x: Math.round(worldSize * 0.72),
    y: Math.round(worldSize * 0.72),
    radius: 48,
    health: 250,
    maxHealth: 250,
    active: false,
    destroyed: false,
    phase: 'dormant',
    travelRemainingMs: DEMON_LAIR_TRAVEL_WINDOW_MS,
    battleRemainingMs: 0,
    encounterStarted: false,
    guardEliteRequired: true,
    guardEliteDefeated: false,
  }
}

export function updateDemonLairTrigger(
  state: DemonLairState,
  elapsedMs: number,
): DemonLairState {
  if (state.active || state.destroyed || state.phase !== 'dormant') {
    return state
  }

  if (elapsedMs >= DEMON_LAIR_TRIGGER_TIME_MS) {
    return {
      ...state,
      active: true,
      phase: 'travel',
    }
  }

  return state
}

export function damageDemonLair(
  state: DemonLairState,
  damage: number,
): {
  readonly nextState: DemonLairState
  readonly justDestroyed: boolean
  readonly spiritReward: number
  readonly bonusDeduction: number
} {
  // Damage is only legal after the player reaches the lair and the separate
  // 60 second battle window starts. Keeping this boundary in the domain
  // prevents callers from accidentally skipping the travel phase.
  if (!state.active || state.destroyed || state.phase !== 'battle') {
    return {
      nextState: state,
      justDestroyed: false,
      spiritReward: 0,
      bonusDeduction: 0,
    }
  }

  const nextHealth = Math.max(0, state.health - damage)
  const isDestroyed = nextHealth === 0

  return {
    nextState: {
      ...state,
      health: nextHealth,
      active: !isDestroyed,
      destroyed: isDestroyed,
      phase: isDestroyed ? 'destroyed' : state.phase,
    },
    justDestroyed: isDestroyed,
    spiritReward: isDestroyed ? DEMON_LAIR_SPIRIT_REWARD : 0,
    bonusDeduction: isDestroyed ? 1 : 0,
  }
}

export interface DemonLairAdvanceResult {
  readonly nextState: DemonLairState
  readonly justStarted: boolean
  readonly justExpired: boolean
  readonly justCompleted: boolean
}

/** Advance the two explicit timers: travel to the lair, then its battle. */
export function advanceDemonLairEvent(
  state: DemonLairState,
  deltaMs: number,
  playerAtLair: boolean,
): DemonLairAdvanceResult {
  const delta = Math.max(0, deltaMs)
  if (delta === 0 || state.phase === 'dormant' || state.phase === 'completed' || state.phase === 'expired') {
    return { nextState: state, justStarted: false, justExpired: false, justCompleted: false }
  }

  if (state.phase === 'travel') {
    if (playerAtLair) {
      return {
        nextState: { ...state, phase: 'battle', encounterStarted: true, battleRemainingMs: DEMON_LAIR_BATTLE_WINDOW_MS },
        justStarted: true,
        justExpired: false,
        justCompleted: false,
      }
    }
    const travelRemainingMs = Math.max(0, state.travelRemainingMs - delta)
    if (travelRemainingMs === 0) {
      return {
        nextState: { ...state, active: false, phase: 'expired', travelRemainingMs: 0 },
        justStarted: false,
        justExpired: true,
        justCompleted: false,
      }
    }
    return {
      nextState: { ...state, travelRemainingMs },
      justStarted: false,
      justExpired: false,
      justCompleted: false,
    }
  }

  if (state.phase === 'battle' || state.phase === 'destroyed') {
    const battleRemainingMs = Math.max(0, state.battleRemainingMs - delta)
    if (battleRemainingMs === 0 && !(state.destroyed && state.guardEliteDefeated)) {
      return {
        nextState: { ...state, active: false, phase: 'expired', battleRemainingMs: 0 },
        justStarted: false,
        justExpired: true,
        justCompleted: false,
      }
    }
    return {
      nextState: { ...state, battleRemainingMs },
      justStarted: false,
      justExpired: false,
      justCompleted: false,
    }
  }

  return { nextState: state, justStarted: false, justExpired: false, justCompleted: false }
}

export function markDemonLairGuardDefeated(state: DemonLairState): DemonLairAdvanceResult {
  const nextState = { ...state, guardEliteDefeated: true }
  if (!state.destroyed) {
    return { nextState, justStarted: false, justExpired: false, justCompleted: false }
  }
  return {
    nextState: { ...nextState, active: false, phase: 'completed' },
    justStarted: false,
    justExpired: false,
    justCompleted: true,
  }
}
