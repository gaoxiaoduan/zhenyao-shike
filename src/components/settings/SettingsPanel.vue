<script setup lang="ts">
import { onMounted, shallowRef, useTemplateRef } from 'vue'
import {
  CONTROL_ACTIONS,
  type ControlAction,
  type GameSettings,
  type QualityMode,
} from '../../game/settings/gameSettings'
import { CONTROL_ACTION_LABELS, displayControlKey } from '../../game/settings/controlPresentation'

const props = defineProps<{
  settings: GameSettings
  fullscreenAvailable: boolean
  rebindError: string | null
}>()

const emit = defineEmits<{
  updateSettings: [patch: Partial<Omit<GameSettings, 'version' | 'keyBindings'>>]
  rebind: [action: ControlAction, key: string]
  reset: []
  close: []
  toggleFullscreen: []
}>()

const listeningAction = shallowRef<ControlAction | null>(null)
const panel = useTemplateRef<HTMLElement>('panel')

onMounted(() => panel.value?.focus())

function updateVolume(kind: 'musicVolume' | 'sfxVolume', event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  emit('updateSettings', { [kind]: value })
}

function updateQuality(event: Event) {
  emit('updateSettings', { quality: (event.target as HTMLSelectElement).value as QualityMode })
}

function captureBinding(event: KeyboardEvent) {
  const action = listeningAction.value
  if (!action) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      emit('close')
    }
    return
  }

  event.preventDefault()
  event.stopPropagation()
  emit('rebind', action, event.key)
  listeningAction.value = null
}

</script>

<template>
  <div class="settings-backdrop" role="presentation" @keydown="captureBinding">
    <section
      ref="panel"
      class="settings-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      tabindex="-1"
    >
      <header class="settings-panel__header">
        <div>
          <p>洞府执事</p>
          <h2 id="settings-title">设置</h2>
        </div>
        <button class="settings-panel__close" type="button" aria-label="关闭设置" @click="emit('close')">×</button>
      </header>

      <div class="settings-panel__body">
        <section class="settings-section" aria-labelledby="audio-title">
          <div class="settings-section__heading">
            <div>
              <p>声景</p>
              <h3 id="audio-title">音效与背景音</h3>
            </div>
            <button
              class="settings-switch"
              :aria-pressed="props.settings.muted"
              type="button"
              @click="emit('updateSettings', { muted: !props.settings.muted })"
            >
              {{ props.settings.muted ? '恢复声音' : '全部静音' }}
            </button>
          </div>

          <label class="settings-range">
            <span>音乐音量 <output>{{ Math.round(props.settings.musicVolume * 100) }}%</output></span>
            <input
              aria-label="音乐音量"
              type="range"
              min="0"
              max="1"
              step="0.05"
              :value="props.settings.musicVolume"
              @input="updateVolume('musicVolume', $event)"
            >
          </label>
          <label class="settings-range">
            <span>战斗音效 <output>{{ Math.round(props.settings.sfxVolume * 100) }}%</output></span>
            <input
              aria-label="战斗音效"
              type="range"
              min="0"
              max="1"
              step="0.05"
              :value="props.settings.sfxVolume"
              @input="updateVolume('sfxVolume', $event)"
            >
          </label>
          <label class="settings-check">
            <input
              type="checkbox"
              :checked="props.settings.vibrationEnabled"
              @change="emit('updateSettings', { vibrationEnabled: ($event.target as HTMLInputElement).checked })"
            >
            <span><strong>移动端震动</strong><small>仅用于术法、升阶与重伤等关键反馈</small></span>
          </label>
        </section>

        <section class="settings-section" aria-labelledby="display-title">
          <div class="settings-section__heading">
            <div>
              <p>画面</p>
              <h3 id="display-title">显示与可读性</h3>
            </div>
            <button v-if="props.fullscreenAvailable" class="settings-switch" type="button" @click="emit('toggleFullscreen')">
              切换全屏
            </button>
          </div>

          <label class="settings-select">
            <span>渲染清晰度</span>
            <select :value="props.settings.quality" @change="updateQuality">
              <option value="auto">自动（推荐）</option>
              <option value="sharp">锐利（最高 2×）</option>
              <option value="smooth">流畅（1×）</option>
            </select>
          </label>
          <label class="settings-check">
            <input
              type="checkbox"
              :checked="props.settings.largeText"
              @change="emit('updateSettings', { largeText: ($event.target as HTMLInputElement).checked })"
            >
            <span><strong>大号文字</strong><small>放大网页界面的关键信息</small></span>
          </label>
          <label class="settings-check">
            <input
              type="checkbox"
              :checked="props.settings.reducedMotion"
              @change="emit('updateSettings', { reducedMotion: ($event.target as HTMLInputElement).checked })"
            >
            <span><strong>减少动态效果</strong><small>收敛转场、闪烁与界面位移</small></span>
          </label>
        </section>

        <section class="settings-section" aria-labelledby="controls-title">
          <div class="settings-section__heading">
            <div>
              <p>键位</p>
              <h3 id="controls-title">桌面操作</h3>
            </div>
            <button class="settings-switch" type="button" @click="emit('reset')">恢复默认</button>
          </div>

          <p class="settings-section__help">选择按键后直接按下新键；若与其他操作冲突，将保留原绑定。</p>
          <div class="settings-bindings">
            <div v-for="action in CONTROL_ACTIONS" :key="action" class="settings-binding">
              <span>{{ CONTROL_ACTION_LABELS[action] }}</span>
              <button
                type="button"
                :class="{ 'is-listening': listeningAction === action }"
                @click="listeningAction = action"
              >
                {{ listeningAction === action ? '请按键…' : displayControlKey(props.settings.keyBindings[action][0] ?? '') }}
              </button>
            </div>
          </div>
          <p v-if="props.rebindError" class="settings-error" role="alert">{{ props.rebindError }}</p>
        </section>
      </div>

      <footer class="settings-panel__footer">
        <span>设置会自动保存在此浏览器</span>
        <button class="game-button" type="button" @click="emit('close')">完成</button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.settings-backdrop {
  position: fixed;
  z-index: 100;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgb(2 7 5 / 0.8);
  backdrop-filter: blur(12px);
}

