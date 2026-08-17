import { describe, expect, it, vi } from 'vitest'
import { createInputIntent } from '../domain/inputIntent'
import type { BattleViewport } from '../platform/viewportPolicy'
import { createBattleRuntimeAdapter } from './createBattleSession'

vi.mock('phaser', () => ({
  Scene: class Scene {},
}))

function createScene() {
  return {
    selectInitialArtifact: vi.fn(),
    selectUpgrade: vi.fn(),
    selectAscension: vi.fn(),
    skipAscension: vi.fn(),
    deduceUpgrade: vi.fn(),
    tunaHeal: vi.fn(),
    skipOnboarding: vi.fn(),
    setInputIntent: vi.fn(),
    castSpell: vi.fn(),
    resizeViewport: vi.fn(),
    setReducedMotion: vi.fn(),
    setPaused: vi.fn(),
  }
}

describe('Phaser battle runtime adapter', () => {
  it('maps every session runtime command without exposing the scene', () => {
    const scene = createScene()
    const game = {
      scale: { setGameSize: vi.fn() },
      destroy: vi.fn(),
    }
    const runtime = createBattleRuntimeAdapter(scene, game, 2)
    const viewport: BattleViewport = {
      aspectRatio: 16 / 9,
      internalWidth: 1280,
      internalHeight: 720,
      requiresOrientation: false,
      requiresLargerWindow: false,
      hasInformationWings: false,
    }

    runtime.selectInitialArtifact('qing-feng-jian-xia')
    runtime.selectUpgrade('upgrade-choice')
    runtime.selectAscension('ascension-choice')
    runtime.skipAscension()
    runtime.deduceUpgrade()
    runtime.tunaHeal()
    runtime.skipOnboarding()
    runtime.setInputIntent(createInputIntent({ moveX: 1 }))
    runtime.castSpell()
    runtime.resize(viewport)
    runtime.setReducedMotion(true)
    runtime.setPaused(true)
    runtime.destroy()

    expect(scene.selectInitialArtifact).toHaveBeenCalledWith('qing-feng-jian-xia')
    expect(scene.selectUpgrade).toHaveBeenCalledWith('upgrade-choice')
    expect(scene.selectAscension).toHaveBeenCalledWith('ascension-choice')
    expect(scene.skipAscension).toHaveBeenCalledOnce()
    expect(scene.deduceUpgrade).toHaveBeenCalledOnce()
    expect(scene.tunaHeal).toHaveBeenCalledOnce()
    expect(scene.skipOnboarding).toHaveBeenCalledOnce()
    expect(scene.setInputIntent).toHaveBeenCalledWith(createInputIntent({ moveX: 1 }))
    expect(scene.castSpell).toHaveBeenCalledOnce()
    expect(game.scale.setGameSize).toHaveBeenCalledWith(2560, 1440)
    expect(scene.resizeViewport).toHaveBeenCalledWith(1280, 720)
    expect(scene.setReducedMotion).toHaveBeenCalledWith(true)
    expect(scene.setPaused).toHaveBeenCalledWith(true)
    expect(game.destroy).toHaveBeenCalledWith(true)
  })
})
