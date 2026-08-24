import { describe, expect, it } from 'vitest'
import {
  applyArtifactBuildAction,
  createArtifactBuild,
  type ArtifactBuildState,
} from './artifactBuild'
import {
  applyUpgradeChoice,
  createArtifactInventory,
  MAX_ARTIFACT_LEVEL,
} from './artifactInventory'

function apply(
  state: ArtifactBuildState,
  action: Parameters<typeof applyArtifactBuildAction>[1],
): ArtifactBuildState {
  const result = applyArtifactBuildAction(state, action)
  expect(result.accepted).toBe(true)
  return result.state
}

describe('artifactBuild domain module', () => {
  it('keeps the whole build decision chain behind one public seam', () => {
    let build = createArtifactBuild(7_301)
    expect(build.decision?.type).toBe('initial-artifact-selection')

    build = apply(build, {
      type: 'select-initial-artifact',
      artifactId: 'qing-feng-jian-xia',
    })
    build = apply(build, { type: 'grant-levels', count: 1 })

    expect(build.decision?.type).toBe('upgrade')
    if (!build.decision || build.decision.type !== 'upgrade') {
      throw new Error('expected an upgrade decision')
    }
    expect(build.decision.choices.length).toBe(3)
    expect(build.decision.isZhouTian).toBe(false)

    const currentDecision = build.decision
    const selected = currentDecision.choices[0]
    expect(selected).toBeDefined()

    const deduced = applyArtifactBuildAction(build, { type: 'deduce-upgrade' })
    expect(deduced.accepted).toBe(true)
    const deducedDecision = deduced.state.decision
    if (!deducedDecision || deducedDecision.type !== 'upgrade') {
      throw new Error('expected a replacement upgrade decision')
    }
    expect(deducedDecision.choices).toHaveLength(3)
    expect(deducedDecision.choices.some((choice) => choice.choiceId === selected!.choiceId)).toBe(false)

    build = deduced.state
    const nextDecision = build.decision
    if (!nextDecision || nextDecision.type !== 'upgrade') {
      throw new Error('expected a replacement upgrade decision')
    }
    build = apply(build, { type: 'select-upgrade', choiceId: nextDecision.choices[0]!.choiceId })

    expect(build.inventory.slots.length).toBeGreaterThanOrEqual(1)
    expect(build.modifiers.damageMultiplier).toBeGreaterThan(0)
  })

  it('rejects stale, illegal, exhausted, and unavailable actions without changing state', () => {
    const initial = createArtifactBuild(12)

    const stale = applyArtifactBuildAction(initial, {
      type: 'select-upgrade',
      choiceId: 'upgrade-qing-feng-jian-xia',
    })
    expect(stale).toMatchObject({ accepted: false, rejection: 'decision-not-available' })
    expect(stale.state).toBe(initial)

    const illegalInitial = applyArtifactBuildAction(initial, {
      type: 'select-initial-artifact',
      artifactId: 'si-xiang-zhen-qi',
    })
    expect(illegalInitial).toMatchObject({ accepted: false, rejection: 'choice-not-available' })
    expect(illegalInitial.state).toBe(initial)

    let build = apply(initial, {
      type: 'select-initial-artifact',
      artifactId: 'qing-feng-jian-xia',
    })
    const beforeDeduction = build
    build = apply(build, { type: 'grant-levels', count: 1 })
    const firstDeduction = applyArtifactBuildAction(build, { type: 'deduce-upgrade' })
    expect(firstDeduction.accepted).toBe(true)
    const secondDeduction = applyArtifactBuildAction(firstDeduction.state, { type: 'deduce-upgrade' })
    expect(secondDeduction).toMatchObject({ accepted: false, rejection: 'resource-unavailable' })
    expect(secondDeduction.state).toBe(firstDeduction.state)
    expect(beforeDeduction.decision).toBeNull()
  })

  it('returns combat-ready results for flexible and Zhou Tian choices', () => {
    let build = apply(createArtifactBuild(7_301), {
      type: 'select-initial-artifact',
      artifactId: 'qing-feng-jian-xia',
    })

    build = apply(build, { type: 'grant-levels', count: 1 })
    const decision = build.decision
    if (!decision || decision.type !== 'upgrade') {
      throw new Error('expected an upgrade decision')
    }
    const flexible = decision.choices.find((choice) => 'type' in choice && choice.type === 'flex')
    expect(flexible).toBeDefined()
    build = apply(build, { type: 'select-upgrade', choiceId: flexible!.choiceId })
    expect(build.modifiers.damageMultiplier).toBe(1.03)

    let completeInventory = createArtifactInventory('qing-feng-jian-xia')
    for (const artifactId of [
      'qing-feng-jian-xia',
      'lei-zhuan-fu-ce',
      'si-xiang-zhen-qi',
      'fu-yao-yu-yi',
    ] as const) {
      if (completeInventory.slots.every((slot) => slot.id !== artifactId)) {
        completeInventory = applyUpgradeChoice(completeInventory, artifactId)
      }
      for (let level = 1; level < MAX_ARTIFACT_LEVEL; level += 1) {
        completeInventory = applyUpgradeChoice(completeInventory, artifactId)
      }
    }
    const noArtifactProgression = {
      ...build,
      inventory: completeInventory,
      decision: null,
      pendingLevelUps: 0,
    } as const
    let buildAtAscension = apply(noArtifactProgression, { type: 'grant-levels', count: 1 })
    expect(buildAtAscension.decision?.type).toBe('ascension')
    const firstAscension = buildAtAscension.decision
    if (!firstAscension || firstAscension.type !== 'ascension') {
      throw new Error('expected the first ascension decision')
    }
    buildAtAscension = apply(buildAtAscension, {
      type: 'select-ascension',
      choiceId: firstAscension.choices[1]!.choiceId,
    })
    expect(buildAtAscension.decision?.type).toBe('ascension')
    const secondAscension = buildAtAscension.decision
    if (!secondAscension || secondAscension.type !== 'ascension') {
      throw new Error('expected the second ascension decision')
    }
    buildAtAscension = apply(buildAtAscension, {
      type: 'select-ascension',
      choiceId: secondAscension.choices[0]!.choiceId,
    })

    let noProgressionInventory = buildAtAscension.inventory
    for (const artifactId of ['qing-feng-jian-xia', 'lei-zhuan-fu-ce'] as const) {
      noProgressionInventory = applyUpgradeChoice(noProgressionInventory, artifactId)
      for (let level = 1; level < MAX_ARTIFACT_LEVEL; level += 1) {
        noProgressionInventory = applyUpgradeChoice(noProgressionInventory, artifactId)
      }
    }
    const zhouTian = applyArtifactBuildAction({
      ...buildAtAscension,
      inventory: noProgressionInventory,
    }, { type: 'grant-levels', count: 1 })
    expect(zhouTian.accepted).toBe(true)
    expect(zhouTian.state.decision).toMatchObject({ type: 'upgrade', isZhouTian: true })

    const zhouDecision = zhouTian.state.decision
    if (!zhouDecision || zhouDecision.type !== 'upgrade') {
      throw new Error('expected a Zhou Tian decision')
    }
    const yuQi = zhouDecision.choices.find((choice) => choice.choiceId === 'yu-qi')
    expect(yuQi).toBeDefined()
    const applied = applyArtifactBuildAction(zhouTian.state, {
      type: 'select-upgrade',
      choiceId: yuQi!.choiceId,
    })
    expect(applied.accepted).toBe(true)
    expect(applied.state.modifiers.damageMultiplier).toBe(1.09)
  })
})
