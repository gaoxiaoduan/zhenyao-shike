import {
  soundCuePriority,
  type AudioOutput,
  type AudioPauseMode,
  type MusicStage,
  type SoundCue,
} from './audioDirector'

interface ToneSpec {
  readonly frequency: number
  readonly endFrequency?: number
  readonly duration: number
  readonly gain: number
  readonly wave: OscillatorType
}

const MUSIC_PATTERNS: Record<MusicStage, readonly number[]> = {
  home: [146.83, 196, 220, 196],
  opening: [220, 293.66, 329.63, 293.66],
  rising: [220, 293.66, 392, 329.63, 293.66, 440],
  surging: [220, 329.63, 440, 392, 493.88, 440],
  crisis: [196, 293.66, 392, 466.16, 392, 523.25],
  boss: [110, 164.81, 220, 233.08, 220, 174.61],
  victory: [220, 329.63, 440, 659.25],
  defeat: [220, 196, 164.81, 146.83],
}

const EFFECT_TONES: Record<SoundCue, readonly ToneSpec[]> = {
  'ui-confirm': [{ frequency: 440, endFrequency: 660, duration: 0.12, gain: 0.18, wave: 'sine' }],
  'ui-back': [{ frequency: 330, endFrequency: 220, duration: 0.12, gain: 0.14, wave: 'sine' }],
  'sword-cast': [{ frequency: 760, endFrequency: 1_320, duration: 0.09, gain: 0.12, wave: 'sawtooth' }],
  'thunder-cast': [
    { frequency: 92, endFrequency: 44, duration: 0.22, gain: 0.2, wave: 'square' },
    { frequency: 880, endFrequency: 180, duration: 0.16, gain: 0.1, wave: 'sawtooth' },
  ],
  'array-pulse': [{ frequency: 196, endFrequency: 293.66, duration: 0.3, gain: 0.13, wave: 'sine' }],
  'wind-cast': [{ frequency: 540, endFrequency: 980, duration: 0.18, gain: 0.09, wave: 'triangle' }],
  'sword-array-cast': [
    { frequency: 392, endFrequency: 1_176, duration: 0.28, gain: 0.14, wave: 'sawtooth' },
    { frequency: 587.33, endFrequency: 1_568, duration: 0.2, gain: 0.1, wave: 'triangle' },
  ],
  'light-wing-cast': [
    { frequency: 698.46, endFrequency: 1_396.91, duration: 0.24, gain: 0.1, wave: 'triangle' },
    { frequency: 523.25, endFrequency: 1_046.5, duration: 0.18, gain: 0.07, wave: 'sine' },
  ],
  'sky-thunder-cast': [
    { frequency: 72, endFrequency: 34, duration: 0.42, gain: 0.24, wave: 'square' },
    { frequency: 1_320, endFrequency: 82, duration: 0.3, gain: 0.14, wave: 'sawtooth' },
  ],
  'ordinary-hit': [{ frequency: 150, endFrequency: 92, duration: 0.07, gain: 0.12, wave: 'square' }],
  'enemy-defeated': [{ frequency: 240, endFrequency: 120, duration: 0.13, gain: 0.11, wave: 'triangle' }],
  'boar-charge': [{ frequency: 130, endFrequency: 76, duration: 0.28, gain: 0.16, wave: 'sawtooth' }],
  'mist-shot': [{ frequency: 420, endFrequency: 210, duration: 0.24, gain: 0.1, wave: 'sine' }],
  'elite-warning': [
    { frequency: 220, endFrequency: 440, duration: 0.34, gain: 0.18, wave: 'square' },
    { frequency: 110, endFrequency: 82, duration: 0.42, gain: 0.15, wave: 'sawtooth' },
  ],
  'spirit-collected': [{ frequency: 660, endFrequency: 880, duration: 0.09, gain: 0.08, wave: 'sine' }],
  'player-hurt': [{ frequency: 120, endFrequency: 58, duration: 0.24, gain: 0.24, wave: 'sawtooth' }],
  'player-critical': [
    { frequency: 90, endFrequency: 45, duration: 0.3, gain: 0.28, wave: 'sawtooth' },
    { frequency: 180, endFrequency: 72, duration: 0.22, gain: 0.16, wave: 'square' },
  ],
  'spell-cast': [
    { frequency: 196, endFrequency: 392, duration: 0.34, gain: 0.16, wave: 'sine' },
    { frequency: 293.66, endFrequency: 587.33, duration: 0.3, gain: 0.1, wave: 'triangle' },
  ],
  'artifact-ascended': [
    { frequency: 220, endFrequency: 440, duration: 0.45, gain: 0.17, wave: 'sine' },
    { frequency: 329.63, endFrequency: 659.25, duration: 0.5, gain: 0.13, wave: 'triangle' },
  ],
  'boss-arrival': [{ frequency: 73.42, endFrequency: 110, duration: 0.9, gain: 0.3, wave: 'sawtooth' }],
  'boss-howl': [
    { frequency: 174.61, endFrequency: 523.25, duration: 0.62, gain: 0.24, wave: 'sawtooth' },
    { frequency: 87.31, endFrequency: 58.27, duration: 0.7, gain: 0.2, wave: 'square' },
  ],
  'boss-enraged': [{ frequency: 110, endFrequency: 55, duration: 0.8, gain: 0.28, wave: 'square' }],
  'boss-defeated': [{ frequency: 146.83, endFrequency: 587.33, duration: 0.8, gain: 0.2, wave: 'triangle' }],
}

