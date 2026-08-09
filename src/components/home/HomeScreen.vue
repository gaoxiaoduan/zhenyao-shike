<script setup lang="ts">
import caveBackgroundUrl from '../../assets/game/qingshi-cave-home.png'

const props = defineProps<{
  fullscreenAvailable: boolean
}>()

const emit = defineEmits<{
  start: []
  openSettings: []
  openControls: []
  toggleFullscreen: []
}>()
</script>

<template>
  <section
    class="home-screen relative min-h-svh overflow-hidden"
    :style="{ backgroundImage: `url(${caveBackgroundUrl})` }"
  >
    <div class="home-screen__shade absolute inset-0" />
    <div class="home-screen__grain absolute inset-0" />

    <header class="home-screen__topbar relative z-10">
      <div>
        <p class="home-screen__location">炼气初期 · 青石岭临时洞府</p>
        <p class="home-screen__name">散修 陈砺安</p>
      </div>
      <nav class="home-screen__utilities" aria-label="洞府工具">
        <button type="button" @click="emit('openControls')">操作卷册</button>
        <button type="button" @click="emit('openSettings')">设置</button>
        <button v-if="props.fullscreenAvailable" type="button" @click="emit('toggleFullscreen')">全屏</button>
      </nav>
    </header>

    <div class="home-screen__content relative z-10">
      <p class="home-screen__kicker">凡躯入道 · 十刻镇妖</p>
      <h1>镇妖十刻</h1>
      <p class="home-screen__lead">
        妖潮正从竹林深处逼近。择一法器，在十刻镇妖盘留下第一道属于凡人的刻印。
      </p>

      <div class="home-screen__briefing" aria-label="本次历练情报">
        <span><small>战场</small>青石岭</span>
        <span><small>妖王</small>啸月狼王</span>
        <span><small>目标</small>生存 · 构筑 · 镇压</span>
      </div>

      <button
        class="home-screen__start"
        type="button"
        aria-label="开始青石岭历练"
        @click="emit('start')"
      >
        <span>入青石岭</span>
        <small>开始本次历练</small>
      </button>
      <p class="home-screen__hint">桌面端默认窗口化 · WASD / 方向键移动 · Space / E 施放术法</p>
    </div>

    <footer class="home-screen__footer relative z-10">
      <span>青石岭核心切片</span>
      <span>原创视听演示版</span>
    </footer>
  </section>
</template>

<style scoped>
.home-screen {
  display: grid;
  grid-template-rows: auto 1fr auto;
  background-color: #07100d;
  background-position: center;
  background-size: cover;
  color: #f3efe1;
}

.home-screen__shade {
  background:
    linear-gradient(90deg, rgb(3 8 7 / 0.92) 0%, rgb(3 8 7 / 0.54) 42%, rgb(3 8 7 / 0.18) 68%, rgb(3 8 7 / 0.46) 100%),
    linear-gradient(0deg, rgb(3 8 7 / 0.82), transparent 45%);
}

.home-screen__grain {
  opacity: 0.18;
  background-image: repeating-linear-gradient(0deg, transparent 0 3px, rgb(253 230 138 / 0.08) 4px);
  mix-blend-mode: soft-light;
  pointer-events: none;
}

.home-screen__topbar,
.home-screen__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: max(1.25rem, env(safe-area-inset-top)) max(1.5rem, env(safe-area-inset-right)) 1rem max(1.5rem, env(safe-area-inset-left));
}

.home-screen__location,
.home-screen__kicker {
  margin: 0;
  color: rgb(253 230 138 / 0.68);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.28em;
}

.home-screen__name {
  margin: 0.35rem 0 0;
  color: rgb(231 229 228 / 0.74);
  font-size: 0.75rem;
}

.home-screen__utilities {
  display: flex;
  gap: 0.5rem;
}

