<script setup lang="ts">
import { defineAsyncComponent, onUnmounted, shallowRef, watch } from 'vue'
import HomeScreen from './components/home/HomeScreen.vue'
import ResultScreen from './components/result/ResultScreen.vue'
import ControlsPanel from './components/settings/ControlsPanel.vue'
import SettingsPanel from './components/settings/SettingsPanel.vue'
import { useGameSettings } from './composables/useGameSettings'
import { createAudioDirector, type AudioIntent } from './game/audio/audioDirector'
import { createBrowserAudioOutput } from './game/audio/browserAudioOutput'
import type { RunSummary } from './game/domain/runSummary'
import { recordRunResult } from './game/domain/runRecord'
import type { ControlAction, GameSettings } from './game/settings/gameSettings'
import { CONTROL_ACTION_LABELS } from './game/settings/controlPresentation'

const BattlefieldGame = defineAsyncComponent(() => import('./components/BattlefieldGame.vue'))

type Screen = 'home' | 'run' | 'result'
type Overlay = 'settings' | 'controls' | null

const screen = shallowRef<Screen>('home')
const overlay = shallowRef<Overlay>(null)
const lastResult = shallowRef<RunSummary | null>(null)
const isNewRecord = shallowRef(false)
const showOnboarding = shallowRef(true)
const rebindError = shallowRef<string | null>(null)
const fullscreenAvailable = shallowRef(Boolean(document.fullscreenEnabled))
const desktopMedia = window.matchMedia('(hover: hover) and (pointer: fine)')
const { settings, update, rebind, reset } = useGameSettings()
const audioDirector = createAudioDirector(createBrowserAudioOutput(), settings.value)

watch(settings, (nextSettings) => audioDirector.updateSettings(nextSettings))
watch(
  settings,
  (nextSettings) => document.documentElement.classList.toggle('large-text-root', nextSettings.largeText),
  { immediate: true },
)

function unlockAudio() {
  void audioDirector.unlock()
}

function handleAudioIntent(intent: AudioIntent) {
  audioDirector.handle(intent)
}

function startRun() {
  unlockAudio()
  if (!desktopMedia.matches && document.fullscreenEnabled && !document.fullscreenElement) {
    void document.documentElement.requestFullscreen().catch(() => undefined)
  }
  audioDirector.handle({ type: 'music', stage: 'opening' })
  audioDirector.handle({ type: 'pause', mode: 'active' })
  overlay.value = null
  screen.value = 'run'
}

function toggleFullscreen() {
  if (!document.fullscreenEnabled) {
    return
  }
  if (document.fullscreenElement) {
    void document.exitFullscreen().catch(() => undefined)
    return
  }
  void document.documentElement.requestFullscreen().catch(() => undefined)
}

function finishRun(summary: RunSummary) {
  const record = recordRunResult(window.localStorage, summary.elapsedMs, summary.result)
  lastResult.value = { ...summary, demonCores: record.demonCoreEarned ? 1 : 0 }
  isNewRecord.value = record.isNewRecord
  audioDirector.handle({ type: 'music', stage: summary.result })
  overlay.value = null
  screen.value = 'result'
}

function returnHome() {
  audioDirector.handle({ type: 'effect', cue: 'ui-back' })
  audioDirector.handle({ type: 'music', stage: 'home' })
  audioDirector.handle({ type: 'pause', mode: 'active' })
  overlay.value = null
  screen.value = 'home'
}

function openOverlay(nextOverlay: Exclude<Overlay, null>) {
  rebindError.value = null
  audioDirector.handle({ type: 'effect', cue: 'ui-confirm' })
  overlay.value = nextOverlay
}

function closeOverlay() {
  audioDirector.handle({ type: 'effect', cue: 'ui-back' })
  overlay.value = null
}

function updateSettings(patch: Partial<Omit<GameSettings, 'version' | 'keyBindings'>>) {
  update(patch)
}

function rebindKey(action: ControlAction, key: string) {
  const result = rebind(action, key)
  rebindError.value = result.ok
    ? null
    : `此按键已用于“${CONTROL_ACTION_LABELS[result.conflictWith]}”，请先选择其他按键。`
  audioDirector.handle({ type: 'effect', cue: result.ok ? 'ui-confirm' : 'player-hurt' })
}

function resetSettings() {
  reset()
  rebindError.value = null
  audioDirector.handle({ type: 'effect', cue: 'ui-confirm' })
}

onUnmounted(() => {
  audioDirector.dispose()
  document.documentElement.classList.remove('large-text-root')
})
</script>

<template>
  <main
    class="min-h-svh overflow-hidden bg-[#090e0d] text-stone-100"
    :class="{ 'reduce-motion': settings.reducedMotion }"
    @pointerdown.capture.once="unlockAudio"
  >
    <HomeScreen
      v-if="screen === 'home'"
      :fullscreen-available="fullscreenAvailable"
      @start="startRun"
      @open-settings="openOverlay('settings')"
      @open-controls="openOverlay('controls')"
      @toggle-fullscreen="toggleFullscreen"
    />

    <BattlefieldGame
      v-else-if="screen === 'run'"
      :settings="settings"
      :show-onboarding="showOnboarding"
      :input-suspended="overlay !== null"
      @finished="finishRun"
      @onboarding-completed="showOnboarding = false"
      @toggle-fullscreen="toggleFullscreen"
      @open-settings="openOverlay('settings')"
      @audio-intent="handleAudioIntent"
    />

    <ResultScreen
      v-else-if="lastResult"
      :summary="lastResult"
      :new-record="isNewRecord"
      @retry="startRun"
      @home="returnHome"
    />

    <SettingsPanel
      v-if="overlay === 'settings'"
      :settings="settings"
      :fullscreen-available="fullscreenAvailable"
      :rebind-error="rebindError"
      @update-settings="updateSettings"
      @rebind="rebindKey"
      @reset="resetSettings"
      @toggle-fullscreen="toggleFullscreen"
      @close="closeOverlay"
    />
    <ControlsPanel v-if="overlay === 'controls'" @close="closeOverlay" />
  </main>
</template>
