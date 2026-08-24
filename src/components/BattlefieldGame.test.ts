// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createArtifactInventory, generateUpgradeChoices } from '../game/domain/artifactInventory'
import type { BrowserFactsAdapter } from '../game/platform/browserFacts'
import { computeBattleViewport } from '../game/platform/viewportPolicy'
import { DEFAULT_GAME_SETTINGS } from '../game/settings/gameSettings'
import type { GameSessionEffect, GameSessionSnapshot } from '../game/session/GameSession'
import BattlefieldGame from './BattlefieldGame.vue'
import BattleTouchControls from './BattleTouchControls.vue'

const battleHarness = vi.hoisted(() => ({
  onSnapshot: undefined as ((snapshot: GameSessionSnapshot) => void) | undefined,
  onEffect: undefined as ((effect: GameSessionEffect) => void) | undefined,
  browserFacts: undefined as BrowserFactsAdapter | undefined,
  session: {
    requestManualPause: vi.fn(),
    releaseManualPause: vi.fn(),
    confirmOrientation: vi.fn(),
    confirmWindowFocus: vi.fn(),
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
    setReducedMotion: vi.fn(),
    dispose: vi.fn(),
  },
}))

vi.mock('../game/phaser/createBattleSession', () => ({
  createBattleSession: (options: {
    onSnapshot: (snapshot: GameSessionSnapshot) => void
    onEffect: (effect: GameSessionEffect) => void
    browserFacts: BrowserFactsAdapter
  }) => {
    battleHarness.onSnapshot = options.onSnapshot
    battleHarness.onEffect = options.onEffect
    battleHarness.browserFacts = options.browserFacts
    return battleHarness.session
  },
}))

const testViewport = computeBattleViewport({ width: 1280, height: 720, desktop: true })

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

  afterEach(() => {
    battleHarness.browserFacts?.dispose()
    battleHarness.browserFacts = undefined
    vi.unstubAllGlobals()
  })

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

  it('lets the browser facts adapter own blur and page visibility while manual pause still clears input', () => {
    const wrapper = mount(BattlefieldGame, {
      props: { settings: DEFAULT_GAME_SETTINGS, showOnboarding: false },
    })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }))
    window.dispatchEvent(new Event('blur'))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'escape' }))

    expect(battleHarness.browserFacts?.getSnapshot().focused).toBe(false)
    expect(battleHarness.session.clearInputIntent).toHaveBeenCalledOnce()
    expect(battleHarness.session.requestManualPause).toHaveBeenCalledOnce()

    wrapper.unmount()
  })

  it('invalidates the active touch adapter when manually pausing', async () => {
    const wrapper = mount(BattlefieldGame, {
      props: { settings: DEFAULT_GAME_SETTINGS, showOnboarding: false },
    })
    const touchControls = wrapper.getComponent(BattleTouchControls)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'escape' }))
    await nextTick()

    const inputResetRevision = touchControls.props('inputResetRevision')
    wrapper.unmount()
    expect(inputResetRevision).toBe(1)
  })

  it('clears the player input module when the session enters an orientation pause', () => {
    const wrapper = mount(BattlefieldGame, {
      props: { settings: DEFAULT_GAME_SETTINGS, showOnboarding: false },
    })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }))
    battleHarness.onSnapshot?.({
      lifecycle: 'active',
      viewport: testViewport,
      pause: { active: true, presentation: 'orientation' },
      decision: null,
      hud: null,
      onboardingStep: null,
      onboardingCompleted: true,
      result: null,
    })

    expect(battleHarness.session.clearInputIntent).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('drops movement and casting pressed while the session is paused', () => {
    const wrapper = mount(BattlefieldGame, {
      props: { settings: DEFAULT_GAME_SETTINGS, showOnboarding: false },
    })

    battleHarness.onSnapshot?.({
      lifecycle: 'active',
      viewport: testViewport,
      pause: { active: true, presentation: 'manual' },
      decision: null,
      hud: null,
      onboardingStep: null,
      onboardingCompleted: true,
      result: null,
    })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))

    expect(battleHarness.session.setInputIntent).not.toHaveBeenCalled()
    expect(battleHarness.session.castSpell).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('keeps a physically held direction through an upgrade decision', async () => {
    const wrapper = mount(BattlefieldGame, {
      props: { settings: DEFAULT_GAME_SETTINGS, showOnboarding: false },
    })
    const choices = generateUpgradeChoices(createArtifactInventory('qing-feng-jian-xia'), 3)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }))
    battleHarness.onSnapshot?.({
      lifecycle: 'active',
      viewport: testViewport,
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

    expect(battleHarness.session.clearInputIntent).not.toHaveBeenCalled()
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
      viewport: testViewport,
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
      viewport: testViewport,
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

  it('renders the compact-mode focus confirmation and resumes only after explicit confirmation', async () => {
    const wrapper = mount(BattlefieldGame, {
      props: { settings: DEFAULT_GAME_SETTINGS, showOnboarding: false, compactMode: true },
    })

    battleHarness.onSnapshot?.({
      lifecycle: 'active',
      viewport: testViewport,
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
    wrapper.unmount()
  })

  it('pauses immediately when mounted while the page is already hidden', () => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    const wrapper = mount(BattlefieldGame, {
      props: { settings: DEFAULT_GAME_SETTINGS, showOnboarding: false },
    })

    expect(battleHarness.browserFacts?.getSnapshot().visible).toBe(false)
    wrapper.unmount()
    hidden.mockRestore()
  })
})
