<script setup lang="ts">
import type { BaseArtifactId } from '../game/domain/initialArtifactSelection'
import type { UpgradeChoice } from '../game/domain/artifactInventory'

defineProps<{
  choices: readonly UpgradeChoice[]
}>()

const emit = defineEmits<{
  select: [choiceId: string, artifactId: BaseArtifactId]
}>()
</script>

<template>
  <div
    class="upgrade-selection absolute inset-0 z-50 grid place-items-center bg-stone-950/85 p-5 backdrop-blur-md"
    role="dialog"
    aria-label="法器突破与构筑升级"
  >
    <div class="w-full max-w-4xl rounded-lg border border-amber-100/35 bg-[#18231e] p-5 shadow-2xl sm:p-8">
      <p class="text-center text-sm tracking-[0.35em] text-amber-200/80">灵蕴满溢 · 领悟升级</p>
      <h2 class="mt-2 text-center font-serif text-3xl font-bold text-amber-50 sm:text-4xl">
        择一参悟
      </h2>
      <p class="mx-auto mt-3 max-w-xl text-center text-sm leading-6 text-stone-300">
        提升当前法器威力，或参悟新的法器加入构筑（最多同时驾驭 4 件法器）。
      </p>

      <div class="mt-7 grid gap-4 sm:grid-cols-3">
        <button
          v-for="choice in choices"
          :key="choice.choiceId"
          class="group relative flex flex-col justify-between rounded-lg border border-amber-100/25 bg-stone-950/45 p-5 text-left transition hover:-translate-y-1 hover:border-amber-200 hover:bg-amber-950/20 hover:shadow-[0_0_24px_rgba(245,158,11,0.15)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200"
          type="button"
          @click="emit('select', choice.choiceId, choice.artifactId)"
        >
          <div>
            <div class="flex items-center justify-between">
              <span class="text-lg font-bold text-amber-100 group-hover:text-amber-200">
                {{ choice.name }}
              </span>
              <span
                class="rounded border px-2 py-0.5 text-xs font-medium tracking-wider"
                :class="
                  choice.type === 'acquire'
                    ? 'border-emerald-500/40 bg-emerald-950/60 text-emerald-200'
                    : 'border-amber-400/40 bg-amber-950/60 text-amber-200'
                "
              >
                {{ choice.type === 'acquire' ? '新获得' : `Lv.${choice.currentLevel} ➔ Lv.${choice.targetLevel}` }}
              </span>
            </div>

            <p class="mt-3 text-xs leading-5 text-stone-300">
              {{ choice.description }}
            </p>
          </div>

          <div class="mt-5 border-t border-amber-100/10 pt-3">
            <span class="block text-xs font-semibold tracking-wide text-amber-200/90">
              {{ choice.statsDescription }}
            </span>
          </div>
        </button>
      </div>

      <p class="mt-6 text-center text-xs text-stone-400">
        选择后法器效果立即反映在战场上。
      </p>
    </div>
  </div>
</template>
