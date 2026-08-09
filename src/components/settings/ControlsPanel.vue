<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue'

const emit = defineEmits<{ close: [] }>()
const panel = useTemplateRef<HTMLElement>('panel')

onMounted(() => panel.value?.focus())
</script>

<template>
  <div class="controls-backdrop">
    <section
      ref="panel"
      class="controls-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="controls-title"
      tabindex="-1"
      @keydown.esc.stop.prevent="emit('close')"
    >
      <header>
        <div><p>操作卷册</p><h2 id="controls-title">如何历练</h2></div>
        <button type="button" aria-label="关闭操作说明" @click="$emit('close')">×</button>
      </header>
      <div class="controls-panel__grid">
        <article><span>WASD / 方向键</span><h3>移动</h3><p>角色攻击全自动。保持移动，拉开妖物与角色之间的空间。</p></article>
        <article><span>Space / E</span><h3>施放术法</h3><p>术法冷却完成后可主动护身；屏幕右侧会显示剩余冷却。</p></article>
        <article><span>Esc</span><h3>暂停</h3><p>暂停战斗后可进入设置。窗口失焦时，移动输入会被安全清空。</p></article>
        <article><span>触控</span><h3>移动端</h3><p>横屏使用左侧摇杆移动、右侧按钮施术；竖屏会自动暂停。</p></article>
      </div>
      <p class="controls-panel__note">所有桌面键位都可在“设置”中重新绑定。</p>
      <button class="game-button" type="button" @click="$emit('close')">收起卷册</button>
    </section>
  </div>
</template>

<style scoped>
.controls-backdrop { position: fixed; z-index: 100; inset: 0; display: grid; place-items: center; padding: 1rem; background: rgb(2 7 5 / 0.8); backdrop-filter: blur(12px); }
.controls-panel { width: min(44rem, 100%); max-height: calc(100svh - 2rem); overflow-y: auto; border: 1px solid rgb(253 230 138 / 0.28); border-radius: 0.5rem; background: linear-gradient(145deg, #18231e, #07100d); padding: 1.2rem; box-shadow: 0 2rem 7rem rgb(0 0 0 / 0.7); }
.controls-panel header { display: flex; align-items: center; justify-content: space-between; }
.controls-panel header p { margin: 0; color: rgb(253 230 138 / 0.55); font-size: 0.65rem; letter-spacing: 0.25em; }
.controls-panel h2 { margin: 0.25rem 0 0; color: #fff3c4; font-family: "STKaiti", "KaiTi", serif; font-size: 2rem; }
.controls-panel header button { width: 2.6rem; height: 2.6rem; border: 1px solid rgb(231 229 228 / 0.22); background: transparent; color: #e7e5e4; font-size: 1.5rem; }
.controls-panel__grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.7rem; margin-top: 1rem; }
.controls-panel article { border: 1px solid rgb(126 174 126 / 0.16); background: rgb(2 10 7 / 0.42); padding: 1rem; }
.controls-panel article span { color: #fde68a; font-size: 0.68rem; font-weight: 800; letter-spacing: 0.08em; }
.controls-panel h3 { margin: 0.45rem 0 0; color: #f5f5f4; font-size: 0.95rem; }
.controls-panel article p,
.controls-panel__note { color: rgb(168 162 158 / 0.86); font-size: 0.72rem; line-height: 1.65; }
.controls-panel__note { margin: 1rem 0; text-align: center; }
.controls-panel > .game-button { display: block; margin: auto; }
@media (max-width: 560px) { .controls-panel__grid { grid-template-columns: 1fr; } }
</style>
