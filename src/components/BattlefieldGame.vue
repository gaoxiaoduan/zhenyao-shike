<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef, useTemplateRef, watch } from 'vue'
import type { AscensionRecipe, UpgradeDraftChoice } from '../game/domain/artifactInventory'
import type { ZhouTianOption } from '../game/domain/deductionAndZhouTian'
import { createInputIntent, mergeMovementIntent, type InputIntent } from '../game/domain/inputIntent'
import type { BaseArtifact } from '../game/domain/initialArtifactSelection'
import {
  completeOnboardingStep,
  createOnboardingProgress,
  nextOnboardingStep,
  type OnboardingProgress,
} from '../game/domain/onboardingProgress'
import { createBattleSession } from '../game/phaser/createBattleSession'
import type { AudioIntent } from '../game/audio/audioDirector'
import type { DamageSource, RunResult, RunSummary } from '../game/domain/runSummary'
import { computeBattleViewport, computeRenderScale } from '../game/platform/viewportPolicy'
import { normalizeBindingKey, type ControlAction, type GameSettings } from '../game/settings/gameSettings'
import type { BattleHudSnapshot, GameSession, GameSessionEvent, OnboardingStep } from '../game/session/GameSession'
import BattleTouchControls from './BattleTouchControls.vue'
import BattleHud from './game/BattleHud.vue'
import InitialArtifactSelectionModal from './InitialArtifactSelectionModal.vue'
import OnboardingGuide from './OnboardingGuide.vue'
import UpgradeSelectionModal from './UpgradeSelectionModal.vue'

const props = withDefaults(defineProps<{
  showOnboarding?: boolean
  settings: GameSettings
  inputSuspended?: boolean
}>(), {
  showOnboarding: true,
  inputSuspended: false,
})

const emit = defineEmits<{
  finished: [summary: RunSummary]
  onboardingCompleted: []
  toggleFullscreen: []
  openSettings: []
  audioIntent: [intent: AudioIntent]
}>()

const battleMount = useTemplateRef<HTMLElement>('battleMount')
const session = shallowRef<GameSession | null>(null)
const showPause = shallowRef(false)
const orientationPaused = shallowRef(false)
const viewportPaused = shallowRef(false)
const visibilityPaused = shallowRef(false)
const pressedKeys = new Set<string>()
const desktopMedia = window.matchMedia('(hover: hover) and (pointer: fine)')
const viewport = shallowRef(computeBattleViewport({
  width: window.innerWidth,
  height: window.innerHeight,
  desktop: desktopMedia.matches,
}))
const initialArtifactCandidates = shallowRef<readonly BaseArtifact[]>([])
const upgradeChoices = shallowRef<readonly (UpgradeDraftChoice | ZhouTianOption)[]>([])
const ascensionChoices = shallowRef<readonly AscensionRecipe[]>([])
const deductionCount = shallowRef(1)
const canDeduce = shallowRef(false)
const isZhouTian = shallowRef(false)
const onboardingProgress = shallowRef<OnboardingProgress>(createOnboardingProgress())
const hudSnapshot = shallowRef<BattleHudSnapshot | null>(null)
const endingNotice = shallowRef<{ result: RunResult; source: DamageSource } | null>(null)
let movementIntent = createInputIntent()

const damageSourceLabels: Readonly<Record<DamageSource, string>> = {
  'ordinary-enemy': '寻常妖物围攻',
  'elite-enemy': '精英妖物破阵',
  'wolf-king-contact': '啸月狼王扑击',
  'moon-howl': '狼王月啸',
  unknown: '妖潮压境',
}

const initialSelectionOpen = computed(() => initialArtifactCandidates.value.length > 0)
const upgradeModalOpen = computed(() => upgradeChoices.value.length > 0 || ascensionChoices.value.length > 0)
const onboardingStep = computed(() => props.showOnboarding ? nextOnboardingStep(onboardingProgress.value) : null)
const battlefieldStyle = computed(() => ({
  '--battle-aspect': viewport.value.aspectRatio.toString(),
}))
const pauseTitle = computed(() => {
  if (orientationPaused.value) {
    return '请旋转设备'
  }
  if (viewportPaused.value) {
    return '请扩大窗口'
  }
  return '暂避妖潮'
})
const pauseDescription = computed(() => {
  if (orientationPaused.value) {
    return '横屏后点击继续，战场才会恢复。'
  }
  if (viewportPaused.value) {
    return '桌面战场至少需要 960 × 540 的可用空间。'
  }
  return '自动攻击与妖潮已完全暂停。'
})
const audioPauseMode = computed(() => {
  if (showPause.value || orientationPaused.value || viewportPaused.value || visibilityPaused.value) {
    return 'full' as const
  }
  if (initialSelectionOpen.value || upgradeModalOpen.value) {
    return 'choice' as const
  }
  return 'active' as const
})

