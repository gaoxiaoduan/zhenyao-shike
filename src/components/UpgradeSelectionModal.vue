<script setup lang="ts">
import type { AscensionRecipe, FlexibleUpgradeChoice, UpgradeChoice, UpgradeDraftChoice } from '../game/domain/artifactInventory'
import type { ZhouTianOption } from '../game/domain/deductionAndZhouTian'
import ArtifactIcon from './game/ArtifactIcon.vue'
import { useChoiceDialogHotkeys } from './useChoiceDialogHotkeys'

const props = defineProps<{
  choices: readonly (UpgradeDraftChoice | ZhouTianOption)[]
  ascensions: readonly AscensionRecipe[]
  deductionCount: number
  canDeduce?: boolean
  isZhouTian?: boolean
}>()

const emit = defineEmits<{
  select: [choiceId: string]
  selectAscension: [choiceId: string]
  skipAscension: []
  deduce: []
  tuna: []
}>()

function isUpgradeChoice(item: UpgradeDraftChoice | ZhouTianOption): item is UpgradeChoice {
  return 'artifactId' in item
}

function isFlexibleChoice(item: UpgradeDraftChoice | ZhouTianOption): item is FlexibleUpgradeChoice {
  return 'type' in item && item.type === 'flex'
}

const { handleChoiceHotkey } = useChoiceDialogHotkeys((slot, event) => {
  const choice = props.choices[slot]
  if (choice) {
    event.preventDefault()
    emit('select', choice.choiceId)
    return
  }

  const ascension = props.choices.length === 0 ? props.ascensions[slot] : undefined
  if (ascension) {
    event.preventDefault()
    emit('selectAscension', ascension.choiceId)
  }
})
</script>

<template>
  <div
    ref="dialog"
    class="upgrade-selection absolute inset-0 z-50 grid place-items-center bg-stone-950/85 p-5 backdrop-blur-md"
    role="dialog"
    aria-modal="true"
    aria-label="法器突破与构筑升级"
    tabindex="-1"
    @keydown="handleChoiceHotkey"
  >
    <div class="upgrade-selection__card max-h-[calc(100svh-2.5rem)] w-full max-w-4xl overflow-y-auto rounded-lg border border-amber-100/35 bg-[#18231e] p-5 shadow-2xl sm:p-8">
      <p class="text-center text-sm tracking-[0.35em] text-amber-200/80">
        {{ isZhouTian ? '法器满阶 · 周天运转' : '灵蕴满溢 · 领悟升级' }}
      </p>
      <h2 class="mt-2 text-center font-serif text-3xl font-bold text-amber-50 sm:text-4xl">
        {{ isZhouTian ? '周天运转 强化自身' : '择一参悟' }}
      </h2>
      <p class="mx-auto mt-3 max-w-xl text-center text-sm leading-6 text-stone-300">
        {{
          isZhouTian
            ? '法器已达最高境界，借周天运转淬炼自身（御器、行气、炼体各可强化 3 次）。'
            : '提升当前法器威力，或参悟新的法器加入构筑（最多同时驾驭 4 件法器）。'
        }}
      </p>

      <div v-if="choices.length > 0" class="upgrade-selection__choices mt-7 grid gap-4 sm:grid-cols-3">
        <button
          v-for="choice in choices"
          :key="choice.choiceId"
          class="upgrade-selection__choice group relative flex flex-col justify-between rounded-lg border border-amber-100/25 bg-stone-950/45 p-5 text-left transition hover:-translate-y-1 hover:border-amber-200 hover:bg-amber-950/20 hover:shadow-[0_0_24px_rgba(245,158,11,0.15)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200"
          type="button"
          @click="emit('select', choice.choiceId)"
        >
          <div>
            <div class="flex items-center gap-3">
              <ArtifactIcon v-if="isUpgradeChoice(choice)" :id="choice.artifactId" :label="choice.name" />
              <span v-else class="grid size-11 shrink-0 place-items-center rounded border border-cyan-300/30 bg-cyan-950/45 text-xl text-cyan-100">
                {{ isFlexibleChoice(choice) ? '灵' : '周' }}
              </span>
              <span class="min-w-0 flex-1 text-lg font-bold text-amber-100 group-hover:text-amber-200">{{ choice.name }}</span>
              <span
                v-if="isUpgradeChoice(choice)"
                class="rounded border px-2 py-0.5 text-xs font-medium tracking-wider"
                :class="
                  choice.type === 'acquire'
                    ? 'border-emerald-500/40 bg-emerald-950/60 text-emerald-200'
                    : 'border-amber-400/40 bg-amber-950/60 text-amber-200'
                "
              >
                {{ choice.type === 'acquire' ? '新获得' : `Lv.${choice.currentLevel} ➔ Lv.${choice.targetLevel}` }}
              </span>
              <span
                v-else-if="isFlexibleChoice(choice)"
                class="rounded border border-emerald-400/40 bg-emerald-950/60 px-2 py-0.5 text-xs font-medium tracking-wider text-emerald-200"
              >
                机缘 {{ choice.currentRank }} ➔ {{ choice.targetRank }}
              </span>
              <span
                v-else
                class="rounded border border-cyan-400/40 bg-cyan-950/60 px-2 py-0.5 text-xs font-medium tracking-wider text-cyan-200"
              >
                {{ choice.count }}/{{ choice.maxCount }}
              </span>
              <kbd class="rounded border border-amber-100/35 bg-stone-950/55 px-2 py-1 text-xs text-amber-100">
                按 {{ choices.indexOf(choice) + 1 }}
              </kbd>
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

      <!-- Action controls bar: Deduction (推演) & Meditation (吐纳) -->
      <div class="upgrade-selection__action-bar mt-6 flex flex-wrap items-center justify-center gap-4 border-t border-amber-100/15 pt-5">
        <button
          class="flex items-center gap-2 rounded-md border border-cyan-300/40 bg-cyan-950/40 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200 hover:bg-cyan-900/60 disabled:cursor-not-allowed disabled:opacity-40"
          type="button"
          :disabled="deductionCount <= 0 || canDeduce === false || isZhouTian"
          @click="emit('deduce')"
        >
          <span>推演重抽</span>
          <span class="rounded-full bg-cyan-900/80 px-2 py-0.5 text-xs text-cyan-200">
            {{ canDeduce === false && deductionCount > 0 ? '本轮候选不足' : `剩余 ${deductionCount} 次` }}
          </span>
        </button>

        <button
          class="flex items-center gap-2 rounded-md border border-emerald-300/40 bg-emerald-950/40 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-200 hover:bg-emerald-900/60"
          type="button"
          @click="emit('tuna')"
        >
          <span>吐纳调息</span>
          <span class="text-xs text-emerald-300/90">（放弃本次升级，回复 15% 生命）</span>
        </button>
      </div>

      <section
        v-if="ascensions.length > 0"
        class="upgrade-selection__ascension mt-7 rounded-lg border border-fuchsia-200/25 bg-fuchsia-950/15 p-4 sm:p-5"
        aria-label="可用升阶"
      >
        <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="text-xs font-bold tracking-[0.28em] text-fuchsia-200/80">构筑已成 · 可执行升阶</p>
            <h3 class="mt-1 text-xl font-bold text-fuchsia-100">将两件满级法器炼为高阶法器</h3>
          </div>
          <button
            class="text-xs text-stone-400 underline underline-offset-2 hover:text-stone-200"
            type="button"
            @click="emit('skipAscension')"
          >
            暂缓升阶
          </button>
        </div>
        <div class="mt-4 grid gap-3 sm:grid-cols-3">
          <button
            v-for="(ascension, index) in ascensions"
            :key="ascension.choiceId"
            class="upgrade-selection__ascension-choice rounded-md border border-fuchsia-200/30 bg-stone-950/35 p-4 text-left transition hover:-translate-y-0.5 hover:border-fuchsia-200/75 hover:bg-fuchsia-950/30 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fuchsia-200"
            type="button"
            @click="emit('selectAscension', ascension.choiceId)"
          >
            <span class="flex items-center gap-3">
              <ArtifactIcon :id="ascension.resultId" :label="ascension.name" />
              <span>
                <small class="block text-xs tracking-wide text-stone-400">{{ ascension.sourceNames.join(' + ') }}</small>
                <strong class="mt-1 block text-lg text-fuchsia-100">{{ ascension.name }}</strong>
              </span>
              <kbd
                v-if="choices.length === 0 && index < 3"
                class="ml-auto rounded border border-fuchsia-100/35 bg-stone-950/55 px-2 py-1 text-xs text-fuchsia-100"
              >
                按 {{ index + 1 }}
              </kbd>
            </span>
            <span class="mt-2 block text-xs leading-5 text-stone-300">{{ ascension.description }}</span>
            <span class="mt-3 block text-xs font-semibold text-fuchsia-200/90">
              法器槽 {{ ascension.slotCountBefore }} ➔ {{ ascension.slotCountAfter }} · 成型后不再升级
            </span>
          </button>
        </div>
      </section>

      <p class="mt-6 text-center text-xs text-stone-400">
        选择后效果立即反映在战场上；推演不消耗吐纳，吐纳不消耗推演。
      </p>
    </div>
  </div>
