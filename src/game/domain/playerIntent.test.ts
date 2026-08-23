import { describe, expect, it } from 'vitest'
import { DEFAULT_GAME_SETTINGS } from '../settings/gameSettings'
import { createPlayerIntentModule } from './playerIntent'

describe('玩家意图模块', () => {
  it('将键盘的并发方向与释放转换为归一化移动意图', () => {
    const playerIntent = createPlayerIntentModule({
      getKeyBindings: () => DEFAULT_GAME_SETTINGS.keyBindings,
    })

    const up = playerIntent.dispatch({ type: 'keyboard-key-down', key: 'w', repeat: false })
    const diagonal = playerIntent.dispatch({ type: 'keyboard-key-down', key: 'd', repeat: false })
    const right = playerIntent.dispatch({ type: 'keyboard-key-up', key: 'w' })
    const stopped = playerIntent.dispatch({ type: 'keyboard-key-up', key: 'd' })

    expect(up).toEqual({
      preventDefault: true,
      intents: [{ type: 'movement', intent: { moveX: 0, moveY: -1 } }],
    })
    expect(diagonal.preventDefault).toBe(true)
    expect(diagonal.intents).toHaveLength(1)
    const diagonalIntent = diagonal.intents[0]
    expect(diagonalIntent).toMatchObject({ type: 'movement' })
    if (!diagonalIntent || diagonalIntent.type !== 'movement') {
      throw new Error('应产生移动意图')
    }
    expect(diagonalIntent.intent.moveX).toBeCloseTo(Math.SQRT1_2)
    expect(diagonalIntent.intent.moveY).toBeCloseTo(-Math.SQRT1_2)
    expect(right).toEqual({
      preventDefault: true,
      intents: [{ type: 'movement', intent: { moveX: 1, moveY: 0 } }],
    })
    expect(stopped).toEqual({
      preventDefault: true,
      intents: [{ type: 'movement', intent: { moveX: 0, moveY: 0 } }],
    })
  })

  it('让触控与键盘产生等价的移动和术法意图', () => {
    const keyboard = createPlayerIntentModule({
      getKeyBindings: () => DEFAULT_GAME_SETTINGS.keyBindings,
    })
    const touch = createPlayerIntentModule({
      getKeyBindings: () => DEFAULT_GAME_SETTINGS.keyBindings,
    })

    const keyboardMovement = keyboard.dispatch({ type: 'keyboard-key-down', key: 'w', repeat: false })
    const keyboardCast = keyboard.dispatch({ type: 'keyboard-key-down', key: ' ', repeat: false })
    const touchMovement = touch.dispatch({ type: 'touch-move', moveX: 0, moveY: -1 })
    const touchCast = touch.dispatch({ type: 'touch-cast' })

    expect(touchMovement).toEqual({ preventDefault: false, intents: keyboardMovement.intents })
    expect(keyboardCast).toEqual({ preventDefault: true, intents: [{ type: 'cast-spell' }] })
    expect(touchCast).toEqual({ preventDefault: false, intents: [{ type: 'cast-spell' }] })
  })

  it('在触摸结束和暂停时清除残留的方向', () => {
    const playerIntent = createPlayerIntentModule({
      getKeyBindings: () => DEFAULT_GAME_SETTINGS.keyBindings,
    })
    const touchPause = createPlayerIntentModule({
      getKeyBindings: () => DEFAULT_GAME_SETTINGS.keyBindings,
    })
    const keyboardClear = createPlayerIntentModule({
      getKeyBindings: () => DEFAULT_GAME_SETTINGS.keyBindings,
    })

    playerIntent.dispatch({ type: 'keyboard-key-down', key: 'd', repeat: false })
    const touchEnded = playerIntent.dispatch({ type: 'touch-end' })
    playerIntent.dispatch({ type: 'keyboard-key-down', key: 'w', repeat: false })
    const paused = playerIntent.dispatch({ type: 'keyboard-key-down', key: 'escape', repeat: false })
    const staleRelease = playerIntent.dispatch({ type: 'keyboard-key-up', key: 'w' })
    const toolbarPaused = touchPause.dispatch({ type: 'pause-requested' })
    const pageHidden = keyboardClear.dispatch({ type: 'input-reset' })

    expect(touchEnded).toEqual({ preventDefault: false, intents: [{ type: 'clear-input' }] })
    expect(paused).toEqual({
      preventDefault: true,
      intents: [{ type: 'clear-input' }, { type: 'toggle-pause' }],
    })
    expect(staleRelease).toEqual({ preventDefault: true, intents: [] })
    expect(toolbarPaused.intents).toEqual(paused.intents)
    expect(pageHidden.intents).toEqual(touchEnded.intents)
  })

  it('在失焦与页面隐藏的系统重置后不恢复旧方向', () => {
    const playerIntent = createPlayerIntentModule({
      getKeyBindings: () => DEFAULT_GAME_SETTINGS.keyBindings,
    })

    playerIntent.dispatch({ type: 'keyboard-key-down', key: 'd', repeat: false })
    const windowBlur = playerIntent.dispatch({ type: 'input-reset' })
    playerIntent.dispatch({ type: 'keyboard-key-down', key: 'w', repeat: false })
    const pageHidden = playerIntent.dispatch({ type: 'input-reset' })
    const staleRelease = playerIntent.dispatch({ type: 'keyboard-key-up', key: 'w' })

    expect(windowBlur).toEqual({ preventDefault: false, intents: [{ type: 'clear-input' }] })
    expect(pageHidden).toEqual({ preventDefault: false, intents: [{ type: 'clear-input' }] })
    expect(staleRelease).toEqual({ preventDefault: true, intents: [] })
  })

  it('将界面暂停请求转换为清除后切换暂停', () => {
    const playerIntent = createPlayerIntentModule({
      getKeyBindings: () => DEFAULT_GAME_SETTINGS.keyBindings,
    })

    const paused = playerIntent.dispatch({ type: 'pause-requested' })

    expect(paused).toEqual({
      preventDefault: false,
      intents: [{ type: 'clear-input' }, { type: 'toggle-pause' }],
    })
  })
})
