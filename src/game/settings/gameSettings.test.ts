import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GAME_SETTINGS,
  GAME_SETTINGS_STORAGE_KEY,
  loadGameSettings,
  rebindPrimaryKey,
  saveGameSettings,
} from './gameSettings'

describe('game settings', () => {
  it('uses the agreed defaults when no local settings exist', () => {
    const storage = { getItem: () => null }

    expect(loadGameSettings(storage)).toEqual(DEFAULT_GAME_SETTINGS)
  })

  it('loads valid persisted preferences while retaining missing defaults', () => {
    const storage = {
      getItem: () => JSON.stringify({
        version: 1,
        musicVolume: 0.25,
        quality: 'smooth',
        keyBindings: { castSpell: ['q'] },
      }),
    }

    expect(loadGameSettings(storage)).toMatchObject({
      musicVolume: 0.25,
      sfxVolume: 0.8,
      quality: 'smooth',
      keyBindings: {
        moveUp: ['w', 'arrowup'],
        castSpell: ['q'],
      },
    })
  })

  it('rejects a primary key that is already bound to another action', () => {
    expect(rebindPrimaryKey(DEFAULT_GAME_SETTINGS, 'castSpell', 'w')).toEqual({
      ok: false,
      conflictWith: 'moveUp',
      settings: DEFAULT_GAME_SETTINGS,
    })
  })

  it('changes one primary key while keeping its secondary fallback', () => {
    const result = rebindPrimaryKey(DEFAULT_GAME_SETTINGS, 'castSpell', 'q')

    expect(result.ok).toBe(true)
    expect(result.settings.keyBindings.castSpell).toEqual(['q', 'e'])
  })

  it('keeps all bindings when the selected primary key is unchanged', () => {
    const result = rebindPrimaryKey(DEFAULT_GAME_SETTINGS, 'castSpell', 'space')

    expect(result.settings.keyBindings.castSpell).toEqual(['space', 'e'])
  })

  it('persists the versioned settings document', () => {
    const writes: Array<[string, string]> = []
    saveGameSettings({ setItem: (key, value) => writes.push([key, value]) }, DEFAULT_GAME_SETTINGS)

    expect(writes).toEqual([
      [GAME_SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_GAME_SETTINGS)],
    ])
  })
})
