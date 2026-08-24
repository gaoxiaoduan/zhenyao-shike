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
  readonly animationStep: number
}

const ENEMY_SILHOUETTES: Readonly<Record<EnemyVisualSilhouette, {
  readonly accentColor: number
  readonly baseScale: number
  readonly tint: number | null
}>> = {
  'boar-demon': { accentColor: 0xf59e0b, baseScale: 1.04, tint: null },
  'wood-wolf': { accentColor: 0x86efac, baseScale: 1, tint: null },
  'mist-moth': { accentColor: 0xc4b5fd, baseScale: 0.96, tint: null },
  'elite-wolf': { accentColor: 0xfbbf24, baseScale: 1.14, tint: null },
  'moon-shadow': { accentColor: 0xc4b5fd, baseScale: 0.92, tint: 0x2e1065 },
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
  const animationStep = input.reducedMotion ? 0 : Math.floor(Math.max(0, input.elapsedMs) / 120)
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
  const dynamicMotion = input.reducedMotion ? 0 : Math.sin(input.elapsedMs / 90 + animationStep)
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
  return {
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
    animationStep,
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
  readonly phase: WolfKingPhase
  readonly attack: WolfKingAttack
  readonly arrival: boolean
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
  readonly attackRing: boolean
  readonly animationStep: number
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
  const animationStep = input.reducedMotion ? 0 : Math.floor(Math.max(0, input.elapsedMs) / 120)
  return {
    phase: input.phase,
    attack: input.attack,
    arrival: isArrival,
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
    attackRing: input.attack === 'assault' || input.attack === 'charge',
    animationStep,
  }
}

export type PlayerVisualPose = 'idle' | 'walk' | 'cast' | 'hit' | 'downed'

export interface PlayerPresentationInput {
  readonly facingX: number
  readonly facingY: number
  readonly isMoving: boolean
  readonly hitFlashMs: number
  readonly hitSparkMs: number
  readonly castPoseMs: number
  readonly downed: boolean
  readonly stopBounceRemainingMs: number
  readonly shieldRemainingMs: number
  readonly motionPhase?: number
  readonly elapsedMs: number
  readonly reducedMotion: boolean
}

export interface PlayerPresentation {
  readonly pose: PlayerVisualPose
  readonly bob: number
  readonly scaleX: number
  readonly scaleY: number
  readonly angle: number
  readonly flipX: boolean
  readonly alpha: number
  readonly tint: number | null
  readonly hitSparkActive: boolean
  readonly hitSparkProgress: number
  readonly motionPhase: number
}

export function resolvePlayerPresentation(input: PlayerPresentationInput): PlayerPresentation {
  const pose: PlayerVisualPose = input.downed
    ? 'downed'
    : input.hitFlashMs > 0
      ? 'hit'
      : input.castPoseMs > 0
        ? 'cast'
        : input.isMoving
          ? 'walk'
          : 'idle'
  const motionPhase = input.motionPhase ?? input.elapsedMs / 180
  const walkBob = input.isMoving && !input.reducedMotion ? Math.sin(motionPhase) * 3 : 0
  const stopBounce = input.stopBounceRemainingMs > 0 && !input.reducedMotion
    ? Math.sin((1 - input.stopBounceRemainingMs / 180) * Math.PI) * 4
    : 0
  const bob = pose === 'downed' ? 10 : walkBob + stopBounce
  const squash = pose === 'walk' && !input.reducedMotion
    ? 1 + Math.sin(motionPhase * 2) * 0.035
    : pose === 'cast'
      ? 1.06
      : 1
  const angle = pose === 'downed'
    ? 78
    : pose === 'hit'
      ? (input.facingX < 0 ? -10 : 10)
      : pose === 'cast'
        ? input.facingX * 7
        : input.isMoving
          ? input.facingX * input.facingY * 2
          : 0

  return {
    pose,
    bob,
    scaleX: squash,
    scaleY: 1 - (squash - 1) * 0.6,
    angle,
    flipX: input.facingX < -0.1,
    alpha: pose === 'downed' ? 0.66 : 1,
    tint: input.hitFlashMs > 0
      ? 0xffffff
      : input.shieldRemainingMs > 0
        ? 0xdff8ff
        : null,
    hitSparkActive: input.hitSparkMs > 0,
    hitSparkProgress: Math.max(0, Math.min(1, 1 - input.hitSparkMs / 220)),
    motionPhase: input.reducedMotion ? 0 : motionPhase,
  }
}

export interface ArtifactProjectilePresentationInput {
  readonly artifactId: ArtifactId
  readonly elapsedMs: number
  readonly reducedMotion: boolean
}

export interface ArtifactProjectilePresentation {
  readonly signature: ArtifactVisualSignature
  readonly macroShape: ArtifactMacroShape
  readonly hasTrail: boolean
  readonly displayWidth: number
  readonly displayHeight: number
  readonly animationStep: number
}

export function resolveArtifactProjectilePresentation(
  input: ArtifactProjectilePresentationInput,
): ArtifactProjectilePresentation {
  const signature = resolveArtifactVisualSignature(input.artifactId)
  const animationStep = input.reducedMotion ? 0 : Math.floor(input.elapsedMs / 90)
  return {
    signature,
    macroShape: signature.macroShape,
    hasTrail: !input.reducedMotion,
    displayWidth: signature.isHighTier ? 30 : 24,
    displayHeight: signature.isHighTier ? 34 : 28,
    animationStep,
  }
}

export interface SpellPresentationInput {
  readonly shieldRemainingMs: number
  readonly castVisualRemainingMs: number
  readonly impactPulseRemainingMs: number
  readonly endVisualRemainingMs: number
  readonly elapsedMs: number
  readonly reducedMotion: boolean
}

export interface SpellPresentation {
  readonly active: boolean
  readonly shieldActive: boolean
  readonly displaySize: number
  readonly angle: number
  readonly alpha: number
  readonly pulseRemainingMs: number
  readonly pulseProgress: number
  readonly signature: ArtifactVisualSignature
  readonly animationStep: number
}

export function resolveSpellPresentation(input: SpellPresentationInput): SpellPresentation {
  const active = input.shieldRemainingMs > 0
    || input.castVisualRemainingMs > 0
    || input.impactPulseRemainingMs > 0
    || input.endVisualRemainingMs > 0
  const pulseRemainingMs = Math.max(
    input.castVisualRemainingMs,
    input.impactPulseRemainingMs,
    input.endVisualRemainingMs,
  )
  return {
    active,
    shieldActive: input.shieldRemainingMs > 0,
    displaySize: input.shieldRemainingMs > 0 ? 112 : 94,
    angle: input.reducedMotion ? 0 : input.elapsedMs / 80,
    alpha: input.shieldRemainingMs > 0 ? 0.72 : 0.9,
    pulseRemainingMs,
    pulseProgress: 1 - pulseRemainingMs / 520,
    signature: resolveCombatVisualSignature('xuan-guang-hu-shen-jue'),
    animationStep: input.reducedMotion ? 0 : Math.floor(input.elapsedMs / 120),
  }
}

export type CombatFeedbackKind = 'hit' | 'death' | 'dust' | 'breach'

export interface CombatFeedbackInput {
  readonly kind: CombatFeedbackKind
  readonly x: number
  readonly y: number
  readonly color: number
  readonly remainingMs: number
  readonly durationMs: number
  readonly radius: number
}

export interface CombatFeedbackPresentation extends CombatFeedbackInput {
  readonly progress: number
  readonly alpha: number
}

export function resolveCombatFeedbackPresentation(
  input: CombatFeedbackInput,
  reducedMotion: boolean,
): CombatFeedbackPresentation {
  const progress = Math.max(0, Math.min(1, 1 - input.remainingMs / input.durationMs))
  return {
    ...input,
    progress,
    alpha: reducedMotion ? 0.72 : Math.max(0.12, 1 - progress),
  }
}

export type ArtifactFieldPresentation = ArtifactArrayFieldPresentation | ThunderImpactPresentation

export interface ArtifactArrayFieldPresentation {
  readonly kind: 'array'
  readonly artifactId: ArtifactId
  readonly x: number
  readonly y: number
  readonly radius: number
  readonly rotation: number
  readonly pulseActive: boolean
  readonly pulseProgress: number
  readonly signature: ArtifactVisualSignature
}

export interface ThunderImpactPresentation {
  readonly kind: 'thunder-impact'
  readonly artifactId: ArtifactId
  readonly x: number
  readonly y: number
  readonly radius: number
  readonly progress: number
  readonly alpha: number
  readonly signature: ArtifactVisualSignature
}

export type ArtifactFieldPresentationInput =
  | {
      readonly kind: 'array'
      readonly artifactId: ArtifactId
      readonly x: number
      readonly y: number
      readonly radius: number
      readonly rotation: number
      readonly pulseRemainingMs: number
      readonly pulseDurationMs: number
    }
  | {
      readonly kind: 'thunder-impact'
      readonly artifactId: ArtifactId
      readonly x: number
      readonly y: number
      readonly radius: number
      readonly remainingMs: number
      readonly durationMs: number
    }

export function resolveArtifactFieldPresentation(
  input: ArtifactFieldPresentationInput,
  reducedMotion: boolean,
): ArtifactFieldPresentation {
  const signature = resolveArtifactVisualSignature(input.artifactId)
  if (input.kind === 'array') {
    return {
      kind: input.kind,
      artifactId: input.artifactId,
      x: input.x,
      y: input.y,
      radius: input.radius,
      rotation: reducedMotion ? 0 : input.rotation,
      pulseActive: input.pulseRemainingMs > 0,
      pulseProgress: Math.max(0, Math.min(1, 1 - input.pulseRemainingMs / input.pulseDurationMs)),
      signature,
    }
  }

  const progress = Math.max(0, Math.min(1, 1 - input.remainingMs / input.durationMs))
  return {
    kind: input.kind,
    artifactId: input.artifactId,
    x: input.x,
    y: input.y,
    radius: input.radius,
    progress,
    alpha: reducedMotion ? 0.72 : Math.max(0, input.remainingMs / input.durationMs),
    signature,
  }
}

export interface PositionedPlayerPresentation {
  readonly x: number
  readonly y: number
  readonly health: number
  readonly maxHealth: number
  readonly presentation: PlayerPresentation
}

export interface PositionedEnemyPresentation {
  readonly x: number
  readonly y: number
  readonly directionX: number
  readonly directionY: number
  readonly radius: number
  readonly health: number
  readonly maxHealth: number
  readonly isElite: boolean
  readonly presentation: EnemyPresentation
}

export interface PositionedBossPresentation {
  readonly x: number
  readonly y: number
  readonly radius: number
  readonly health: number
  readonly maxHealth: number
  readonly chargeDirectionX: number
  readonly chargeDirectionY: number
  readonly howlDirectionX: number
  readonly howlDirectionY: number
  readonly howlProgress: number
  readonly presentation: BossPresentation
}

export interface PositionedArtifactProjectilePresentation {
  readonly x: number
  readonly y: number
  readonly velocityX: number
  readonly velocityY: number
  readonly artifactId: ArtifactId
  readonly presentation: ArtifactProjectilePresentation
}

export interface CombatPresentationFrame {
  readonly elapsedMs: number
  readonly reducedMotion: boolean
  readonly player: PositionedPlayerPresentation
  readonly enemies: readonly PositionedEnemyPresentation[]
  readonly boss: PositionedBossPresentation | null
  readonly projectiles: readonly PositionedArtifactProjectilePresentation[]
  readonly artifactFields: readonly ArtifactFieldPresentation[]
  readonly enemyProjectiles: readonly PositionedEnemyProjectilePresentation[]
  readonly spell: SpellPresentation
  readonly feedback: readonly CombatFeedbackPresentation[]
}

export interface PositionedEnemyProjectilePresentation {
  readonly x: number
  readonly y: number
  readonly radius: number
}

export type CombatPresentationFrameInput = {
  readonly elapsedMs: number
  readonly reducedMotion: boolean
  readonly player: Omit<PlayerPresentationInput, 'elapsedMs' | 'reducedMotion'> & {
    readonly x: number
    readonly y: number
    readonly health: number
    readonly maxHealth: number
  }
  readonly enemies: readonly ({
    readonly x: number
    readonly y: number
    readonly directionX: number
    readonly directionY: number
    readonly radius: number
    readonly health: number
    readonly maxHealth: number
    readonly isElite: boolean
    readonly input: Omit<EnemyPresentationInput, 'elapsedMs' | 'reducedMotion'>
  })[]
  readonly boss: ({
    readonly x: number
    readonly y: number
    readonly radius: number
    readonly health: number
    readonly maxHealth: number
    readonly chargeDirectionX: number
    readonly chargeDirectionY: number
    readonly howlDirectionX: number
    readonly howlDirectionY: number
    readonly howlProgress: number
    readonly input: Omit<BossPresentationInput, 'elapsedMs' | 'reducedMotion'>
  }) | null
  readonly projectiles: readonly ({
    readonly x: number
    readonly y: number
    readonly velocityX: number
    readonly velocityY: number
    readonly artifactId: ArtifactId
  })[]
  readonly artifactFields: readonly ArtifactFieldPresentationInput[]
  readonly enemyProjectiles: readonly PositionedEnemyProjectilePresentation[]
  readonly spell: Omit<SpellPresentationInput, 'elapsedMs' | 'reducedMotion'>
  readonly bursts: readonly CombatFeedbackInput[]
}

export function resolveCombatPresentationFrame(input: CombatPresentationFrameInput): CombatPresentationFrame {
  const player = {
    ...input.player,
    presentation: resolvePlayerPresentation({
      ...input.player,
      elapsedMs: input.elapsedMs,
      reducedMotion: input.reducedMotion,
    }),
  }
  const enemies = input.enemies.map((enemy) => ({
    x: enemy.x,
    y: enemy.y,
    directionX: enemy.directionX,
    directionY: enemy.directionY,
    radius: enemy.radius,
    health: enemy.health,
    maxHealth: enemy.maxHealth,
    isElite: enemy.isElite,
    presentation: resolveEnemyPresentation({
      ...enemy.input,
      elapsedMs: input.elapsedMs,
      reducedMotion: input.reducedMotion,
    }),
  }))
  const boss = input.boss === null
    ? null
    : {
        x: input.boss.x,
        y: input.boss.y,
        radius: input.boss.radius,
        health: input.boss.health,
        maxHealth: input.boss.maxHealth,
        chargeDirectionX: input.boss.chargeDirectionX,
        chargeDirectionY: input.boss.chargeDirectionY,
        howlDirectionX: input.boss.howlDirectionX,
        howlDirectionY: input.boss.howlDirectionY,
        howlProgress: input.boss.howlProgress,
        presentation: resolveBossPresentation({
          ...input.boss.input,
          elapsedMs: input.elapsedMs,
          reducedMotion: input.reducedMotion,
        }),
      }
  const projectiles = input.projectiles.map((projectile) => ({
    x: projectile.x,
    y: projectile.y,
    velocityX: projectile.velocityX,
    velocityY: projectile.velocityY,
    artifactId: projectile.artifactId,
    presentation: resolveArtifactProjectilePresentation({
      artifactId: projectile.artifactId,
      elapsedMs: input.elapsedMs,
      reducedMotion: input.reducedMotion,
    }),
  }))
  const artifactFields = input.artifactFields.map((field) => resolveArtifactFieldPresentation(field, input.reducedMotion))
  const spell = resolveSpellPresentation({
    ...input.spell,
    elapsedMs: input.elapsedMs,
    reducedMotion: input.reducedMotion,
  })
  const feedback = input.bursts.map((burst) => resolveCombatFeedbackPresentation(burst, input.reducedMotion))

  return {
    elapsedMs: input.elapsedMs,
    reducedMotion: input.reducedMotion,
    player,
    enemies,
    boss,
    projectiles,
    artifactFields,
    enemyProjectiles: input.enemyProjectiles,
    spell,
    feedback,
  }
}

export interface CombatPresentationAdapter {
  present(frame: CombatPresentationFrame): void
}

export interface RecordingCombatPresentationAdapter extends CombatPresentationAdapter {
  readonly frames: readonly CombatPresentationFrame[]
}

export function createRecordingCombatPresentationAdapter(): RecordingCombatPresentationAdapter {
  const recordedFrames: CombatPresentationFrame[] = []
  return {
    get frames() {
      return recordedFrames.slice()
    },
    present(frame) {
      recordedFrames.push(frame)
    },
  }
}
