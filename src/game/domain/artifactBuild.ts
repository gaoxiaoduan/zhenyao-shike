import {
  applyAscensionChoice,
  applyFlexibleUpgradeChoice,
  applyUpgradeChoice,
  createArtifactInventory,
  createUpgradeDraftState,
  draftUpgradeChoices,
  getAvailableAscensionChoices,
  type ArtifactInventory,
  type AscendedArtifactId,
  type AscensionRecipe,
  type FlexibleUpgradeChoice,
  type UpgradeChoice,
  type UpgradeDraftChoice,
  type UpgradeDraftState,
} from './artifactInventory'
import {
  applyZhouTianChoice,
  canPerformDeduction,
  calculateTunaHeal,
  createDeductionState,
  createZhouTianState,
  generateZhouTianChoices,
  performDeduction,
  type DeductionState,
  type ZhouTianOption,
  type ZhouTianState,
} from './deductionAndZhouTian'
import {
  createInitialArtifactSelection,
  selectInitialArtifact,
  type BaseArtifact,
  type BaseArtifactId,
} from './initialArtifactSelection'

export type ArtifactBuildChoice = UpgradeDraftChoice | ZhouTianOption

export type ArtifactBuildDecision =
  | {
      readonly type: 'initial-artifact-selection'
      readonly candidates: readonly BaseArtifact[]
    }
  | {
      readonly type: 'upgrade'
      readonly choices: readonly ArtifactBuildChoice[]
      readonly deductionCount: number
      readonly canDeduce: boolean
      readonly isZhouTian: boolean
    }
  | {
      readonly type: 'ascension'
      readonly choices: readonly AscensionRecipe[]
    }
  | null

export interface ArtifactBuildModifiers {
  readonly damageMultiplier: number
  readonly attackIntervalMultiplier: number
  readonly maxHealthMultiplier: number
}

export interface ArtifactBuildState {
  readonly inventory: ArtifactInventory
  readonly draftState: UpgradeDraftState
  readonly deductionState: DeductionState
  readonly zhouTianState: ZhouTianState
  readonly modifiers: ArtifactBuildModifiers
  readonly pendingLevelUps: number
  readonly decision: ArtifactBuildDecision
}

export type ArtifactBuildAction =
  | { readonly type: 'select-initial-artifact'; readonly artifactId: BaseArtifactId }
  | { readonly type: 'grant-levels'; readonly count: number }
  | { readonly type: 'grant-deduction'; readonly count: number }
  | { readonly type: 'select-upgrade'; readonly choiceId: string }
  | { readonly type: 'deduce-upgrade' }
  | { readonly type: 'select-ascension'; readonly choiceId: string }
  | { readonly type: 'skip-ascension' }
  | { readonly type: 'tuna-heal'; readonly maxHealth: number }

export type ArtifactBuildRejection =
  | 'decision-not-available'
  | 'choice-not-available'
  | 'resource-unavailable'

export type ArtifactBuildEffect =
  | { readonly type: 'initial-artifact-selected'; readonly artifactId: BaseArtifactId }
  | { readonly type: 'artifact-ascended'; readonly artifactId: AscendedArtifactId }
  | { readonly type: 'health-restored'; readonly amount: number }

export interface ArtifactBuildTransition {
  readonly accepted: boolean
  readonly state: ArtifactBuildState
  readonly rejection?: ArtifactBuildRejection
  readonly effect?: ArtifactBuildEffect
}

export function createArtifactBuild(seed: number): ArtifactBuildState {
  const initialSelection = createInitialArtifactSelection()
  return {
    inventory: createArtifactInventory(),
    draftState: createUpgradeDraftState(seed),
    deductionState: createDeductionState(1),
    zhouTianState: createZhouTianState(),
    modifiers: {
      damageMultiplier: 1,
      attackIntervalMultiplier: 1,
      maxHealthMultiplier: 1,
    },
    pendingLevelUps: 0,
    decision: {
      type: 'initial-artifact-selection',
      candidates: initialSelection.candidates,
    },
  }
}

