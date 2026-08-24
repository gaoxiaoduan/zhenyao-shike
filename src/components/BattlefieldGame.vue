<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef, useTemplateRef, watch } from 'vue'
import {
  createPlayerIntentModule,
  type PlayerInput,
  type PlayerIntent,
} from '../game/domain/playerIntent'
import type { BaseArtifact } from '../game/domain/initialArtifactSelection'
import { createBattleSession } from '../game/phaser/createBattleSession'
import type { AudioIntent } from '../game/audio/audioDirector'
import type { DamageSource, RunSummary } from '../game/domain/runSummary'
import { computeBattleViewport, computeRenderScale } from '../game/platform/viewportPolicy'
import type { GameSettings } from '../game/settings/gameSettings'
import type {
  BattleHudSnapshot,
  BattleInstrumentationSnapshot,
  GameSession,
  GameSessionEffect,
  GameSessionSnapshot,
} from '../game/session/GameSession'
import BattleTouchControls from './BattleTouchControls.vue'
import BattleHud from './game/BattleHud.vue'
import InitialArtifactSelectionModal from './InitialArtifactSelectionModal.vue'
import OnboardingGuide from './OnboardingGuide.vue'
import UpgradeSelectionModal from './UpgradeSelectionModal.vue'

const props = withDefaults(defineProps<{
  showOnboarding?: boolean
  settings: GameSettings
  inputSuspended?: boolean
  practiceMode?: boolean
  compactMode?: boolean
}>(), {
  showOnboarding: true,
  inputSuspended: false,
  practiceMode: false,
  compactMode: false,
})

const emit = defineEmits<{
  finished: [summary: RunSummary]
  onboardingCompleted: []
  toggleFullscreen: []
  toggleCompactMode: []
  openSettings: []
  audioIntent: [intent: AudioIntent]
}>()

const battleMount = useTemplateRef<HTMLElement>('battleMount')
const session = shallowRef<GameSession | null>(null)
const playerInput = createPlayerIntentModule({
  getKeyBindings: () => props.settings.keyBindings,
})
const inputResetRevision = shallowRef(0)
const desktopMedia = window.matchMedia('(hover: hover) and (pointer: fine)')
const viewport = shallowRef(computeBattleViewport({
  width: window.innerWidth,
  height: window.innerHeight,
  desktop: desktopMedia.matches,
  compact: props.compactMode,
}))
const emptySnapshot: GameSessionSnapshot = {
  lifecycle: 'active',
  pause: { active: false, presentation: null },
  decision: null,
  hud: null,
  onboardingStep: null,
  onboardingCompleted: false,
  result: null,
}
const sessionSnapshot = shallowRef<GameSessionSnapshot>(emptySnapshot)
const hudSnapshot = computed<BattleHudSnapshot | null>(() => sessionSnapshot.value.hud)
const initialDecision = computed(() => sessionSnapshot.value.decision?.type === 'initial-artifact-selection'
  ? sessionSnapshot.value.decision
  : null)
const upgradeDecision = computed(() => sessionSnapshot.value.decision?.type === 'upgrade'
  ? sessionSnapshot.value.decision
  : null)
const ascensionDecision = computed(() => sessionSnapshot.value.decision?.type === 'ascension'
  ? sessionSnapshot.value.decision
  : null)
const eventNotice = computed(() => sessionSnapshot.value.decision?.type === 'battlefield-event'
  ? sessionSnapshot.value.decision.event
  : null)
const endingNotice = computed(() => sessionSnapshot.value.result?.state === 'ending'
  ? sessionSnapshot.value.result
  : null)
let finishedSummary: RunSummary | null = null
let onboardingCompletionNotified = false
const e2eTimeScale = (import.meta.env.DEV || import.meta.env.VITE_E2E === '1')
  && new URLSearchParams(window.location.search).get('e2e-time') === '30'
  ? 30
  : 1

