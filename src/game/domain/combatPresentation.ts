import type { ArtifactId } from './artifactInventory'
import type { EnemyRole, QingShiRidgeEnemyId } from './combatRules'
import type { EnemyAction } from './enemyBehaviorRules'
import type { WolfKingAttack, WolfKingPhase } from './wolfKingRules'

export type EnemyVisualSilhouette =
  | 'boar-demon'
  | 'wood-wolf'
  | 'mist-moth'
  | 'elite-wolf'
  | 'moon-shadow'

export type EnemyVisualPose = 'approach' | 'windup' | 'attack' | 'recover' | 'hit'

export type EnemyTelegraph = 'none' | 'charge-lane' | 'flank' | 'mist-cloud' | 'moon-shadow' | 'vulnerable-crack'

export interface EnemyPresentationInput {
  readonly id: QingShiRidgeEnemyId | 'xiaoyue-wolf-king-moon-shadow'
  readonly isElite: boolean
  readonly isMoonShadow: boolean
  readonly action: EnemyAction
  readonly actionRemainingMs: number
  readonly recoveryIsVulnerable: boolean
  readonly hitFlashMs: number
  readonly facingX: number
  readonly elapsedMs: number
  readonly reducedMotion: boolean
  readonly attackVisualRemainingMs?: number
}

export interface EnemyPresentation {
  readonly textureKey: 'qingshi-actors' | 'qingshi-combat-actors'
  readonly frame: number
  readonly silhouette: EnemyVisualSilhouette
  readonly pose: EnemyVisualPose
  readonly telegraph: EnemyTelegraph
  readonly tint: number | null
  readonly accentColor: number
  readonly scale: number
  readonly bob: number
  readonly angle: number
  readonly flipX: boolean
  readonly alpha: number
  readonly isVulnerable: boolean
}

const ENEMY_SILHOUETTES: Readonly<Record<EnemyVisualSilhouette, {
  readonly frame: number
  readonly accentColor: number
  readonly baseScale: number
  readonly tint: number | null
}>> = {
  'boar-demon': { frame: 1, accentColor: 0xf59e0b, baseScale: 1.04, tint: null },
  'wood-wolf': { frame: 2, accentColor: 0x86efac, baseScale: 1, tint: null },
  'mist-moth': { frame: 3, accentColor: 0xc4b5fd, baseScale: 0.96, tint: null },
  'elite-wolf': { frame: 4, accentColor: 0xfbbf24, baseScale: 1.14, tint: null },
  'moon-shadow': { frame: 2, accentColor: 0xc4b5fd, baseScale: 0.92, tint: 0x2e1065 },
}

function enemySilhouette(input: EnemyPresentationInput): EnemyVisualSilhouette {
  if (input.isMoonShadow || input.id === 'xiaoyue-wolf-king-moon-shadow') {
    return 'moon-shadow'
  }
  if (input.isElite || input.id === 'qing-shi-ridge-elite-wolf') {
    return 'elite-wolf'
  }
  if (input.id === 'qing-shi-ridge-boar-demon') {
    return 'boar-demon'
  }
  if (input.id === 'qing-shi-ridge-mist-moth') {
    return 'mist-moth'
  }
  return 'wood-wolf'
}

function enemyRoleForPresentation(input: EnemyPresentationInput): EnemyRole {
  if (input.isMoonShadow || input.id === 'xiaoyue-wolf-king-moon-shadow') {
    return 'pursuer-flanker'
  }
  if (input.id === 'qing-shi-ridge-boar-demon') {
    return 'armored-charger'
  }
  if (input.id === 'qing-shi-ridge-mist-moth') {
    return 'ranged-kiter'
  }
  return input.isElite || input.id === 'qing-shi-ridge-elite-wolf'
    ? 'elite-pouncer'
    : 'pursuer-flanker'
}

