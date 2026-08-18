<script setup lang="ts">
import type { ReplayTarget } from '../../game/domain/replayTarget'

const props = withDefaults(defineProps<{
  target: ReplayTarget
  previousTarget?: ReplayTarget | null
  previousTargetCompleted?: boolean
  variant?: 'home' | 'result'
}>(), {
  previousTarget: null,
  previousTargetCompleted: false,
  variant: 'home',
})
</script>

<template>
  <article
    class="replay-target"
    :class="[`replay-target--${props.variant}`, { 'replay-target--completed': props.previousTarget && props.previousTargetCompleted }]"
    aria-label="再来一把目标"
  >
    <header class="replay-target__header">
      <small>{{ props.variant === 'result' ? '下一局目标' : '再来一把目标' }}</small>
      <span v-if="props.previousTarget">
        {{ props.previousTargetCompleted ? '上一局目标已完成' : '上一局目标未完成' }}
      </span>
    </header>
    <strong class="replay-target__title">{{ props.target.title }}</strong>
    <p v-if="props.previousTarget" class="replay-target__previous">
      {{ props.previousTargetCompleted ? '完成' : '继续' }}：{{ props.previousTarget.title }}
    </p>
    <p>{{ props.target.description }}</p>
  </article>
</template>

<style scoped>
.replay-target {
  --replay-target-border: rgb(167 243 208 / 0.32);
  --replay-target-accent: #a7f3d0;
  border: 1px solid var(--replay-target-border);
  border-left: 3px solid var(--replay-target-accent);
  border-radius: 0.25rem;
  background: linear-gradient(120deg, rgb(22 70 52 / 0.58), rgb(13 34 27 / 0.74));
  box-shadow: inset 0 1px rgb(255 255 255 / 0.05), 0 0.75rem 2rem rgb(0 0 0 / 0.16);
  color: #d1fae5;
}

.replay-target--home {
  width: min(32rem, 100%);
  margin-top: 1.1rem;
  padding: 0.8rem 1rem;
}

.replay-target--result {
  margin-top: 1.35rem;
  padding: 0.95rem 1.05rem;
}

.replay-target--completed {
  --replay-target-border: rgb(253 230 138 / 0.46);
  --replay-target-accent: #fde68a;
}

.replay-target__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: rgb(209 250 229 / 0.68);
  font-size: 0.62rem;
  letter-spacing: 0.16em;
}

.replay-target--completed .replay-target__header {
  color: rgb(253 230 138 / 0.76);
}

.replay-target__header span {
  color: var(--replay-target-accent);
  font-weight: 800;
  letter-spacing: 0.08em;
}

.replay-target__previous {
  color: var(--replay-target-accent) !important;
  font-weight: 800;
}

.replay-target__title {
  display: block;
  margin-top: 0.35rem;
  color: #fef3c7;
  font-family: "STKaiti", "KaiTi", serif;
  font-size: 1.35rem;
  letter-spacing: 0.08em;
}

.replay-target p {
  margin: 0.32rem 0 0;
  color: rgb(209 250 229 / 0.7);
  font-size: 0.7rem;
  line-height: 1.55;
}

@media (max-width: 700px) {
  .replay-target--home,
  .replay-target--result {
    width: 100%;
  }

  .replay-target__header {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.25rem;
  }
}
</style>