function recordE2eInstrumentation(snapshot: BattleInstrumentationSnapshot) {
  const mount = battleMount.value
  if (!mount || e2eTimeScale === 1) {
    return
  }
  mount.setAttribute('data-radar-rendered', String(snapshot.radarRendered))
  mount.setAttribute('data-radar-enemy-regions', String(snapshot.radarEnemyRegions))
  mount.setAttribute('data-radar-spirit-regions', String(snapshot.radarSpiritRegions))
  mount.setAttribute('data-radar-landmarks', String(snapshot.radarLandmarks))
  mount.setAttribute('data-movement-distance', String(snapshot.distanceTravelled))
  mount.setAttribute('data-presentation-checkpoint', snapshot.presentationCheckpoint ?? '')
  mount.setAttribute('data-presentation-player-pose', snapshot.presentationPlayerPose)
  mount.setAttribute('data-presentation-artifact-shapes', snapshot.presentationArtifactShapes.join(','))
  mount.setAttribute('data-presentation-boss-halo', snapshot.presentationBossHalo ?? '')
  mount.setAttribute('data-presentation-boss-telegraph', snapshot.presentationBossTelegraph ?? '')
}

const damageSourceLabels: Readonly<Record<DamageSource, string>> = {
  'ordinary-enemy': '寻常妖物围攻',
  'elite-enemy': '精英妖物破阵',
  'wolf-king-contact': '啸月狼王扑击',
  'moon-howl': '狼王月啸',
  unknown: '妖潮压境',
}

const initialSelectionOpen = computed(() => initialDecision.value !== null)
const upgradeModalOpen = computed(() => upgradeDecision.value !== null || ascensionDecision.value !== null)
const onboardingStep = computed(() => props.showOnboarding ? sessionSnapshot.value.onboardingStep : null)
const pausePresentation = computed(() => sessionSnapshot.value.pause.presentation)
const pauseOverlayOpen = computed(() => pausePresentation.value === 'manual'
  || pausePresentation.value === 'orientation'
  || pausePresentation.value === 'viewport'
  || pausePresentation.value === 'window-blur'
  || pausePresentation.value === 'window-focus-confirmation'
  || pausePresentation.value === 'orientation-confirmation')
const battlefieldStyle = computed(() => ({
  '--battle-aspect': viewport.value.aspectRatio.toString(),
}))
const pauseTitle = computed(() => {
  if (pausePresentation.value === 'orientation') {
    return '请旋转设备'
  }
  if (pausePresentation.value === 'viewport') {
    return '请扩大窗口'
  }
  if (pausePresentation.value === 'orientation-confirmation') {
    return '横屏已恢复'
  }
  if (pausePresentation.value === 'window-blur') {
    return '窗口已失焦'
  }
  if (pausePresentation.value === 'window-focus-confirmation') {
    return '窗口已恢复'
  }
  return '暂避妖潮'
})
const pauseDescription = computed(() => {
  if (pausePresentation.value === 'orientation') {
    return '横屏后点击继续，战场才会恢复。'
  }
  if (pausePresentation.value === 'viewport') {
    return '桌面战场至少需要 960 × 540 的可用空间。'
  }
  if (pausePresentation.value === 'orientation-confirmation') {
    return '已恢复横屏，点击继续后战场才会恢复。'
  }
  if (pausePresentation.value === 'window-blur') {
    return '小窗已失去焦点，战场已暂停。'
  }
  if (pausePresentation.value === 'window-focus-confirmation') {
    return '窗口已恢复焦点，点击继续后战场才会恢复。'
  }
  return '自动攻击与妖潮已完全暂停。'
})
watch(() => props.inputSuspended, (suspended) => {
  if (suspended) {
    resetPlayerInput()
  }
  session.value?.setInputSuspended(suspended)
})
watch(() => props.settings.reducedMotion, (reducedMotion) => {
  session.value?.setReducedMotion(reducedMotion)
})
watch(() => props.compactMode, () => {
  syncViewport()
})

function handleSessionSnapshot(snapshot: GameSessionSnapshot) {
  const previousPausePresentation = sessionSnapshot.value.pause.presentation
  const wasOnboardingCompleted = sessionSnapshot.value.onboardingCompleted
  sessionSnapshot.value = snapshot
  if (shouldResetInputForPause(snapshot.pause.presentation)
    && snapshot.pause.presentation !== previousPausePresentation) {
    resetPlayerInput()
  }
  if (props.showOnboarding && !wasOnboardingCompleted && snapshot.onboardingCompleted && !onboardingCompletionNotified) {
    onboardingCompletionNotified = true
    emit('onboardingCompleted')
  }
  if (snapshot.result?.state === 'ended' && snapshot.result.summary !== finishedSummary) {
    finishedSummary = snapshot.result.summary
    emit('finished', snapshot.result.summary)
  }
}

