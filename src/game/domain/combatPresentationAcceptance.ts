export type CombatPresentationCheckpointId =
  | 'opening-00-30'
  | 'surge-02-00'
  | 'event-04-00'
  | 'boss-08-30'

export interface CombatPresentationCheckpoint {
  readonly id: CombatPresentationCheckpointId
  readonly elapsedMs: number
  readonly label: string
}

/**
 * Stable visual review points for the Qing Shi Ridge sample run.
 *
 * The scene may run faster in acceptance mode, but the domain clock remains
 * the source of truth. Keeping these values outside Phaser lets browser and
 * unit tests agree on the same review contract.
 */
export const QING_SHI_RIDGE_PRESENTATION_CHECKPOINTS: readonly CombatPresentationCheckpoint[] = [
  { id: 'opening-00-30', elapsedMs: 30_000, label: '开局妖潮与第一轮法器动作' },
  { id: 'surge-02-00', elapsedMs: 120_000, label: '妖潮增压与精英妖物' },
  { id: 'event-04-00', elapsedMs: 240_000, label: '青石岭事件与高阶法器' },
  { id: 'boss-08-30', elapsedMs: 510_000, label: '啸月狼王与狂月阶段' },
] as const

export function resolveCombatPresentationCheckpoint(elapsedMs: number): CombatPresentationCheckpoint | null {
  let current: CombatPresentationCheckpoint | null = null
  for (const checkpoint of QING_SHI_RIDGE_PRESENTATION_CHECKPOINTS) {
    if (elapsedMs < checkpoint.elapsedMs) {
      break
    }
    current = checkpoint
  }
  return current
}