export function resolveEnemyPresentation(input: EnemyPresentationInput): EnemyPresentation {
  const silhouette = enemySilhouette(input)
  const palette = ENEMY_SILHOUETTES[silhouette]
  const role = enemyRoleForPresentation(input)
  const isAttack = input.action === 'charge' || (input.attackVisualRemainingMs ?? 0) > 0
  const pose: EnemyVisualPose = input.hitFlashMs > 0
    ? 'hit'
    : input.action === 'windup'
      ? 'windup'
      : isAttack
        ? 'attack'
        : input.action === 'recover'
          ? 'recover'
          : 'approach'
  const isVulnerable = input.recoveryIsVulnerable && input.action === 'recover'
  const telegraph: EnemyTelegraph = isVulnerable
    ? 'vulnerable-crack'
    : input.action === 'windup' || input.action === 'charge'
      ? 'charge-lane'
      : role === 'ranged-kiter' && isAttack
        ? 'mist-cloud'
        : silhouette === 'moon-shadow'
          ? 'moon-shadow'
          : role === 'pursuer-flanker'
            ? 'flank'
            : 'none'
  const dynamicMotion = input.reducedMotion ? 0 : Math.sin(input.elapsedMs / 90 + palette.frame) 
  const poseScale = input.reducedMotion
    ? 1
    : pose === 'windup'
      ? 0.9
      : pose === 'attack'
        ? 1.08
        : pose === 'recover'
          ? 0.96
          : pose === 'hit'
            ? 1.04
            : 1
  const angle = input.reducedMotion
    ? 0
    : pose === 'windup'
      ? (input.facingX < 0 ? -1 : 1) * 7
      : pose === 'attack'
        ? (input.facingX < 0 ? -1 : 1) * 4
        : pose === 'recover' && isVulnerable
          ? (input.facingX < 0 ? -1 : 1) * -9
          : 0
  const frame = silhouette === 'moon-shadow'
    ? pose === 'windup'
      ? 1
      : pose === 'attack'
        ? 2
        : pose === 'recover'
          ? 3
          : 0
    : palette.frame

  return {
    textureKey: silhouette === 'moon-shadow' ? 'qingshi-combat-actors' : 'qingshi-actors',
    frame,
    silhouette,
    pose,
    telegraph,
    tint: input.hitFlashMs > 0 ? 0xffffff : palette.tint,
    accentColor: palette.accentColor,
    scale: palette.baseScale * poseScale,
    bob: dynamicMotion * (silhouette === 'mist-moth' ? 4 : silhouette === 'moon-shadow' ? 2 : 1.8),
    angle,
    flipX: input.facingX < -0.1,
    alpha: silhouette === 'moon-shadow' ? 0.86 : 1,
    isVulnerable,
  }
}

export type ArtifactVisualFamily = 'sword' | 'thunder' | 'array' | 'wind' | 'spell'

export type ArtifactMacroShape =
  | 'flying-sword'
  | 'talisman-bolt'
  | 'four-flag-array'
  | 'curved-wind-blade'
  | 'floating-sword-rain'
  | 'light-sword-wing'
  | 'nine-heavens-thunder-array'
  | 'protective-talisman-shield'

export interface ArtifactVisualSignature {
  readonly family: ArtifactVisualFamily
  readonly macroShape: ArtifactMacroShape
  readonly sourceMotif: string
  readonly accentColor: number
  readonly isHighTier: boolean
  readonly trailWidth: number
}

const ARTIFACT_SIGNATURES: Readonly<Record<ArtifactId, ArtifactVisualSignature>> = {
  'qing-feng-jian-xia': {
    family: 'sword',
    macroShape: 'flying-sword',
    sourceMotif: '剑匣开锋 · 单柄飞剑',
    accentColor: 0xe9d5ff,
    isHighTier: false,
    trailWidth: 3,
  },
  'lei-zhuan-fu-ce': {
    family: 'thunder',
    macroShape: 'talisman-bolt',
    sourceMotif: '雷篆符纸 · 分叉雷火',
    accentColor: 0xfde68a,
    isHighTier: false,
    trailWidth: 2,
  },
  'si-xiang-zhen-qi': {
    family: 'array',
    macroShape: 'four-flag-array',
    sourceMotif: '四象阵旗 · 四方脉冲',
    accentColor: 0xa7f3d0,
    isHighTier: false,
    trailWidth: 2,
  },
  'fu-yao-yu-yi': {
    family: 'wind',
    macroShape: 'curved-wind-blade',
    sourceMotif: '扶摇羽衣 · 羽流弧刃',
    accentColor: 0x7dd3fc,
    isHighTier: false,
    trailWidth: 3,
  },
  'zhu-xie-jian-zhen': {
    family: 'sword',
    macroShape: 'floating-sword-rain',
    sourceMotif: '青锋剑匣 + 四象阵旗 · 悬空剑阵',
    accentColor: 0xf0abfc,
    isHighTier: true,
    trailWidth: 5,
  },
  'liu-guang-jian-yi': {
    family: 'wind',
    macroShape: 'light-sword-wing',
    sourceMotif: '青锋剑匣 + 扶摇羽衣 · 翼展剑潮',
    accentColor: 0x93c5fd,
    isHighTier: true,
    trailWidth: 4,
  },
  'jiu-xiao-lei-zhen': {
    family: 'thunder',
    macroShape: 'nine-heavens-thunder-array',
    sourceMotif: '雷篆符册 + 四象阵旗 · 地面雷阵',
    accentColor: 0xfef08a,
    isHighTier: true,
    trailWidth: 5,
  },
}

