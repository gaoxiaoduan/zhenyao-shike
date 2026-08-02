<script setup lang="ts">
import { defineAsyncComponent, shallowRef } from 'vue'

const BattlefieldGame = defineAsyncComponent(() => import('./components/BattlefieldGame.vue'))

type Screen = 'home' | 'run' | 'result'

const screen = shallowRef<Screen>('home')
const lastResult = shallowRef<'victory' | 'defeat'>('defeat')

function startRun() {
  if (document.fullscreenEnabled && !document.fullscreenElement) {
    void document.documentElement.requestFullscreen().catch(() => undefined)
  }
  screen.value = 'run'
}

function finishRun(result: 'victory' | 'defeat') {
  lastResult.value = result
  screen.value = 'result'
}
</script>

<template>
  <main class="min-h-svh overflow-hidden bg-[#090e0d] text-stone-100">
    <section
      v-if="screen === 'home'"
      class="relative grid min-h-svh place-items-center overflow-hidden px-6 py-10"
    >
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,#294a3a_0%,#111c18_38%,#070b0a_78%)]" />
      <div class="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(227,202,141,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(227,202,141,.08)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div class="relative z-10 max-w-2xl text-center">
        <p class="mb-4 text-sm tracking-[0.5em] text-amber-200/65">凡躯入道 · 十刻镇妖</p>
        <h1 class="font-serif text-6xl font-black tracking-[0.12em] text-amber-100 drop-shadow-[0_4px_28px_rgba(232,192,102,.26)] sm:text-8xl">
          镇妖十刻
        </h1>
        <p class="mx-auto mt-6 max-w-xl text-base leading-8 text-stone-300 sm:text-lg">
          陈砺安自青石岭起步，以四方术法与随身法器，在妖潮中挣出一条散修之路。
        </p>

        <button
          class="mt-10 min-h-14 min-w-52 rounded-sm border border-amber-200/55 bg-amber-100/10 px-8 py-4 text-lg font-bold tracking-[0.3em] text-amber-100 shadow-[0_0_40px_rgba(232,192,102,.12)] transition hover:bg-amber-100/20 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200"
          type="button"
          @click="startRun"
        >
          入青石岭
        </button>

        <p class="mt-5 text-xs tracking-wider text-stone-500">
          移动端请横屏 · 桌面端使用 WASD 或方向键
        </p>
      </div>
    </section>

    <BattlefieldGame v-else-if="screen === 'run'" @finished="finishRun" />

    <section v-else class="grid min-h-svh place-items-center px-6">
      <div class="w-full max-w-lg rounded-lg border border-amber-100/20 bg-stone-950/80 p-8 text-center shadow-2xl">
        <p class="text-sm tracking-[0.35em] text-amber-200/60">历练结算</p>
        <h2 class="mt-4 font-serif text-4xl font-bold text-amber-100">
          {{ lastResult === 'victory' ? '妖王伏诛' : '此行未竟' }}
        </h2>
        <p class="mt-4 leading-7 text-stone-400">
          核心切片正在搭建中。每次重开都会生成新的妖群节奏。
        </p>
        <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button class="game-button" type="button" @click="startRun">再次历练</button>
          <button class="game-button game-button--quiet" type="button" @click="screen = 'home'">
            返回洞府
          </button>
        </div>
      </div>
    </section>
  </main>
</template>
