import type { ArtifactId } from './artifactInventory'

export type RunResult = 'victory' | 'defeat'
export type DamageSource =
  | 'ordinary-enemy'
  | 'elite-enemy'
  | 'wolf-king-contact'
  | 'moon-howl'
  | 'unknown'

export interface RunArtifactSummary {
  readonly id: ArtifactId
  readonly name: string
  readonly level: number
}

export interface RunSummaryInput {
  readonly result: RunResult
  readonly elapsedMs: number
  readonly defeatedEnemies: number
  readonly defeatedElites: number
  readonly demonLairDestroyed: boolean
  readonly artifacts: readonly RunArtifactSummary[]
  readonly finalDamageSource: DamageSource
  readonly practiceMode?: boolean
}

export interface RunSummary {
  readonly result: RunResult
  readonly elapsedMs: number
  readonly defeatedEnemies: number
  readonly artifacts: readonly RunArtifactSummary[]
  readonly spiritStones: number
  readonly demonCores: number
  readonly demonLairDestroyed: boolean
  readonly finalDamageSource: DamageSource
  readonly hint: string
}

const DAMAGE_HINTS: Record<DamageSource, string> = {
  'ordinary-enemy': '妖群贴身造成了最后一击；保持移动，并优先补足范围压制。',
  'elite-enemy': '精英妖物突破了防线；先辨认金色轮廓，再为它预留脱身路线。',
  'wolf-king-contact': '狼王近身终结了历练；横向绕行比直线后退更容易避开追击。',
  'moon-howl': '月啸命中了最后一击；看到紫色扩散预警时，应立即拉开距离。',
  unknown: '此行未竟；调整法器构筑，再从妖潮中寻找破局节奏。',
}

export function createRunSummary(input: RunSummaryInput): RunSummary {
  return {
    result: input.result,
    elapsedMs: input.elapsedMs,
    defeatedEnemies: input.defeatedEnemies,
    artifacts: input.artifacts,
    spiritStones: input.practiceMode ? 0 : input.defeatedElites * 2 + (input.demonLairDestroyed ? 8 : 0),
    // Only the product shell knows whether this is the first victory for the current node.
    demonCores: 0,
    demonLairDestroyed: input.demonLairDestroyed,
    finalDamageSource: input.finalDamageSource,
    hint:
      input.result === 'victory'
        ? '构筑已经完成从求生到反压制的转折；下一局可以尝试另一条升阶路线。'
        : DAMAGE_HINTS[input.finalDamageSource],
  }
}