export function resolveArtifactVisualSignature(artifactId: ArtifactId): ArtifactVisualSignature {
  return ARTIFACT_SIGNATURES[artifactId]
}

export type CombatPresentationSignatureId = ArtifactId | 'xuan-guang-hu-shen-jue'

const PROTECTIVE_SPELL_SIGNATURE: ArtifactVisualSignature = {
  family: 'spell',
  macroShape: 'protective-talisman-shield',
  sourceMotif: '结印玄光 · 四符护身',
  accentColor: 0xbae6fd,
  isHighTier: false,
  trailWidth: 3,
}

export function resolveCombatVisualSignature(id: CombatPresentationSignatureId): ArtifactVisualSignature {
  return id === 'xuan-guang-hu-shen-jue'
    ? PROTECTIVE_SPELL_SIGNATURE
    : resolveArtifactVisualSignature(id)
}

export type BossVisualHalo = 'arrival-pulse' | 'broken-moon' | 'cracked-moon' | 'breach-open'
export type BossTelegraph = 'none' | 'charge-lane' | 'assault-lane' | 'howl-sector'

export interface BossPresentationInput {
  readonly phase: WolfKingPhase
  readonly attack: WolfKingAttack
  readonly introRemainingMs: number
  readonly howlRemainingMs: number
  readonly breachRemainingMs: number
  readonly impactRemainingMs?: number
  readonly elapsedMs: number
  readonly reducedMotion: boolean
}

export interface BossPresentation {
  readonly textureKey: 'qingshi-combat-actors'
  readonly frame: number
  readonly halo: BossVisualHalo
  readonly telegraph: BossTelegraph
  readonly tint: number
  readonly accentColor: number
  readonly alpha: number
  readonly scale: number
  readonly angle: number
  readonly shake: number
  readonly shadowSplit: boolean
  readonly moonMarkOpen: boolean
}

export function resolveBossPresentation(input: BossPresentationInput): BossPresentation {
  const isArrival = input.phase === 'arrival' || input.introRemainingMs > 0
  const isEnraged = input.phase === 'enraged'
  const isBreachOpen = input.breachRemainingMs > 0
  const halo: BossVisualHalo = isBreachOpen
    ? 'breach-open'
    : isArrival
      ? 'arrival-pulse'
      : isEnraged
        ? 'cracked-moon'
        : 'broken-moon'
  const telegraph: BossTelegraph = input.howlRemainingMs > 0
    ? 'howl-sector'
    : input.attack === 'assault-warning'
      ? 'assault-lane'
      : input.attack === 'charge-warning'
        ? 'charge-lane'
        : 'none'
  const impactRemainingMs = input.impactRemainingMs ?? 0
  const shake = input.reducedMotion || isArrival || impactRemainingMs <= 0
    ? 0
    : Math.sin(input.elapsedMs / 28) * (isEnraged ? 1.5 : 0.8) * Math.min(1, impactRemainingMs / 120)
  const frame = isEnraged
    ? input.breachRemainingMs > 0
      ? 7
      : input.attack === 'assault' || input.attack === 'assault-warning'
        ? 6
        : input.attack === 'charge' || input.attack === 'charge-warning'
          ? 5
          : 4
    : 4

  return {
    textureKey: 'qingshi-combat-actors',
    frame,
    halo,
    telegraph,
    tint: isEnraged ? 0xffb4b4 : 0xffffff,
    accentColor: isEnraged ? 0xef4444 : 0xc084fc,
    alpha: isArrival ? 0.35 : 1,
    scale: isBreachOpen ? 1.06 : isEnraged ? 1.02 : 1,
    angle: isBreachOpen && !input.reducedMotion ? Math.sin(input.elapsedMs / 65) * 5 : 0,
    shake,
    shadowSplit: isEnraged,
    moonMarkOpen: isBreachOpen,
  }
}
