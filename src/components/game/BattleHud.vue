<script setup lang="ts">
import { computed } from 'vue'
import { formatElapsedTime } from '../../game/domain/runProgress'
import type { BattleHudSnapshot } from '../../game/session/GameSession'
import type { KeyBindings } from '../../game/settings/gameSettings'
import { displayControlKey } from '../../game/settings/controlPresentation'
import ArtifactIcon from './ArtifactIcon.vue'

const props = defineProps<{
  snapshot: BattleHudSnapshot | null
  keyBindings: KeyBindings
}>()

const spellKey = computed(() => displayControlKey(props.keyBindings.castSpell[0] ?? 'space'))
</script>

<template>
  <div class="battle-hud pointer-events-none absolute inset-0 z-20" aria-label="战斗信息">
    <section class="battle-hud__vitals" aria-label="主角状态">
      <div class="battle-hud__vitals-heading">
        <strong>陈砺安 · Lv.{{ snapshot?.level ?? 1 }}</strong>
        <span>{{ snapshot?.health ?? 100 }} / {{ snapshot?.maxHealth ?? 100 }}</span>
      </div>
      <div
        class="battle-hud__bar battle-hud__bar--health"
        role="progressbar"
        aria-label="生命"
        :aria-valuenow="snapshot?.health ?? 100"
        :aria-valuemax="snapshot?.maxHealth ?? 100"
      >
        <i :style="{ width: `${Math.max(0, Math.min(100, ((snapshot?.health ?? 100) / (snapshot?.maxHealth ?? 100)) * 100))}%` }" />
      </div>
      <div
        class="battle-hud__bar battle-hud__bar--experience"
        role="progressbar"
        aria-label="灵蕴"
        :aria-valuenow="snapshot?.experience ?? 0"
        :aria-valuemax="snapshot?.experienceToNextLevel ?? 1"
      >
        <i :style="{ width: `${Math.max(0, Math.min(100, ((snapshot?.experience ?? 0) / (snapshot?.experienceToNextLevel ?? 1)) * 100))}%` }" />
      </div>
    </section>

    <aside class="battle-hud__wing battle-hud__wing--left">
      <p class="battle-hud__eyebrow">本局构筑</p>
      <div v-if="snapshot?.artifacts.length" class="battle-hud__artifacts">
        <div v-for="artifact in snapshot.artifacts" :key="artifact.id" class="battle-hud__artifact">
          <ArtifactIcon :id="artifact.id" :label="artifact.name" />
          <span>
            <strong>{{ artifact.name }}</strong>
            <small>Lv.{{ artifact.level }}</small>
          </span>
        </div>
      </div>
      <p v-else class="battle-hud__muted">择定法器后，构筑将在此显现。</p>
    </aside>

    <aside class="battle-hud__wing battle-hud__wing--right">
      <p class="battle-hud__eyebrow">青石岭历练</p>
      <strong class="battle-hud__stage">{{ snapshot?.stageLabel ?? '整备中' }}</strong>
      <dl class="battle-hud__stats">
        <div><dt>时间</dt><dd>{{ formatElapsedTime(snapshot?.elapsedMs ?? 0) }}</dd></div>
        <div><dt>妖物</dt><dd>{{ snapshot?.enemyCount ?? 0 }}</dd></div>
        <div><dt>身法</dt><dd>{{ snapshot?.movementActive ? '移动中' : '驻足' }}</dd></div>
      </dl>
      <div v-if="snapshot?.eliteCount" class="battle-hud__elite" aria-live="polite">
        <span><strong>精英威胁 × {{ snapshot.eliteCount }}</strong><small>场内生命条</small></span>
        <div
          class="battle-hud__elite-bar"
          role="progressbar"
          aria-label="精英妖物生命"
          :aria-valuenow="snapshot.weakestEliteHealthPercent ?? 0"
          aria-valuemin="0"
          aria-valuemax="100"
        ><i :style="{ width: `${snapshot.weakestEliteHealthPercent ?? 0}%` }" /></div>
      </div>
      <div class="battle-hud__spell">
        <ArtifactIcon id="protective-spell" label="玄光护身诀" />
        <span>
          <strong>玄光护身诀</strong>
          <small>{{ snapshot?.spellCooldownMs ? `${Math.ceil(snapshot.spellCooldownMs / 1000)} 秒` : '可施放' }}</small>
        </span>
        <kbd>{{ spellKey }}</kbd>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.battle-hud__vitals {
  position: absolute;
  top: max(0.8rem, env(safe-area-inset-top));
  left: 50%;
  width: min(24rem, calc(100% - 18rem));
  min-width: 15rem;
  border: 1px solid rgb(225 190 102 / 0.22);
  background: rgb(6 14 10 / 0.82);
  padding: 0.55rem 0.7rem;
  color: #f5f5f4;
  box-shadow: 0 0.7rem 2rem rgb(0 0 0 / 0.35);
  transform: translateX(-50%);
  backdrop-filter: blur(10px);
}

