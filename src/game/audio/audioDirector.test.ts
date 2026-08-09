import { describe, expect, it } from 'vitest'
import { DEFAULT_GAME_SETTINGS } from '../settings/gameSettings'
import {
  createAudioDirector,
  musicStageForRun,
  soundCuePriority,
  type AudioOutput,
  type SoundCue,
} from './audioDirector'

describe('musicStageForRun', () => {
  it('maps the agreed run milestones to deterministic music layers', () => {
    expect(musicStageForRun(0, 'growth')).toBe('opening')
    expect(musicStageForRun(150_000, 'growth')).toBe('rising')
    expect(musicStageForRun(330_000, 'growth')).toBe('surging')
    expect(musicStageForRun(480_000, 'growth')).toBe('crisis')
    expect(musicStageForRun(600_000, 'boss')).toBe('boss')
  })
})

describe('audio director', () => {
  it('reserves priority for player, spell, ascension, and demon king cues', () => {
    expect(soundCuePriority('ordinary-hit')).toBe('normal')
    expect(soundCuePriority('boss-howl')).toBe('high')
    expect(soundCuePriority('sky-thunder-cast')).toBe('high')
  })

  it('aggregates rapid ordinary hits while preserving the agreed effect volume', async () => {
    const played: Array<{ cue: SoundCue; volume: number }> = []
    const output: AudioOutput = {
      unlock: async () => undefined,
      setMusic: () => undefined,
      setPauseMode: () => undefined,
      playEffect: (cue, volume) => played.push({ cue, volume }),
      vibrate: () => undefined,
      dispose: () => undefined,
    }
    const director = createAudioDirector(output, DEFAULT_GAME_SETTINGS)
    await director.unlock()

    director.handle({ type: 'effect', cue: 'ordinary-hit' }, 1_000)
    director.handle({ type: 'effect', cue: 'ordinary-hit' }, 1_040)
    director.handle({ type: 'effect', cue: 'ordinary-hit' }, 1_100)

    expect(played).toEqual([
      { cue: 'ordinary-hit', volume: 0.8 },
      { cue: 'ordinary-hit', volume: 0.8 },
    ])
  })

  it('ducks choice music and silences every bus when muted', async () => {
    const musicVolumes: number[] = []
    const output: AudioOutput = {
      unlock: async () => undefined,
      setMusic: (_stage, volume) => musicVolumes.push(volume),
      setPauseMode: () => undefined,
      playEffect: () => undefined,
      vibrate: () => undefined,
      dispose: () => undefined,
    }
    const director = createAudioDirector(output, DEFAULT_GAME_SETTINGS)
    await director.unlock()

    director.handle({ type: 'pause', mode: 'choice' })
    director.updateSettings({ ...DEFAULT_GAME_SETTINGS, muted: true })

    expect(musicVolumes.at(-2)).toBeCloseTo(0.21)
    expect(musicVolumes.at(-1)).toBe(0)
  })

  it('uses haptics only for eligible cues when vibration is enabled', async () => {
    const vibrated: SoundCue[] = []
    const output: AudioOutput = {
      unlock: async () => undefined,
      setMusic: () => undefined,
      setPauseMode: () => undefined,
      playEffect: () => undefined,
      vibrate: (cue) => vibrated.push(cue),
      dispose: () => undefined,
    }
    const director = createAudioDirector(output, DEFAULT_GAME_SETTINGS)
    await director.unlock()

    director.handle({ type: 'effect', cue: 'ordinary-hit' })
    director.handle({ type: 'effect', cue: 'spell-cast' })

    expect(vibrated).toEqual(['spell-cast'])
  })
})
