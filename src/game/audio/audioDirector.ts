import type { RunPhase } from '../domain/runProgress'
import type { GameSettings } from '../settings/gameSettings'

export type MusicStage = 'home' | 'opening' | 'rising' | 'surging' | 'crisis' | 'boss' | 'victory' | 'defeat'
export type AudioPauseMode = 'active' | 'choice' | 'full'
export type SoundCue =
  | 'ui-confirm'
  | 'ui-back'
  | 'sword-cast'
  | 'thunder-cast'
  | 'array-pulse'
  | 'wind-cast'
  | 'sword-array-cast'
  | 'light-wing-cast'
  | 'sky-thunder-cast'
  | 'ordinary-hit'
  | 'enemy-defeated'
  | 'spirit-collected'
  | 'player-hurt'
  | 'player-critical'
  | 'spell-cast'
  | 'artifact-ascended'
  | 'boss-arrival'
  | 'boss-howl'
  | 'boss-enraged'
  | 'boss-defeated'

export type AudioIntent =
  | { readonly type: 'effect'; readonly cue: SoundCue }
  | { readonly type: 'music'; readonly stage: MusicStage }
  | { readonly type: 'pause'; readonly mode: AudioPauseMode }

export interface AudioOutput {
  unlock(): Promise<void>
  setMusic(stage: MusicStage, volume: number): void
  setPauseMode(mode: AudioPauseMode): void
  playEffect(cue: SoundCue, volume: number): void
  vibrate(cue: SoundCue): void
  dispose(): void
}

export interface AudioDirector {
  unlock(): Promise<void>
  handle(intent: AudioIntent, now?: number): void
  updateSettings(settings: GameSettings): void
  dispose(): void
}

const CUE_THROTTLE_MS: Partial<Record<SoundCue, number>> = {
  'ordinary-hit': 80,
  'enemy-defeated': 60,
  'spirit-collected': 45,
  'player-hurt': 180,
  'sword-cast': 90,
  'thunder-cast': 120,
  'array-pulse': 160,
  'wind-cast': 100,
  'sword-array-cast': 150,
  'light-wing-cast': 110,
  'sky-thunder-cast': 180,
}

const HAPTIC_CUES: ReadonlySet<SoundCue> = new Set([
  'spell-cast',
  'artifact-ascended',
  'player-critical',
])

const HIGH_PRIORITY_CUES: ReadonlySet<SoundCue> = new Set([
  'player-hurt',
  'player-critical',
  'spell-cast',
  'artifact-ascended',
  'sword-array-cast',
  'light-wing-cast',
  'sky-thunder-cast',
  'boss-arrival',
  'boss-howl',
  'boss-enraged',
  'boss-defeated',
])

export function soundCuePriority(cue: SoundCue): 'high' | 'normal' {
  return HIGH_PRIORITY_CUES.has(cue) ? 'high' : 'normal'
}

export function musicStageForRun(elapsedMs: number, phase: RunPhase): MusicStage {
  if (phase === 'boss') {
    return 'boss'
  }
  if (elapsedMs >= 480_000) {
    return 'crisis'
  }
  if (elapsedMs >= 330_000) {
    return 'surging'
  }
  if (elapsedMs >= 150_000) {
    return 'rising'
  }
  return 'opening'
}

export function createAudioDirector(output: AudioOutput, initialSettings: GameSettings): AudioDirector {
  let settings = initialSettings
  let unlocked = false
  let musicStage: MusicStage = 'home'
  let pauseMode: AudioPauseMode = 'active'
  const lastPlayedAt = new Map<SoundCue, number>()

  function musicVolume() {
    if (settings.muted) {
      return 0
    }
    return settings.musicVolume * (pauseMode === 'choice' ? 0.35 : pauseMode === 'full' ? 0 : 1)
  }

  function syncMusic() {
    if (unlocked) {
      output.setMusic(musicStage, musicVolume())
    }
  }

  return {
    async unlock() {
      if (!unlocked) {
        await output.unlock()
        unlocked = true
      }
      output.setPauseMode(pauseMode)
      syncMusic()
    },
    handle(intent, now = performance.now()) {
      if (intent.type === 'music') {
        musicStage = intent.stage
        syncMusic()
        return
      }
      if (intent.type === 'pause') {
        pauseMode = intent.mode
        if (unlocked) {
          output.setPauseMode(pauseMode)
          syncMusic()
        }
        return
      }
      if (!unlocked || settings.muted || pauseMode === 'full') {
        return
      }

      const throttleMs = CUE_THROTTLE_MS[intent.cue] ?? 0
      const previous = lastPlayedAt.get(intent.cue) ?? Number.NEGATIVE_INFINITY
      if (now - previous < throttleMs) {
        return
      }

      lastPlayedAt.set(intent.cue, now)
      output.playEffect(intent.cue, settings.sfxVolume)
      if (settings.vibrationEnabled && HAPTIC_CUES.has(intent.cue)) {
        output.vibrate(intent.cue)
      }
    },
    updateSettings(nextSettings) {
      settings = nextSettings
      syncMusic()
    },
    dispose() {
      output.dispose()
      lastPlayedAt.clear()
      unlocked = false
    },
  }
}
