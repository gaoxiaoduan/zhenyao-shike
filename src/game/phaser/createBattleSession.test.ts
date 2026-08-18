import { describe, expect, it, vi } from 'vitest'
import {
  applyUpgradeChoice,
  ARTIFACT_DEFINITIONS,
  createArtifactInventory,
  type ArtifactInventory,
  type UpgradeDraftChoice,
} from '../domain/artifactInventory'
import { createInputIntent } from '../domain/inputIntent'
import type { BattleViewport } from '../platform/viewportPolicy'
import { createBattleRuntimeAdapter, QingShiRidgeScene } from './createBattleSession'

vi.mock('phaser', () => ({
  Scene: class Scene {},
  Math: { Between: (min: number) => min },
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
    setCompactRadar: vi.fn(),
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
      compact: true,
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
    expect(scene.setCompactRadar).toHaveBeenCalledWith(true)
    expect(scene.setReducedMotion).toHaveBeenCalledWith(true)
    expect(scene.setPaused).toHaveBeenCalledWith(true)
    expect(game.destroy).toHaveBeenCalledWith(true)
  })

  it('publishes an ascension request when the final upgrade creates a recipe', () => {
    const outputs: Array<{ type: string }> = []
    const scene = new QingShiRidgeScene(
      (output) => outputs.push(output),
      1,
      false,
      1280,
      720,
      false,
      7301,
      1,
    )
    let inventory: ArtifactInventory = createArtifactInventory('qing-feng-jian-xia')
    for (let level = 1; level < 4; level += 1) {
      inventory = applyUpgradeChoice(inventory, 'qing-feng-jian-xia')
    }
    inventory = applyUpgradeChoice(inventory, 'si-xiang-zhen-qi')
    for (let level = 1; level < 5; level += 1) {
      inventory = applyUpgradeChoice(inventory, 'si-xiang-zhen-qi')
    }

    const qingFeng = ARTIFACT_DEFINITIONS['qing-feng-jian-xia']
    const choice: UpgradeDraftChoice = {
      type: 'upgrade',
      choiceId: 'upgrade-qing-feng-jian-xia',
      artifactId: 'qing-feng-jian-xia',
      name: qingFeng.name,
      description: qingFeng.description,
      currentLevel: 4,
      targetLevel: 5,
      statsDescription: '伤害提升',
      attackColor: qingFeng.attackColor,
    }
    const state = scene as unknown as {
      inventory: ArtifactInventory
      pendingLevelUps: number
      awaitingUpgradeSelection: boolean
      upgradeChoices: readonly UpgradeDraftChoice[]
      ascensionChoices: readonly unknown[]
    }
    state.inventory = inventory
    state.pendingLevelUps = 1
    state.awaitingUpgradeSelection = true
    state.upgradeChoices = [choice]
    state.ascensionChoices = []

    scene.selectUpgrade(choice.choiceId)

    expect(outputs).toContainEqual(expect.objectContaining({ type: 'ascension-requested' }))
  })

  it('uses one fixed presentation seed for accelerated acceptance runs', () => {
    const first = new QingShiRidgeScene(
      () => undefined,
      1,
      false,
      1280,
      720,
      false,
      11,
      30,
      undefined,
      true,
    ) as unknown as {
      terrainLayout: unknown
      upgradeDraftState: unknown
      lingquanEvent: unknown
    }
    const second = new QingShiRidgeScene(
      () => undefined,
      1,
      false,
      1280,
      720,
      false,
      99_999,
      30,
      undefined,
      true,
    ) as unknown as {
      terrainLayout: unknown
      upgradeDraftState: unknown
      lingquanEvent: unknown
    }

    expect(first.terrainLayout).toEqual(second.terrainLayout)
    expect(first.upgradeDraftState).toEqual(second.upgradeDraftState)
    expect(first.lingquanEvent).toEqual(second.lingquanEvent)
  })
})
