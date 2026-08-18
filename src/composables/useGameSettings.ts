import { readonly, shallowRef } from 'vue'
import {
  DEFAULT_GAME_SETTINGS,
  loadGameSettings,
  rebindPrimaryKey,
  saveGameSettings,
  type ControlAction,
  type GameSettings,
} from '../game/settings/gameSettings'

export function useGameSettings(storage: Storage = createSafeSettingsStorage()) {
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

function createSafeSettingsStorage(): Storage {
  const memoryValues = new Map<string, string>()
  const browserStorage = readBrowserStorage()

  return {
    getItem(key) {
      try {
        return browserStorage ? browserStorage.getItem(key) : memoryValues.get(key) ?? null
      } catch {
        return memoryValues.get(key) ?? null
      }
    },
    setItem(key, value) {
      memoryValues.set(key, value)
      try {
        browserStorage?.setItem(key, value)
      } catch {
        // Settings remain available for this session when browser storage is blocked.
      }
    },
    removeItem: () => undefined,
    clear: () => undefined,
    key: () => null,
    length: 0,
  }
}

function readBrowserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}
