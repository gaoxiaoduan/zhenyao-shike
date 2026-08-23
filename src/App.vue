<script setup lang="ts">
import { defineAsyncComponent, onUnmounted, shallowRef, watch } from 'vue'
import HomeScreen from './components/home/HomeScreen.vue'
import RunHistoryPanel from './components/home/RunHistoryPanel.vue'
import ResultScreen from './components/result/ResultScreen.vue'
import ControlsPanel from './components/settings/ControlsPanel.vue'
import SettingsPanel from './components/settings/SettingsPanel.vue'
import { useGameSettings } from './composables/useGameSettings'
import { createAudioDirector, type AudioIntent } from './game/audio/audioDirector'
import { createBrowserAudioOutput } from './game/audio/browserAudioOutput'
import {
  createInitialRunHistoryState,
  createRunHistory,
  type RunHistoryState,
} from './game/domain/runHistory'
import type { RunSummary } from './game/domain/runSummary'
import type { ReplayTarget } from './game/domain/replayTarget'
import { createBrowserRunHistoryStorage } from './game/platform/runHistoryStorage'
import type { ControlAction, GameSettings } from './game/settings/gameSettings'
import { CONTROL_ACTION_LABELS } from './game/settings/controlPresentation'

const BattlefieldGame = defineAsyncComponent(() => import('./components/BattlefieldGame.vue'))

type Screen = 'home' | 'run' | 'result'
type Overlay = 'settings' | 'controls' | 'history' | null

const screen = shallowRef<Screen>('home')
const overlay = shallowRef<Overlay>(null)
const lastResult = shallowRef<RunSummary | null>(null)
const isNewRecord = shallowRef(false)
const persistenceStatus = shallowRef<'persisted' | 'session-only'>('persisted')
const practiceResult = shallowRef(false)
const showOnboarding = shallowRef(true)
const practiceMode = shallowRef(false)
const compactMode = shallowRef(false)
const rebindError = shallowRef<string | null>(null)
const fullscreenAvailable = shallowRef(Boolean(document.fullscreenEnabled))
const desktopMedia = window.matchMedia('(hover: hover) and (pointer: fine)')
const runHistoryStorage = createBrowserRunHistoryStorage()
const runHistoryModule = createRunHistory(runHistoryStorage)
const initialRunHistoryState = createInitialRunHistoryState()
const bossPracticeUnlocked = shallowRef(initialRunHistoryState.bossPracticeUnlocked)
const runHistory = shallowRef(initialRunHistoryState.history)
const replayTarget = shallowRef<ReplayTarget>(initialRunHistoryState.replayTarget)
const previousReplayTarget = shallowRef<ReplayTarget | null>(null)
const previousReplayTargetCompleted = shallowRef(false)
const storageNotice = shallowRef<'recovered' | 'degraded' | null>(null)
const { settings, update, rebind, reset } = useGameSettings()
const audioDirector = createAudioDirector(createBrowserAudioOutput(), settings.value)

void hydrateRunHistory()

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