export function getArtifactBuildCombatResult(state: ArtifactBuildState): {
  readonly inventory: ArtifactInventory
  readonly modifiers: ArtifactBuildModifiers
} {
  return {
    inventory: state.inventory,
    modifiers: state.modifiers,
  }
}

export function applyArtifactBuildAction(
  state: ArtifactBuildState,
  action: ArtifactBuildAction,
): ArtifactBuildTransition {
  switch (action.type) {
    case 'select-initial-artifact':
      return selectInitialArtifactAction(state, action.artifactId)
    case 'grant-levels':
      return grantLevelsAction(state, action.count)
    case 'grant-deduction':
      return grantDeductionAction(state, action.count)
    case 'select-upgrade':
      return selectUpgradeAction(state, action.choiceId)
    case 'deduce-upgrade':
      return deduceUpgradeAction(state)
    case 'select-ascension':
      return selectAscensionAction(state, action.choiceId)
    case 'skip-ascension':
      return skipAscensionAction(state)
    case 'tuna-heal':
      return tunaHealAction(state, action.maxHealth)
  }
}

function selectInitialArtifactAction(
  state: ArtifactBuildState,
  artifactId: BaseArtifactId,
): ArtifactBuildTransition {
  if (state.decision?.type !== 'initial-artifact-selection') {
    return reject(state, 'decision-not-available')
  }

  try {
    const selection = selectInitialArtifact(
      { candidates: state.decision.candidates },
      artifactId,
    )
    return accept({
      ...state,
      inventory: createArtifactInventory(selection.selected.id),
      decision: null,
    }, {
      type: 'initial-artifact-selected',
      artifactId: selection.selected.id,
    })
  } catch {
    return reject(state, 'choice-not-available')
  }
}

function grantLevelsAction(state: ArtifactBuildState, count: number): ArtifactBuildTransition {
  if (state.decision !== null || state.inventory.slots.length === 0) {
    return reject(state, 'decision-not-available')
  }
  if (!Number.isInteger(count) || count <= 0) {
    return reject(state, 'resource-unavailable')
  }

  const nextState = advanceDecision({
    ...state,
    pendingLevelUps: state.pendingLevelUps + count,
  })
  return accept(nextState)
}

function grantDeductionAction(state: ArtifactBuildState, count: number): ArtifactBuildTransition {
  if (!Number.isInteger(count) || count <= 0) {
    return reject(state, 'resource-unavailable')
  }
  return accept({
    ...state,
    deductionState: {
      remainingCount: state.deductionState.remainingCount + count,
    },
  })
}

function selectUpgradeAction(state: ArtifactBuildState, choiceId: string): ArtifactBuildTransition {
  if (state.decision?.type !== 'upgrade') {
    return reject(state, 'decision-not-available')
  }

  const choice = state.decision.choices.find((candidate) => candidate.choiceId === choiceId)
  if (!choice) {
    return reject(state, 'choice-not-available')
  }

  if (state.decision.isZhouTian) {
    return applyZhouTianSelection(state, choice)
  }

  if (isFlexibleChoice(choice)) {
    return applyFlexibleSelection(state, choice)
  }
  if (!isUpgradeChoice(choice)) {
    return reject(state, 'choice-not-available')
  }

  try {
    return accept(completeUpgradeSelection({
      ...state,
      inventory: applyUpgradeChoice(state.inventory, choice.artifactId),
    }))
  } catch {
    return reject(state, 'resource-unavailable')
  }
}

function applyFlexibleSelection(
  state: ArtifactBuildState,
  choice: FlexibleUpgradeChoice,
): ArtifactBuildTransition {
  try {
    const result = applyFlexibleUpgradeChoice(state.draftState, choice.choiceId)
    return accept(completeUpgradeSelection({
      ...state,
      draftState: result.nextState,
      modifiers: {
        damageMultiplier: state.modifiers.damageMultiplier + result.damageMultiplierDelta,
        attackIntervalMultiplier: Math.max(
          0.5,
          state.modifiers.attackIntervalMultiplier + result.attackIntervalMultiplierDelta,
        ),
        maxHealthMultiplier: state.modifiers.maxHealthMultiplier + result.maxHealthMultiplierDelta,
      },
    }))
  } catch {
    return reject(state, 'resource-unavailable')
  }
}

