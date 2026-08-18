<script setup lang="ts">
import caveBackgroundUrl from '../../assets/game/qingshi-cave-home.png'
import ReplayTargetCard from '../home/ReplayTargetCard.vue'
import type { ReplayTarget } from '../../game/domain/replayTarget'
import { BATTLEFIELD_EVENT_COPY } from '../../game/domain/runEventPresentation'
import type { RunHistorySnapshot } from '../../game/domain/runRecord'
import type { DamageSource, RunSummary } from '../../game/domain/runSummary'
import ArtifactIcon from '../game/ArtifactIcon.vue'

const props = withDefaults(defineProps<{
  summary: RunSummary
  newRecord: boolean
  practiceMode?: boolean
  persistenceStatus?: 'persisted' | 'session-only'
  runHistory?: RunHistorySnapshot
  replayTarget?: ReplayTarget
  previousReplayTarget?: ReplayTarget | null
  previousReplayTargetCompleted?: boolean
}>(), {
  practiceMode: false,
  persistenceStatus: 'persisted',
  previousReplayTarget: null,
  previousReplayTargetCompleted: false,
})

const emit = defineEmits<{
  retry: []
  home: []
  openHistory: []
}>()

const damageLabels: Readonly<Record<DamageSource, string>> = {
  'ordinary-enemy': '寻常妖物',
  'elite-enemy': '精英妖物',
  'wolf-king-contact': '狼王扑击',
  'moon-howl': '月啸',
  unknown: '历练终止',
}