function handleSessionEffect(effect: GameSessionEffect) {
  if (effect.type === 'audio') {
    emit('audioIntent', effect.intent)
  }
}

function selectInitialArtifact(artifactId: BaseArtifact['id']) {
  const decision = initialDecision.value
  if (decision) {
    session.value?.selectInitialArtifact(decision.id, artifactId)
  }
}

function selectUpgrade(choiceId: string) {
  const decision = upgradeDecision.value
  if (decision) {
    session.value?.selectUpgrade(decision.id, choiceId)
  }
}

function selectAscension(choiceId: string) {
  const decision = ascensionDecision.value
  if (decision) {
    session.value?.selectAscension(decision.id, choiceId)
  }
}

function skipAscension() {
  const decision = ascensionDecision.value
  if (decision) {
    session.value?.skipAscension(decision.id)
  }
}

function deduceUpgrade() {
  const decision = upgradeDecision.value
  if (decision) {
    session.value?.deduceUpgrade(decision.id)
  }
}

function tunaHeal() {
  const decision = upgradeDecision.value ?? ascensionDecision.value
  if (decision) {
    session.value?.tunaHeal(decision.id)
  }
}

function skipOnboarding() {
  session.value?.skipOnboarding()
}

function dispatchPlayerInput(input: PlayerInput, event?: Event) {
  const result = playerInput.dispatch(input)
  if (result.preventDefault) {
    event?.preventDefault()
  }
  if (result.intents.some((intent) => intent.type === 'clear-input')) {
    inputResetRevision.value += 1
  }
  const gameplayInputBlocked = sessionSnapshot.value.pause.active
    && sessionSnapshot.value.pause.presentation !== 'decision'
  let resetAfterDroppedIntent = false
  for (const intent of result.intents) {
    if (gameplayInputBlocked && (intent.type === 'movement' || intent.type === 'cast-spell')) {
      resetAfterDroppedIntent = true
      continue
    }
    applyPlayerIntent(intent)
  }
  if (resetAfterDroppedIntent) {
    resetPlayerInput()
  }
}

function shouldResetInputForPause(presentation: GameSessionSnapshot['pause']['presentation']) {
  return presentation === 'orientation' || presentation === 'viewport'
}

function resetPlayerInput() {
  dispatchPlayerInput({ type: 'input-reset' })
}

function applyPlayerIntent(intent: PlayerIntent) {
  if (intent.type === 'movement') {
    session.value?.setInputIntent(intent.intent)
  } else if (intent.type === 'cast-spell') {
    session.value?.castSpell()
  } else if (intent.type === 'clear-input') {
    session.value?.clearInputIntent()
  } else {
    toggleSessionPause()
  }
}

function handleTouchMove(movement: { readonly moveX: number; readonly moveY: number }) {
  dispatchPlayerInput({ type: 'touch-move', ...movement })
}

function handleTouchEnd() {
  dispatchPlayerInput({ type: 'touch-end' })
}

function castSpell() {
  dispatchPlayerInput({ type: 'touch-cast' })
}

function resumeEventNotice() {
  const decision = sessionSnapshot.value.decision
  if (decision?.type === 'battlefield-event') {
    session.value?.confirmBattlefieldEvent(decision.id)
  }
}

function togglePause() {
  dispatchPlayerInput({ type: 'pause-requested' })
}

function toggleSessionPause() {
  if (pausePresentation.value === 'manual') {
    session.value?.releaseManualPause()
    return
  }

  session.value?.requestManualPause()
}

function continueRun() {
  if (pausePresentation.value === 'manual') {
    session.value?.releaseManualPause()
  } else if (pausePresentation.value === 'orientation-confirmation') {
    session.value?.confirmOrientation()
  } else if (pausePresentation.value === 'window-focus-confirmation') {
    session.value?.confirmWindowFocus()
  }
}

