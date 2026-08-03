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
}

export const DEMON_LAIR_TRIGGER_TIME_MS = 90_000

export function createDemonLairState(worldSize = 2048): DemonLairState {
  return {
    x: Math.round(worldSize * 0.72),
    y: Math.round(worldSize * 0.72),
    radius: 48,
    health: 250,
    maxHealth: 250,
    active: false,
    destroyed: false,
  }
}

export function updateDemonLairTrigger(
  state: DemonLairState,
  elapsedMs: number,
): DemonLairState {
  if (state.active || state.destroyed) {
    return state
  }

  if (elapsedMs >= DEMON_LAIR_TRIGGER_TIME_MS) {
    return {
      ...state,
      active: true,
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
  if (!state.active || state.destroyed) {
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
    },
    justDestroyed: isDestroyed,
    spiritReward: isDestroyed ? 40 : 0,
    bonusDeduction: isDestroyed ? 1 : 0,
  }
}
