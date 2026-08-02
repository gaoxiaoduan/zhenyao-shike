<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef, useTemplateRef } from 'vue'
import type { UpgradeChoice } from '../game/domain/artifactInventory'
import { createInputIntent, mergeMovementIntent, type InputIntent } from '../game/domain/inputIntent'
import type { BaseArtifact } from '../game/domain/initialArtifactSelection'
import {
  completeOnboardingStep,
  createOnboardingProgress,
  nextOnboardingStep,
  type OnboardingProgress,
} from '../game/domain/onboardingProgress'
import { createBattleSession } from '../game/phaser/createBattleSession'
import type { GameSession, GameSessionEvent, OnboardingStep } from '../game/session/GameSession'
import BattleTouchControls from './BattleTouchControls.vue'
import InitialArtifactSelectionModal from './InitialArtifactSelectionModal.vue'
import OnboardingGuide from './OnboardingGuide.vue'
import UpgradeSelectionModal from './UpgradeSelectionModal.vue'

const props = withDefaults(defineProps<{
  showOnboarding?: boolean
}>(), {
  showOnboarding: true,
})

const emit = defineEmits<{
  finished: [result: 'victory' | 'defeat']
  onboardingCompleted: []
}>()

const battleMount = useTemplateRef<HTMLElement>('battleMount')
const session = shallowRef<GameSession | null>(null)
const showPause = shallowRef(false)
const orientationPaused = shallowRef(false)
const pressedKeys = new Set<string>()
const initialArtifactCandidates = shallowRef<readonly BaseArtifact[]>([])
const upgradeChoices = shallowRef<readonly UpgradeChoice[]>([])
const onboardingProgress = shallowRef<OnboardingProgress>(createOnboardingProgress())

const initialSelectionOpen = computed(() => initialArtifactCandidates.value.length > 0)
const upgradeModalOpen = computed(() => upgradeChoices.value.length > 0)
const onboardingStep = computed(() => props.showOnboarding ? nextOnboardingStep(onboardingProgress.value) : null)

function handleSessionEvent(event: GameSessionEvent) {
  if (event.type === 'initial-artifact-selection-requested') {
    initialArtifactCandidates.value = event.candidates
    return
  }

  if (event.type === 'upgrade-requested') {
    upgradeChoices.value = event.choices
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

  emit('finished', event.result)
}

function selectInitialArtifact(artifactId: BaseArtifact['id']) {
  session.value?.selectInitialArtifact(artifactId)
  initialArtifactCandidates.value = []
}

function selectUpgrade(choiceId: string) {
  session.value?.selectUpgrade(choiceId)
  upgradeChoices.value = []
  session.value?.resume('upgrade')
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
  session.value?.setInputIntent(intent)
}

function castSpell() {
  session.value?.setInputIntent(createInputIntent({ castSpell: true }))
}

function togglePause() {
  if (showPause.value) {
    continueRun()
    return
  }

  showPause.value = true
  session.value?.pause('manual')
}

function continueRun() {
  if (orientationPaused.value) {
    return
  }

  showPause.value = false
  session.value?.resume('manual')
}

function syncOrientation() {
  if (window.innerHeight <= window.innerWidth) {
    if (orientationPaused.value) {
      orientationPaused.value = false
      showPause.value = true
      session.value?.pause('manual')
      session.value?.resume('orientation')
    }
    return
  }

  orientationPaused.value = true
  session.value?.pause('orientation')
}

function syncVisibility() {
  if (document.hidden) {
    pressedKeys.clear()
    syncKeyboardIntent()
    session.value?.pause('visibility')
    return
  }

  session.value?.resume('visibility')
}

function isMovementKey(key: string) {
  return ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)
}

function syncKeyboardIntent() {
  session.value?.setInputIntent(
    mergeMovementIntent({
      up: pressedKeys.has('w') || pressedKeys.has('arrowup'),
      down: pressedKeys.has('s') || pressedKeys.has('arrowdown'),
      left: pressedKeys.has('a') || pressedKeys.has('arrowleft'),
      right: pressedKeys.has('d') || pressedKeys.has('arrowright'),
    }),
  )
}

function handleKeyDown(event: KeyboardEvent) {
  const key = event.key.toLowerCase()
  if (key === 'escape') {
    event.preventDefault()
    togglePause()
    return
  }
  if (key === ' ' || key === 'e') {
    event.preventDefault()
    session.value?.setInputIntent(createInputIntent({ castSpell: true }))
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
  const key = event.key.toLowerCase()
  if (!isMovementKey(key)) {
    return
  }

  event.preventDefault()
  pressedKeys.delete(key)
  syncKeyboardIntent()
}

onMounted(() => {
  const mount = battleMount.value
  if (!mount) {
    return
  }

  session.value = createBattleSession({ parent: mount, onEvent: handleSessionEvent })
  window.addEventListener('resize', syncOrientation)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  document.addEventListener('visibilitychange', syncVisibility)
  syncOrientation()
})

onUnmounted(() => {
  window.removeEventListener('resize', syncOrientation)
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  document.removeEventListener('visibilitychange', syncVisibility)
  session.value?.dispose()
})
</script>

<template>
  <section class="battlefield relative min-h-svh overflow-hidden bg-[#12251d]">
    <div ref="battleMount" class="battlefield__canvas absolute inset-0" aria-label="青石岭战场" />

    <button
      class="absolute right-4 top-[max(4.5rem,calc(env(safe-area-inset-top)+4.5rem))] z-30 rounded-md border border-stone-100/30 bg-stone-950/65 px-3 py-2 text-xs tracking-[0.2em] text-stone-100 backdrop-blur-sm"
      type="button"
      @click="togglePause"
    >
      暂停
    </button>

    <BattleTouchControls @cast="castSpell" @move="setTouchIntent" />

    <OnboardingGuide v-if="onboardingStep" :step="onboardingStep" @skip="skipOnboarding" />

    <InitialArtifactSelectionModal
      v-if="initialSelectionOpen"
      :candidates="initialArtifactCandidates"
      @select="selectInitialArtifact"
    />

    <UpgradeSelectionModal
      v-if="upgradeModalOpen"
      :choices="upgradeChoices"
      @select="selectUpgrade"
    />

    <div
      v-if="showPause || orientationPaused"
      class="absolute inset-0 z-40 grid place-items-center bg-stone-950/78 p-5 backdrop-blur-sm"
      role="dialog"
      aria-label="历练暂停"
    >
      <div class="w-full max-w-sm rounded-lg border border-amber-100/30 bg-[#18231e] p-7 text-center shadow-2xl">
        <p class="text-sm tracking-[0.32em] text-amber-100/70">历练暂停</p>
        <h2 class="mt-3 font-serif text-3xl font-bold text-amber-50">
          {{ orientationPaused ? '请旋转设备' : '暂避妖潮' }}
        </h2>
        <p class="mt-4 text-sm leading-6 text-stone-300">
          {{ orientationPaused ? '横屏后点击继续，战场才会恢复。' : '自动攻击与妖潮已完全暂停。' }}
        </p>
        <button
          v-if="!orientationPaused"
          class="game-button mt-7 w-full"
          type="button"
          @click="continueRun"
        >
          继续历练
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.battlefield {
  touch-action: none;
}

.battlefield__canvas :deep(canvas) {
  max-height: 100%;
  max-width: 100%;
}

.battlefield__canvas {
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
}
</style>