function syncViewport() {
  const nextViewport = computeBattleViewport({
    width: window.innerWidth,
    height: window.innerHeight,
    desktop: desktopMedia.matches,
    compact: props.compactMode,
  })
  viewport.value = nextViewport
  session.value?.resize(nextViewport)
}

function syncVisibility() {
  if (document.hidden) {
    resetPlayerInput()
  }
  session.value?.setPageVisible(!document.hidden)
}

function handleWindowBlur() {
  resetPlayerInput()
  if (props.compactMode) {
    session.value?.setWindowFocused(false)
  }
}

function handleWindowFocus() {
  if (props.compactMode) {
    session.value?.setWindowFocused(true)
  }
}

function handleKeyDown(event: KeyboardEvent) {
  if (props.inputSuspended) {
    return
  }
  dispatchPlayerInput({ type: 'keyboard-key-down', key: event.key, repeat: event.repeat }, event)
}

function handleKeyUp(event: KeyboardEvent) {
  dispatchPlayerInput({ type: 'keyboard-key-up', key: event.key }, event)
}

onMounted(() => {
  const mount = battleMount.value
  if (!mount) {
    return
  }

  session.value = createBattleSession({
    parent: mount,
    onSnapshot: handleSessionSnapshot,
    onEffect: handleSessionEffect,
    viewport: viewport.value,
    renderScale: computeRenderScale({
      quality: props.settings.quality,
      devicePixelRatio: window.devicePixelRatio,
      desktop: desktopMedia.matches,
    }),
    reducedMotion: props.settings.reducedMotion,
    compactRadar: !desktopMedia.matches || props.compactMode,
    runSeed: Date.now(),
    elapsedTimeScale: e2eTimeScale,
    onInstrumentation: e2eTimeScale > 1 ? recordE2eInstrumentation : undefined,
    deterministicAcceptance: e2eTimeScale > 1,
    practiceMode: props.practiceMode,
  })
  session.value.setInputSuspended(props.inputSuspended)
  window.addEventListener('resize', syncViewport)
  window.addEventListener('blur', handleWindowBlur)
  window.addEventListener('focus', handleWindowFocus)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  document.addEventListener('visibilitychange', syncVisibility)
  desktopMedia.addEventListener('change', syncViewport)
  syncViewport()
  syncVisibility()
})