.home-screen__utilities button {
  min-height: 2.5rem;
  border: 1px solid rgb(231 229 228 / 0.22);
  border-radius: 0.25rem;
  background: rgb(6 12 10 / 0.62);
  padding: 0.5rem 0.85rem;
  color: rgb(231 229 228 / 0.82);
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  backdrop-filter: blur(8px);
}

.home-screen__utilities button:hover,
.home-screen__utilities button:focus-visible {
  border-color: rgb(253 230 138 / 0.7);
  color: #fef3c7;
  outline: none;
}

.home-screen__content {
  align-self: center;
  width: min(40rem, calc(100% - 3rem));
  margin-left: clamp(1.5rem, 8vw, 9rem);
  padding: 2rem 0 4rem;
}

.home-screen h1 {
  margin: 0.7rem 0 0;
  color: #fff4cc;
  font-family: "STKaiti", "KaiTi", "Songti SC", serif;
  font-size: clamp(4rem, 8vw, 7.5rem);
  font-weight: 900;
  letter-spacing: 0.1em;
  line-height: 0.95;
  text-shadow: 0 0.35rem 0 #3b2918, 0 1.2rem 3rem rgb(0 0 0 / 0.62);
}

.home-screen__lead {
  max-width: 34rem;
  margin: 1.6rem 0 0;
  color: rgb(231 229 228 / 0.82);
  font-size: clamp(0.95rem, 1.4vw, 1.08rem);
  line-height: 1.9;
}

.home-screen__briefing {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 1.35rem;
}

.home-screen__briefing span {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  border: 1px solid rgb(127 174 126 / 0.24);
  background: rgb(8 20 15 / 0.66);
  padding: 0.55rem 0.75rem;
  color: #dbe9d4;
  font-size: 0.75rem;
  backdrop-filter: blur(8px);
}

.home-screen__briefing small {
  color: rgb(253 230 138 / 0.55);
  font-size: 0.58rem;
  letter-spacing: 0.16em;
}

.home-screen__start {
  display: inline-flex;
  align-items: baseline;
  gap: 1rem;
  min-width: 17rem;
  margin-top: 2rem;
  border: 1px solid rgb(255 225 133 / 0.76);
  border-left-width: 4px;
  border-radius: 0.2rem;
  background: linear-gradient(110deg, rgb(109 75 28 / 0.82), rgb(37 55 36 / 0.82));
  padding: 1rem 1.35rem;
  color: #fff1bd;
  box-shadow: 0 0.8rem 2.5rem rgb(0 0 0 / 0.44), inset 0 0 1.5rem rgb(255 231 156 / 0.07);
  text-align: left;
  transition: transform 160ms ease, border-color 160ms ease, filter 160ms ease;
}

.home-screen__start:hover,
.home-screen__start:focus-visible {
  border-color: #fff0b3;
  filter: brightness(1.14);
  outline: none;
  transform: translateY(-2px);
}

.home-screen__start span {
  font-family: "STKaiti", "KaiTi", serif;
  font-size: 1.5rem;
  font-weight: 900;
  letter-spacing: 0.16em;
}

.home-screen__start small,
.home-screen__hint,
.home-screen__footer {
  color: rgb(214 211 209 / 0.6);
  font-size: 0.65rem;
  letter-spacing: 0.1em;
}

.home-screen__hint {
  margin: 0.8rem 0 0;
}

.home-screen__footer {
  border-top: 1px solid rgb(255 255 255 / 0.06);
  background: rgb(2 7 5 / 0.48);
  padding-top: 0.75rem;
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}

@media (max-width: 700px) {
  .home-screen__topbar {
    align-items: flex-start;
  }

  .home-screen__location,
  .home-screen__name,
  .home-screen__utilities button:first-child,
  .home-screen__utilities button:last-child,
  .home-screen__footer {
    display: none;
  }

  .home-screen__content {
    width: calc(100% - 2rem);
    margin: auto;
    padding-bottom: 1.5rem;
  }

  .home-screen h1 {
    font-size: clamp(3rem, 18vw, 5rem);
  }
}
</style>
