export type QualityMode = 'auto' | 'sharp' | 'smooth'
export type ControlAction = 'moveUp' | 'moveDown' | 'moveLeft' | 'moveRight' | 'castSpell' | 'pause'

export type KeyBindings = Readonly<Record<ControlAction, readonly string[]>>
export const CONTROL_ACTIONS: readonly ControlAction[] = [
  'moveUp',
  'moveDown',
  'moveLeft',
  'moveRight',
  'castSpell',
  'pause',
]

export interface GameSettings {
  readonly version: 1
  readonly musicVolume: number
  readonly sfxVolume: number
  readonly muted: boolean
  readonly vibrationEnabled: boolean
  readonly quality: QualityMode
  readonly largeText: boolean
  readonly reducedMotion: boolean
  readonly keyBindings: KeyBindings
}

export interface ReadableSettingsStorage {
  getItem(key: string): string | null
}

export interface WritableSettingsStorage {
  setItem(key: string, value: string): void
}

export const GAME_SETTINGS_STORAGE_KEY = 'zhenyao-shike.settings.v1'

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  version: 1,
  musicVolume: 0.6,
  sfxVolume: 0.8,
  muted: false,
  vibrationEnabled: true,
  quality: 'auto',
  largeText: false,
  reducedMotion: false,
  keyBindings: {
    moveUp: ['w', 'arrowup'],
    moveDown: ['s', 'arrowdown'],
    moveLeft: ['a', 'arrowleft'],
    moveRight: ['d', 'arrowright'],
    castSpell: ['space', 'e'],
    pause: ['escape'],
  },
}

export function loadGameSettings(storage: ReadableSettingsStorage): GameSettings {
  const raw = storage.getItem(GAME_SETTINGS_STORAGE_KEY)
  if (raw === null) {
    return DEFAULT_GAME_SETTINGS
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== 1) {
      return DEFAULT_GAME_SETTINGS
    }

    const storedBindings = isRecord(parsed.keyBindings) ? parsed.keyBindings : {}
    return {
      version: 1,
      musicVolume: readVolume(parsed.musicVolume, DEFAULT_GAME_SETTINGS.musicVolume),
      sfxVolume: readVolume(parsed.sfxVolume, DEFAULT_GAME_SETTINGS.sfxVolume),
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_GAME_SETTINGS.muted,
      vibrationEnabled:
        typeof parsed.vibrationEnabled === 'boolean'
          ? parsed.vibrationEnabled
          : DEFAULT_GAME_SETTINGS.vibrationEnabled,
      quality: isQualityMode(parsed.quality) ? parsed.quality : DEFAULT_GAME_SETTINGS.quality,
      largeText: typeof parsed.largeText === 'boolean' ? parsed.largeText : DEFAULT_GAME_SETTINGS.largeText,
      reducedMotion:
        typeof parsed.reducedMotion === 'boolean' ? parsed.reducedMotion : DEFAULT_GAME_SETTINGS.reducedMotion,
      keyBindings: {
        moveUp: readKeyList(storedBindings.moveUp, DEFAULT_GAME_SETTINGS.keyBindings.moveUp),
        moveDown: readKeyList(storedBindings.moveDown, DEFAULT_GAME_SETTINGS.keyBindings.moveDown),
        moveLeft: readKeyList(storedBindings.moveLeft, DEFAULT_GAME_SETTINGS.keyBindings.moveLeft),
        moveRight: readKeyList(storedBindings.moveRight, DEFAULT_GAME_SETTINGS.keyBindings.moveRight),
        castSpell: readKeyList(storedBindings.castSpell, DEFAULT_GAME_SETTINGS.keyBindings.castSpell),
        pause: readKeyList(storedBindings.pause, DEFAULT_GAME_SETTINGS.keyBindings.pause),
      },
    }
  } catch {
    return DEFAULT_GAME_SETTINGS
  }
}

export function saveGameSettings(storage: WritableSettingsStorage, settings: GameSettings): void {
  storage.setItem(GAME_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}

export type RebindResult =
  | { readonly ok: true; readonly settings: GameSettings }
  | {
      readonly ok: false
      readonly conflictWith: ControlAction
      readonly settings: GameSettings
    }

export function rebindPrimaryKey(
  settings: GameSettings,
  action: ControlAction,
  key: string,
): RebindResult {
  const normalizedKey = normalizeBindingKey(key)
  const conflictWith = CONTROL_ACTIONS.find(
    (candidate) => candidate !== action && settings.keyBindings[candidate].includes(normalizedKey),
  )
  if (conflictWith) {
    return { ok: false, conflictWith, settings }
  }

  const existingKeys = settings.keyBindings[action]
  const secondaryKeys = existingKeys.includes(normalizedKey)
    ? existingKeys.filter((candidate) => candidate !== normalizedKey)
    : existingKeys.slice(1)
  return {
    ok: true,
    settings: {
      ...settings,
      keyBindings: {
        ...settings.keyBindings,
        [action]: [normalizedKey, ...secondaryKeys],
      },
    },
  }
}

export function normalizeBindingKey(key: string): string {
  return key === ' ' ? 'space' : key.toLowerCase()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isQualityMode(value: unknown): value is QualityMode {
  return value === 'auto' || value === 'sharp' || value === 'smooth'
}

function readVolume(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback
}

function readKeyList(value: unknown, fallback: readonly string[]): readonly string[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every((key) => typeof key === 'string')) {
    return fallback
  }

  return value
}
