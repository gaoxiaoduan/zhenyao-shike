import { describe, expect, it, vi } from 'vitest'
import { createInputIntent } from '../domain/inputIntent'
import { createGameSessionController, type BattleRuntime } from './GameSessionController'

function createRuntime(): BattleRuntime {
  return {
    destroy: vi.fn(),
    setInputIntent: vi.fn(),
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
})