function applyZhouTianSelection(
  state: ArtifactBuildState,
  choice: ArtifactBuildChoice,
): ArtifactBuildTransition {
  if (!isZhouTianChoice(choice)) {
    return reject(state, 'choice-not-available')
  }

  try {
    const result = applyZhouTianChoice(state.zhouTianState, choice.choiceId)
    return accept(completeUpgradeSelection({
      ...state,
      zhouTianState: result.nextState,
      modifiers: {
        damageMultiplier: state.modifiers.damageMultiplier + result.damageMultiplierDelta,
        attackIntervalMultiplier: Math.max(
          0.5,
          state.modifiers.attackIntervalMultiplier + result.attackIntervalMultiplierDelta,
        ),
        maxHealthMultiplier: state.modifiers.maxHealthMultiplier + result.maxHealthMultiplierDelta,
      },
    }))
  } catch {
    return reject(state, 'resource-unavailable')
  }
}

function completeUpgradeSelection(state: ArtifactBuildState): ArtifactBuildState {
  const nextState = {
    ...state,
    pendingLevelUps: Math.max(0, state.pendingLevelUps - 1),
    decision: null,
  }
  if (nextState.pendingLevelUps > 0) {
    return advanceDecision(nextState)
  }

  const ascensionChoices = getAvailableAscensionChoices(nextState.inventory)
  return ascensionChoices.length > 0
    ? { ...nextState, decision: createAscensionDecision(ascensionChoices) }
    : nextState
}

function deduceUpgradeAction(state: ArtifactBuildState): ArtifactBuildTransition {
  if (state.decision?.type !== 'upgrade' || state.decision.isZhouTian) {
    return reject(state, 'decision-not-available')
  }
  if (!state.decision.canDeduce) {
    return reject(state, 'resource-unavailable')
  }

  try {
    const choices = state.decision.choices.filter(isUpgradeDraftChoice)
    if (choices.length !== state.decision.choices.length) {
      return reject(state, 'choice-not-available')
    }
    const result = performDeduction(
      state.deductionState,
      choices,
      state.inventory,
      state.draftState,
    )
    return accept({
      ...state,
      deductionState: result.nextState,
      draftState: result.nextDraftState,
      decision: createUpgradeDecision(
        result.newChoices,
        result.nextState,
        state.inventory,
        result.nextDraftState,
        false,
      ),
    })
  } catch {
    return reject(state, 'resource-unavailable')
  }
}

function selectAscensionAction(state: ArtifactBuildState, choiceId: string): ArtifactBuildTransition {
  if (state.decision?.type !== 'ascension') {
    return reject(state, 'decision-not-available')
  }
  if (!state.decision.choices.some((choice) => choice.choiceId === choiceId)) {
    return reject(state, 'choice-not-available')
  }

  try {
    const inventory = applyAscensionChoice(state.inventory, choiceId)
    const resultId = state.decision.choices.find((choice) => choice.choiceId === choiceId)!.resultId
    const nextChoices = getAvailableAscensionChoices(inventory)
    return accept({
      ...state,
      inventory,
      decision: nextChoices.length > 0 ? createAscensionDecision(nextChoices) : null,
    }, { type: 'artifact-ascended', artifactId: resultId })
  } catch {
    return reject(state, 'resource-unavailable')
  }
}

function skipAscensionAction(state: ArtifactBuildState): ArtifactBuildTransition {
  if (state.decision?.type !== 'ascension') {
    return reject(state, 'decision-not-available')
  }
  return accept({ ...state, decision: null })
}

