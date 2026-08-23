<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import ArtifactIcon from './game/ArtifactIcon.vue'
import type { BattleHudSnapshot } from '../game/session/GameSession'

const props = withDefaults(defineProps<{
  snapshot?: BattleHudSnapshot | null
  inputResetRevision?: number
}>(), {
  snapshot: null,
  inputResetRevision: 0,
})

interface JoystickCenter {
  readonly x: number
  readonly y: number
}

const emit = defineEmits<{
  move: [movement: { readonly moveX: number; readonly moveY: number }]
  cast: []
  end: []
}>()

const joystickCenter = shallowRef<JoystickCenter | null>(null)
const thumbOffset = shallowRef({ x: 0, y: 0 })
const activePointerId = shallowRef<number | null>(null)

function resetMovement() {
  activePointerId.value = null
  joystickCenter.value = null
  thumbOffset.value = { x: 0, y: 0 }
}

watch(() => props.inputResetRevision, resetMovement)

function updateMovement(event: PointerEvent) {
  const center = joystickCenter.value
  if (!center || activePointerId.value !== event.pointerId) {
    return
  }

  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const deltaX = event.clientX - bounds.left - center.x
  const deltaY = event.clientY - bounds.top - center.y
  const magnitude = Math.hypot(deltaX, deltaY)
  const clamp = magnitude > 58 ? 58 / magnitude : 1
  const offset = { x: deltaX * clamp, y: deltaY * clamp }

  thumbOffset.value = offset
  emit('move', { moveX: offset.x / 58, moveY: offset.y / 58 })
}

function beginMovement(event: PointerEvent) {
  const zone = event.currentTarget as HTMLElement
  const bounds = zone.getBoundingClientRect()
  activePointerId.value = event.pointerId
  joystickCenter.value = { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
  thumbOffset.value = { x: 0, y: 0 }
  zone.setPointerCapture(event.pointerId)
  emit('move', { moveX: 0, moveY: 0 })
}

function endMovement(event: PointerEvent) {
  if (activePointerId.value !== event.pointerId) {
    return
  }

  resetMovement()
  emit('end')
}

function castSpell() {
  emit('cast')
}

</script>

<template>
  <div class="battle-touch-controls pointer-events-none absolute z-20">
    <div
      class="battle-touch-controls__move-zone pointer-events-auto absolute inset-y-0 left-0 w-[45%] touch-none"
      @pointercancel="endMovement"
      @pointerdown="beginMovement"
      @pointermove="updateMovement"
      @pointerup="endMovement"
    >
      <div
        v-if="joystickCenter"
        class="battle-touch-controls__joystick absolute h-[7.25rem] w-[7.25rem] rounded-full border border-emerald-100/45 bg-emerald-950/35"
        :style="{ left: `${joystickCenter.x}px`, top: `${joystickCenter.y}px` }"
      >
        <div
          class="battle-touch-controls__thumb absolute left-1/2 top-1/2 h-[3.25rem] w-[3.25rem] rounded-full border border-emerald-100/75 bg-emerald-300/25"
          :style="{ transform: `translate(calc(-50% + ${thumbOffset.x}px), calc(-50% + ${thumbOffset.y}px))` }"
        />
      </div>
    </div>
    <button
      class="battle-touch-controls__spell pointer-events-auto absolute bottom-6 right-6 grid h-[5.5rem] w-[5.5rem] place-items-center rounded-full border border-sky-100/75 bg-sky-300/18 text-xs font-bold tracking-[0.16em] text-sky-50 shadow-[0_0_28px_rgba(125,211,252,.22)] touch-none active:scale-95"
      type="button"
      @pointerdown.prevent="castSpell"
    >
      <div
        class="battle-touch-controls__spell-icon"
        :class="{ 'battle-touch-controls__spell-icon--ready': !props.snapshot?.spellCooldownMs }"
        :style="{ '--spell-cooldown': `${Math.max(0, Math.min(1, (props.snapshot?.spellCooldownMs ?? 0) / 10_000)) * 100}%`, '--shield-progress': `${Math.max(0, Math.min(1, (props.snapshot?.spellShieldRemainingMs ?? 0) / 1_500)) * 100}%` }"
      >
        <ArtifactIcon id="protective-spell" label="玄光护身诀" />
        <span v-if="props.snapshot?.spellCooldownMs" class="battle-touch-controls__spell-mask" aria-hidden="true" />
        <span v-if="props.snapshot?.spellShieldRemainingMs" class="battle-touch-controls__shield-ring" aria-hidden="true" />
      </div>
      <span class="battle-touch-controls__spell-label">
        {{ props.snapshot?.spellShieldRemainingMs ? `护盾 ${Math.ceil(props.snapshot.spellShieldRemainingMs / 100) / 10}s` : props.snapshot?.spellCooldownMs ? `${Math.ceil(props.snapshot.spellCooldownMs / 1000)} 秒` : '玄光' }}
      </span>
    </button>
  </div>
</template>

<style scoped>
.battle-touch-controls__joystick {
  transform: translate(-50%, -50%);
}

.battle-touch-controls__thumb {
  transition: transform 35ms linear;
}

.battle-touch-controls__spell-label {
  position: absolute;
  bottom: 0.55rem;
  font-size: 0.6rem;
  letter-spacing: 0.18em;
}

.battle-touch-controls__spell-icon {
  position: relative;
  display: grid;
  place-items: center;
  width: 2.8rem;
  height: 2.8rem;
  border-radius: 0.45rem;
}

.battle-touch-controls__spell-icon--ready {
  filter: drop-shadow(0 0 0.5rem rgb(125 211 252 / 0.62));
}

.battle-touch-controls__spell-mask {
  position: absolute;
  inset: 0;
  border-radius: 0.45rem;
  background: conic-gradient(rgb(8 16 13 / 0.78) var(--spell-cooldown), transparent 0);
  pointer-events: none;
}

.battle-touch-controls__shield-ring {
  position: absolute;
  inset: -0.25rem;
  border: 2px solid #bae6fd;
  border-radius: 0.55rem;
  opacity: 0.9;
  transform: rotate(-90deg);
  clip-path: polygon(0 0, var(--shield-progress) 0, var(--shield-progress) 100%, 0 100%);
  pointer-events: none;
}

.battle-touch-controls__spell :deep(.artifact-icon) {
  width: 2.55rem;
  height: 2.55rem;
  border-color: rgb(186 230 253 / 0.62);
}

.battle-touch-controls {
  bottom: env(safe-area-inset-bottom);
  left: env(safe-area-inset-left);
  right: env(safe-area-inset-right);
  top: env(safe-area-inset-top);
}

@media (hover: hover) and (pointer: fine) {
  .battle-touch-controls {
    display: none;
  }
}
</style>
