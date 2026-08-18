import { describe, expect, it, vi } from 'vitest'
import { createInputIntent } from '../domain/inputIntent'
import { createInitialArtifactSelection } from '../domain/initialArtifactSelection'
import type { UpgradeDraftChoice } from '../domain/artifactInventory'
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

    expect(snapshots.at(-1)?.pause).toEqual({ active: true, presentation: 'orientation-confirmation' })
    session.confirmOrientation()
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

    const snapshotsBeforeSelection = snapshots.length
    session.selectInitialArtifact(decision.id, candidates[0]!.id)
    session.selectInitialArtifact(decision.id, candidates[0]!.id)

    expect(runtime.selectInitialArtifact).toHaveBeenCalledTimes(1)
    expect(runtime.selectInitialArtifact).toHaveBeenCalledWith(candidates[0]!.id)
    expect(snapshots).toHaveLength(snapshotsBeforeSelection + 1)
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
    expect(Object.isFrozen(ascension.choices[0]!.sourceIds)).toBe(true)
    expect(Object.isFrozen(ascension.choices[0]!.sourceNames)).toBe(true)
    created.session.selectAscension(ascension.id, 'ascend-qing-feng-si-xiang')

    expect(runtime.setPaused).toHaveBeenCalledTimes(2)
    expect(runtime.setPaused).toHaveBeenNthCalledWith(1, true)
    expect(runtime.setPaused).toHaveBeenNthCalledWith(2, false)
    expect(runtime.setInputIntent).toHaveBeenLastCalledWith(intent)
  })

  it('让连续升阶逐项完成，并在最后一项结束后恢复移动', () => {
    const runtime = createRuntime()
    let reportRuntimeOutput: (output: BattleRuntimeOutput) => void = () => undefined
    vi.mocked(runtime.selectAscension).mockImplementationOnce(() => {
      reportRuntimeOutput({
        type: 'ascension-requested',
        choices: [{
          choiceId: 'ascend-liu-guang-jiu-xiao',
          resultId: 'jiu-xiao-lei-zhen',
          name: '九霄雷阵',
          description: '雷阵',
          sourceIds: ['lei-zhuan-fu-ce', 'si-xiang-zhen-qi'],
          sourceNames: ['雷篆符册', '四象阵旗'],
          slotCountBefore: 2,
          slotCountAfter: 1,
          attackColor: 0x93c5fd,
        }],
      })
    })
    const created = createSession(runtime)
    reportRuntimeOutput = created.reportRuntimeOutput
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
    const firstDecision = created.snapshots.at(-1)?.decision
    if (!firstDecision || firstDecision.type !== 'ascension') {
      throw new Error('expected first ascension decision')
    }
    created.session.selectAscension(firstDecision.id, firstDecision.choices[0]!.choiceId)

    const secondDecision = created.snapshots.at(-1)?.decision
    expect(secondDecision?.type).toBe('ascension')
    expect(runtime.setPaused).toHaveBeenCalledOnce()
    if (!secondDecision || secondDecision.type !== 'ascension') {
      throw new Error('expected second ascension decision')
    }
    created.session.selectAscension(secondDecision.id, secondDecision.choices[0]!.choiceId)

    expect(runtime.selectAscension).toHaveBeenCalledTimes(2)
    expect(runtime.setPaused).toHaveBeenNthCalledWith(2, false)
  })

  it('让多个待处理升级机会按顺序完成，且只在最后一项恢复 runtime', () => {
    const runtime = createRuntime()
    let reportRuntimeOutput: (output: BattleRuntimeOutput) => void = () => undefined
    let remainingUpgrade = 1
    vi.mocked(runtime.selectUpgrade).mockImplementation(() => {
      if (remainingUpgrade > 0) {
        remainingUpgrade -= 1
        reportRuntimeOutput({
          ...upgradeOutput,
          choices: [{
            ...(upgradeOutput.choices[0]! as UpgradeDraftChoice),
            choiceId: 'upgrade-next',
          } as UpgradeDraftChoice],
        })
      }
    })
    const created = createSession(runtime)
    reportRuntimeOutput = created.reportRuntimeOutput
    reportRuntimeOutput(upgradeOutput)

    const firstDecision = created.snapshots.at(-1)?.decision
    if (!firstDecision || firstDecision.type !== 'upgrade') {
      throw new Error('expected first upgrade decision')
    }
    created.session.selectUpgrade(firstDecision.id, firstDecision.choices[0]!.choiceId)

    const secondDecision = created.snapshots.at(-1)?.decision
    expect(secondDecision?.type).toBe('upgrade')
    expect(runtime.setPaused).toHaveBeenCalledOnce()
    if (!secondDecision || secondDecision.type !== 'upgrade') {
      throw new Error('expected second upgrade decision')
    }
    created.session.selectUpgrade(secondDecision.id, secondDecision.choices[0]!.choiceId)

    expect(runtime.selectUpgrade).toHaveBeenCalledTimes(2)
    expect(runtime.setPaused).toHaveBeenNthCalledWith(2, false)
  })

  it('让暂缓升阶和周天运转选择继续穿过同一个决策 seam', () => {
    const runtime = createRuntime()
    let reportRuntimeOutput: (output: BattleRuntimeOutput) => void = () => undefined
    vi.mocked(runtime.skipAscension).mockImplementation(() => {
      reportRuntimeOutput({ ...upgradeOutput, choices: [{
        ...(upgradeOutput.choices[0]! as UpgradeDraftChoice),
        choiceId: 'upgrade-after-skip',
      } as UpgradeDraftChoice] })
    })
    const created = createSession(runtime)
    reportRuntimeOutput = created.reportRuntimeOutput
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

    const ascension = created.snapshots.at(-1)?.decision
    if (!ascension || ascension.type !== 'ascension') {
      throw new Error('expected ascension decision')
    }
    created.session.skipAscension(ascension.id)
    expect(created.snapshots.at(-1)?.decision?.type).toBe('upgrade')
    expect(runtime.setPaused).toHaveBeenCalledOnce()

    reportRuntimeOutput({
      type: 'upgrade-requested',
      choices: [{
        choiceId: 'yu-qi',
        name: '周天运转 · 御器',
        description: '全品阶法器基础伤害提升 6%。',
        statsDescription: '伤害 +6%',
        count: 0,
        maxCount: 3,
      }],
      deductionCount: 0,
      canDeduce: false,
      isZhouTian: true,
    })
    const zhouTian = created.snapshots.at(-1)?.decision
    if (!zhouTian || zhouTian.type !== 'upgrade') {
      throw new Error('expected Zhou Tian decision')
    }
    created.session.selectUpgrade(zhouTian.id, 'yu-qi')
    expect(runtime.selectUpgrade).toHaveBeenCalledWith('yu-qi')
    expect(runtime.setPaused).toHaveBeenNthCalledWith(2, false)
  })

  it('在当前升级决策内处理推演，吐纳和周天运转只应用一次', () => {
    const runtime = createRuntime()
    let reportRuntimeOutput: (output: BattleRuntimeOutput) => void = () => undefined
    vi.mocked(runtime.deduceUpgrade).mockImplementation(() => {
      reportRuntimeOutput({
        ...upgradeOutput,
        choices: [{
          ...(upgradeOutput.choices[0]! as UpgradeDraftChoice),
          choiceId: 'upgrade-after-deduction',
        } as UpgradeDraftChoice],
        deductionCount: 0,
        canDeduce: false,
      })
    })
    const created = createSession(runtime)
    reportRuntimeOutput = created.reportRuntimeOutput
    reportRuntimeOutput(upgradeOutput)
    const upgrade = created.snapshots.at(-1)?.decision
    if (!upgrade || upgrade.type !== 'upgrade') {
      throw new Error('expected upgrade decision')
    }

    created.session.deduceUpgrade(upgrade.id)
    const afterDeduction = created.snapshots.at(-1)?.decision
    expect(afterDeduction?.type).toBe('upgrade')
    expect(runtime.deduceUpgrade).toHaveBeenCalledOnce()

    if (!afterDeduction || afterDeduction.type !== 'upgrade') {
      throw new Error('expected upgrade after deduction')
    }
    created.session.tunaHeal(afterDeduction.id)
    created.session.tunaHeal(afterDeduction.id)
    expect(runtime.tunaHeal).toHaveBeenCalledOnce()

    reportRuntimeOutput({ ...upgradeOutput, isZhouTian: true, canDeduce: false })
    const zhouTian = created.snapshots.at(-1)?.decision
    if (!zhouTian || zhouTian.type !== 'upgrade') {
      throw new Error('expected Zhou Tian decision')
    }
    created.session.deduceUpgrade(zhouTian.id)
    expect(runtime.deduceUpgrade).toHaveBeenCalledOnce()
  })

  it('吐纳后继续处理剩余升级机会，并在整条链结束前保持暂停', () => {
    const runtime = createRuntime()
    let reportRuntimeOutput: (output: BattleRuntimeOutput) => void = () => undefined
    vi.mocked(runtime.tunaHeal).mockImplementation(() => {
      reportRuntimeOutput({
        ...upgradeOutput,
        choices: [{
          ...(upgradeOutput.choices[0]! as UpgradeDraftChoice),
          choiceId: 'upgrade-after-tuna',
        } as UpgradeDraftChoice],
      })
    })
    const created = createSession(runtime)
    reportRuntimeOutput = created.reportRuntimeOutput
    reportRuntimeOutput(upgradeOutput)
    const firstDecision = created.snapshots.at(-1)?.decision
    if (!firstDecision || firstDecision.type !== 'upgrade') {
      throw new Error('expected first upgrade decision')
    }

    created.session.tunaHeal(firstDecision.id)

    const nextDecision = created.snapshots.at(-1)?.decision
    expect(nextDecision?.type).toBe('upgrade')
    expect(runtime.tunaHeal).toHaveBeenCalledOnce()
    expect(runtime.setPaused).toHaveBeenCalledOnce()
    expect(runtime.setPaused).toHaveBeenCalledWith(true)
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

  it('同类战场事件的后续请求不会再次建立说明决策', () => {
    const { session, reportRuntimeOutput, snapshots } = createSession()
    const event = {
      kind: 'demon-lair' as const,
      phase: 'travel' as const,
      name: '妖巢暴动',
      objective: '前往妖巢。',
      remainingMs: 45_000,
      reward: '灵蕴',
    }
    reportRuntimeOutput({ type: 'battlefield-event-requested', event, firstEncounter: true })
    const decision = snapshots.at(-1)?.decision
    if (!decision || decision.type !== 'battlefield-event') {
      throw new Error('expected battlefield event decision')
    }
    session.confirmBattlefieldEvent(decision.id)
    const snapshotAfterConfirmation = snapshots.at(-1)
    reportRuntimeOutput({ type: 'battlefield-event-requested', event, firstEncounter: false })

    expect(snapshots.at(-1)).toBe(snapshotAfterConfirmation)
    expect(snapshots.at(-1)?.decision).toBeNull()
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
    session.confirmOrientation()

    expect(runtime.setPaused).toHaveBeenNthCalledWith(1, true)
    expect(runtime.setPaused).toHaveBeenNthCalledWith(2, false)
    expect(snapshots.at(-1)?.pause.active).toBe(false)
  })

  it('在方向暂停切换为窗口尺寸暂停时不短暂恢复 runtime', () => {
    const { session, snapshots, runtime } = createSession()

    session.resize({
      aspectRatio: 1,
      internalWidth: 540,
      internalHeight: 960,
      requiresOrientation: true,
      requiresLargerWindow: false,
      hasInformationWings: false,
    })
    session.resize({
      aspectRatio: 2,
      internalWidth: 960,
      internalHeight: 540,
      requiresOrientation: false,
      requiresLargerWindow: true,
      hasInformationWings: false,
    })

    expect(runtime.setPaused).toHaveBeenCalledOnce()
    expect(runtime.setPaused).toHaveBeenCalledWith(true)
    expect(snapshots.at(-1)?.pause.presentation).toBe('viewport')
    session.setPlatformPause('viewport', false)
    expect(snapshots.at(-1)?.pause.presentation).toBe('orientation-confirmation')
    session.confirmOrientation()
    expect(runtime.setPaused).toHaveBeenNthCalledWith(2, false)
  })

  it('结束后拒绝迟到的 runtime output，不覆盖 ended snapshot', () => {
    const { reportRuntimeOutput, snapshots, effects } = createSession()
    const summary = {
      result: 'defeat' as const,
      elapsedMs: 1_000,
      defeatedEnemies: 0,
      defeatedElites: 0,
      bossElapsedMs: null,
      completedEvents: [],
      artifacts: [],
      spiritStones: 0,
      demonCores: 0,
      demonLairDestroyed: false,
      finalDamageSource: 'unknown' as const,
      hint: '此行未竟；调整法器构筑，再从妖潮中寻找破局节奏。',
    }

    reportRuntimeOutput({ type: 'run-ended', summary })
    const endedSnapshot = snapshots.at(-1)
    const effectsBeforeLateOutput = effects.length
    reportRuntimeOutput(upgradeOutput)
    reportRuntimeOutput({
      type: 'effect',
      effect: { type: 'audio', intent: { type: 'effect', cue: 'event-alert' } },
    })

    expect(snapshots.at(-1)).toBe(endedSnapshot)
    expect(effects).toHaveLength(effectsBeforeLateOutput)
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