function startRun(isPractice = false, isCompact = false) {
  unlockAudio()
  if (!desktopMedia.matches && document.fullscreenEnabled && !document.fullscreenElement) {
    void document.documentElement.requestFullscreen().catch(() => undefined)
  }
  audioDirector.handle({ type: 'music', stage: 'opening' })
  audioDirector.handle({ type: 'pause', mode: 'active' })
  overlay.value = null
  practiceMode.value = isPractice
  compactMode.value = isCompact
  if (isPractice) {
    showOnboarding.value = false
  }
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

async function hydrateRunHistory() {
  applyRunHistoryState(await runHistoryModule.restore())
}

async function finishRun(summary: RunSummary) {
  const wasPractice = practiceMode.value
  let settledSummary = summary
  let nextIsNewRecord = false
  let nextPreviousReplayTarget: ReplayTarget | null = null
  let nextPreviousReplayTargetCompleted = false
  if (!wasPractice) {
    const settlement = await runHistoryModule.completeStandardRun(summary)
    applyRunHistoryState(settlement.state)
    settledSummary = settlement.summary
    nextIsNewRecord = settlement.isNewRecord
    nextPreviousReplayTarget = settlement.previousReplayTarget
    nextPreviousReplayTargetCompleted = settlement.previousReplayTargetCompleted
  } else {
    settledSummary = await runHistoryModule.completeBossPractice(summary)
  }
  lastResult.value = settledSummary
  isNewRecord.value = nextIsNewRecord
  previousReplayTarget.value = nextPreviousReplayTarget
  previousReplayTargetCompleted.value = nextPreviousReplayTargetCompleted
  practiceResult.value = wasPractice
  practiceMode.value = false
  audioDirector.handle({ type: 'music', stage: summary.result })
  overlay.value = null
  screen.value = 'result'
}

function applyRunHistoryState(nextState: RunHistoryState) {
  bossPracticeUnlocked.value = nextState.bossPracticeUnlocked
  runHistory.value = nextState.history
  replayTarget.value = nextState.replayTarget
  persistenceStatus.value = nextState.persistenceStatus
  if (nextState.hydrationStatus !== 'ready') {
    storageNotice.value = nextState.hydrationStatus
  } else if (nextState.persistenceStatus === 'session-only') {
    storageNotice.value = 'degraded'
  }
}

function returnHome() {
  audioDirector.handle({ type: 'effect', cue: 'ui-back' })
  audioDirector.handle({ type: 'music', stage: 'home' })
  audioDirector.handle({ type: 'pause', mode: 'active' })
  overlay.value = null
  compactMode.value = false
  screen.value = 'home'
}

function retryRun() {
  startRun(practiceResult.value, compactMode.value)
}

function toggleCompactMode() {
  compactMode.value = !compactMode.value
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

function dismissStorageNotice() {
  storageNotice.value = null
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
      :boss-practice-unlocked="bossPracticeUnlocked"
      :replay-target="replayTarget"
      @start="startRun"
      :run-history="runHistory"
      @compact-start="startRun(false, true)"
      @open-history="openOverlay('history')"
      @practice="startRun(true)"
      @open-settings="openOverlay('settings')"
      @open-controls="openOverlay('controls')"
      @toggle-fullscreen="toggleFullscreen"
    />

    <BattlefieldGame
      v-else-if="screen === 'run'"
      :settings="settings"
      :show-onboarding="showOnboarding"
      :practice-mode="practiceMode"
      :compact-mode="compactMode"
      :input-suspended="overlay !== null"
      @finished="finishRun"
      @onboarding-completed="showOnboarding = false"
      @toggle-fullscreen="toggleFullscreen"
      @toggle-compact-mode="toggleCompactMode"
      @open-settings="openOverlay('settings')"
      @audio-intent="handleAudioIntent"
    />

    <ResultScreen
      v-else-if="lastResult"
      :summary="lastResult"
      :new-record="isNewRecord"
      :practice-mode="practiceResult"
      :persistence-status="persistenceStatus"
      :run-history="runHistory"
      :replay-target="replayTarget"
      :previous-replay-target="previousReplayTarget"
      :previous-replay-target-completed="previousReplayTargetCompleted"
      @retry="retryRun"
      @home="returnHome"
      @open-history="openOverlay('history')"
    />

    <aside
      v-if="storageNotice"
      class="fixed inset-x-4 bottom-4 z-[80] mx-auto flex max-w-xl items-center justify-between gap-4 rounded border border-amber-200/30 bg-[#14271d]/95 px-4 py-3 text-sm text-stone-100 shadow-2xl backdrop-blur"
      role="status"
      aria-live="polite"
    >
      <span>{{ storageNotice === 'recovered' ? '检测到存档异常，已从上一份有效历练记录恢复。' : '历练记录存储暂不可用，本局记录只保留在当前会话。' }}</span>
      <button class="shrink-0 text-amber-200 underline underline-offset-4" type="button" @click="dismissStorageNotice">知道了</button>
    </aside>

    <RunHistoryPanel
      v-if="overlay === 'history'"
      :history="runHistory"
      @close="closeOverlay"
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
