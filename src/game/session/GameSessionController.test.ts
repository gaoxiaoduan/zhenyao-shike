import { describe, expect, it, vi } from 'vitest'
import { createInputIntent } from '../domain/inputIntent'
import { createGameSessionController, type BattleRuntime } from './GameSessionController'

function createRuntime(): BattleRuntime {
  return {
    destroy: vi.fn(),
    selectInitialArtifact: vi.fn(),
    selectUpgrade: vi.fn(),
    selectAscension: vi.fn(),
    skipAscension: vi.fn(),
    deduceUpgrade: vi.fn(),
    tunaHeal: vi.fn(),
    skipOnboarding: vi.fn(),
    setInputIntent: vi.fn(),
    resize: vi.fn(),
    setReducedMotion: vi.fn(),
    setPaused: vi.fn(),
  }
}

describe('历练会话', () => {
  it('叠加暂停原因，直到最后一个原因解除才恢复战场', () => {
    const runtime = createRuntime()
    const session = createGameSessionController(runtime)

    session.pause('manual')
    session.pause('visibility')
    session.resume('visibility')
    session.resume('manual')

    expect(runtime.setPaused).toHaveBeenCalledTimes(2)
    expect(runtime.setPaused).toHaveBeenNthCalledWith(1, true)
    expect(runtime.setPaused).toHaveBeenNthCalledWith(2, false)
  })

  it('销毁运行时并停止后续命令', () => {
    const runtime = createRuntime()
    const session = createGameSessionController(runtime)

    session.dispose()
    session.pause('manual')

    expect(runtime.destroy).toHaveBeenCalledOnce()
    expect(runtime.setPaused).not.toHaveBeenCalled()
  })

  it('将已归一化的跨平台输入转交给战场运行时', () => {
    const runtime = createRuntime()
    const session = createGameSessionController(runtime)
    const intent = createInputIntent({ moveX: 1, castSpell: true })

    session.setInputIntent(intent)

    expect(runtime.setInputIntent).toHaveBeenCalledWith(intent)
  })

  it('将首次法器选择转交给尚未启动的战场', () => {
    const runtime = createRuntime()
    const session = createGameSessionController(runtime)

    session.selectInitialArtifact('qing-feng-jian-xia')

    expect(runtime.selectInitialArtifact).toHaveBeenCalledWith('qing-feng-jian-xia')
  })

  it('跳过教学后让战场恢复普通节奏', () => {
    const runtime = createRuntime()
    const session = createGameSessionController(runtime)

    session.skipOnboarding()

    expect(runtime.skipOnboarding).toHaveBeenCalledOnce()
  })

  it('将升阶选择和暂缓命令转交给战场运行时', () => {
    const runtime = createRuntime()
    const session = createGameSessionController(runtime)

    session.selectAscension('ascend-qing-feng-si-xiang')
    session.skipAscension()

    expect(runtime.selectAscension).toHaveBeenCalledWith('ascend-qing-feng-si-xiang')
    expect(runtime.skipAscension).toHaveBeenCalledOnce()
  })

  it('将推演重抽与吐纳调息转交给战场运行时', () => {
    const runtime = createRuntime()
    const session = createGameSessionController(runtime)

    session.deduceUpgrade()
    session.tunaHeal()

    expect(runtime.deduceUpgrade).toHaveBeenCalledOnce()
    expect(runtime.tunaHeal).toHaveBeenCalledOnce()
  })

  it('将桌面视口变化转交给战场运行时', () => {
    const runtime = createRuntime()
    const session = createGameSessionController(runtime)
    const viewport = {
      aspectRatio: 21 / 9,
      internalWidth: 1680,
      internalHeight: 720,
      requiresOrientation: false,
      requiresLargerWindow: false,
      hasInformationWings: false,
    }

    session.resize(viewport)

    expect(runtime.resize).toHaveBeenCalledWith(viewport)
  })

  it('将运行中的减少动态设置同步到战场表现', () => {
    const runtime = createRuntime()
    const session = createGameSessionController(runtime)

    session.setReducedMotion(true)

    expect(runtime.setReducedMotion).toHaveBeenCalledWith(true)
  })
})