function formatTime(elapsedMs: number) {
  const totalSeconds = Math.floor(elapsedMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
</script>

<template>
  <section
    class="result-screen"
    :class="`result-screen--${props.summary.result}`"
    :style="{ backgroundImage: `url(${caveBackgroundUrl})` }"
  >
    <div class="result-screen__shade" />
    <article class="result-card">
      <header class="result-card__header">
        <div>
          <p>{{ props.practiceMode ? '啸月狼王 · 演练结算' : '青石岭 · 历练结算' }}</p>
          <h1>{{ props.summary.result === 'victory' ? '妖王伏诛' : '此行未竟' }}</h1>
          <strong v-if="props.newRecord" class="result-record">新纪录</strong>
          <span v-if="props.practiceMode">本次演练不计入主线奖励、纪录或妖丹。</span>
          <span v-else>
            {{ props.summary.result === 'victory' ? '啸月狼王已伏，山道暂得安宁。' : damageLabels[props.summary.finalDamageSource] }}
          </span>
          <small v-if="!props.practiceMode" class="result-record-note">
            {{ props.persistenceStatus === 'persisted' ? '本局已写入历练记录' : '本局记录仅保留在当前会话' }}
          </small>
        </div>
        <div class="result-seal" aria-hidden="true">{{ props.summary.result === 'victory' ? '胜' : '败' }}</div>
      </header>

      <div class="result-stats" aria-label="历练数据">
        <div><small>坚持时间</small><strong>{{ formatTime(props.summary.elapsedMs) }}</strong></div>
        <div><small>斩妖数</small><strong>{{ props.summary.defeatedEnemies }}</strong></div>
        <div><small>精英斩妖</small><strong>{{ props.summary.defeatedElites }}</strong></div>
        <div v-if="props.summary.bossElapsedMs !== null"><small>妖王战</small><strong>{{ formatTime(props.summary.bossElapsedMs) }}</strong></div>
        <div><small>灵石</small><strong>+{{ props.summary.spiritStones }}</strong></div>
        <div><small>妖丹</small><strong>+{{ props.summary.demonCores }}</strong></div>
      </div>

      <section class="result-build" aria-labelledby="result-build-title">
        <div class="result-build__heading">
          <h2 id="result-build-title">本局法器</h2>
          <span>{{ props.summary.artifacts.length }} / 4</span>
        </div>
        <div v-if="props.summary.artifacts.length" class="result-build__items">
          <div v-for="artifact in props.summary.artifacts" :key="artifact.id" class="result-build__item">
            <ArtifactIcon :id="artifact.id" :label="artifact.name" />
            <span><strong>{{ artifact.name }}</strong><small>法器 Lv.{{ artifact.level }}</small></span>
          </div>
        </div>
        <p v-else class="result-build__empty">尚未形成法器构筑。</p>
      </section>

      <div class="result-event" :class="{ 'is-complete': props.summary.completedEvents.includes('demon-lair') }">
        <span>战场事件 · {{ BATTLEFIELD_EVENT_COPY['demon-lair'].name }}</span>
        <strong>
          {{ props.summary.completedEvents.includes('demon-lair') ? '妖巢暴动已完成' : '妖巢暴动未完成' }}
          <template v-if="props.summary.completedEvents.includes('lingquan')"> · {{ BATTLEFIELD_EVENT_COPY.lingquan.name }}已完成</template>
        </strong>
      </div>

      <aside class="result-hint">
        <small>{{ props.summary.result === 'victory' ? '构筑札记' : '破局提示' }}</small>
        <p>{{ props.summary.hint }}</p>
      </aside>

      <ReplayTargetCard
        v-if="!props.practiceMode && props.replayTarget"
        :target="props.replayTarget"
        :previous-target="props.previousReplayTarget"
        :previous-target-completed="props.previousReplayTargetCompleted"
        variant="result"
      />

      <footer class="result-actions">
        <button class="game-button" type="button" aria-label="再次进入青石岭" @click="emit('retry')">再次历练</button>
        <button v-if="!props.practiceMode && props.runHistory" class="game-button game-button--quiet" type="button" aria-label="查看历练记录" @click="emit('openHistory')">历练记录</button>
        <button class="game-button game-button--quiet" type="button" @click="emit('home')">返回洞府</button>
      </footer>
    </article>
  </section>
</template>

<style scoped>
.result-screen {
  position: relative;
  display: grid;
  min-height: 100svh;
  place-items: center;
  overflow: hidden auto;
  padding: 1.25rem;
  background-position: center;
  background-size: cover;
}

.result-screen::before {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 50% 36%, rgb(245 216 138 / 0.1), transparent 34%),
    repeating-linear-gradient(135deg, transparent 0 5rem, rgb(167 243 208 / 0.025) 5rem 5.1rem);
  content: "";
  pointer-events: none;
}

.result-screen__shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(110deg, rgb(2 8 6 / 0.94), rgb(4 12 9 / 0.72)), linear-gradient(0deg, rgb(2 7 5 / 0.9), transparent);
  backdrop-filter: blur(4px);
}

.result-card {
  position: relative;
  isolation: isolate;
  width: min(52rem, 100%);
  border: 1px solid rgb(245 216 138 / 0.34);
  border-radius: 0.55rem;
  background: linear-gradient(145deg, rgb(28 46 35 / 0.97), rgb(7 14 11 / 0.98));
  padding: clamp(1.25rem, 3vw, 2.3rem);
  box-shadow: 0 2rem 7rem rgb(0 0 0 / 0.72), inset 0 1px rgb(255 255 255 / 0.08);
}

.result-card::before,
.result-card::after {
  position: absolute;
  z-index: -1;
  width: 3.5rem;
  height: 3.5rem;
  border-color: rgb(245 216 138 / 0.4);
  content: "";
  pointer-events: none;
}

.result-card::before {
  top: 0.75rem;
  left: 0.75rem;
  border-top: 1px solid;
  border-left: 1px solid;
}

.result-card::after {
  right: 0.75rem;
  bottom: 0.75rem;
  border-right: 1px solid;
  border-bottom: 1px solid;
}

.result-card__header,
.result-build__heading,
.result-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.result-card__header p,
.result-hint small {
  margin: 0;
  color: rgb(253 230 138 / 0.58);
  font-size: 0.67rem;
  font-weight: 800;
  letter-spacing: 0.28em;
}

