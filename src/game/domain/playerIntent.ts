import { createInputIntent, mergeMovementIntent, type InputIntent } from './inputIntent'
import { normalizeBindingKey, type KeyBindings } from '../settings/gameSettings'

export type PlayerInput =
  | { readonly type: 'keyboard-key-down'; readonly key: string; readonly repeat: boolean }
  | { readonly type: 'keyboard-key-up'; readonly key: string }
  | { readonly type: 'touch-move'; readonly moveX: number; readonly moveY: number }
  | { readonly type: 'touch-cast' }
  | { readonly type: 'touch-end' }
  | { readonly type: 'input-reset' }
  | { readonly type: 'pause-requested' }

export type PlayerIntent =
  | { readonly type: 'movement'; readonly intent: InputIntent }
  | { readonly type: 'cast-spell' }
  | { readonly type: 'clear-input' }
  | { readonly type: 'toggle-pause' }

export interface PlayerIntentDispatchResult {
  readonly preventDefault: boolean
  readonly intents: readonly PlayerIntent[]
}

export interface PlayerIntentModule {
  dispatch(input: PlayerInput): PlayerIntentDispatchResult
}

export interface CreatePlayerIntentModuleOptions {
  readonly getKeyBindings: () => KeyBindings
}

const MOVEMENT_ACTIONS = ['moveUp', 'moveDown', 'moveLeft', 'moveRight'] as const

export function createPlayerIntentModule(options: CreatePlayerIntentModuleOptions): PlayerIntentModule {
  const pressedKeys = new Set<string>()

  function isBound(action: typeof MOVEMENT_ACTIONS[number], key: string) {
    return options.getKeyBindings()[action].includes(key)
  }

  function isMovementKey(key: string) {
    return MOVEMENT_ACTIONS.some((action) => isBound(action, key))
  }

  function movementIntent(): PlayerIntent {
    const bindings = options.getKeyBindings()
    return {
      type: 'movement',
      intent: mergeMovementIntent({
        up: bindings.moveUp.some((key) => pressedKeys.has(key)),
        down: bindings.moveDown.some((key) => pressedKeys.has(key)),
        left: bindings.moveLeft.some((key) => pressedKeys.has(key)),
        right: bindings.moveRight.some((key) => pressedKeys.has(key)),
      }),
    }
  }

  function clearInput(preventDefault: boolean): PlayerIntentDispatchResult {
    pressedKeys.clear()
    return { preventDefault, intents: [{ type: 'clear-input' }] }
  }

  function togglePause(preventDefault: boolean): PlayerIntentDispatchResult {
    const cleared = clearInput(preventDefault)
    return {
      preventDefault: cleared.preventDefault,
      intents: [...cleared.intents, { type: 'toggle-pause' }],
    }
  }

  return {
    dispatch(input) {
      if (input.type === 'touch-move') {
        return {
          preventDefault: false,
          intents: [{ type: 'movement', intent: createInputIntent(input) }],
        }
      }
      if (input.type === 'touch-cast') {
        return { preventDefault: false, intents: [{ type: 'cast-spell' }] }
      }
      if (input.type === 'touch-end') {
        return clearInput(false)
      }
      if (input.type === 'input-reset') {
        return clearInput(false)
      }
      if (input.type === 'pause-requested') {
        return togglePause(false)
      }

      const key = normalizeBindingKey(input.key)
      if (options.getKeyBindings().pause.includes(key)) {
        if (input.type === 'keyboard-key-down' && !input.repeat) {
          return togglePause(true)
        }
        return { preventDefault: true, intents: [] }
      }
      if (options.getKeyBindings().castSpell.includes(key)) {
        if (input.type === 'keyboard-key-down' && !input.repeat) {
          return { preventDefault: true, intents: [{ type: 'cast-spell' }] }
        }
        return { preventDefault: true, intents: [] }
      }
      if (!isMovementKey(key)) {
        return { preventDefault: false, intents: [] }
      }

      if (input.type === 'keyboard-key-down') {
        const pressedBefore = pressedKeys.size
        pressedKeys.add(key)
        if (pressedKeys.size === pressedBefore) {
          return { preventDefault: true, intents: [] }
        }
      } else if (!pressedKeys.delete(key)) {
        return { preventDefault: true, intents: [] }
      }

      return { preventDefault: true, intents: [movementIntent()] }
    },
  }
}
