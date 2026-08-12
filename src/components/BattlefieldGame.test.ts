// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createArtifactInventory, generateUpgradeChoices } from '../game/domain/artifactInventory'
import { DEFAULT_GAME_SETTINGS } from '../game/settings/gameSettings'
import type { GameSessionEvent } from '../game/session/GameSession'
import BattlefieldGame from './BattlefieldGame.vue'

const battleHarness = vi.hoisted(() => ({
  onEvent: undefined as ((event: GameSessionEvent) => void) | undefined,
  session: {
    pause: vi.fn(),
    resume: vi.fn(),
    selectInitialArtifact: vi.fn(),
    selectUpgrade: vi.fn(),
    selectAscension: vi.fn(),
    skipAscension: vi.fn(),
    deduceUpgrade: vi.fn(),
    tunaHeal: vi.fn(),
    skipOnboarding: vi.fn(),
    setInputIntent: vi.fn(),
    castSpell: vi.fn(),
    resize: vi.fn(),
    setReducedMotion: vi.fn(),
    dispose: vi.fn(),
  },
}))

vi.mock('../game/phaser/createBattleSession', () => ({
  createBattleSession: (options: { onEvent: (event: GameSessionEvent) => void }) => {
    battleHarness.onEvent = options.onEvent
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
    battleHarness.onEvent?.({ type: 'upgrade-requested', choices, deductionCount: 1, canDeduce: true })
    await nextTick()
    await wrapper.get('[aria-label="法器突破与构筑升级"]').trigger('keydown', { key: '1' })

    expect(battleHarness.session.selectUpgrade).toHaveBeenCalledWith(choices[0]!.choiceId)
    expect(battleHarness.session.resume).toHaveBeenCalledWith('upgrade')
    expect(battleHarness.session.setInputIntent).toHaveBeenLastCalledWith(
      expect.objectContaining({ moveX: 0, moveY: -1 }),
    )
    wrapper.unmount()
  })

  it('explains the first battlefield event once and resumes the tutorial pause', async () => {
    const wrapper = mount(BattlefieldGame, {
      props: { settings: DEFAULT_GAME_SETTINGS, showOnboarding: false },
    })

    battleHarness.onEvent?.({
      type: 'battlefield-event',
      firstEncounter: true,
      event: {
        kind: 'lingquan',
        phase: 'available',
        name: '灵泉涌现',
        objective: '进入青蓝引导区域并维持两秒。',
        remainingMs: 45_000,
        reward: '恢复 35% 最大生命',
      },
    })
    await nextTick()

    expect(wrapper.get('[aria-label="战场事件说明"]').text()).toContain('灵泉涌现')
    await wrapper.get('[aria-label="战场事件说明"] button').trigger('click')
    expect(battleHarness.session.resume).toHaveBeenCalledWith('tutorial')
    wrapper.unmount()
  })
})
