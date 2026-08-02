<script setup lang="ts">
import type { OnboardingStep } from '../game/session/GameSession'

const props = defineProps<{
  step: OnboardingStep
}>()

const emit = defineEmits<{
  skip: []
}>()

const guideCopy: Record<OnboardingStep, { title: string; description: string }> = {
  move: {
    title: '先学会走位',
    description: '左侧拖动摇杆；桌面端使用 WASD 或方向键，绕开逼近的妖物。',
  },
  'auto-attack': {
    title: '法器会自动出手',
    description: '无需瞄准。靠近妖物，观察法器自行锁定目标。',
  },
  'collect-spirit': {
    title: '拾取灵蕴',
    description: '妖物消散后留下灵蕴；靠近它们以积累本局成长。',
  },
  'cast-spell': {
    title: '玄光护身',
    description: '妖物靠近时，点击右下术法按钮；桌面端按 Space 或 E，震退附近妖物。',
  },
  'level-up': {
    title: '灵蕴圆满',
    description: '积累足够灵蕴即可提升本局成长。之后每次精进都会带来新的法器选择。',
  },
}
</script>

<template>
  <aside class="onboarding-guide absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-30 w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 rounded-md border border-emerald-100/25 bg-stone-950/72 px-4 py-3 text-center shadow-xl backdrop-blur-sm">
    <p class="text-xs font-bold tracking-[0.2em] text-emerald-200">{{ guideCopy[props.step].title }}</p>
    <p class="mt-1 text-xs leading-5 text-stone-200">{{ guideCopy[props.step].description }}</p>
    <button class="mt-2 text-xs text-stone-400 underline underline-offset-2" type="button" @click="emit('skip')">
      跳过教学
    </button>
  </aside>
</template>
