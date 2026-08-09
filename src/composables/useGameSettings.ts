import { readonly, shallowRef } from 'vue'
import {
  DEFAULT_GAME_SETTINGS,
  loadGameSettings,
  rebindPrimaryKey,
  saveGameSettings,
  type ControlAction,
  type GameSettings,
} from '../game/settings/gameSettings'

export function useGameSettings(storage: Storage = window.localStorage) {
  const settings = shallowRef<GameSettings>(loadGameSettings(storage))

  function replace(nextSettings: GameSettings) {
    settings.value = nextSettings
    saveGameSettings(storage, nextSettings)
  }

  function update(patch: Partial<Omit<GameSettings, 'version' | 'keyBindings'>>) {
    replace({ ...settings.value, ...patch })
  }

  function rebind(action: ControlAction, key: string) {
    const result = rebindPrimaryKey(settings.value, action, key)
    if (result.ok) {
      replace(result.settings)
    }
    return result
  }

  function reset() {
    replace(DEFAULT_GAME_SETTINGS)
  }

  return {
    settings: readonly(settings),
    update,
    rebind,
    reset,
  }
}
