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
    <div class="max-h-[calc(100svh-2.5rem)] w-full max-w-3xl overflow-y-auto rounded-lg border border-amber-100/30 bg-[#18231e] p-5 shadow-2xl sm:p-8">
      <p class="text-center text-sm tracking-[0.32em] text-amber-100/70">初入青石岭</p>
      <h2 class="mt-3 text-center font-serif text-3xl font-bold text-amber-50">择一法器傍身</h2>
      <p class="mx-auto mt-3 max-w-xl text-center text-sm leading-6 text-stone-300">
        妖物会主动逼近，法器会自行出手。选定后，开始这一场正式历练。
      </p>
      <div class="mt-7 grid gap-3 sm:grid-cols-3">
        <button
          v-for="artifact in candidates"
          :key="artifact.id"
          class="rounded-md border border-amber-100/25 bg-stone-950/35 p-4 text-left transition hover:border-amber-100/70 hover:bg-amber-100/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-100"
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
      <p class="mt-5 text-center text-xs text-stone-400">桌面端：WASD / 方向键移动，Space / E 施放术法。</p>
    </div>
  </div>
</template>