function tunaHealAction(state: ArtifactBuildState, maxHealth: number): ArtifactBuildTransition {
  if (state.decision?.type !== 'upgrade' && state.decision?.type !== 'ascension') {
    return reject(state, 'decision-not-available')
  }
  if (!Number.isFinite(maxHealth) || maxHealth <= 0) {
    return reject(state, 'resource-unavailable')
  }

  const nextState = state.decision.type === 'upgrade'
    ? completeUpgradeSelection({ ...state, decision: state.decision })
    : { ...state, decision: null }
  return accept(nextState, {
    type: 'health-restored',
    amount: calculateTunaHeal(maxHealth),
  })
}

function advanceDecision(state: ArtifactBuildState): ArtifactBuildState {
  if (state.pendingLevelUps <= 0) {
    return { ...state, decision: null }
  }

  const draft = draftUpgradeChoices(state.inventory, state.draftState, { count: 3 })
  if (draft.choices.length > 0) {
    return {
      ...state,
      draftState: draft.nextState,
      decision: createUpgradeDecision(
        draft.choices,
        state.deductionState,
        state.inventory,
        draft.nextState,
        false,
      ),
    }
  }

  const ascensionChoices = getAvailableAscensionChoices(state.inventory)
  if (ascensionChoices.length > 0) {
    return {
      ...state,
      pendingLevelUps: 0,
      draftState: draft.nextState,
      decision: createAscensionDecision(ascensionChoices),
    }
  }

  const zhouTianChoices = generateZhouTianChoices(state.zhouTianState)
  if (zhouTianChoices.length > 0) {
    return {
      ...state,
      draftState: draft.nextState,
      decision: {
        type: 'upgrade',
        choices: zhouTianChoices,
        deductionCount: state.deductionState.remainingCount,
        canDeduce: false,
        isZhouTian: true,
      },
    }
  }

  return {
    ...state,
    pendingLevelUps: 0,
    draftState: draft.nextState,
    decision: null,
  }
}

function createUpgradeDecision(
  choices: readonly ArtifactBuildChoice[],
  deductionState: DeductionState,
  inventory: ArtifactInventory,
  draftState: UpgradeDraftState,
  isZhouTian: boolean,
): Extract<ArtifactBuildDecision, { type: 'upgrade' }> {
  return {
    type: 'upgrade',
    choices,
    deductionCount: deductionState.remainingCount,
    canDeduce: !isZhouTian && canDeduceChoices(deductionState, choices, inventory, draftState),
    isZhouTian,
  }
}

function isFlexibleChoice(choice: ArtifactBuildChoice): choice is FlexibleUpgradeChoice {
  return 'type' in choice && choice.type === 'flex'
}

function isUpgradeChoice(choice: ArtifactBuildChoice): choice is UpgradeChoice {
  return 'type' in choice && (choice.type === 'acquire' || choice.type === 'upgrade')
}

function isUpgradeDraftChoice(choice: ArtifactBuildChoice): choice is UpgradeDraftChoice {
  return 'type' in choice
}

function isZhouTianChoice(choice: ArtifactBuildChoice): choice is ZhouTianOption {
  return choice.choiceId === 'yu-qi'
    || choice.choiceId === 'xing-qi'
    || choice.choiceId === 'lian-ti'
}

function canDeduceChoices(
  deductionState: DeductionState,
  choices: readonly ArtifactBuildChoice[],
  inventory: ArtifactInventory,
  draftState: UpgradeDraftState,
) {
  const upgradeChoices = choices.filter(isUpgradeDraftChoice)
  return upgradeChoices.length === choices.length
    && canPerformDeduction(deductionState, upgradeChoices, inventory, draftState)
}

function createAscensionDecision(
  choices: readonly AscensionRecipe[],
): Extract<ArtifactBuildDecision, { type: 'ascension' }> {
  return { type: 'ascension', choices }
}

function accept(state: ArtifactBuildState, effect?: ArtifactBuildEffect): ArtifactBuildTransition {
  return { accepted: true, state, effect }
}

function reject(
  state: ArtifactBuildState,
  rejection: ArtifactBuildRejection,
): ArtifactBuildTransition {
  return { accepted: false, state, rejection }
}