export function createBrowserAudioOutput(): AudioOutput {
  let context: AudioContext | null = null
  let musicGain: GainNode | null = null
  let sfxGain: GainNode | null = null
  let musicStage: MusicStage = 'home'
  let musicVolume = 0
  let pauseMode: AudioPauseMode = 'active'
  let musicStep = 0
  let musicTimer: number | undefined
  let activeVoices = 0

  function createTone(
    destination: AudioNode,
    spec: ToneSpec,
    volume: number,
    priority: 'high' | 'normal' = 'normal',
  ) {
    const voiceLimit = priority === 'high' ? 14 : 10
    if (!context || activeVoices >= voiceLimit || volume <= 0) {
      return
    }

    const now = context.currentTime
    const oscillator = context.createOscillator()
    const envelope = context.createGain()
    oscillator.type = spec.wave
    oscillator.frequency.setValueAtTime(spec.frequency, now)
    if (spec.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, spec.endFrequency), now + spec.duration)
    }
    envelope.gain.setValueAtTime(0.0001, now)
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, spec.gain * volume), now + 0.015)
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + spec.duration)
    oscillator.connect(envelope).connect(destination)
    activeVoices += 1
    oscillator.addEventListener('ended', () => {
      activeVoices = Math.max(0, activeVoices - 1)
      oscillator.disconnect()
      envelope.disconnect()
    })
    oscillator.start(now)
    oscillator.stop(now + spec.duration + 0.02)
  }

  function playMusicStep() {
    if (!context || !musicGain || musicVolume <= 0 || pauseMode === 'full') {
      return
    }
    const pattern = MUSIC_PATTERNS[musicStage]
    const frequency = pattern[musicStep % pattern.length] ?? pattern[0] ?? 220
    musicStep += 1
    const pace = musicStage === 'boss' || musicStage === 'crisis' ? 0.34 : 0.52
    createTone(musicGain, { frequency, duration: pace, gain: 0.12, wave: 'triangle' }, 1)
    if (musicStage === 'rising' || musicStage === 'surging' || musicStage === 'crisis' || musicStage === 'boss') {
      createTone(
        musicGain,
        { frequency: frequency / 2, duration: 0.16, gain: 0.08, wave: 'sine' },
        1,
      )
    }
  }

  function ensureMusicTimer() {
    if (musicTimer !== undefined) {
      return
    }
    musicTimer = window.setInterval(playMusicStep, 560)
    playMusicStep()
  }

  return {
    async unlock() {
      if (!context) {
        context = new AudioContext({ latencyHint: 'interactive' })
        musicGain = context.createGain()
        sfxGain = context.createGain()
        musicGain.connect(context.destination)
        sfxGain.connect(context.destination)
      }
      await context.resume()
      ensureMusicTimer()
    },
    setMusic(stage, volume) {
      musicStage = stage
      musicVolume = volume
      musicStep = 0
      if (context && musicGain) {
        musicGain.gain.setTargetAtTime(volume, context.currentTime, 0.08)
      }
      ensureMusicTimer()
    },
    setPauseMode(mode) {
      pauseMode = mode
    },
    playEffect(cue, volume) {
      if (!sfxGain || pauseMode === 'full') {
        return
      }
      for (const tone of EFFECT_TONES[cue]) {
        createTone(sfxGain, tone, volume, soundCuePriority(cue))
      }
    },
    vibrate(cue) {
      if (!('vibrate' in navigator)) {
        return
      }
      const pattern = cue === 'artifact-ascended'
        ? [30, 30, 55]
        : cue === 'player-critical'
          ? [60, 35, 60]
          : 35
      try {
        navigator.vibrate(pattern)
      } catch {
        // Haptics are optional and must never affect the battle loop.
      }
    },
    dispose() {
      if (musicTimer !== undefined) {
        window.clearInterval(musicTimer)
        musicTimer = undefined
      }
      void context?.close()
      context = null
      musicGain = null
      sfxGain = null
    },
  }
}
