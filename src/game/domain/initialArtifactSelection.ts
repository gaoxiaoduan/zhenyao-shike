export type BaseArtifactId =
  | 'qing-feng-jian-xia'
  | 'lei-zhuan-fu-ce'
  | 'fu-yao-yu-yi'
  | 'si-xiang-zhen-qi'

export interface BaseArtifact {
  readonly id: BaseArtifactId
  readonly name: string
  readonly description: string
  readonly attackColor: number
  readonly attackDamage: number
  readonly attackIntervalMs: number
  readonly moveSpeedMultiplier: number
}

export interface InitialArtifactSelection {
  readonly candidates: readonly BaseArtifact[]
}

export interface SelectedInitialArtifact {
  readonly selected: BaseArtifact
}

const INITIAL_ARTIFACT_CANDIDATES: readonly BaseArtifact[] = [
  {
    id: 'qing-feng-jian-xia',
    name: '青锋剑匣',
    description: '自动锁定最近妖物，连续放出飞剑。适合先理解自动攻击。',
    attackColor: 0xe9d5ff,
    attackDamage: 12,
    attackIntervalMs: 420,
    moveSpeedMultiplier: 1,
  },
  {
    id: 'lei-zhuan-fu-ce',
    name: '雷篆符册',
    description: '自动投放雷符，重击最近妖物。适合观察一击破敌。',
    attackColor: 0xfde68a,
    attackDamage: 20,
    attackIntervalMs: 720,
    moveSpeedMultiplier: 1,
  },
  {
    id: 'fu-yao-yu-yi',
    name: '扶摇羽衣',
    description: '提升行进速度，并在移动时放出风刃。适合练习走位。',
    attackColor: 0x7dd3fc,
    attackDamage: 10,
    attackIntervalMs: 460,
    moveSpeedMultiplier: 1.35,
  },
]

export function createInitialArtifactSelection(): InitialArtifactSelection {
  return { candidates: INITIAL_ARTIFACT_CANDIDATES }
}

export function selectInitialArtifact(
  selection: InitialArtifactSelection,
  artifactId: BaseArtifactId,
): SelectedInitialArtifact {
  const selected = selection.candidates.find((artifact) => artifact.id === artifactId)
  if (!selected) {
    throw new RangeError('所选法器不在本次候选中。')
  }

  return { selected }
}
