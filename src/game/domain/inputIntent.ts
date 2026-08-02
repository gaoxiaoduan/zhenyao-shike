export interface InputIntent {
  readonly moveX: number
  readonly moveY: number
  readonly castSpell: boolean
  readonly pauseRequested: boolean
}

export interface MovementKeys {
  readonly up: boolean
  readonly down: boolean
  readonly left: boolean
  readonly right: boolean
}

export function createInputIntent(partial: Partial<InputIntent> = {}): InputIntent {
  const moveX = partial.moveX ?? 0
  const moveY = partial.moveY ?? 0
  const magnitude = Math.hypot(moveX, moveY)
  const scale = magnitude > 1 ? 1 / magnitude : 1

  return {
    moveX: moveX * scale,
    moveY: moveY * scale,
    castSpell: partial.castSpell ?? false,
    pauseRequested: partial.pauseRequested ?? false,
  }
}

export function mergeMovementIntent(keys: MovementKeys): InputIntent {
  return createInputIntent({
    moveX: Number(keys.right) - Number(keys.left),
    moveY: Number(keys.down) - Number(keys.up),
  })
}
