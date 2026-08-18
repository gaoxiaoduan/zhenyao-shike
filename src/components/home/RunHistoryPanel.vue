<script setup lang="ts">
import type { RunEventId } from '../../game/domain/runSummary'
import { BATTLEFIELD_EVENT_COPY } from '../../game/domain/runEventPresentation'
import type { RunHistoryEntry, RunHistorySnapshot } from '../../game/domain/runRecord'

const props = defineProps<{
  history: RunHistorySnapshot
}>()

const emit = defineEmits<{
  close: []
}>()

const damageLabels: Readonly<Record<RunHistoryEntry['finalDamageSource'], string>> = {
  'ordinary-enemy': '寻常妖物围攻',
  'elite-enemy': '精英妖物破阵',
  'wolf-king-contact': '狼王扑击',
  'moon-howl': '狼王月啸',
  unknown: '妖潮压境',
}

function formatTime(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function formatDate(recordedAtMs: number): string {
  const date = new Date(recordedAtMs)
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

function eventLabel(event: RunEventId): string {
  return BATTLEFIELD_EVENT_COPY[event].name
}

function buildLabel(entry: RunHistoryEntry): string {
  return entry.artifacts.length
    ? entry.artifacts.map((artifact) => `${artifact.name} · Lv.${artifact.level}`).join('、')
    : '尚未形成法器构筑'
}

function close() {
  emit('close')
}
</script>

<template>
  <section class="run-history-panel" role="dialog" aria-label="历练记录" @click.self="close">
    <article class="run-history-card">
      <header class="run-history-card__header">
        <div>
          <p>个人战绩 · 青石岭</p>
          <h2>历练记录</h2>
          <span>每一次失败也会留下下一局的突破线索。</span>
        </div>
        <button class="run-history-card__close" type="button" aria-label="关闭历练记录" @click="close">×</button>
      </header>

      <div v-if="props.history.entries.length" class="run-history-card__body">
        <section class="run-history-best" aria-label="个人最佳">
          <div>
            <small>最快胜场</small>
            <strong>{{ props.history.best.fastestVictoryMs === null ? '—' : formatTime(props.history.best.fastestVictoryMs) }}</strong>
          </div>
          <div>
            <small>最高斩妖</small>
            <strong>{{ props.history.best.mostKills }}</strong>
          </div>
          <div>
            <small>最长坚持</small>
            <strong>{{ formatTime(props.history.best.longestSurvivalMs) }}</strong>
          </div>
        </section>

        <ol class="run-history-list" aria-label="最近历练">
          <li v-for="entry in props.history.entries" :key="entry.id" class="run-history-entry">
            <div class="run-history-entry__heading">
              <strong :class="`run-history-entry__result--${entry.result}`">
                {{ entry.result === 'victory' ? '妖王伏诛' : '此行未竟' }}
              </strong>
              <time>{{ formatDate(entry.recordedAtMs) }}</time>
            </div>
            <div class="run-history-entry__stats">
              <span>历练 {{ formatTime(entry.elapsedMs) }}</span>
              <span>斩妖 {{ entry.defeatedEnemies }}</span>
              <span>精英 {{ entry.defeatedElites }}</span>
              <span v-if="entry.bossElapsedMs !== null">妖王战 {{ formatTime(entry.bossElapsedMs) }}</span>
            </div>
            <p class="run-history-entry__build">构筑：{{ buildLabel(entry) }}</p>
            <p class="run-history-entry__events">
              <span v-if="entry.completedEvents.length">事件：{{ entry.completedEvents.map(eventLabel).join(' · ') }}</span>
              <span v-else>事件：未完成</span>
              <span v-if="entry.result === 'defeat'"> · 终局：{{ damageLabels[entry.finalDamageSource] }}</span>
            </p>
          </li>
        </ol>
      </div>

      <div v-else class="run-history-empty">
        <strong>还没有历练记录</strong>
        <p>完成第一局后，这里会留下时间、斩妖数和构筑，帮助你找到下一次突破点。</p>
      </div>

      <footer>仅保存在当前浏览器 · 最近 {{ props.history.entries.length }} / 12 局</footer>
    </article>
  </section>
</template>

<style scoped>
.run-history-panel {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  overflow: auto;
  background: rgb(2 7 5 / 0.76);
  padding: 1rem;
  backdrop-filter: blur(8px);
}

.run-history-card {
  width: min(54rem, 100%);
  max-height: min(46rem, calc(100svh - 2rem));
  overflow: hidden auto;
  border: 1px solid rgb(245 216 138 / 0.34);
  border-radius: 0.55rem;
  background: linear-gradient(145deg, rgb(28 46 35 / 0.98), rgb(7 14 11 / 0.99));
  box-shadow: 0 2rem 7rem rgb(0 0 0 / 0.72), inset 0 1px rgb(255 255 255 / 0.08);
}

.run-history-card__header,
.run-history-card__body,
.run-history-card > footer {
  padding: clamp(1rem, 3vw, 1.7rem);
}

.run-history-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid rgb(245 216 138 / 0.14);
}

.run-history-card__header p {
  margin: 0;
  color: rgb(253 230 138 / 0.65);
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.24em;
}

.run-history-card h2 {
  margin: 0.35rem 0 0.25rem;
  color: #fff2bd;
  font-family: "STKaiti", "KaiTi", serif;
  font-size: clamp(2rem, 5vw, 3.3rem);
  line-height: 1;
}

.run-history-card__header span,
.run-history-card > footer {
  color: rgb(214 211 209 / 0.65);
  font-size: 0.7rem;
}

.run-history-card__close {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border: 1px solid rgb(231 229 228 / 0.22);
  border-radius: 0.25rem;
  background: rgb(6 12 10 / 0.62);
  color: #fef3c7;
  font-size: 1.5rem;
  line-height: 1;
}

.run-history-card__close:hover,
.run-history-card__close:focus-visible {
  border-color: rgb(253 230 138 / 0.7);
  outline: none;
}

.run-history-best {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-block: 1px solid rgb(245 216 138 / 0.16);
}

.run-history-best div {
  display: grid;
  gap: 0.25rem;
  padding: 0.85rem 0.5rem;
  text-align: center;
}

.run-history-best div + div { border-left: 1px solid rgb(245 216 138 / 0.12); }
.run-history-best small { color: rgb(168 162 158 / 0.8); font-size: 0.62rem; letter-spacing: 0.08em; }
.run-history-best strong { color: #fef3c7; font-size: 1.2rem; font-variant-numeric: tabular-nums; }

.run-history-list {
  display: grid;
  gap: 0.65rem;
  margin: 1rem 0 0;
  padding: 0;
  list-style: none;
}

.run-history-entry {
  border: 1px solid rgb(126 174 126 / 0.2);
  border-top-color: rgb(245 216 138 / 0.25);
  background: linear-gradient(135deg, rgb(2 10 7 / 0.56), rgb(20 38 27 / 0.38));
  padding: 0.75rem;
}

.run-history-entry__heading,
.run-history-entry__stats,
.run-history-entry__events {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.run-history-entry__heading time { color: rgb(168 162 158 / 0.62); font-size: 0.62rem; }
.run-history-entry__result--victory { color: #fde68a; }
.run-history-entry__result--defeat { color: #fca5a5; }
.run-history-entry__stats { justify-content: flex-start; margin-top: 0.5rem; color: #dbe9d4; font-size: 0.7rem; }
.run-history-entry__stats span + span::before { margin-right: 0.5rem; color: rgb(253 230 138 / 0.35); content: "·"; }
.run-history-entry__build,
.run-history-entry__events { margin: 0.45rem 0 0; color: rgb(214 211 209 / 0.68); font-size: 0.65rem; line-height: 1.5; }
.run-history-entry__events { color: rgb(167 243 208 / 0.64); }

.run-history-empty {
  padding: 3rem 1rem;
  text-align: center;
}

.run-history-empty strong { color: #fef3c7; font-family: "STKaiti", "KaiTi", serif; font-size: 1.5rem; }
.run-history-empty p { margin: 0.7rem auto 0; max-width: 24rem; color: rgb(214 211 209 / 0.7); font-size: 0.75rem; line-height: 1.7; }
.run-history-card > footer { border-top: 1px solid rgb(245 216 138 / 0.12); }

@media (max-width: 600px) {
  .run-history-best strong { font-size: 1rem; }
  .run-history-entry__heading time { width: 100%; }
}
</style>
