// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createArtifactInventory, generateUpgradeChoices } from '../game/domain/artifactInventory'
import { DEFAULT_GAME_SETTINGS } from '../game/settings/gameSettings'
import type { GameSessionEffect, GameSessionSnapshot } from '../game/session/GameSession'
import BattlefieldGame from './BattlefieldGame.vue'

const battleHarness = vi.hoisted(() => ({
  onSnapshot: undefined as ((snapshot: GameSessionSnapshot) => void) | undefined,
  onEffect: undefined as ((effect: GameSessionEffect) => void) | undefined,
  session: {
    requestManualPause: vi.fn(),
    releaseManualPause: vi.fn(),
    confirmOrientation: vi.fn(),
    confirmWindowFocus: vi.fn(),
    setPlatformPause: vi.fn(),
    setWindowFocused: vi.fn(),
    setPageVisible: vi.fn(),
    setInputSuspended: vi.fn(),
    clearInputIntent: vi.fn(),
    selectInitialArtifact: vi.fn(),
    selectUpgrade: vi.fn(),
    selectAscension: vi.fn(),
    skipAscension: vi.fn(),
    deduceUpgrade: vi.fn(),
    tunaHeal: vi.fn(),
    confirmBattlefieldEvent: vi.fn(),
    skipOnboarding: vi.fn(),
    setInputIntent: vi.fn(),
    castSpell: vi.fn(),
    resize: vi.fn(),
    setReducedMotion: vi.fn(),
    dispose: vi.fn(),
  },
}))

vi.mock('../game/phaser/createBattleSession', () => ({
  createBattleSession: (options: {
    onSnapshot: (snapshot: GameSessionSnapshot) => void
    onEffect: (effect: GameSessionEffect) => void
  }) => {
    battleHarness.onSnapshot = options.onSnapshot
    battleHarness.onEffect = options.onEffect
    return battleHarness.session
  },
}))

describe('BattlefieldGame input adapter', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    for (const command of Object.values(battleHarness.session)) {
      command.mockClear()
    }
  })

  afterEach(() => vi.unstubAllGlobals())

  it('casts while a direction is held without replacing that movement', async () => {
    const wrapper = mount(BattlefieldGame, {
      props: { settings: DEFAULT_GAME_SETTINGS, showOnboarding: false },
    })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space' }))
    await nextTick()

    expect(battleHarness.session.castSpell).toHaveBeenCalledOnce()
    expect(battleHarness.session.setInputIntent).toHaveBeenLastCalledWith(
      expect.objectContaining({ moveX: 0, moveY: -1 }),
    )
    wrapper.unmount()
  })

  it('resumes a physically held direction after choosing an upgrade with a number key', async () => {
    const wrapper = mount(BattlefieldGame, {
      props: { settings: DEFAULT_GAME_SETTINGS, showOnboarding: false },
    })
    const choices = generateUpgradeChoices(createArtifactInventory('qing-feng-jian-xia'), 3)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }))
    battleHarness.onSnapshot?.({
      lifecycle: 'active',
      pause: { active: true, presentation: 'decision' },
      decision: {
        type: 'upgrade',
        id: 'decision-upgrade',
        choices,
        deductionCount: 1,
        canDeduce: true,
        isZhouTian: false,
      },
      hud: null,
      onboardingStep: null,
      onboardingCompleted: true,
      result: null,
    })
    await nextTick()
    await wrapper.get('[aria-label="法器突破与构筑升级"]').trigger('keydown', { key: '1' })

    expect(battleHarness.session.selectUpgrade).toHaveBeenCalledWith('decision-upgrade', choices[0]!.choiceId)
    wrapper.unmount()
  })

  it('explains the first battlefield event once and resumes the tutorial pause', async () => {
    const wrapper = mount(BattlefieldGame, {
      props: { settings: DEFAULT_GAME_SETTINGS, showOnboarding: false },
    })

    battleHarness.onSnapshot?.({
      lifecycle: 'active',
      pause: { active: true, presentation: 'decision' },
      decision: {
        type: 'battlefield-event',
        id: 'decision-event',
        event: {
        kind: 'lingquan',
        phase: 'available',
        name: '灵泉涌现',
        objective: '进入青蓝引导区域并维持两秒。',
        remainingMs: 45_000,
        reward: '恢复 35% 最大生命',
        },
      },
      hud: null,
      onboardingStep: null,
      onboardingCompleted: true,
      result: null,
    })
    await nextTick()

    expect(wrapper.get('[aria-label="战场事件说明"]').text()).toContain('灵泉涌现')
    await wrapper.get('[aria-label="战场事件说明"] button').trigger('click')
    expect(battleHarness.session.confirmBattlefieldEvent).toHaveBeenCalledWith('decision-event')
    wrapper.unmount()
  })

  it('requires explicit confirmation after returning to landscape', async () => {
    const wrapper = mount(BattlefieldGame, {
      props: { settings: DEFAULT_GAME_SETTINGS, showOnboarding: false },
    })

    battleHarness.onSnapshot?.({
      lifecycle: 'active',
      pause: { active: true, presentation: 'orientation-confirmation' },
      decision: null,
      hud: null,
      onboardingStep: null,
      onboardingCompleted: true,
      result: null,
    })
    await nextTick()

    expect(wrapper.get('[aria-label="历练暂停"]').text()).toContain('横屏已恢复')
    await wrapper.get('[aria-label="历练暂停"] button').trigger('click')
    expect(battleHarness.session.confirmOrientation).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('pauses compact mode on window blur and resumes only after confirmation', async () => {
    const wrapper = mount(BattlefieldGame, {
      props: { settings: DEFAULT_GAME_SETTINGS, showOnboarding: false, compactMode: true },
    })

    window.dispatchEvent(new Event('blur'))
    expect(battleHarness.session.setWindowFocused).toHaveBeenCalledWith(false)

    battleHarness.onSnapshot?.({
      lifecycle: 'active',
      pause: { active: true, presentation: 'window-focus-confirmation' },
      decision: null,
      hud: null,
      onboardingStep: null,
      onboardingCompleted: true,
      result: null,
    })
    await nextTick()

    expect(wrapper.get('[aria-label="历练暂停"]').text()).toContain('窗口已恢复')
    await wrapper.get('[aria-label="历练暂停"] button').trigger('click')
    expect(battleHarness.session.confirmWindowFocus).toHaveBeenCalledOnce()

    window.dispatchEvent(new Event('focus'))
    expect(battleHarness.session.setWindowFocused).toHaveBeenCalledWith(true)
    wrapper.unmount()
  })

  it('pauses immediately when mounted while the page is already hidden', () => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    const wrapper = mount(BattlefieldGame, {
      props: { settings: DEFAULT_GAME_SETTINGS, showOnboarding: false },
    })

    expect(battleHarness.session.setPageVisible).toHaveBeenCalledWith(false)
    wrapper.unmount()
    hidden.mockRestore()
  })
})
