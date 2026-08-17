import { describe, expect, it, vi } from 'vitest'
import { createInputIntent } from '../domain/inputIntent'
import { createInitialArtifactSelection } from '../domain/initialArtifactSelection'
import type { AudioIntent } from '../audio/audioDirector'
import type { BattleRuntimeOutput, GameSessionEffect, GameSessionSnapshot } from './GameSession'
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
    castSpell: vi.fn(),
    resize: vi.fn(),
    setReducedMotion: vi.fn(),
    setPaused: vi.fn(),
  }
}

function createSession(runtime = createRuntime()) {
  const snapshots: GameSessionSnapshot[] = []
  const effects: GameSessionEffect[] = []
  const controller = createGameSessionController(runtime, {
    onSnapshot: (snapshot) => snapshots.push(snapshot),
    onEffect: (effect) => effects.push(effect),
  })
  return { ...controller, snapshots, effects, runtime }
}

const upgradeOutput: BattleRuntimeOutput = {
  type: 'upgrade-requested',
  choices: [
    {
      type: 'acquire',
      choiceId: 'upgrade-qing-feng-jian-xia',
      artifactId: 'qing-feng-jian-xia',
      name: '青锋剑匣',
      description: '向附近敌人发射飞剑。',
      currentLevel: 0,
      targetLevel: 1,
      statsDescription: '伤害提升',
      attackColor: 0xe9d5ff,
    },
  ],
  deductionCount: 1,
  canDeduce: true,
  isZhouTian: false,
}