.result-card h1 {
  margin: 0.55rem 0 0.2rem;
  color: #fff2bd;
  font-family: "STKaiti", "KaiTi", serif;
  font-size: clamp(2.8rem, 7vw, 5rem);
  line-height: 1;
}

.result-card__header span { color: rgb(214 211 209 / 0.72); font-size: 0.82rem; }
.result-record-note { display: block; margin-top: 0.35rem; color: rgb(167 243 208 / 0.7); font-size: 0.65rem; }
.result-record { display: inline-block; margin: 0.25rem 0 0.5rem; border: 1px solid rgb(253 230 138 / 0.46); background: rgb(253 230 138 / 0.1); padding: 0.22rem 0.5rem; color: #fde68a; font-size: 0.65rem; letter-spacing: 0.14em; }

.result-seal {
  display: grid;
  width: 5rem;
  height: 5rem;
  place-items: center;
  border: 3px double rgb(248 113 113 / 0.7);
  color: #fca5a5;
  font-family: "STKaiti", "KaiTi", serif;
  font-size: 2.5rem;
  font-weight: 900;
  transform: rotate(-8deg);
}

.result-screen--victory .result-seal { border-color: rgb(253 230 138 / 0.7); color: #fde68a; }

.result-stats {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  margin-top: 1.6rem;
  border-block: 1px solid rgb(245 216 138 / 0.18);
}

.result-stats div { display: grid; gap: 0.25rem; padding: 1rem; text-align: center; }
.result-stats div + div { border-left: 1px solid rgb(253 230 138 / 0.12); }
.result-stats small { color: rgb(168 162 158 / 0.8); font-size: 0.65rem; letter-spacing: 0.1em; }
.result-stats strong { color: #fef3c7; font-size: 1.25rem; font-variant-numeric: tabular-nums; }

.result-build { margin-top: 1.3rem; }
.result-build h2 { margin: 0; color: #e7e5e4; font-size: 0.9rem; }
.result-build__heading > span { color: rgb(253 230 138 / 0.5); font-size: 0.7rem; }
.result-build__items { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.6rem; margin-top: 0.7rem; }
.result-build__item { display: flex; align-items: center; gap: 0.7rem; border: 1px solid rgb(126 174 126 / 0.22); border-top-color: rgb(245 216 138 / 0.22); background: linear-gradient(135deg, rgb(2 10 7 / 0.52), rgb(20 38 27 / 0.38)); padding: 0.55rem; }
.result-build__item > span { display: grid; gap: 0.15rem; }
.result-build__item strong { color: #e7e5e4; font-size: 0.78rem; }
.result-build__item small,
.result-build__empty { color: rgb(168 162 158 / 0.8); font-size: 0.66rem; }

.result-event { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-top: 1rem; border: 1px solid rgb(248 113 113 / 0.18); background: rgb(127 29 29 / 0.1); padding: 0.65rem 0.8rem; }
.result-event span { color: rgb(168 162 158 / 0.8); font-size: 0.65rem; }
.result-event strong { color: #fca5a5; font-size: 0.72rem; }
.result-event.is-complete { border-color: rgb(110 231 183 / 0.22); background: rgb(6 78 59 / 0.1); }
.result-event.is-complete strong { color: #a7f3d0; }

.result-hint { margin-top: 1rem; border-left: 3px solid rgb(253 230 138 / 0.45); background: rgb(253 230 138 / 0.055); padding: 0.8rem 1rem; }
.result-hint p { margin: 0.35rem 0 0; color: rgb(214 211 209 / 0.82); font-size: 0.75rem; line-height: 1.6; }
.result-actions { justify-content: flex-end; margin-top: 1.25rem; }

@media (max-width: 600px) {
  .result-seal { display: none; }
  .result-stats { grid-template-columns: repeat(2, 1fr); }
  .result-stats div:nth-child(odd) { border-left: none; }
  .result-stats div:nth-child(n+3) { border-top: 1px solid rgb(253 230 138 / 0.12); }
  .result-build__items { grid-template-columns: 1fr; }
  .result-actions { align-items: stretch; flex-direction: column; }
}
</style>