watch(audioPauseMode, (mode) => emit('audioIntent', { type: 'pause', mode }), { immediate: true })
watch(() => props.inputSuspended, (suspended) => {
  if (suspended) {
    clearKeyboardIntent()
  }
})
watch(() => props.settings.reducedMotion, (reducedMotion) => {
  session.value?.setReducedMotion(reducedMotion)
})

function handleSessionEvent(event: GameSessionEvent) {
  if (event.type === 'audio-intent') {
    emit('audioIntent', event.intent)
    return
  }

  if (event.type === 'hud-updated') {
    hudSnapshot.value = event.snapshot
    return
  }

  if (event.type === 'run-ending') {
    endingNotice.value = { result: event.result, source: event.source }
    return
  }

  if (event.type === 'initial-artifact-selection-requested') {
    initialArtifactCandidates.value = event.candidates
    return
  }

  if (event.type === 'upgrade-requested') {
    upgradeChoices.value = event.choices
    deductionCount.value = event.deductionCount
    canDeduce.value = event.canDeduce
    isZhouTian.value = !!event.isZhouTian
    session.value?.pause('upgrade')
    return
  }

  if (event.type === 'ascension-requested') {
    ascensionChoices.value = event.choices
    session.value?.pause('upgrade')
    return
  }

  if (event.type === 'onboarding-step-completed') {
    advanceOnboarding(event.step)
    return
  }

  if (event.type === 'pause-requested') {
    showPause.value = true
    session.value?.pause('manual')
    return
  }

  if (event.type === 'run-ended') {
    emit('finished', event.summary)
  }
}

function selectInitialArtifact(artifactId: BaseArtifact['id']) {
  session.value?.selectInitialArtifact(artifactId)
  initialArtifactCandidates.value = []
  restoreMovementIntent()
}

function selectUpgrade(choiceId: string) {
  upgradeChoices.value = []
  ascensionChoices.value = []
  session.value?.selectUpgrade(choiceId)
  emit('audioIntent', { type: 'effect', cue: 'ui-confirm' })
  if (upgradeChoices.value.length === 0 && ascensionChoices.value.length === 0) {
    session.value?.resume('upgrade')
    restoreMovementIntent()
  }
}

function selectAscension(choiceId: string) {
  ascensionChoices.value = []
  session.value?.selectAscension(choiceId)
  if (upgradeChoices.value.length === 0 && ascensionChoices.value.length === 0) {
    session.value?.resume('upgrade')
    restoreMovementIntent()
  }
}

function skipAscension() {
  ascensionChoices.value = []
  session.value?.skipAscension()
  emit('audioIntent', { type: 'effect', cue: 'ui-back' })
  if (upgradeChoices.value.length === 0) {
    session.value?.resume('upgrade')
    restoreMovementIntent()
  }
}

function deduceUpgrade() {
  session.value?.deduceUpgrade()
}

function tunaHeal() {
  upgradeChoices.value = []
  ascensionChoices.value = []
  session.value?.tunaHeal()
  session.value?.resume('upgrade')
  restoreMovementIntent()
}

function advanceOnboarding(completedStep: OnboardingStep) {
  if (!props.showOnboarding) {
    return
  }

  onboardingProgress.value = completeOnboardingStep(onboardingProgress.value, completedStep)
  if (nextOnboardingStep(onboardingProgress.value) === null) {
    emit('onboardingCompleted')
  }
}

function skipOnboarding() {
  session.value?.skipOnboarding()
  emit('onboardingCompleted')
}

function setTouchIntent(intent: InputIntent) {
  movementIntent = createInputIntent({ moveX: intent.moveX, moveY: intent.moveY })
  session.value?.setInputIntent(movementIntent)
}

function castSpell() {
  session.value?.castSpell()
}

function togglePause() {
  if (showPause.value) {
    continueRun()
    return
  }

  showPause.value = true
  clearKeyboardIntent()
  session.value?.pause('manual')
}

function continueRun() {
  if (orientationPaused.value || viewportPaused.value) {
    return
  }

  showPause.value = false
  session.value?.resume('manual')
}

function resumeAfterViewportRecovery(reason: 'orientation' | 'viewport') {
  showPause.value = true
  session.value?.pause('manual')
  session.value?.resume(reason)
}