.battle-hud__vitals-heading { display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 0.4rem; font-size: 0.68rem; }
.battle-hud__vitals-heading span { color: #fdba74; font-family: ui-monospace, monospace; }
.battle-hud__bar { height: 0.36rem; overflow: hidden; background: rgb(0 0 0 / 0.55); }
.battle-hud__bar + .battle-hud__bar { margin-top: 0.22rem; }
.battle-hud__bar i { display: block; height: 100%; transition: width 120ms linear; }
.battle-hud__bar--health i { background: linear-gradient(90deg, #dc6c51, #fb923c); }
.battle-hud__bar--experience i { background: linear-gradient(90deg, #3f8c68, #6ee7b7); }

.battle-hud__wing {
  position: absolute;
  top: 50%;
  width: clamp(11rem, 12vw, 14rem);
  border: 1px solid rgb(225 190 102 / 0.2);
  background: linear-gradient(145deg, rgb(7 14 11 / 0.86), rgb(20 32 25 / 0.72));
  padding: 1rem;
  color: #eee9db;
  box-shadow: 0 1rem 3rem rgb(0 0 0 / 0.35);
  transform: translateY(-50%);
  backdrop-filter: blur(12px);
}

.battle-hud__wing--left {
  left: max(0.75rem, env(safe-area-inset-left));
  border-left: 2px solid rgb(127 174 126 / 0.6);
}

.battle-hud__wing--right {
  right: max(0.75rem, env(safe-area-inset-right));
  border-right: 2px solid rgb(225 190 102 / 0.6);
}

.battle-hud__eyebrow {
  margin: 0 0 0.85rem;
  color: rgb(253 230 138 / 0.65);
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.24em;
}

.battle-hud__artifacts {
  display: grid;
  gap: 0.55rem;
}

.battle-hud__artifact,
.battle-hud__spell {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.battle-hud__artifact strong,
.battle-hud__artifact small,
.battle-hud__spell strong,
.battle-hud__spell small {
  display: block;
}

.battle-hud__artifact strong,
.battle-hud__spell strong {
  font-size: 0.75rem;
}

.battle-hud__artifact small,
.battle-hud__spell small,
.battle-hud__muted {
  color: rgb(214 211 209 / 0.65);
  font-size: 0.65rem;
}

.battle-hud__stage {
  display: block;
  color: #fef3c7;
  font-family: ui-serif, "Songti SC", serif;
  font-size: 1rem;
}

.battle-hud__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.35rem;
  margin: 0.8rem 0;
}

.battle-hud__stats div {
  border: 1px solid rgb(255 255 255 / 0.08);
  background: rgb(255 255 255 / 0.035);
  padding: 0.45rem 0.25rem;
  text-align: center;
}

.battle-hud__stats dt {
  color: rgb(214 211 209 / 0.55);
  font-size: 0.55rem;
}

.battle-hud__stats dd {
  margin: 0.15rem 0 0;
  font-family: ui-monospace, monospace;
  font-size: 0.7rem;
}

.battle-hud__elite { margin: 0.2rem 0 0.8rem; color: #fde68a; font-size: 0.65rem; }
.battle-hud__elite span { display: flex; justify-content: space-between; gap: 0.5rem; }
.battle-hud__elite small { color: rgb(253 230 138 / 0.65); }
.battle-hud__elite-bar { height: 0.3rem; margin-top: 0.3rem; overflow: hidden; background: rgb(0 0 0 / 0.55); }
.battle-hud__elite-bar i { display: block; height: 100%; background: linear-gradient(90deg, #dc6c51, #f59e0b); transition: width 120ms linear; }

.battle-hud__spell {
  border-top: 1px solid rgb(255 255 255 / 0.08);
  padding-top: 0.8rem;
}

.battle-hud__spell kbd {
  margin-left: auto;
  border: 1px solid rgb(125 211 252 / 0.35);
  border-bottom-width: 2px;
  border-radius: 0.25rem;
  background: rgb(14 116 144 / 0.18);
  padding: 0.2rem 0.35rem;
  color: #bae6fd;
  font-size: 0.55rem;
}

@media (max-aspect-ratio: 19/9) {
  .battle-hud__wing {
    top: auto;
    bottom: max(0.75rem, env(safe-area-inset-bottom));
    transform: none;
  }

  .battle-hud__wing--left {
    display: none;
  }
}

@media (hover: none), (pointer: coarse) {
  .battle-hud__wing {
    display: none;
  }

  .battle-hud__vitals {
    left: max(0.75rem, env(safe-area-inset-left));
    width: min(20rem, calc(100% - 9rem));
    min-width: 0;
    transform: none;
  }
}
</style>
