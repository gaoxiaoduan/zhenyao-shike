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
  compact?: boolean
}>()

const spellKey = computed(() => displayControlKey(props.keyBindings.castSpell[0] ?? 'space'))
const spellCooldownRatio = computed(() => {
  const remaining = props.snapshot?.spellCooldownMs ?? 0
  return Math.max(0, Math.min(1, remaining / 10_000))
})
const shieldRatio = computed(() => Math.max(0, Math.min(1, (props.snapshot?.spellShieldRemainingMs ?? 0) / 1_500)))
const eventProgress = computed(() => Math.max(0, Math.min(1, props.snapshot?.battlefieldEvent?.progress ?? 0)))
</script>

<template>
  <div class="battle-hud pointer-events-none absolute inset-0 z-20" :class="{ 'battle-hud--compact': props.compact }" aria-label="战斗信息">
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

    <section v-if="snapshot?.boss && snapshot.boss.phase !== 'defeated'" class="battle-hud__boss" aria-label="妖王生命">
      <div class="battle-hud__boss-heading">
        <strong>{{ snapshot.boss.name }}</strong>
        <span>{{ snapshot.boss.phase === 'enraged' ? '狂月' : snapshot.boss.phase === 'arrival' ? '降临' : '决战' }}</span>
      </div>
      <div class="battle-hud__boss-bar" role="progressbar" aria-label="啸月狼王生命" :aria-valuenow="snapshot.boss.health" :aria-valuemax="snapshot.boss.maxHealth">
        <i :style="{ width: `${Math.max(0, Math.min(100, (snapshot.boss.health / snapshot.boss.maxHealth) * 100))}%` }" />
        <b :style="{ left: `${(snapshot.boss.enragedThreshold / snapshot.boss.maxHealth) * 100}%` }" />
      </div>
      <small v-if="snapshot.boss.breachRemainingMs">妖王破绽 · {{ (snapshot.boss.breachRemainingMs / 1000).toFixed(1) }} 秒</small>
    </section>

    <aside v-if="!props.compact" class="battle-hud__wing battle-hud__wing--left">
      <div class="battle-hud__eyebrow-row">
        <p class="battle-hud__eyebrow">本局构筑</p>
        <span>{{ snapshot?.artifacts.length ?? 0 }} / 4</span>
      </div>
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

    <aside v-if="!props.compact" class="battle-hud__wing battle-hud__wing--right">
      <div class="battle-hud__eyebrow-row">
        <p class="battle-hud__eyebrow">青石岭历练</p>
        <span>第 {{ snapshot?.level ?? 1 }} 境</span>
      </div>
      <strong class="battle-hud__stage">{{ snapshot?.stageLabel ?? '整备中' }}</strong>
      <dl class="battle-hud__stats">
        <div><dt>时间</dt><dd>{{ formatElapsedTime(snapshot?.elapsedMs ?? 0) }}</dd></div>
        <div><dt>妖物</dt><dd>{{ snapshot?.enemyCount ?? 0 }}</dd></div>
        <div><dt>境进</dt><dd>Lv.{{ snapshot?.level ?? 1 }}</dd></div>
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
        <div class="battle-hud__spell-icon" :class="{ 'battle-hud__spell-icon--ready': !snapshot?.spellCooldownMs }" :style="{ '--spell-cooldown': `${spellCooldownRatio * 100}%`, '--shield-progress': `${shieldRatio * 100}%` }">
          <ArtifactIcon id="protective-spell" label="玄光护身诀" />
          <span v-if="snapshot?.spellCooldownMs" class="battle-hud__spell-mask" aria-hidden="true" />
          <span v-if="snapshot?.spellShieldRemainingMs" class="battle-hud__shield-ring" aria-hidden="true" />
        </div>
        <span>
          <strong>玄光护身诀</strong>
          <small :class="{ 'battle-hud__spell-status--ready': !snapshot?.spellShieldRemainingMs && !snapshot?.spellCooldownMs }">{{ snapshot?.spellShieldRemainingMs ? `护盾 ${Math.ceil(snapshot.spellShieldRemainingMs / 100) / 10}s` : snapshot?.spellCooldownMs ? `${Math.ceil(snapshot.spellCooldownMs / 1000)} 秒` : '可施放' }}</small>
        </span>
        <kbd>{{ spellKey }}</kbd>
      </div>
      <div v-if="snapshot?.hitProtectionRemainingMs" class="battle-hud__protection">受击保护 · {{ (snapshot.hitProtectionRemainingMs / 1000).toFixed(1) }} 秒</div>
    </aside>

    <aside v-if="snapshot?.battlefieldEvent" class="battle-hud__event" :class="{ 'battle-hud__event--fountain': snapshot.battlefieldEvent.kind === 'lingquan' }" aria-live="polite">
      <div class="battle-hud__event-heading"><strong>{{ snapshot.battlefieldEvent.name }}</strong><span>{{ snapshot.battlefieldEvent.phase === 'travel' ? '前往' : snapshot.battlefieldEvent.phase === 'guiding' ? '引导中' : '战斗中' }}</span></div>
      <p>{{ snapshot.battlefieldEvent.objective }}</p>
      <div class="battle-hud__event-bar"><i :style="{ width: `${eventProgress * 100}%` }" /></div>
      <small>{{ Math.ceil(snapshot.battlefieldEvent.remainingMs / 1000) }} 秒 · {{ snapshot.battlefieldEvent.reward }}</small>
    </aside>
  </div>