function syncViewport() {
  const nextViewport = computeBattleViewport({
    width: window.innerWidth,
    height: window.innerHeight,
    desktop: desktopMedia.matches,
  })
  viewport.value = nextViewport
  session.value?.resize(nextViewport)

  if (nextViewport.requiresOrientation) {
    orientationPaused.value = true
    session.value?.pause('orientation')
  } else if (orientationPaused.value) {
    orientationPaused.value = false
    resumeAfterViewportRecovery('orientation')
  }

  if (nextViewport.requiresLargerWindow) {
    viewportPaused.value = true
    session.value?.pause('viewport')
  } else if (viewportPaused.value) {
    viewportPaused.value = false
    resumeAfterViewportRecovery('viewport')
  }
}

function syncVisibility() {
  if (document.hidden) {
    visibilityPaused.value = true
    clearKeyboardIntent()
    session.value?.pause('visibility')
    return
  }

  visibilityPaused.value = false
  session.value?.resume('visibility')
}

function isBound(action: ControlAction, key: string) {
  return props.settings.keyBindings[action].includes(key)
}

function isMovementKey(key: string) {
  return (['moveUp', 'moveDown', 'moveLeft', 'moveRight'] as const).some((action) => isBound(action, key))
}

function syncKeyboardIntent() {
  movementIntent = mergeMovementIntent({
    up: props.settings.keyBindings.moveUp.some((key) => pressedKeys.has(key)),
    down: props.settings.keyBindings.moveDown.some((key) => pressedKeys.has(key)),
    left: props.settings.keyBindings.moveLeft.some((key) => pressedKeys.has(key)),
    right: props.settings.keyBindings.moveRight.some((key) => pressedKeys.has(key)),
  })
  restoreMovementIntent()
}

function restoreMovementIntent() {
  session.value?.setInputIntent(movementIntent)
}

function handleKeyDown(event: KeyboardEvent) {
  if (props.inputSuspended) {
    return
  }
  const key = normalizeBindingKey(event.key)
  if (isBound('pause', key)) {
    event.preventDefault()
    if (!event.repeat) {
      togglePause()
    }
    return
  }
  if (isBound('castSpell', key)) {
    event.preventDefault()
    if (!event.repeat) {
      session.value?.castSpell()
    }
    return
  }
  if (!isMovementKey(key)) {
    return
  }

  event.preventDefault()
  pressedKeys.add(key)
  syncKeyboardIntent()
}

function handleKeyUp(event: KeyboardEvent) {
  const key = normalizeBindingKey(event.key)
  if (!isMovementKey(key)) {
    return
  }

  event.preventDefault()
  pressedKeys.delete(key)
  syncKeyboardIntent()
}

function clearKeyboardIntent() {
  pressedKeys.clear()
  movementIntent = createInputIntent()
  restoreMovementIntent()
}

onMounted(() => {
  const mount = battleMount.value
  if (!mount) {
    return
  }

  session.value = createBattleSession({
    parent: mount,
    onEvent: handleSessionEvent,
    viewport: viewport.value,
    renderScale: computeRenderScale({
      quality: props.settings.quality,
      devicePixelRatio: window.devicePixelRatio,
      desktop: desktopMedia.matches,
    }),
    reducedMotion: props.settings.reducedMotion,
    compactRadar: !desktopMedia.matches,
    runSeed: Date.now(),
    elapsedTimeScale: import.meta.env.DEV && new URLSearchParams(window.location.search).get('e2e-time') === '30'
      ? 30
      : 1,
  })
  window.addEventListener('resize', syncViewport)
  window.addEventListener('blur', clearKeyboardIntent)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  document.addEventListener('visibilitychange', syncVisibility)
  desktopMedia.addEventListener('change', syncViewport)
  syncViewport()
})

onUnmounted(() => {
  window.removeEventListener('resize', syncViewport)
  window.removeEventListener('blur', clearKeyboardIntent)
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  document.removeEventListener('visibilitychange', syncVisibility)
  desktopMedia.removeEventListener('change', syncViewport)
  session.value?.dispose()
})
</script>