.settings-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(58rem, 100%);
  max-height: min(52rem, calc(100svh - 2rem));
  overflow: hidden;
  border: 1px solid rgb(253 230 138 / 0.28);
  border-radius: 0.5rem;
  background: linear-gradient(145deg, rgb(24 35 30 / 0.98), rgb(8 16 13 / 0.98));
  box-shadow: 0 2rem 7rem rgb(0 0 0 / 0.7), inset 0 1px rgb(255 255 255 / 0.05);
}

.settings-panel__header,
.settings-panel__footer,
.settings-section__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.settings-panel__header {
  border-bottom: 1px solid rgb(253 230 138 / 0.14);
  padding: 1.1rem 1.35rem;
}

.settings-panel__header p,
.settings-section__heading p {
  margin: 0;
  color: rgb(253 230 138 / 0.5);
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.settings-panel h2,
.settings-panel h3 {
  margin: 0.2rem 0 0;
  color: #fff3c4;
  font-family: "STKaiti", "KaiTi", serif;
}

.settings-panel h2 { font-size: 1.65rem; }
.settings-panel h3 { font-size: 1.15rem; }

.settings-panel__close,
.settings-switch,
.settings-binding button {
  border: 1px solid rgb(231 229 228 / 0.2);
  border-radius: 0.25rem;
  background: rgb(255 255 255 / 0.04);
  color: rgb(231 229 228 / 0.8);
}

.settings-panel__close {
  width: 2.6rem;
  height: 2.6rem;
  font-size: 1.5rem;
}

.settings-panel__body {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
  overflow-y: auto;
  padding: 1rem;
}

.settings-section {
  border: 1px solid rgb(126 174 126 / 0.16);
  border-radius: 0.35rem;
  background: rgb(2 10 7 / 0.38);
  padding: 1rem;
}

.settings-section:last-child { grid-column: 1 / -1; }
.settings-switch { min-height: 2.25rem; padding: 0.45rem 0.7rem; font-size: 0.7rem; }

.settings-panel button:hover,
.settings-panel button:focus-visible,
.settings-binding button.is-listening {
  border-color: rgb(253 230 138 / 0.7);
  color: #fef3c7;
  outline: none;
}

.settings-range,
.settings-select {
  display: grid;
  gap: 0.5rem;
  margin-top: 1rem;
  color: rgb(231 229 228 / 0.82);
  font-size: 0.82rem;
}

.settings-range > span,
.settings-select {
  grid-template-columns: 1fr auto;
  align-items: center;
}

.settings-range output { color: #fde68a; font-variant-numeric: tabular-nums; }
.settings-range input { width: 100%; accent-color: #caa560; }

.settings-select select {
  border: 1px solid rgb(231 229 228 / 0.22);
  border-radius: 0.25rem;
  background: #111c18;
  padding: 0.55rem;
  color: #f5f5f4;
}

.settings-check {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  margin-top: 1rem;
  color: rgb(231 229 228 / 0.82);
}

.settings-check input { margin-top: 0.25rem; accent-color: #caa560; }
.settings-check span { display: grid; gap: 0.15rem; }
.settings-check strong { font-size: 0.82rem; }
.settings-check small,
.settings-section__help { color: rgb(168 162 158 / 0.78); font-size: 0.68rem; line-height: 1.5; }

.settings-bindings {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 0.8rem;
}

.settings-binding {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  border-bottom: 1px solid rgb(255 255 255 / 0.06);
  padding: 0.45rem;
  color: rgb(214 211 209 / 0.82);
  font-size: 0.72rem;
}

.settings-binding button { min-width: 4.5rem; padding: 0.45rem; color: #fde68a; }
.settings-error { margin: 0.7rem 0 0; color: #fca5a5; font-size: 0.72rem; }

.settings-panel__footer {
  border-top: 1px solid rgb(253 230 138 / 0.12);
  padding: 0.8rem 1.2rem;
  color: rgb(168 162 158 / 0.68);
  font-size: 0.66rem;
}

.settings-panel__footer .game-button { min-height: 2.5rem; padding: 0.55rem 1.25rem; }

@media (max-width: 700px), (max-height: 580px) {
  .settings-backdrop { padding: 0.5rem; }
  .settings-panel { max-height: calc(100svh - 1rem); }
  .settings-panel__body { grid-template-columns: 1fr; }
  .settings-section:last-child { grid-column: auto; }
  .settings-bindings { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