onUnmounted(() => {
  window.removeEventListener('resize', syncViewport)
  window.removeEventListener('blur', handleWindowBlur)
  window.removeEventListener('focus', handleWindowFocus)
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
    :class="{
      'battlefield--with-wings': viewport.hasInformationWings && !props.compactMode,
      'battlefield--compact': props.compactMode,
    }"
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
      <button
        v-if="desktopMedia.matches || props.compactMode"
        class="battlefield__tool-button"
        type="button"
        :aria-label="props.compactMode ? '切换标准布局' : '切换小窗布局'"
        @click="emit('toggleCompactMode')"
      >
        {{ props.compactMode ? '标准布局' : '小窗' }}
      </button>
      <button class="battlefield__tool-button" type="button" @click="togglePause">
        暂停
      </button>
    </div>

    <BattleTouchControls
      :snapshot="hudSnapshot"
      :input-reset-revision="inputResetRevision"
      @cast="castSpell"
      @end="handleTouchEnd"
      @move="handleTouchMove"
    />
    <BattleHud :snapshot="hudSnapshot" :key-bindings="settings.keyBindings" :compact="props.compactMode" />

    <div v-if="endingNotice" class="battlefield__ending" role="status" aria-live="assertive">
      <small>{{ endingNotice.result === 'victory' ? '妖王伏诛' : '致命一击' }}</small>
      <strong>{{ endingNotice.result === 'victory' ? '青石岭暂安' : damageSourceLabels[endingNotice.source] }}</strong>
    </div>

    <div
      v-if="eventNotice"
      class="absolute inset-0 z-50 grid place-items-center bg-stone-950/56 p-5 backdrop-blur-[2px]"
      role="dialog"
      aria-label="战场事件说明"
    >
      <div class="battlefield__event-card w-full max-w-md rounded-lg border border-cyan-100/35 bg-[#10251f]/95 p-7 shadow-2xl">
        <p class="text-xs font-bold tracking-[0.32em] text-cyan-100/70">战场事件</p>
        <h2 class="mt-3 font-serif text-3xl font-bold text-cyan-50">{{ eventNotice.name }}</h2>
        <p class="mt-4 text-sm leading-7 text-stone-200">{{ eventNotice.objective }}</p>
        <p class="mt-3 text-xs font-bold tracking-[0.12em] text-cyan-100/75">
          当前期限：{{ Math.ceil(eventNotice.remainingMs / 1000) }} 秒
        </p>
        <p class="mt-3 border-l-2 border-amber-200/60 pl-3 text-sm leading-6 text-amber-100/85">奖励：{{ eventNotice.reward }}</p>
        <button class="game-button mt-7 w-full" type="button" @click="resumeEventNotice">记住规则，继续历练</button>
      </div>
    </div>

    <OnboardingGuide v-if="onboardingStep" :step="onboardingStep" @skip="skipOnboarding" />

    <InitialArtifactSelectionModal
      v-if="initialSelectionOpen"
      :candidates="initialDecision?.candidates ?? []"
      @select="selectInitialArtifact"
    />

    <UpgradeSelectionModal
      v-if="upgradeModalOpen"
      :choices="upgradeDecision?.choices ?? []"
      :ascensions="ascensionDecision?.choices ?? []"
      :deduction-count="upgradeDecision?.deductionCount ?? 0"
      :can-deduce="upgradeDecision?.canDeduce ?? false"
      :is-zhou-tian="upgradeDecision?.isZhouTian ?? false"
      @select="selectUpgrade"
      @select-ascension="selectAscension"
      @skip-ascension="skipAscension"
      @deduce="deduceUpgrade"
      @tuna="tunaHeal"
    />

    <div
      v-if="pauseOverlayOpen"
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
          v-if="pausePresentation === 'manual' || pausePresentation === 'orientation-confirmation' || pausePresentation === 'window-focus-confirmation'"
          class="game-button mt-7 w-full"
          type="button"
          @click="continueRun"
        >
          继续历练
        </button>
        <button
          v-if="pausePresentation === 'manual'"
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
  isolation: isolate;
  width: min(100vw, calc(100svh * var(--battle-aspect)));
  height: min(100svh, calc(100vw / var(--battle-aspect)));
  transform: translate(-50%, -50%);
  box-shadow: 0 0 5rem rgb(4 16 11 / 0.8);
}

.battlefield__stage::before {
  position: absolute;
  inset: 0;
  z-index: 5;
  border: 1px solid rgb(245 216 138 / 0.14);
  background:
    radial-gradient(circle at 50% 46%, transparent 0 35%, rgb(3 9 6 / 0.06) 64%, rgb(3 9 6 / 0.42) 100%),
    linear-gradient(180deg, rgb(1 8 5 / 0.08), transparent 22%, transparent 72%, rgb(1 8 5 / 0.24));
  box-shadow: inset 0 0 4rem rgb(1 7 4 / 0.25);
  content: "";
  pointer-events: none;
}

.battlefield__stage::after {
  position: absolute;
  inset: 0.6rem;
  z-index: 6;
  border: 1px solid rgb(167 243 208 / 0.06);
  content: "";
  pointer-events: none;
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
  border: 1px solid rgb(231 229 228 / 0.32);
  border-radius: 0.25rem;
  background: linear-gradient(135deg, rgb(23 40 29 / 0.86), rgb(12 18 15 / 0.78));
  padding: 0.55rem 0.8rem;
  color: rgb(245 245 244);
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  box-shadow: inset 0 1px rgb(255 255 255 / 0.06), 0 0.5rem 1.25rem rgb(0 0 0 / 0.24);
  transition: border-color 160ms ease, background-color 160ms ease, transform 160ms ease;
  backdrop-filter: blur(10px);
}

.battlefield__tool-button:hover,
.battlefield__tool-button:focus-visible {
  border-color: rgb(253 230 138 / 0.7);
  color: rgb(254 243 199);
  outline: none;
}

.battlefield__tool-button:active {
  transform: translateY(1px);
}
</style>