</template>

<style scoped>
.upgrade-selection {
  background:
    radial-gradient(circle at 50% 35%, rgb(72 45 101 / 0.18), transparent 42%),
    rgb(3 8 6 / 0.88);
}

.upgrade-selection__card {
  position: relative;
  border-color: rgb(245 216 138 / 0.38);
  background:
    linear-gradient(135deg, rgb(28 46 35 / 0.98), rgb(8 18 13 / 0.98)),
    #18231e;
  box-shadow: 0 2rem 7rem rgb(0 0 0 / 0.75), inset 0 1px rgb(255 255 255 / 0.08);
}

.upgrade-selection__card::before {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 2.5rem;
  height: 2.5rem;
  border-top: 1px solid rgb(245 216 138 / 0.48);
  border-right: 1px solid rgb(245 216 138 / 0.48);
  content: "";
  pointer-events: none;
}

.upgrade-selection__choice {
  border-color: rgb(245 216 138 / 0.24);
  background: linear-gradient(145deg, rgb(3 12 8 / 0.62), rgb(19 34 25 / 0.68));
  box-shadow: inset 0 1px rgb(255 255 255 / 0.04);
}

.upgrade-selection__choice:hover,
.upgrade-selection__choice:focus-visible {
  background: linear-gradient(145deg, rgb(62 47 24 / 0.62), rgb(18 51 32 / 0.72));
  box-shadow: inset 0 1px rgb(255 255 255 / 0.1), 0 0 1.5rem rgb(245 216 138 / 0.08);
}

.upgrade-selection__choice :deep(.artifact-icon),
.upgrade-selection__ascension-choice :deep(.artifact-icon) {
  border-color: rgb(245 216 138 / 0.42);
}

.upgrade-selection__action-bar {
  border-top-color: rgb(245 216 138 / 0.16);
}

.upgrade-selection__ascension {
  background: linear-gradient(135deg, rgb(57 21 77 / 0.24), rgb(25 13 39 / 0.18));
  box-shadow: inset 0 1px rgb(255 255 255 / 0.04);
}

.upgrade-selection__ascension-choice {
  background: linear-gradient(145deg, rgb(26 13 36 / 0.56), rgb(8 15 12 / 0.5));
}
</style>