</template>

<style scoped>
.battle-hud {
  --hud-panel: rgb(6 14 10 / 0.84);
  --hud-panel-bright: rgb(19 34 25 / 0.78);
  --hud-gold: #f5d88a;
  --hud-jade: #a7f3d0;
  --hud-line: rgb(225 190 102 / 0.28);
}

.battle-hud::before {
  position: absolute;
  inset: max(0.55rem, env(safe-area-inset-top)) max(0.55rem, env(safe-area-inset-right)) max(0.55rem, env(safe-area-inset-bottom)) max(0.55rem, env(safe-area-inset-left));
  z-index: 50;
  border: 1px solid rgb(245 216 138 / 0.08);
  border-radius: 0.45rem;
  content: "";
  pointer-events: none;
}

.battle-hud__vitals {
  position: absolute;
  top: max(0.8rem, env(safe-area-inset-top));
  left: 50%;
  width: min(24rem, calc(100% - 18rem));
  min-width: 15rem;
  border: 1px solid var(--hud-line);
  border-top-color: rgb(245 216 138 / 0.52);
  border-radius: 0.35rem;
  background: linear-gradient(135deg, var(--hud-panel-bright), var(--hud-panel));
  padding: 0.55rem 0.7rem;
  color: #f5f5f4;
  box-shadow: var(--ui-shadow), inset 0 1px rgb(255 255 255 / 0.06);
  transform: translateX(-50%);
  backdrop-filter: blur(10px);
}