<template>
  <section
    class="battlefield relative min-h-svh overflow-hidden bg-[#08100d]"
    :class="{ 'battlefield--with-wings': viewport.hasInformationWings }"
    :style="battlefieldStyle"
  >
    <div class="battlefield__stage">
      <div
        ref="battleMount"
        class="battlefield__canvas absolute inset-0"
        aria-label="青石岭战场"
        aria-description="战场雷达显示主角位置、妖物密度、精英妖物场内生命条、妖王与灵蕴"
        data-testid="battlefield-canvas"
      />
    </div>

    <div class="battlefield__toolbar absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-30 flex gap-2">
      <button class="battlefield__tool-button" type="button" @click="emit('toggleFullscreen')">
        全屏
      </button>
      <button class="battlefield__tool-button" type="button" @click="togglePause">
        暂停
      </button>
    </div>

    <BattleTouchControls @cast="castSpell" @move="setTouchIntent" />
    <BattleHud :snapshot="hudSnapshot" :key-bindings="settings.keyBindings" />

    <div v-if="endingNotice" class="battlefield__ending" role="status" aria-live="assertive">
      <small>{{ endingNotice.result === 'victory' ? '妖王伏诛' : '致命一击' }}</small>
      <strong>{{ endingNotice.result === 'victory' ? '青石岭暂安' : damageSourceLabels[endingNotice.source] }}</strong>
    </div>

    <OnboardingGuide v-if="onboardingStep" :step="onboardingStep" @skip="skipOnboarding" />

    <InitialArtifactSelectionModal
      v-if="initialSelectionOpen"
      :candidates="initialArtifactCandidates"
      @select="selectInitialArtifact"
    />

    <UpgradeSelectionModal
      v-if="upgradeModalOpen"
      :choices="upgradeChoices"
      :ascensions="ascensionChoices"
      :deduction-count="deductionCount"
      :can-deduce="canDeduce"
      :is-zhou-tian="isZhouTian"
      @select="selectUpgrade"
      @select-ascension="selectAscension"
      @skip-ascension="skipAscension"
      @deduce="deduceUpgrade"
      @tuna="tunaHeal"
    />

    <div
      v-if="showPause || orientationPaused || viewportPaused"
      class="absolute inset-0 z-40 grid place-items-center bg-stone-950/78 p-5 backdrop-blur-sm"
      role="dialog"
      aria-label="历练暂停"
    >
      <div class="w-full max-w-sm rounded-lg border border-amber-100/30 bg-[#18231e] p-7 text-center shadow-2xl">
        <p class="text-sm tracking-[0.32em] text-amber-100/70">历练暂停</p>
        <h2 class="mt-3 font-serif text-3xl font-bold text-amber-50">
          {{ pauseTitle }}
        </h2>
        <p class="mt-4 text-sm leading-6 text-stone-300">
          {{ pauseDescription }}
        </p>
        <button
          v-if="!orientationPaused && !viewportPaused"
          class="game-button mt-7 w-full"
          type="button"
          @click="continueRun"
        >
          继续历练
        </button>
        <button
          v-if="!orientationPaused && !viewportPaused"
          class="game-button game-button--quiet mt-3 w-full"
          type="button"
          @click="emit('openSettings')"
        >
          设置与键位
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.battlefield {
  touch-action: none;
}

.battlefield__ending {
  position: absolute;
  z-index: 35;
  left: 50%;
  top: 42%;
  display: grid;
  min-width: 16rem;
  gap: 0.35rem;
  border-block: 1px solid rgb(253 230 138 / 0.42);
  background: rgb(2 7 5 / 0.82);
  padding: 0.8rem 2rem;
  color: #fff3c4;
  text-align: center;
  transform: translate(-50%, -50%);
  backdrop-filter: blur(8px);
}

.battlefield__ending small { color: rgb(253 230 138 / 0.62); font-size: 0.65rem; letter-spacing: 0.28em; }
.battlefield__ending strong { font-family: "STKaiti", "KaiTi", serif; font-size: 1.65rem; }

.battlefield__stage {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(100vw, calc(100svh * var(--battle-aspect)));
  height: min(100svh, calc(100vw / var(--battle-aspect)));
  transform: translate(-50%, -50%);
  box-shadow: 0 0 5rem rgb(4 16 11 / 0.8);
}

.battlefield__canvas :deep(canvas) {
  height: 100% !important;
  max-height: 100%;
  max-width: 100%;
  width: 100% !important;
}

.battlefield__canvas {
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
}

.battlefield__tool-button {
  min-height: 2.5rem;
  border: 1px solid rgb(231 229 228 / 0.28);
  border-radius: 0.25rem;
  background: rgb(12 18 15 / 0.76);
  padding: 0.55rem 0.8rem;
  color: rgb(245 245 244);
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  backdrop-filter: blur(10px);
}

.battlefield__tool-button:hover,
.battlefield__tool-button:focus-visible {
  border-color: rgb(253 230 138 / 0.7);
  color: rgb(254 243 199);
  outline: none;
}
</style>