describe('一局会话 external seam', () => {
  it('只在所有平台暂停事实解除后恢复，并在手动暂停时清空移动意图', () => {
    const { session, snapshots, runtime } = createSession()
    const intent = createInputIntent({ moveX: 1 })

    session.setInputIntent(intent)
    session.requestManualPause()
    session.setPlatformPause('orientation', true)
    session.releaseManualPause()

    expect(snapshots.at(-1)?.pause).toEqual({ active: true, presentation: 'orientation' })
    session.setPlatformPause('orientation', false)

    expect(runtime.setPaused).toHaveBeenNthCalledWith(1, true)
    expect(runtime.setPaused).toHaveBeenNthCalledWith(2, false)
    expect(runtime.setInputIntent).toHaveBeenLastCalledWith(createInputIntent())
    expect(snapshots.at(-1)?.pause).toEqual({ active: false, presentation: null })
  })

  it('把初始法器选择发布为带 id 的决策，并只接受当前决策一次', () => {
    const { session, reportRuntimeOutput, snapshots, runtime } = createSession()
    const candidates = createInitialArtifactSelection().candidates
    reportRuntimeOutput({ type: 'initial-artifact-selection-requested', candidates })
    const decision = snapshots.at(-1)?.decision

    expect(decision?.type).toBe('initial-artifact-selection')
    expect(Object.isFrozen(snapshots.at(-1))).toBe(true)
    expect(Object.isFrozen(decision)).toBe(true)
    if (!decision || decision.type !== 'initial-artifact-selection') {
      throw new Error('expected initial artifact decision')
    }

    session.selectInitialArtifact(decision.id, candidates[0]!.id)
    session.selectInitialArtifact(decision.id, candidates[0]!.id)

    expect(runtime.selectInitialArtifact).toHaveBeenCalledTimes(1)
    expect(runtime.selectInitialArtifact).toHaveBeenCalledWith(candidates[0]!.id)
    expect(snapshots.at(-1)?.decision).toBeNull()
  })

  it('让升级到后续决策保持连续暂停，并在链尾只恢复一次移动意图', () => {
    const runtime = createRuntime()
    let reportRuntimeOutput: (output: BattleRuntimeOutput) => void = () => undefined
    vi.mocked(runtime.selectUpgrade).mockImplementation(() => {
      reportRuntimeOutput({
        type: 'ascension-requested',
        choices: [{
          choiceId: 'ascend-qing-feng-si-xiang',
          resultId: 'zhu-xie-jian-zhen',
          name: '诛邪剑阵',
          description: '剑雨',
          sourceIds: ['qing-feng-jian-xia', 'si-xiang-zhen-qi'],
          sourceNames: ['青锋剑匣', '四象阵旗'],
          slotCountBefore: 2,
          slotCountAfter: 1,
          attackColor: 0xf0abfc,
        }],
      })
    })
    const created = createSession(runtime)
    reportRuntimeOutput = created.reportRuntimeOutput
    const intent = createInputIntent({ moveY: -1 })
    created.session.setInputIntent(intent)
    reportRuntimeOutput(upgradeOutput)
    const upgrade = created.snapshots.at(-1)?.decision

    expect(upgrade?.type).toBe('upgrade')
    if (!upgrade || upgrade.type !== 'upgrade') {
      throw new Error('expected upgrade decision')
    }
    created.session.selectUpgrade(upgrade.id, 'upgrade-qing-feng-jian-xia')
    const ascension = created.snapshots.at(-1)?.decision
    expect(ascension?.type).toBe('ascension')

    if (!ascension || ascension.type !== 'ascension') {
      throw new Error('expected ascension decision')
    }
    created.session.selectAscension(ascension.id, 'ascend-qing-feng-si-xiang')

    expect(runtime.setPaused).toHaveBeenCalledTimes(2)
    expect(runtime.setPaused).toHaveBeenNthCalledWith(1, true)
    expect(runtime.setPaused).toHaveBeenNthCalledWith(2, false)
    expect(runtime.setInputIntent).toHaveBeenLastCalledWith(intent)
  })

  it('拒绝过期、错配和重复命令，不污染当前 snapshot 或 runtime', () => {
    const { session, reportRuntimeOutput, snapshots, runtime } = createSession()
    reportRuntimeOutput(upgradeOutput)
    const before = snapshots.at(-1)

    session.selectUpgrade('decision-old', 'upgrade-qing-feng-jian-xia')
    session.selectUpgrade(before?.decision?.id ?? '', 'missing-choice')

    expect(snapshots.at(-1)).toBe(before)
    expect(runtime.selectUpgrade).not.toHaveBeenCalled()
  })

  it('让首次事件说明与页面隐藏叠加，关闭说明不会越过页面暂停', () => {
    const { session, reportRuntimeOutput, snapshots } = createSession()
    reportRuntimeOutput({
      type: 'battlefield-event-requested',
      firstEncounter: true,
      event: {
        kind: 'lingquan',
        phase: 'available',
        name: '灵泉涌现',
        objective: '前往灵泉并完成引导。',
        remainingMs: 45_000,
        reward: '恢复生命',
      },
    })
    const decision = snapshots.at(-1)?.decision
    if (!decision || decision.type !== 'battlefield-event') {
      throw new Error('expected battlefield event decision')
    }

    session.setPageVisible(false)
    session.confirmBattlefieldEvent(decision.id)
    expect(snapshots.at(-1)?.pause).toEqual({ active: true, presentation: 'visibility' })
    session.setPageVisible(true)
    expect(snapshots.at(-1)?.pause.active).toBe(false)
  })

  it('把尺寸和输入挂起事实纳入同一暂停所有权，并按解除顺序恢复', () => {
    const { session, snapshots, runtime } = createSession()
    const tooSmallPortrait = {
      aspectRatio: 1,
      internalWidth: 540,
      internalHeight: 960,
      requiresOrientation: true,
      requiresLargerWindow: true,
      hasInformationWings: false,
    }

    session.resize(tooSmallPortrait)
    session.setInputSuspended(true)
    session.resize({ ...tooSmallPortrait, requiresOrientation: false, requiresLargerWindow: false })
    expect(snapshots.at(-1)?.pause.presentation).toBe('input')
    session.setInputSuspended(false)

    expect(runtime.setPaused).toHaveBeenNthCalledWith(1, true)
    expect(runtime.setPaused).toHaveBeenNthCalledWith(2, false)
    expect(snapshots.at(-1)?.pause.active).toBe(false)
  })

  it('把运行时 effect 转成类型化 effect，并使 dispose 幂等且终止后续命令', () => {
    const { session, reportRuntimeOutput, effects, runtime } = createSession()
    const intent: AudioIntent = { type: 'effect', cue: 'event-alert' }
    reportRuntimeOutput({ type: 'effect', effect: { type: 'audio', intent } })
    session.dispose()
    session.dispose()
    session.requestManualPause()
    session.castSpell()

    expect(effects).toContainEqual({ type: 'audio', intent })
    expect(runtime.destroy).toHaveBeenCalledOnce()
    expect(runtime.castSpell).not.toHaveBeenCalled()
  })
})