.battle-hud__vitals-heading { display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 0.4rem; font-size: 0.68rem; }
.battle-hud__vitals-heading span { color: #fdba74; font-family: ui-monospace, monospace; }
.battle-hud__bar { position: relative; height: 0.36rem; overflow: hidden; border: 1px solid rgb(255 255 255 / 0.05); background: rgb(0 0 0 / 0.55); }
.battle-hud__bar + .battle-hud__bar { margin-top: 0.22rem; }
.battle-hud__bar i { display: block; height: 100%; transition: width 120ms linear; }
.battle-hud__bar--health i { background: linear-gradient(90deg, #dc6c51, #fb923c); }
.battle-hud__bar--experience i { background: linear-gradient(90deg, #3f8c68, #6ee7b7); }

.battle-hud__boss {
  position: absolute;
  top: max(5.1rem, calc(env(safe-area-inset-top) + 4.4rem));
  left: 50%;
  width: min(31rem, calc(100% - 22rem));
  min-width: 18rem;
  border: 1px solid rgb(216 180 254 / 0.42);
  border-radius: 0.35rem;
  background: linear-gradient(135deg, rgb(31 16 43 / 0.9), rgb(19 10 28 / 0.86));
  padding: 0.55rem 0.7rem;
  color: #fef3c7;
  box-shadow: 0 1rem 3rem rgb(0 0 0 / 0.38), inset 0 1px rgb(255 255 255 / 0.05);
  transform: translateX(-50%);
}

.battle-hud__boss-heading { display: flex; justify-content: space-between; font-size: 0.72rem; }
.battle-hud__boss-heading span { color: #fda4af; font-size: 0.62rem; }
.battle-hud__boss-bar { position: relative; height: 0.6rem; margin-top: 0.35rem; overflow: hidden; background: rgb(0 0 0 / 0.65); }
.battle-hud__boss-bar i { display: block; height: 100%; background: linear-gradient(90deg, #c084fc, #f87171); transition: width 120ms linear; }
.battle-hud__boss-bar b { position: absolute; top: 0; bottom: 0; width: 2px; background: #fef08a; box-shadow: 0 0 0.4rem #fef08a; }
.battle-hud__boss small { display: block; margin-top: 0.3rem; color: #fef08a; font-size: 0.6rem; }

.battle-hud__wing {
  position: absolute;
  top: 50%;
  width: clamp(11rem, 12vw, 14rem);
  overflow: hidden;
  border: 1px solid rgb(225 190 102 / 0.24);
  border-radius: 0.35rem;
  background: linear-gradient(145deg, rgb(20 36 27 / 0.84), rgb(7 14 11 / 0.88));
  padding: 1rem;
  color: #eee9db;
  box-shadow: var(--ui-shadow), inset 0 1px rgb(255 255 255 / 0.05);
  transform: translateY(-50%);
  backdrop-filter: blur(12px);
}

.battle-hud__wing::before {
  position: absolute;
  top: 0;
  width: 3rem;
  height: 1px;
  background: linear-gradient(90deg, var(--hud-gold), transparent);
  content: "";
  opacity: 0.7;
}

.battle-hud__wing--left::before { left: 0; }
.battle-hud__wing--right::before { right: 0; transform: rotate(180deg); }

.battle-hud__wing--left {
  left: max(0.75rem, env(safe-area-inset-left));
  border-left: 2px solid rgb(127 174 126 / 0.6);
}

.battle-hud__wing--right {
  right: max(0.75rem, env(safe-area-inset-right));
  border-right: 2px solid rgb(225 190 102 / 0.6);
}

.battle-hud__eyebrow {
  margin: 0;
  color: rgb(253 230 138 / 0.65);
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.24em;
}

.battle-hud__eyebrow-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.85rem;
}

.battle-hud__eyebrow-row > span {
  color: rgb(167 243 208 / 0.58);
  font-family: ui-monospace, monospace;
  font-size: 0.58rem;
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

.battle-hud__spell-icon { position: relative; display: grid; place-items: center; width: 2.75rem; height: 2.75rem; border-radius: 0.4rem; }
.battle-hud__spell-icon--ready { filter: drop-shadow(0 0 0.5rem rgb(125 211 252 / 0.6)); }
.battle-hud__spell-mask { position: absolute; inset: 0; border-radius: 0.4rem; background: conic-gradient(rgb(8 16 13 / 0.78) var(--spell-cooldown), transparent 0); pointer-events: none; }
.battle-hud__shield-ring { position: absolute; inset: -0.25rem; border: 2px solid #bae6fd; border-radius: 0.55rem; opacity: 0.9; transform: rotate(-90deg); clip-path: polygon(0 0, var(--shield-progress) 0, var(--shield-progress) 100%, 0 100%); pointer-events: none; }
.battle-hud__protection { margin-top: 0.45rem; color: #bae6fd; font-size: 0.6rem; text-align: right; }

.battle-hud__event {
  position: absolute;
  left: 50%;
  bottom: max(1rem, env(safe-area-inset-bottom));
  width: min(29rem, calc(100% - 2rem));
  border: 1px solid rgb(239 68 68 / 0.4);
  border-radius: 0.35rem;
  background: linear-gradient(135deg, rgb(54 18 24 / 0.92), rgb(28 12 16 / 0.9));
  padding: 0.65rem 0.8rem;
  color: #fee2e2;
  transform: translateX(-50%);
  backdrop-filter: blur(8px);
  box-shadow: 0 1rem 3rem rgb(0 0 0 / 0.32), inset 0 1px rgb(255 255 255 / 0.04);
}
.battle-hud__event--fountain { border-color: rgb(103 232 249 / 0.35); background: rgb(7 30 34 / 0.9); color: #cffafe; }
.battle-hud__event-heading { display: flex; justify-content: space-between; gap: 0.5rem; font-size: 0.7rem; }
.battle-hud__event-heading span { color: #fda4af; font-size: 0.6rem; }
.battle-hud__event--fountain .battle-hud__event-heading span { color: #67e8f9; }
.battle-hud__event p { margin: 0.25rem 0 0.4rem; font-size: 0.62rem; opacity: 0.8; }
.battle-hud__event-bar { height: 0.28rem; overflow: hidden; background: rgb(0 0 0 / 0.5); }
.battle-hud__event-bar i { display: block; height: 100%; background: linear-gradient(90deg, #ef4444, #fbbf24); transition: width 120ms linear; }
.battle-hud__event--fountain .battle-hud__event-bar i { background: linear-gradient(90deg, #22d3ee, #a7f3d0); }
.battle-hud__event small { display: block; margin-top: 0.3rem; color: rgb(254 226 226 / 0.7); font-size: 0.57rem; }

.battle-hud--compact .battle-hud__vitals {
  top: max(0.6rem, env(safe-area-inset-top));
  left: max(0.6rem, env(safe-area-inset-left));
  width: min(15rem, calc(100% - 1.2rem));
  min-width: 0;
  padding: 0.42rem 0.55rem;
  transform: none;
}

.battle-hud--compact .battle-hud__vitals-heading { margin-bottom: 0.28rem; font-size: 0.62rem; }
.battle-hud--compact .battle-hud__boss {
  top: max(13rem, calc(env(safe-area-inset-top) + 12.6rem));
  right: max(0.6rem, env(safe-area-inset-right));
  left: auto;
  width: min(16rem, calc(100% - 18rem));
  min-width: 0;
  padding: 0.42rem 0.55rem;
  transform: none;
}
.battle-hud--compact .battle-hud__event { bottom: max(0.6rem, env(safe-area-inset-bottom)); width: min(22rem, calc(100% - 1.2rem)); }

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

.battle-hud__spell-status--ready {
  color: var(--hud-jade);
  text-shadow: 0 0 0.8rem rgb(110 231 183 / 0.35);
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
  border: 1px solid rgb(255 255 255 / 0.1);
  border-top-color: rgb(245 216 138 / 0.18);
  background: linear-gradient(180deg, rgb(255 255 255 / 0.055), rgb(255 255 255 / 0.018));
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

  .battle-hud__boss {
    top: max(13rem, calc(env(safe-area-inset-top) + 12.6rem));
    width: calc(100% - 1.5rem);
    min-width: 0;
  }

  .battle-hud__event { bottom: 7rem; }
}
</style>
