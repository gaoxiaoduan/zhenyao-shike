<script setup lang="ts">
import type { BaseArtifact } from '../game/domain/initialArtifactSelection'
import ArtifactIcon from './game/ArtifactIcon.vue'
import { useChoiceDialogHotkeys } from './useChoiceDialogHotkeys'

const props = defineProps<{
  candidates: readonly BaseArtifact[]
}>()

const emit = defineEmits<{
  select: [artifactId: BaseArtifact['id']]
}>()

const { handleChoiceHotkey } = useChoiceDialogHotkeys((slot, event) => {
  const candidate = props.candidates[slot]
  if (!candidate) {
    return
  }

  event.preventDefault()
  emit('select', candidate.id)
})
</script>

<template>
  <div
    ref="dialog"
    class="initial-artifact-selection absolute inset-0 z-50 grid place-items-center bg-stone-950/82 p-5 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
    aria-label="选择初始法器"
    tabindex="-1"
    @keydown="handleChoiceHotkey"
  >
    <div class="initial-artifact-selection__card max-h-[calc(100svh-2.5rem)] w-full max-w-3xl overflow-y-auto rounded-lg border border-amber-100/30 bg-[#18231e] p-5 shadow-2xl sm:p-8">
      <p class="initial-artifact-selection__eyebrow text-center text-sm tracking-[0.32em] text-amber-100/70">初入青石岭</p>
      <h2 class="initial-artifact-selection__title mt-3 text-center font-serif text-3xl font-bold text-amber-50">择一法器傍身</h2>
      <p class="initial-artifact-selection__lead mx-auto mt-3 max-w-xl text-center text-sm leading-6 text-stone-300">
        妖物会主动逼近，法器会自行出手。选定后，开始这一场正式历练。
      </p>
      <div class="initial-artifact-selection__choices mt-7 grid gap-3 sm:grid-cols-3">
        <button
          v-for="artifact in candidates"
          :key="artifact.id"
          class="initial-artifact-selection__choice rounded-md border border-amber-100/25 bg-stone-950/35 p-4 text-left transition hover:border-amber-100/70 hover:bg-amber-100/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-100"
          type="button"
          @click="emit('select', artifact.id)"
        >
          <span class="flex items-center gap-3">
            <ArtifactIcon :id="artifact.id" :label="artifact.name" />
            <strong class="min-w-0 flex-1 text-base text-amber-100">{{ artifact.name }}</strong>
            <kbd class="rounded border border-amber-100/35 bg-stone-950/55 px-2 py-1 text-xs text-amber-100">
              按 {{ candidates.indexOf(artifact) + 1 }}
            </kbd>
          </span>
          <span class="mt-2 block text-sm leading-6 text-stone-300">{{ artifact.description }}</span>
        </button>
      </div>
      <p class="initial-artifact-selection__footer mt-5 text-center text-xs text-stone-400">桌面端：WASD / 方向键移动，Space / E 施放术法。</p>
    </div>
  </div>
</template>

<style scoped>
.initial-artifact-selection {
  background:
    radial-gradient(circle at 50% 40%, rgb(38 78 55 / 0.2), transparent 42%),
    rgb(3 8 6 / 0.86);
}

.initial-artifact-selection__card {
  position: relative;
  border-color: rgb(245 216 138 / 0.36);
  background:
    linear-gradient(135deg, rgb(27 47 35 / 0.98), rgb(9 20 15 / 0.98)),
    #18231e;
  box-shadow: 0 2rem 7rem rgb(0 0 0 / 0.72), inset 0 1px rgb(255 255 255 / 0.08);
}

.initial-artifact-selection__card::before,
.initial-artifact-selection__card::after {
  position: absolute;
  width: 2.2rem;
  height: 2.2rem;
  border-color: rgb(245 216 138 / 0.48);
  content: "";
  pointer-events: none;
}

.initial-artifact-selection__card::before {
  top: 0.75rem;
  left: 0.75rem;
  border-top: 1px solid;
  border-left: 1px solid;
}

.initial-artifact-selection__card::after {
  right: 0.75rem;
  bottom: 0.75rem;
  border-right: 1px solid;
  border-bottom: 1px solid;
}

.initial-artifact-selection__eyebrow {
  color: rgb(245 216 138 / 0.78);
}

.initial-artifact-selection__title {
  text-shadow: 0 0 1.5rem rgb(245 216 138 / 0.12);
}

.initial-artifact-selection__lead {
  color: rgb(231 229 228 / 0.78);
}

.initial-artifact-selection__choice {
  position: relative;
  border-color: rgb(245 216 138 / 0.24);
  background: linear-gradient(145deg, rgb(3 12 8 / 0.58), rgb(16 32 23 / 0.62));
  box-shadow: inset 0 1px rgb(255 255 255 / 0.04);
}

.initial-artifact-selection__choice::after {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  width: 0.35rem;
  height: 0.35rem;
  border: 1px solid rgb(245 216 138 / 0.72);
  content: "";
  transform: rotate(45deg);
}

.initial-artifact-selection__choice:hover,
.initial-artifact-selection__choice:focus-visible {
  border-color: rgb(255 243 196 / 0.84);
  background: linear-gradient(145deg, rgb(62 47 24 / 0.65), rgb(16 49 31 / 0.7));
  box-shadow: inset 0 1px rgb(255 255 255 / 0.1), 0 0 1.5rem rgb(245 216 138 / 0.08);
}

.initial-artifact-selection__choice :deep(.artifact-icon) {
  border-color: rgb(245 216 138 / 0.42);
}

.initial-artifact-selection__footer {
  color: rgb(214 211 209 / 0.62);
}
</style>
