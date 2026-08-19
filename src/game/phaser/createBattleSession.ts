import * as Phaser from 'phaser'
import actorAtlasUrl from '../../assets/game/qingshi-actors.png'
import combatActorAtlasUrl from '../../assets/game/qingshi-combat-actors.png'
import commonActorAtlasLeftUrl from '../../assets/game/qingshi-common-actors-left.png'
import commonActorAtlasRightUrl from '../../assets/game/qingshi-common-actors-right.png'
import artifactCombatEffectsAtlasUrl from '../../assets/game/artifact-combat-effects.png'
import groundTextureUrl from '../../assets/game/qingshi-ground.png'
import { musicStageForRun, type MusicStage, type SoundCue } from '../audio/audioDirector'
import {
  applyAscensionChoice,
  applyFlexibleUpgradeChoice,
  applyUpgradeChoice,
  ARTIFACT_DEFINITIONS,
  createArtifactInventory,
  createUpgradeDraftState,
  draftUpgradeChoices,
  getAvailableAscensionChoices,
  getArtifactLevel,
  getArtifactStats,
  type ArtifactInventory,
  type ArtifactStats,
  type ArtifactId,
  type AscensionRecipe,
  type UpgradeDraftChoice,
  type UpgradeDraftState,
} from '../domain/artifactInventory'
import {
  aggregateRadarPoints,
  computeCombatCamera,
  isInsideTargetingEnvelope,
  projectRadarPoint,
} from '../domain/battlefieldSpatialRules'
import {
  applyEnemyPressure,
  BASE_PLAYER_SPEED,
  chooseCommonEnemyForWave,
  createEnemyStats,
  getDemonWaveStage,
  getOffscreenSpawnPosition,
  getMistProjectileBudget,
  getWaveSpawnDirective,
  resolveDamage,
  shouldSpawnElite,
  type EnemyRole,
  type QingShiRidgeEnemyId,
} from '../domain/combatRules'
import {
  advanceEnemyBehavior,
  createEnemyBehaviorState,
  type EnemyBehaviorState,
} from '../domain/enemyBehaviorRules'
import {
  resolveArtifactVisualSignature,
  resolveBossPresentation,
  resolveCombatVisualSignature,
  resolveEnemyPresentation,
} from '../domain/combatPresentation'
import { resolveCombatPresentationCheckpoint } from '../domain/combatPresentationAcceptance'
import {
  advanceDemonLairEvent,
  advanceLingquanEvent,
  createDemonLairState,
  createLingquanEventState,
  damageDemonLair,
  generateQingShiRidgeLayout,
  markDemonLairGuardDefeated,
  updateLingquanTrigger,
  updateDemonLairTrigger,
  type LingquanEventState,
  type DemonLairState,
  type QingShiRidgeTerrainLayout,
} from '../domain/qingshiEventsAndTerrain'
import { createInputIntent, type InputIntent } from '../domain/inputIntent'
import {
  createInitialArtifactSelection,
  selectInitialArtifact,
  type BaseArtifactId,
} from '../domain/initialArtifactSelection'
import type { OnboardingStep } from '../domain/onboardingProgress'
import { advancePlayerDamageState, resolvePlayerDamage, type PlayerDamageKind } from '../domain/playerDamageRules'
import {
  advanceRunProgress,
  calculateRunElapsedMs,
  createRunProgress,
  endRun,
  grantExperience,
  GROWTH_PHASE_DURATION_MS,
  type RunProgress,
} from '../domain/runProgress'
import { createRunSummary, type DamageSource, type RunEventId, type RunResult } from '../domain/runSummary'
import { BATTLEFIELD_EVENT_COPY } from '../domain/runEventPresentation'
import {
  advanceWolfKingEncounter,
  createWolfKingEncounter,
  createWolfKingMinionStats,
  damageWolfKing,
  resolveWolfKingAttack,
  WOLF_KING_COMBAT_SPEED,
  WOLF_KING_CONTACT_DAMAGE_PER_SECOND,
  WOLF_KING_ENRAGED_SPEED,
  WOLF_KING_HOWL_DAMAGE,
  WOLF_KING_HOWL_DURATION_MS,
  WOLF_KING_HOWL_RADIUS,
  WOLF_KING_HOWL_SAFE_GAP_HALF_ANGLE,
  isWolfKingHowlHit,
  WOLF_KING_ENRAGED_HEALTH_RATIO,
  WOLF_KING_MOON_SHADOW_LIMIT,
  type WolfKingAttack,
  type WolfKingEncounter,
  type WolfKingEvent,
} from '../domain/wolfKingRules'
import {
  applyZhouTianChoice,
  calculateTunaHeal,
  canPerformDeduction,
  createDeductionState,
  createZhouTianState,
  generateZhouTianChoices,
  performDeduction,
  type ZhouTianOptionId,
} from '../domain/deductionAndZhouTian'
import type {
  BattleInstrumentationSnapshot,
  CreateGameSessionOptions,
  BattleRuntimeOutput,
} from '../session/GameSession'
import { createGameSessionController, type BattleRuntime } from '../session/GameSessionController'

const WORLD_SIZE = 2048
const PLAYER_SPEED = BASE_PLAYER_SPEED
const HUD_INTERVAL_MS = 120
const SPELL_COOLDOWN_MS = 10_000
const SPELL_SHIELD_DURATION_MS = 1_500
const RESULT_FREEZE_MS = 600
const COMMON_ACTOR_ATLAS_FRAME_COUNT = 20

function resolveCommonActorAtlas(frame: number) {
  const normalizedFrame = Math.max(0, Math.floor(frame))
  return normalizedFrame < COMMON_ACTOR_ATLAS_FRAME_COUNT
    ? { textureKey: 'qingshi-common-actors-left', frame: normalizedFrame }
    : { textureKey: 'qingshi-common-actors-right', frame: normalizedFrame - COMMON_ACTOR_ATLAS_FRAME_COUNT }
}

const ABANDONED_VILLAGE = { x: 1160, y: 1040, width: 290, height: 190 } as const

interface Enemy {
  kind: 'enemy'
  id: string
  x: number
  y: number
  health: number
  maxHealth: number
  isElite: boolean
  role: EnemyRole
  behavior: EnemyBehaviorState
  chargeDirectionX: number
  chargeDirectionY: number
  flankDirection: -1 | 1
  vulnerableMultiplier: number
  hitFlashMs: number
  radius: number
  speed: number
  color: number
  isLairGuard: boolean
  isMoonShadow: boolean
  lifetimeRemainingMs: number | null
  attackVisualRemainingMs: number
  sprite: Phaser.GameObjects.Image
}

interface BossSpatialState {
  readonly kind: 'boss'
  x: number
  y: number
  readonly radius: number
  readonly sprite: Phaser.GameObjects.Image
  chargeDirectionX: number
  chargeDirectionY: number
}

interface DemonLairSpatialState {
  readonly kind: 'lair'
  readonly x: number
  readonly y: number
  readonly radius: number
}

type CombatTarget = Enemy | BossSpatialState | DemonLairSpatialState

interface Projectile {
  x: number
  y: number
  velocityX: number
  velocityY: number
  remainingMs: number
  color: number
  damage: number
  artifactId: ArtifactId
  aoeRadius?: number
}

interface EnemyProjectile {
  x: number
  y: number
  velocityX: number
  velocityY: number
  remainingMs: number
  damage: number
  radius: number
}

interface Spirit {
  x: number
  y: number
  value: number
}

interface ThunderEffect {
  x: number
  y: number
  radius: number
  remainingMs: number
  artifactId: ArtifactId
}

type CombatBurstKind = 'hit' | 'death' | 'dust' | 'breach'

interface CombatBurst {
  kind: CombatBurstKind
  x: number
  y: number
  color: number
  remainingMs: number
  durationMs: number
  radius: number
}

const DETERMINISTIC_ACCEPTANCE_SEED = 20260818

export class QingShiRidgeScene extends Phaser.Scene {
  private readonly reportRuntimeOutput: (event: BattleRuntimeOutput) => void
  private readonly renderScale: number
  private compactRadar: boolean
  private readonly elapsedTimeScale: number
  private readonly emitInstrumentation?: (snapshot: BattleInstrumentationSnapshot) => void
  private readonly deterministicAcceptance: boolean
  private readonly practiceMode: boolean
  private reducedMotion: boolean
  private graphics!: Phaser.GameObjects.Graphics
  private radarGraphics!: Phaser.GameObjects.Graphics
  private radarLabel!: Phaser.GameObjects.Text
  private spiritNodeLabels: Phaser.GameObjects.Text[] = []
  private playerSprite!: Phaser.GameObjects.Image
  private spellPresentationSprite!: Phaser.GameObjects.Image
  private inputIntent = createInputIntent()
  private progress: RunProgress = createRunProgress()
  private player = { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2, health: 100, maxHealth: 100 }
  private enemies: Enemy[] = []
  private enemySpritePool: Phaser.GameObjects.Image[] = []
  private projectiles: Projectile[] = []
  private artifactProjectileSprites: Phaser.GameObjects.Image[] = []
  private enemyProjectiles: EnemyProjectile[] = []
  private spirits: Spirit[] = []
  private thunderEffects: ThunderEffect[] = []
  private combatBursts: CombatBurst[] = []
  private combatBurstPool: CombatBurst[] = []
  private inventory: ArtifactInventory = createArtifactInventory()
  private pendingLevelUps = 0
  private awaitingUpgradeSelection = false
  private upgradeChoices: readonly UpgradeDraftChoice[] = []
  private upgradeDraftState: UpgradeDraftState
  private awaitingAscensionSelection = false
  private ascensionChoices: readonly AscensionRecipe[] = []
  private deductionState = createDeductionState(1)
  private zhouTianState = createZhouTianState()
  private isZhouTianActive = false
  private playerDamageMultiplier = 1.0
  private attackIntervalMultiplier = 1.0
  private playerMaxHealthMultiplier = 1.0
  private terrainLayout!: QingShiRidgeTerrainLayout
  private readonly discoveredLandmarkIds = new Set<string>()
  private demonLair: DemonLairState = createDemonLairState(WORLD_SIZE)
  private lingquanEvent: LingquanEventState = createLingquanEventState()
  private pickupRadiusBoostRemainingMs = 0
  private readonly seenBattlefieldEvents = new Set<'demon-lair' | 'lingquan'>()
  private lastEliteSpawnMs: number | null = null
  private readonly initialArtifactSelection = createInitialArtifactSelection()
  private readonly completedOnboardingSteps = new Set<OnboardingStep>()
  private awaitingInitialArtifact = true
  private onboardingSkipped = false
  private paused = false
  private randomState = 1
  private boss?: WolfKingEncounter
  private bossSpatial?: BossSpatialState
  private bossStartedPresentationElapsedMs: number | null = null
  private bossReachedEnraged = false
  private bossHowlRemainingMs = 0
  private bossHowlElapsedMs = 0
  private bossHowlDirectionX = 0
  private bossHowlDirectionY = 1
  private bossHowlResolved = true
  private bossBreachRemainingMs = 0
  private bossAttack: WolfKingAttack = 'none'
  private bossAttackAvoidanceWindowMs = 0
  private bossAttackResolved = false
  private bossImpactRemainingMs = 0
  private musicStage: MusicStage = 'opening'
  private defeatedEnemies = 0
  private defeatedElites = 0
  private distanceTravelled = 0
  private finalDamageSource: DamageSource = 'unknown'
  private viewportWidth: number
  private viewportHeight: number
  private cameraZoom = 1

  private swordElapsedMs = 0
  private thunderElapsedMs = 0
  private fourArrayElapsedMs = 0
  private windBladeElapsedMs = 0
  private arrayRotationRad = 0
  private arrayPulseRemainingMs = 0
  private arrayPulseArtifactId: ArtifactId = 'si-xiang-zhen-qi'
  private presentationElapsedMs = 0

  private spawnElapsedMs = 0
  private spawnOrdinal = 0
  private spellCooldownMs = 0
  private shieldRemainingMs = 0
  private shieldBlockedFeedback = false
  private hitProtectionRemainingMs = 0
  private playerHitFlashMs = 0
  private playerHitSparkMs = 0
  private playerCastPoseMs = 0
  private playerDowned = false
  private playerMotionPhase = 0
  private playerFacingX = 0
  private playerFacingY = 1
  private wasPlayerMoving = false
  private playerStopBounceRemainingMs = 0
  private lastPlayerStepIndex = -1
  private spellCastVisualRemainingMs = 0
  private spellEndVisualRemainingMs = 0
  private spellImpactPulseRemainingMs = 0
  private hudElapsedMs = HUD_INTERVAL_MS
  private hitAudioCooldownMs = 0
  private ended = false

  constructor(
    reportRuntimeOutput: (event: BattleRuntimeOutput) => void,
    renderScale: number,
    reducedMotion: boolean,
    viewportWidth: number,
    viewportHeight: number,
    compactRadar: boolean,
    runSeed: number,
    elapsedTimeScale: number,
    emitInstrumentation?: (snapshot: BattleInstrumentationSnapshot) => void,
    deterministicAcceptance = false,
    practiceMode = false,
  ) {
    super({ key: 'qing-shi-ridge' })
    this.reportRuntimeOutput = reportRuntimeOutput
    this.renderScale = renderScale
    this.reducedMotion = reducedMotion
    this.viewportWidth = viewportWidth
    this.viewportHeight = viewportHeight
    this.compactRadar = compactRadar
    this.elapsedTimeScale = Math.max(1, elapsedTimeScale)
    this.emitInstrumentation = emitInstrumentation
    this.deterministicAcceptance = deterministicAcceptance
    this.practiceMode = practiceMode
    const sessionSeed = deterministicAcceptance ? DETERMINISTIC_ACCEPTANCE_SEED : runSeed
    this.randomState = (Math.floor(sessionSeed) >>> 0) || 1
    this.terrainLayout = generateQingShiRidgeLayout(sessionSeed)
    this.upgradeDraftState = createUpgradeDraftState(sessionSeed)
    this.lingquanEvent = createLingquanEventState(this.terrainLayout.spiritNodes.length, sessionSeed)
  }

  preload() {
    this.load.image('qingshi-ground', groundTextureUrl)
    this.load.spritesheet('qingshi-actors', actorAtlasUrl, { frameWidth: 512, frameHeight: 512 })
    // Keep each WebGL texture below the common 8192px maximum texture width.
    this.load.spritesheet('qingshi-common-actors-left', commonActorAtlasLeftUrl, { frameWidth: 256, frameHeight: 256 })
    this.load.spritesheet('qingshi-common-actors-right', commonActorAtlasRightUrl, { frameWidth: 256, frameHeight: 256 })
    this.load.spritesheet('qingshi-combat-actors', combatActorAtlasUrl, { frameWidth: 256, frameHeight: 768 })
    this.load.spritesheet('artifact-combat-effects', artifactCombatEffectsAtlasUrl, { frameWidth: 128, frameHeight: 128 })
  }

  create() {
    this.add
      .tileSprite(0, 0, WORLD_SIZE, WORLD_SIZE, 'qingshi-ground')
      .setOrigin(0)
      .setTileScale(0.42)
      .setDepth(-3)
    this.graphics = this.add.graphics().setDepth(2)
    this.radarGraphics = this.add.graphics().setDepth(30)
    this.radarLabel = this.add.text(0, 0, '战场雷达', {
      color: '#fef3c7',
      fontFamily: '"Noto Sans SC", sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
    }).setOrigin(0, 1).setDepth(31)
    this.playerSprite = this.add
      .image(this.player.x, this.player.y, 'qingshi-actors', 0)
      .setDisplaySize(84, 84)
      .setDepth(4)
    this.spellPresentationSprite = this.add
      .image(this.player.x, this.player.y, 'artifact-combat-effects', 28)
      .setDisplaySize(112, 112)
      .setDepth(5)
      .setVisible(false)
    this.spiritNodeLabels = this.terrainLayout.spiritNodes.map((node) => this.add.text(node.x, node.y + 36, '灵脉石坛', {
      color: '#d6d3d1',
      fontFamily: '"Noto Sans SC", sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      stroke: '#07130d',
      strokeThickness: 4,
    }).setOrigin(0.5, 0).setDepth(5).setVisible(false))
    this.cameras.main.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE)
    this.resizeViewport(this.viewportWidth, this.viewportHeight)
    this.updateDiscoveredLandmarks()
    this.updateHudText()
    this.renderBattlefield()
    this.reportRuntimeOutput({
      type: 'initial-artifact-selection-requested',
      candidates: this.initialArtifactSelection.candidates,
    })
  }

  update(_time: number, deltaMs: number) {
    if (this.paused || this.ended || this.awaitingInitialArtifact) {
      return
    }

    const stepMs = Math.min(deltaMs, 50)
    this.presentationElapsedMs += stepMs
    const previousPhase = this.progress.phase
    this.progress = advanceRunProgress(this.progress, stepMs * this.elapsedTimeScale)
    this.syncMusicStage()
    if (!this.practiceMode) {
      this.demonLair = updateDemonLairTrigger(this.demonLair, this.progress.elapsedMs)
      this.lingquanEvent = updateLingquanTrigger(this.lingquanEvent, this.progress.elapsedMs)
    }
    if (previousPhase === 'growth' && this.progress.phase === 'boss') {
      this.startBossEncounter()
    }
    this.movePlayer(stepMs)
    this.advanceBattlefieldEvents(stepMs)
    if (this.paused) {
      this.updateCamera()
      this.renderBattlefield()
      return
    }
    this.updateEnemies(stepMs)
    this.updateEnemyProjectiles(stepMs)
    if (this.player.health <= 0) {
      this.finishRun('defeat')
      this.renderBattlefield()
      return
    }
    this.collectSpirits(stepMs)
    if (this.paused) {
      this.updateCamera()
      this.renderBattlefield()
      return
    }
    this.updateArtifactAttacks(stepMs)
    if (!this.paused) {
      this.updateBoss(stepMs)
    }
    if (this.player.health <= 0) {
      this.finishRun('defeat')
      this.renderBattlefield()
      return
    }

    this.spawnElapsedMs += stepMs
    this.spellCooldownMs = Math.max(0, this.spellCooldownMs - stepMs)
    const shieldWasActive = this.shieldRemainingMs > 0
    const damageState = advancePlayerDamageState({
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      hitProtectionRemainingMs: this.hitProtectionRemainingMs,
      shieldRemainingMs: this.shieldRemainingMs,
    }, stepMs)
    this.shieldRemainingMs = damageState.shieldRemainingMs
    if (shieldWasActive && this.shieldRemainingMs === 0) {
      this.spellEndVisualRemainingMs = 360
      this.emitAudio('spell-end')
    }
    this.hitProtectionRemainingMs = damageState.hitProtectionRemainingMs
    this.bossAttackAvoidanceWindowMs = Math.max(0, this.bossAttackAvoidanceWindowMs - stepMs)
    this.bossImpactRemainingMs = Math.max(0, this.bossImpactRemainingMs - stepMs)
    this.playerHitFlashMs = Math.max(0, this.playerHitFlashMs - stepMs)
    this.playerHitSparkMs = Math.max(0, this.playerHitSparkMs - stepMs)
    this.playerCastPoseMs = Math.max(0, this.playerCastPoseMs - stepMs)
    this.playerStopBounceRemainingMs = Math.max(0, this.playerStopBounceRemainingMs - stepMs)
    this.spellCastVisualRemainingMs = Math.max(0, this.spellCastVisualRemainingMs - stepMs)
    this.spellEndVisualRemainingMs = Math.max(0, this.spellEndVisualRemainingMs - stepMs)
    this.spellImpactPulseRemainingMs = Math.max(0, this.spellImpactPulseRemainingMs - stepMs)
    this.pickupRadiusBoostRemainingMs = Math.max(0, this.pickupRadiusBoostRemainingMs - stepMs)
    this.hitAudioCooldownMs = Math.max(0, this.hitAudioCooldownMs - stepMs)
    this.advanceCombatBursts(stepMs)
    this.arrayPulseRemainingMs = Math.max(0, this.arrayPulseRemainingMs - stepMs)
    this.hudElapsedMs += stepMs

    const isTeaching = !this.onboardingSkipped && this.progress.elapsedMs < 60_000
    const waveStage = getDemonWaveStage(this.progress.elapsedMs)
    const spawnDirective = getWaveSpawnDirective(this.progress.elapsedMs, this.spawnOrdinal)
    const densityMultiplier = isTeaching ? 1 : spawnDirective.intervalMultiplier
    const spawnIntervalMs = waveStage.spawnIntervalMs * densityMultiplier * (isTeaching ? 1.4 : 1)
    const enemyLimit = isTeaching ? Math.min(14, waveStage.activeEnemyTarget) : waveStage.activeEnemyTarget
    if (this.progress.phase === 'growth' && this.isEliteSpawnDue()) {
      this.spawnEnemy(undefined, true)
    }
    if (this.progress.phase === 'growth' && this.spawnElapsedMs >= spawnIntervalMs && this.enemies.length < enemyLimit) {
      this.spawnElapsedMs = 0
      const burstCount = isTeaching ? 1 : spawnDirective.burstCount
      for (let index = 0; index < burstCount && this.enemies.length < enemyLimit; index += 1) {
        const directive = getWaveSpawnDirective(this.progress.elapsedMs, this.spawnOrdinal)
        this.spawnEnemy(directive.enemyId)
        this.spawnOrdinal += 1
      }
    }

    this.updateProjectiles(stepMs)
    this.updateCamera()

    if (this.hudElapsedMs >= HUD_INTERVAL_MS) {
      this.hudElapsedMs = 0
      this.updateHudText()
    }

    if (this.player.health <= 0) {
      this.finishRun('defeat')
    }

    this.renderBattlefield()
  }

  setInputIntent(intent: InputIntent) {
    if (this.paused || this.ended || this.awaitingInitialArtifact) {
      this.inputIntent = createInputIntent()
      return
    }

    this.inputIntent = createInputIntent({ moveX: intent.moveX, moveY: intent.moveY })
  }

  castSpell() {
    if (this.paused || this.ended || this.awaitingInitialArtifact) {
      return
    }

    this.castProtectiveSpell()
  }

  selectInitialArtifact(artifactId: BaseArtifactId) {
    if (!this.awaitingInitialArtifact) {
      return
    }

    const selection = selectInitialArtifact(this.initialArtifactSelection, artifactId)
    this.inventory = createArtifactInventory(selection.selected.id)
    this.awaitingInitialArtifact = false
    this.emitAudio('ui-confirm')
    if (this.practiceMode) {
      this.progress = advanceRunProgress(this.progress, GROWTH_PHASE_DURATION_MS)
      this.startBossEncounter()
      this.updateHudText()
      return
    }
    for (let index = 0; index < 3; index += 1) {
      this.spawnEnemy()
    }
    this.updateHudText()
  }

  selectUpgrade(choiceId: string) {
    if (!this.awaitingUpgradeSelection) {
      return
    }

    if (this.isZhouTianActive) {
      try {
        const result = applyZhouTianChoice(this.zhouTianState, choiceId as ZhouTianOptionId)
        this.zhouTianState = result.nextState
        this.playerDamageMultiplier += result.damageMultiplierDelta
        this.attackIntervalMultiplier = Math.max(
          0.5,
          this.attackIntervalMultiplier + result.attackIntervalMultiplierDelta,
        )
        if (result.maxHealthMultiplierDelta > 0) {
          this.playerMaxHealthMultiplier += result.maxHealthMultiplierDelta
          const newMax = Math.round(100 * this.playerMaxHealthMultiplier)
          const bonus = newMax - this.player.maxHealth
          this.player.maxHealth = newMax
          this.player.health = Math.min(this.player.maxHealth, this.player.health + bonus)
        }
      } catch {
        return
      }

      this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1)
      this.awaitingUpgradeSelection = false
      this.emitAudio('ui-confirm')
      this.updateHudText()

      if (this.pendingLevelUps > 0) {
        this.triggerNextUpgradeIfAvailable()
      }
      return
    }

    const choice = this.upgradeChoices.find((c) => c.choiceId === choiceId)
    if (!choice) {
      return
    }

    if (choice.type === 'flex') {
      const result = applyFlexibleUpgradeChoice(this.upgradeDraftState, choice.choiceId)
      this.upgradeDraftState = result.nextState
      this.playerDamageMultiplier += result.damageMultiplierDelta
      this.attackIntervalMultiplier = Math.max(
        0.5,
        this.attackIntervalMultiplier + result.attackIntervalMultiplierDelta,
      )
      if (result.maxHealthMultiplierDelta > 0) {
        this.playerMaxHealthMultiplier += result.maxHealthMultiplierDelta
        const newMax = Math.round(100 * this.playerMaxHealthMultiplier)
        const bonus = newMax - this.player.maxHealth
        this.player.maxHealth = newMax
        this.player.health = Math.min(this.player.maxHealth, this.player.health + bonus)
      }
    } else {
      this.inventory = applyUpgradeChoice(this.inventory, choice.artifactId)
    }
    this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1)
    this.awaitingUpgradeSelection = false
    this.upgradeChoices = []
    this.emitAudio('ui-confirm')

    this.updateHudText()

    if (this.pendingLevelUps > 0) {
      this.triggerNextUpgradeIfAvailable()
    } else {
      const ascensionChoices = getAvailableAscensionChoices(this.inventory)
      this.ascensionChoices = ascensionChoices
      if (ascensionChoices.length > 0) {
        this.beginAscensionSelection(ascensionChoices)
      }
    }
  }

  deduceUpgrade() {
    if (!this.awaitingUpgradeSelection || this.isZhouTianActive) {
      return
    }

    if (!canPerformDeduction(
      this.deductionState,
      this.upgradeChoices,
      this.inventory,
      this.upgradeDraftState,
    )) {
      return
    }

    const result = performDeduction(
      this.deductionState,
      this.upgradeChoices,
      this.inventory,
      this.upgradeDraftState,
    )
    this.deductionState = result.nextState
    this.upgradeDraftState = result.nextDraftState
    this.upgradeChoices = result.newChoices
    this.reportRuntimeOutput({
      type: 'upgrade-requested',
      choices: this.upgradeChoices,
      deductionCount: this.deductionState.remainingCount,
      canDeduce: canPerformDeduction(
        this.deductionState,
        this.upgradeChoices,
        this.inventory,
        this.upgradeDraftState,
      ),
      isZhouTian: false,
    })
  }

  tunaHeal() {
    if (!this.awaitingUpgradeSelection && !this.awaitingAscensionSelection) {
      return
    }

    const heal = calculateTunaHeal(this.player.maxHealth)
    this.player.health = Math.min(this.player.maxHealth, this.player.health + heal)

    this.awaitingUpgradeSelection = false
    this.awaitingAscensionSelection = false
    this.upgradeChoices = []
    this.ascensionChoices = []
    this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1)

    this.emitAudio('ui-back')
    this.updateHudText()
    if (this.pendingLevelUps > 0) {
      this.triggerNextUpgradeIfAvailable()
    }
  }

  selectAscension(choiceId: string) {
    if (!this.awaitingAscensionSelection) {
      return
    }

    const choice = this.ascensionChoices.find((candidate) => candidate.choiceId === choiceId)
    if (!choice) {
      return
    }

    this.inventory = applyAscensionChoice(this.inventory, choiceId)
    this.emitAudio('artifact-ascended')
    this.awaitingAscensionSelection = false
    this.ascensionChoices = []
    this.updateHudText()

    const nextAscensions = getAvailableAscensionChoices(this.inventory)
    if (nextAscensions.length > 0) {
      this.beginAscensionSelection(nextAscensions)
    }
  }

  skipAscension() {
    if (!this.awaitingAscensionSelection) {
      return
    }

    this.awaitingAscensionSelection = false
    this.ascensionChoices = []
    this.emitAudio('ui-back')
  }

  skipOnboarding() {
    this.onboardingSkipped = true
  }

  setPaused(paused: boolean) {
    this.paused = paused
    if (paused) {
      this.inputIntent = createInputIntent()
    }
  }

  resizeViewport(width: number, height: number) {
    this.viewportWidth = width
    this.viewportHeight = height
    if (!this.cameras?.main) {
      return
    }
    const camera = computeCombatCamera({ viewportWidth: width, viewportHeight: height, worldSize: WORLD_SIZE })
    this.cameraZoom = camera.zoom
    this.cameras.main.setSize(width * this.renderScale, height * this.renderScale)
    this.cameras.main.setZoom(this.cameraZoom * this.renderScale)
    this.updateCamera()
  }

  setCompactRadar(compact: boolean) {
    this.compactRadar = compact
  }

  setReducedMotion(reducedMotion: boolean) {
    this.reducedMotion = reducedMotion
  }

  private nextRandom() {
    this.randomState = (1664525 * this.randomState + 1013904223) >>> 0
    return this.randomState / 0x1_0000_0000
  }

  private randomBetween(min: number, max: number) {
    return min + (max - min) * this.nextRandom()
  }

  private startBossEncounter() {
    this.recallEnemiesForBossTransition()
    this.projectiles = []
    this.enemyProjectiles = []
    this.thunderEffects = []
    const angle = this.randomBetween(0, Math.PI * 2)
    const distance = 180
    this.boss = createWolfKingEncounter()
    this.bossReachedEnraged = false
    this.bossStartedPresentationElapsedMs = this.presentationElapsedMs
    this.bossSpatial = {
      kind: 'boss',
      x: Phaser.Math.Clamp(this.player.x + Math.cos(angle) * distance, 80, WORLD_SIZE - 80),
      y: Phaser.Math.Clamp(this.player.y + Math.sin(angle) * distance, 80, WORLD_SIZE - 80),
      radius: 38,
      chargeDirectionX: 0,
      chargeDirectionY: 0,
      sprite: this.add
        .image(this.player.x, this.player.y, 'qingshi-combat-actors', 4)
        .setDisplaySize(172, 172)
        .setDepth(4),
    }
    this.bossSpatial.sprite.setPosition(this.bossSpatial.x, this.bossSpatial.y)
    this.bossHowlRemainingMs = 0
    this.bossHowlElapsedMs = 0
    this.bossHowlDirectionX = 0
    this.bossHowlDirectionY = 1
    this.bossHowlResolved = true
    this.bossBreachRemainingMs = 0
    this.bossAttack = 'none'
    this.bossAttackAvoidanceWindowMs = 0
    this.bossAttackResolved = false
    this.bossImpactRemainingMs = 0
    this.reportRuntimeOutput({
      type: 'effect',
      effect: { type: 'audio', intent: { type: 'music', stage: 'boss' } },
    })
    this.emitAudio('boss-arrival')
    this.updateHudText()
  }

  private recallEnemiesForBossTransition() {
    for (const enemy of this.enemies) {
      this.releaseEnemySprite(enemy.sprite)
    }
    this.enemies = []
  }

  private updateBoss(stepMs: number) {
    if (!this.boss || !this.bossSpatial || this.boss.phase === 'defeated') {
      return
    }

    const howlWasActive = this.bossHowlRemainingMs > 0
    this.bossHowlRemainingMs = Math.max(0, this.bossHowlRemainingMs - stepMs)
    if (howlWasActive) {
      this.bossHowlElapsedMs = Math.min(WOLF_KING_HOWL_DURATION_MS, this.bossHowlElapsedMs + stepMs)
    }
    const result = advanceWolfKingEncounter(this.boss, stepMs)
    this.boss = result.encounter
    this.bossReachedEnraged = this.bossReachedEnraged || this.boss.phase === 'enraged'
    this.bossAttack = this.boss.attack
    this.bossBreachRemainingMs = this.boss.breachRemainingMs
    this.handleWolfKingEvents(result.events)
    if (this.ended || !this.boss || this.boss.phase === 'arrival' || this.boss.phase === 'defeated') {
      return
    }

    const distance = Phaser.Math.Distance.Between(
      this.bossSpatial.x,
      this.bossSpatial.y,
      this.player.x,
      this.player.y,
    )
    const directionX = (this.player.x - this.bossSpatial.x) / Math.max(distance, 1)
    const directionY = (this.player.y - this.bossSpatial.y) / Math.max(distance, 1)
    const isHeavyAttack = this.boss.attack === 'charge' || this.boss.attack === 'assault'
    const speed = isHeavyAttack
      ? (this.boss.attack === 'assault' ? WOLF_KING_ENRAGED_SPEED * 3.4 : WOLF_KING_COMBAT_SPEED * 4.6)
      : this.boss.phase === 'enraged' ? WOLF_KING_ENRAGED_SPEED : WOLF_KING_COMBAT_SPEED
    const moveDirectionX = isHeavyAttack ? this.bossSpatial.chargeDirectionX : directionX
    const moveDirectionY = isHeavyAttack ? this.bossSpatial.chargeDirectionY : directionY
    const canMove = this.boss.attack !== 'charge-warning' && this.boss.attack !== 'assault-warning'
    this.bossSpatial.x = Phaser.Math.Clamp(
      this.bossSpatial.x + (canMove ? moveDirectionX * speed * (stepMs / 1_000) : 0),
      60,
      WORLD_SIZE - 60,
    )
    this.bossSpatial.y = Phaser.Math.Clamp(
      this.bossSpatial.y + (canMove ? moveDirectionY * speed * (stepMs / 1_000) : 0),
      60,
      WORLD_SIZE - 60,
    )

    if (!isHeavyAttack && this.boss.attack === 'none' && distance < this.bossSpatial.radius + 24) {
      this.receivePlayerDamage(
        this.player.health - WOLF_KING_CONTACT_DAMAGE_PER_SECOND * (stepMs / 1_000),
        'wolf-king-contact',
      )
    }

    if (howlWasActive && this.bossHowlRemainingMs === 0 && !this.bossHowlResolved) {
      this.resolveBossHowl()
    }
  }

  private handleWolfKingEvents(events: readonly WolfKingEvent[]) {
    for (const event of events) {
      if (event.type === 'enraged') {
        this.emitAudio('boss-enraged')
        this.bossImpactRemainingMs = 120
        if (this.bossSpatial) {
          this.spawnCombatBurst('breach', this.bossSpatial.x, this.bossSpatial.y, 0xef4444, 720, 96)
        }
      } else if (event.type === 'summon-requested') {
        for (let index = 0; index < event.count; index += 1) {
          this.spawnWolfKingMinion()
        }
      } else if (event.type === 'moon-howl') {
        this.emitAudio('boss-howl')
        this.bossHowlRemainingMs = WOLF_KING_HOWL_DURATION_MS
        this.bossHowlElapsedMs = 0
        this.bossHowlResolved = false
        if (this.bossSpatial) {
          const distance = Phaser.Math.Distance.Between(this.bossSpatial.x, this.bossSpatial.y, this.player.x, this.player.y)
          this.bossHowlDirectionX = (this.player.x - this.bossSpatial.x) / Math.max(distance, 1)
          this.bossHowlDirectionY = (this.player.y - this.bossSpatial.y) / Math.max(distance, 1)
        }
      } else if (event.type === 'charge-warning' || event.type === 'moon-shadow-assault-warning') {
        if (this.bossSpatial) {
          const distance = Phaser.Math.Distance.Between(this.bossSpatial.x, this.bossSpatial.y, this.player.x, this.player.y)
          this.bossSpatial.chargeDirectionX = (this.player.x - this.bossSpatial.x) / Math.max(distance, 1)
          this.bossSpatial.chargeDirectionY = (this.player.y - this.bossSpatial.y) / Math.max(distance, 1)
        }
        this.bossAttackAvoidanceWindowMs = this.boss?.attackRemainingMs ?? 900
        this.bossAttackResolved = false
        this.emitAudio('boss-charge-warning')
      } else if (event.type === 'charge-started' || event.type === 'moon-shadow-assault') {
        this.emitAudio('boss-charge-start')
        this.bossImpactRemainingMs = 120
        if (this.bossSpatial) {
          this.spawnCombatBurst('dust', this.bossSpatial.x, this.bossSpatial.y, 0xfda4af, 240, 52)
        }
        if (event.type === 'moon-shadow-assault') {
          for (let index = 0; index < 3; index += 1) {
            this.spawnWolfKingMinion()
          }
        }
      } else if (event.type === 'charge-resolved') {
        this.resolveBossHeavyPass(true)
      } else if (event.type === 'moon-shadow-assault-pass-resolved') {
        this.resolveBossHeavyPass(false)
      } else if (event.type === 'moon-shadow-assault-rebound-warning') {
        if (this.bossSpatial) {
          this.bossSpatial.chargeDirectionX *= -1
          this.bossSpatial.chargeDirectionY *= -1
        }
        this.bossAttackAvoidanceWindowMs = this.boss?.attackRemainingMs ?? 360
        this.bossAttackResolved = false
        this.emitAudio('boss-charge-warning')
      } else if (event.type === 'defeated') {
        this.emitAudio('boss-defeated')
        if (this.bossSpatial) {
          this.spawnCombatBurst('death', this.bossSpatial.x, this.bossSpatial.y, 0xc084fc, 520, 110)
        }
        this.finishRun('victory')
      }
    }
  }

  private resolveBossHeavyPass(openBreach: boolean) {
    const boss = this.bossSpatial
    const distance = boss
      ? Phaser.Math.Distance.Between(boss.x, boss.y, this.player.x, this.player.y)
      : Number.POSITIVE_INFINITY
    const avoided = distance > (boss?.radius ?? 38) + 34
    if (boss && !avoided) {
      this.receivePlayerDamage(
        this.player.health - (this.boss?.phase === 'enraged' ? 32 : 24),
        'wolf-king-contact',
        true,
      )
    }
    if (!openBreach || this.bossAttackResolved || !this.boss) {
      return
    }
    const result = resolveWolfKingAttack(this.boss, avoided)
    this.boss = result.encounter
    this.bossBreachRemainingMs = this.boss.breachRemainingMs
    this.bossAttackResolved = true
    if (result.events.some((candidate) => candidate.type === 'breach-opened')) {
      this.emitAudio('boss-breach')
      this.bossImpactRemainingMs = 120
      if (this.bossSpatial) {
        this.spawnCombatBurst('breach', this.bossSpatial.x, this.bossSpatial.y, 0xfef08a, 420, 78)
      }
    }
  }

  private resolveBossHowl() {
    this.bossHowlResolved = true
    const boss = this.bossSpatial
    if (!boss) {
      return
    }
    const distance = Phaser.Math.Distance.Between(boss.x, boss.y, this.player.x, this.player.y)
    const playerAngle = Math.atan2(this.player.y - boss.y, this.player.x - boss.x)
    const waveAngle = Math.atan2(this.bossHowlDirectionY, this.bossHowlDirectionX)
    const angularDistance = Math.abs(Math.atan2(Math.sin(playerAngle - waveAngle), Math.cos(playerAngle - waveAngle)))
    // A narrow mint-coloured sector is the safe gap; the rest of the
    // expanding wave is a boss-heavy hit and bypasses ordinary protection.
    if (isWolfKingHowlHit(distance, angularDistance)) {
      this.receivePlayerDamage(this.player.health - WOLF_KING_HOWL_DAMAGE, 'moon-howl', true)
    }
  }

  private spawnWolfKingMinion() {
    if (!this.bossSpatial || this.enemies.length >= 18) {
      return
    }

    const moonShadowCount = this.enemies.filter((enemy) => enemy.isMoonShadow).length
    if (moonShadowCount >= WOLF_KING_MOON_SHADOW_LIMIT) {
      return
    }

    const angle = this.randomBetween(0, Math.PI * 2)
    const distance = this.randomBetween(90, 150)
    const enraged = this.boss?.phase === 'enraged'
    const stats = createWolfKingMinionStats(enraged)
    this.enemies.push({
      kind: 'enemy',
      x: Phaser.Math.Clamp(this.bossSpatial.x + Math.cos(angle) * distance, 36, WORLD_SIZE - 36),
      y: Phaser.Math.Clamp(this.bossSpatial.y + Math.sin(angle) * distance, 36, WORLD_SIZE - 36),
      ...stats,
      maxHealth: stats.health,
      isElite: false,
      role: 'pursuer-flanker',
      behavior: createEnemyBehaviorState(),
      chargeDirectionX: 0,
      chargeDirectionY: 0,
      flankDirection: this.nextRandom() < 0.5 ? -1 : 1,
      vulnerableMultiplier: 1,
      hitFlashMs: 0,
      isLairGuard: false,
      isMoonShadow: true,
      lifetimeRemainingMs: 24_000,
      attackVisualRemainingMs: 0,
      sprite: this.createEnemySprite('xiaoyue-wolf-king-moon-shadow', this.bossSpatial.x, this.bossSpatial.y, stats.radius),
    })
  }

  private finishRun(result: RunResult) {
    if (this.ended) {
      return
    }

    this.ended = true
    this.playerDowned = result === 'defeat'
    this.progress = endRun(this.progress)
    this.inputIntent = createInputIntent()
    this.reportRuntimeOutput({ type: 'run-ending', result, source: this.finalDamageSource })
    const bossElapsedMs = this.bossStartedPresentationElapsedMs === null
      ? null
      : Math.max(0, this.presentationElapsedMs - this.bossStartedPresentationElapsedMs)
    const summary = createRunSummary({
      result,
      elapsedMs: calculateRunElapsedMs(this.progress.elapsedMs, bossElapsedMs),
      defeatedEnemies: this.defeatedEnemies,
      defeatedElites: this.defeatedElites,
      bossElapsedMs,
      bossReachedEnraged: this.bossReachedEnraged,
      completedEvents: [
        ...(this.demonLair.phase === 'completed' ? ['demon-lair' as const] : []),
        ...(this.lingquanEvent.phase === 'completed' ? ['lingquan' as const] : []),
      ] satisfies readonly RunEventId[],
      artifacts: this.inventory.slots.map((slot) => ({
        id: slot.id,
        name: ARTIFACT_DEFINITIONS[slot.id].name,
        level: slot.level,
      })),
      finalDamageSource: this.finalDamageSource,
      practiceMode: this.practiceMode,
    })
    this.time.delayedCall(RESULT_FREEZE_MS, () => {
      this.reportRuntimeOutput({ type: 'run-ended', summary })
    })
  }

  private movePlayer(stepMs: number) {
    let speedMultiplier = 1.0
    for (const slot of this.inventory.slots) {
      const stats = getArtifactStats(slot.id, slot.level)
      if (stats.moveSpeedMultiplier > speedMultiplier) {
        speedMultiplier = stats.moveSpeedMultiplier
      }
    }

    const previousX = this.player.x
    const previousY = this.player.y
    const distance = PLAYER_SPEED * speedMultiplier * (stepMs / 1_000)
    const moving = this.inputIntent.moveX !== 0 || this.inputIntent.moveY !== 0
    if (moving) {
      this.playerFacingX = this.inputIntent.moveX
      this.playerFacingY = this.inputIntent.moveY
      this.playerMotionPhase += distance * 0.18
      const stepIndex = Math.floor(this.playerMotionPhase / Math.PI)
      if (stepIndex !== this.lastPlayerStepIndex) {
        this.lastPlayerStepIndex = stepIndex
        this.emitAudio('player-step')
      }
    } else if (this.wasPlayerMoving) {
      this.playerStopBounceRemainingMs = 180
    }
    this.wasPlayerMoving = moving
    this.player.x = Phaser.Math.Clamp(this.player.x + this.inputIntent.moveX * distance, 28, WORLD_SIZE - 28)
    this.player.y = Phaser.Math.Clamp(this.player.y + this.inputIntent.moveY * distance, 28, WORLD_SIZE - 28)
    this.distanceTravelled += Phaser.Math.Distance.Between(previousX, previousY, this.player.x, this.player.y)
    this.updateDiscoveredLandmarks()
    if (this.inputIntent.moveX !== 0 || this.inputIntent.moveY !== 0) {
      this.completeOnboardingStep('move')
    }
  }

  private updateDiscoveredLandmarks() {
    const village = this.terrainLayout.village
    const villageCenter = { x: village.x + village.width / 2, y: village.y + village.height / 2 }
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, villageCenter.x, villageCenter.y) <= 360) {
      this.discoveredLandmarkIds.add('abandoned-village')
    }
    this.terrainLayout.spiritNodes.forEach((node, index) => {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, node.x, node.y) <= 260) {
        this.discoveredLandmarkIds.add(`spirit-node-${index}`)
        this.spiritNodeLabels[index]?.setVisible(true)
      }
    })
  }

  private advanceBattlefieldEvents(stepMs: number) {
    if (this.practiceMode) {
      return
    }

    if (this.demonLair.phase === 'travel' && !this.seenBattlefieldEvents.has('demon-lair')) {
      this.seenBattlefieldEvents.add('demon-lair')
      const copy = BATTLEFIELD_EVENT_COPY['demon-lair']
      this.reportRuntimeOutput({
        type: 'battlefield-event-requested',
        event: {
          kind: 'demon-lair',
          phase: 'travel',
          name: copy.name,
          objective: copy.objectives.report,
          remainingMs: this.demonLair.travelRemainingMs,
          reward: copy.reward,
        },
        firstEncounter: !this.deterministicAcceptance,
      })
      return
    }

    if (this.lingquanEvent.phase === 'available' && !this.seenBattlefieldEvents.has('lingquan')) {
      this.seenBattlefieldEvents.add('lingquan')
      const copy = BATTLEFIELD_EVENT_COPY.lingquan
      this.reportRuntimeOutput({
        type: 'battlefield-event-requested',
        event: {
          kind: 'lingquan',
          phase: 'available',
          name: copy.name,
          objective: copy.objectives.report,
          remainingMs: this.lingquanEvent.travelRemainingMs,
          reward: copy.reward,
        },
        firstEncounter: !this.deterministicAcceptance,
      })
      return
    }

    const lairAtPlayer = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.demonLair.x,
      this.demonLair.y,
    ) <= this.demonLair.radius + 72
    const lairResult = advanceDemonLairEvent(this.demonLair, stepMs, lairAtPlayer)
    this.demonLair = lairResult.nextState
    if (lairResult.justStarted) {
      this.spawnDemonLairGuard()
      this.emitAudio('event-alert')
    } else if (lairResult.justExpired) {
      this.removeDemonLairGuard()
    }

    const node = this.terrainLayout.spiritNodes[this.lingquanEvent.nodeIndex]
    const insideFountain = node
      ? Phaser.Math.Distance.Between(this.player.x, this.player.y, node.x, node.y) <= node.radius + 54
      : false
    const fountainResult = advanceLingquanEvent(this.lingquanEvent, {
      deltaMs: stepMs,
      withinGuideArea: insideFountain,
    })
    this.lingquanEvent = fountainResult.nextState
    if (fountainResult.justCompleted) {
      const heal = Math.round(this.player.maxHealth * this.lingquanEvent.healRatio)
      this.player.health = Math.min(this.player.maxHealth, this.player.health + heal)
      this.pickupRadiusBoostRemainingMs = this.lingquanEvent.pickupRadiusDurationMs
      this.emitAudio('lingquan-complete')
    }
  }

  private isEliteSpawnDue() {
    return shouldSpawnElite({
      elapsedMs: this.progress.elapsedMs,
      lastEliteSpawnMs: this.lastEliteSpawnMs,
      activeEliteCount: this.enemies.filter((enemy) => enemy.isElite).length,
    })
  }

  private spawnEnemy(commonEnemyId?: QingShiRidgeEnemyId, forceElite = false) {
    const cam = this.cameras.main
    const cameraWorld = {
      x: cam.worldView.x,
      y: cam.worldView.y,
      width: cam.worldView.width || 800,
      height: cam.worldView.height || 600,
    }

    let spawnPos = getOffscreenSpawnPosition(cameraWorld, WORLD_SIZE, 80, () => this.nextRandom())
    const spawnElite = forceElite || this.isEliteSpawnDue()
    const waveStage = getDemonWaveStage(this.progress.elapsedMs)
    const enemyId: QingShiRidgeEnemyId = spawnElite
      ? 'qing-shi-ridge-elite-wolf'
      : commonEnemyId ?? chooseCommonEnemyForWave(waveStage.index, this.nextRandom())
    if (spawnElite) {
      this.lastEliteSpawnMs = this.progress.elapsedMs
      if (this.deterministicAcceptance) {
        spawnPos = {
          x: Phaser.Math.Clamp(this.player.x + 120, 36, WORLD_SIZE - 36),
          y: this.player.y,
        }
      }
    }

    const stats = createEnemyStats(enemyId)
    this.enemies.push({
      kind: 'enemy',
      x: spawnPos.x,
      y: spawnPos.y,
      ...stats,
      maxHealth: stats.health,
      isElite: stats.isElite ?? false,
      behavior: createEnemyBehaviorState(),
      chargeDirectionX: 0,
      chargeDirectionY: 0,
      flankDirection: this.nextRandom() < 0.5 ? -1 : 1,
      vulnerableMultiplier: 1,
      hitFlashMs: 0,
      isLairGuard: false,
      isMoonShadow: false,
      lifetimeRemainingMs: null,
      attackVisualRemainingMs: 0,
      sprite: this.createEnemySprite(enemyId, spawnPos.x, spawnPos.y, stats.radius),
    })
  }

  private spawnDemonLairGuard() {
    if (this.enemies.some((enemy) => enemy.isLairGuard)) {
      return
    }

    const stats = createEnemyStats('qing-shi-ridge-elite-wolf')
    this.enemies.push({
      kind: 'enemy',
      x: Phaser.Math.Clamp(this.demonLair.x + 88, 36, WORLD_SIZE - 36),
      y: Phaser.Math.Clamp(this.demonLair.y, 36, WORLD_SIZE - 36),
      ...stats,
      maxHealth: stats.health,
      isElite: true,
      role: 'elite-pouncer',
      behavior: createEnemyBehaviorState(),
      chargeDirectionX: 0,
      chargeDirectionY: 0,
      flankDirection: 1,
      vulnerableMultiplier: 1,
      hitFlashMs: 0,
      isLairGuard: true,
      isMoonShadow: false,
      lifetimeRemainingMs: null,
      attackVisualRemainingMs: 0,
      sprite: this.createEnemySprite(stats.id, this.demonLair.x + 88, this.demonLair.y, stats.radius),
    })
  }

  private removeDemonLairGuard() {
    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index]
      if (!enemy?.isLairGuard) {
        continue
      }
      this.releaseEnemySprite(enemy.sprite)
      this.enemies.splice(index, 1)
    }
  }

  private checkDemonLairHit(x: number, y: number, range: number, damage: number) {
    if (!this.demonLair.active || this.demonLair.destroyed || this.demonLair.phase !== 'battle') {
      return
    }

    const distance = Phaser.Math.Distance.Between(x, y, this.demonLair.x, this.demonLair.y)
    if (distance <= range + this.demonLair.radius) {
      const result = damageDemonLair(this.demonLair, damage)
      this.demonLair = result.nextState
      if (result.justDestroyed) {
        for (let i = 0; i < 40; i++) {
          const angle = this.randomBetween(0, Math.PI * 2)
          const dist = this.randomBetween(10, 90)
          this.spirits.push({
            x: Phaser.Math.Clamp(this.demonLair.x + Math.cos(angle) * dist, 40, WORLD_SIZE - 40),
            y: Phaser.Math.Clamp(this.demonLair.y + Math.sin(angle) * dist, 40, WORLD_SIZE - 40),
            value: 1,
          })
        }
        this.deductionState = createDeductionState(this.deductionState.remainingCount + result.bonusDeduction)
        this.emitAudio('lair-destroyed')
        if (this.demonLair.guardEliteDefeated) {
          this.demonLair = { ...this.demonLair, phase: 'completed' }
          this.emitAudio('event-complete')
        }
      }
    }
  }

  private updateEnemies(stepMs: number) {
    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index]
      if (!enemy || enemy.lifetimeRemainingMs === null) {
        continue
      }
      enemy.lifetimeRemainingMs -= stepMs
      if (enemy.lifetimeRemainingMs <= 0) {
        this.releaseEnemySprite(enemy.sprite)
        this.enemies.splice(index, 1)
      }
    }

    let pressure = 0
    for (const enemy of this.enemies) {
      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y)
      const previousAction = enemy.behavior.action
      const behavior = advanceEnemyBehavior(enemy.role, enemy.behavior, {
        deltaMs: stepMs,
        distanceToPlayer: distance,
      })
      enemy.behavior = behavior.nextState
      enemy.vulnerableMultiplier = behavior.vulnerableMultiplier
      enemy.hitFlashMs = Math.max(0, enemy.hitFlashMs - stepMs)
      enemy.attackVisualRemainingMs = Math.max(0, enemy.attackVisualRemainingMs - stepMs)

      if (previousAction === 'approach' && enemy.behavior.action === 'windup') {
        enemy.chargeDirectionX = (this.player.x - enemy.x) / Math.max(distance, 1)
        enemy.chargeDirectionY = (this.player.y - enemy.y) / Math.max(distance, 1)
        this.emitAudio(enemy.isElite ? 'elite-warning' : 'boar-charge')
      }
      if (previousAction === 'windup' && enemy.behavior.action === 'charge') {
        enemy.attackVisualRemainingMs = 260
        this.spawnCombatBurst('dust', enemy.x, enemy.y + enemy.radius * 0.6, enemy.color, 220, enemy.radius * 1.5)
      }
      const mistBudget = getMistProjectileBudget(this.progress.elapsedMs)
      if (behavior.shouldFireProjectile && this.enemyProjectiles.length < mistBudget.attackSeats) {
        this.fireMistProjectile(enemy)
      }

      let directionX = (this.player.x - enemy.x) / Math.max(distance, 1)
      let directionY = (this.player.y - enemy.y) / Math.max(distance, 1)
      if (enemy.behavior.action === 'charge') {
        directionX = enemy.chargeDirectionX
        directionY = enemy.chargeDirectionY
      } else if (enemy.role === 'pursuer-flanker' && distance > 86) {
        const flankOffset = Math.min(110, distance * 0.42) * enemy.flankDirection
        const targetX = this.player.x - directionY * flankOffset
        const targetY = this.player.y + directionX * flankOffset
        const targetDistance = Phaser.Math.Distance.Between(enemy.x, enemy.y, targetX, targetY)
        directionX = (targetX - enemy.x) / Math.max(targetDistance, 1)
        directionY = (targetY - enemy.y) / Math.max(targetDistance, 1)
      } else if (enemy.role === 'ranged-kiter') {
        if (distance < 170) {
          directionX *= -1
          directionY *= -1
        } else if (distance <= 235) {
          const tangentX = -directionY
          directionY = directionX * enemy.flankDirection
          directionX = tangentX * enemy.flankDirection
        }
      }

      const distanceStep = enemy.speed * behavior.speedMultiplier * (stepMs / 1_000)
      enemy.x = Phaser.Math.Clamp(enemy.x + directionX * distanceStep, 24, WORLD_SIZE - 24)
      enemy.y = Phaser.Math.Clamp(enemy.y + directionY * distanceStep, 24, WORLD_SIZE - 24)

      const contactDistance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y)
      if (behavior.contactEnabled && contactDistance < enemy.radius + 22) {
        if (enemy.behavior.action === 'charge') {
          enemy.behavior = { ...enemy.behavior, chargeConnected: true }
        }
        pressure += 1
      }
    }

    if (pressure > 0) {
      const pressuredByElite = this.enemies.some((enemy) => {
        if (!enemy.isElite) {
          return false
        }
        return Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y) < enemy.radius + 22
      })
      this.receivePlayerDamage(
        applyEnemyPressure(this.player.health, pressure, stepMs),
        pressuredByElite ? 'elite-enemy' : 'ordinary-enemy',
      )
    }
  }

  private fireMistProjectile(enemy: Enemy) {
    const budget = getMistProjectileBudget(this.progress.elapsedMs)
    if (this.enemyProjectiles.length >= budget.projectileCap) {
      return
    }
    const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y)
    this.enemyProjectiles.push({
      x: enemy.x,
      y: enemy.y,
      velocityX: ((this.player.x - enemy.x) / Math.max(distance, 1)) * 92,
      velocityY: ((this.player.y - enemy.y) / Math.max(distance, 1)) * 92,
      remainingMs: 3_600,
      damage: 8,
      radius: 8,
    })
    enemy.attackVisualRemainingMs = 260
    this.emitAudio('mist-shot')
  }

  private updateEnemyProjectiles(stepMs: number) {
    const alive: EnemyProjectile[] = []
    for (const projectile of this.enemyProjectiles) {
      projectile.x += projectile.velocityX * (stepMs / 1_000)
      projectile.y += projectile.velocityY * (stepMs / 1_000)
      projectile.remainingMs -= stepMs
      const hitPlayer = Phaser.Math.Distance.Between(
        projectile.x,
        projectile.y,
        this.player.x,
        this.player.y,
      ) <= projectile.radius + 18
      if (hitPlayer) {
        this.receivePlayerDamage(this.player.health - projectile.damage, 'ordinary-enemy')
        continue
      }
      if (projectile.remainingMs > 0) {
        alive.push(projectile)
      }
    }
    this.enemyProjectiles = alive
  }

  private updateArtifactAttacks(stepMs: number) {
    if (!this.reducedMotion) {
      this.arrayRotationRad += (stepMs / 1000) * 1.5
    }

    const aliveThunder: ThunderEffect[] = []
    for (const effect of this.thunderEffects) {
      effect.remainingMs -= stepMs
      if (effect.remainingMs > 0) {
        aliveThunder.push(effect)
      }
    }
    this.thunderEffects = aliveThunder

    for (const slot of this.inventory.slots) {
      const stats = getArtifactStats(slot.id, slot.level)
      const attackIntervalMs = stats.intervalMs * this.attackIntervalMultiplier

      if (slot.id === 'qing-feng-jian-xia') {
        this.swordElapsedMs += stepMs
        if (this.swordElapsedMs >= attackIntervalMs) {
          this.swordElapsedMs = 0
          this.fireFlyingSword(stats)
        }
      } else if (slot.id === 'lei-zhuan-fu-ce' || slot.id === 'jiu-xiao-lei-zhen') {
        this.thunderElapsedMs += stepMs
        if (this.thunderElapsedMs >= attackIntervalMs) {
          this.thunderElapsedMs = 0
          this.fireThunderTalisman(stats, slot.id)
        }
      } else if (slot.id === 'si-xiang-zhen-qi' || slot.id === 'zhu-xie-jian-zhen') {
        this.fourArrayElapsedMs += stepMs
        if (this.fourArrayElapsedMs >= attackIntervalMs) {
          this.fourArrayElapsedMs = 0
          this.pulseFourArray(stats, slot.id)
        }
      } else if (slot.id === 'fu-yao-yu-yi' || slot.id === 'liu-guang-jian-yi') {
        this.windBladeElapsedMs += stepMs
        if (this.windBladeElapsedMs >= attackIntervalMs) {
          this.windBladeElapsedMs = 0
          this.fireWindBlades(stats, slot.id)
        }
      }
    }
  }

  private fireFlyingSword(stats: ArtifactStats) {
    const target = this.findNearestCombatTarget()
    if (!target) {
      return
    }

    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y)
    this.projectiles.push({
      x: this.player.x,
      y: this.player.y,
      velocityX: ((target.x - this.player.x) / Math.max(distance, 1)) * 620,
      velocityY: ((target.y - this.player.y) / Math.max(distance, 1)) * 620,
      remainingMs: 720,
      color: ARTIFACT_DEFINITIONS['qing-feng-jian-xia'].attackColor,
      damage: this.getArtifactDamage(stats.damage),
      artifactId: 'qing-feng-jian-xia',
    })
    this.emitAudio('sword-cast')
    this.completeOnboardingStep('auto-attack')
  }

  private fireThunderTalisman(stats: ArtifactStats, artifactId: ArtifactId = 'lei-zhuan-fu-ce') {
    const target = this.findNearestCombatTarget()
    if (!target) {
      return
    }

    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y)
    this.projectiles.push({
      x: this.player.x,
      y: this.player.y,
      velocityX: ((target.x - this.player.x) / Math.max(distance, 1)) * 480,
      velocityY: ((target.y - this.player.y) / Math.max(distance, 1)) * 480,
      remainingMs: 600,
      color: ARTIFACT_DEFINITIONS[artifactId].attackColor,
      damage: this.getArtifactDamage(stats.damage),
      artifactId,
      aoeRadius: stats.aoeRadius,
    })
    this.emitAudio(artifactId === 'jiu-xiao-lei-zhen' ? 'sky-thunder-cast' : 'thunder-cast')
  }

  private pulseFourArray(stats: ArtifactStats, artifactId: ArtifactId = 'si-xiang-zhen-qi') {
    this.arrayPulseRemainingMs = 320
    this.arrayPulseArtifactId = artifactId
    this.emitAudio(artifactId === 'zhu-xie-jian-zhen' ? 'sword-array-cast' : 'array-pulse')
    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index]
      if (!enemy) {
        continue
      }

      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y)
      if (distance <= stats.aoeRadius + enemy.radius) {
        this.damageEnemy(index, this.getArtifactDamage(stats.damage))
      }
    }

    const boss = this.getActiveBossTarget()
    if (boss && this.isWithinTarget(boss, this.player.x, this.player.y, stats.aoeRadius)) {
      this.damageBoss(this.getArtifactDamage(stats.damage))
    }

    this.checkDemonLairHit(
      this.player.x,
      this.player.y,
      stats.aoeRadius,
      this.getArtifactDamage(stats.damage),
    )
  }

  private fireWindBlades(stats: ArtifactStats, artifactId: ArtifactId = 'fu-yao-yu-yi') {
    const directionCount = artifactId === 'liu-guang-jian-yi' ? 6 : 4
    const directions = Array.from({ length: directionCount }, (_, index) => {
      const angle = (index * Math.PI * 2) / directionCount
      return { x: Math.cos(angle), y: Math.sin(angle) }
    })

    for (const dir of directions) {
      this.projectiles.push({
        x: this.player.x,
        y: this.player.y,
        velocityX: dir.x * 520,
        velocityY: dir.y * 520,
        remainingMs: 450,
        color: ARTIFACT_DEFINITIONS[artifactId].attackColor,
        damage: this.getArtifactDamage(stats.damage),
        artifactId,
      })
    }
    this.emitAudio(artifactId === 'liu-guang-jian-yi' ? 'light-wing-cast' : 'wind-cast')
  }

  private findNearestCombatTarget(): CombatTarget | undefined {
    const worldView = this.cameras.main.worldView
    const targetingView = {
      x: worldView.x,
      y: worldView.y,
      width: worldView.width,
      height: worldView.height,
    }
    const targets: CombatTarget[] = this.enemies.filter((enemy) =>
      isInsideTargetingEnvelope(enemy, targetingView),
    )
    const boss = this.getActiveBossTarget()
    if (boss && isInsideTargetingEnvelope(boss, targetingView)) {
      targets.push(boss)
    }
    const lair = this.getActiveDemonLairTarget()
    if (lair && isInsideTargetingEnvelope(lair, targetingView)) {
      targets.push(lair)
    }

    return targets.reduce<CombatTarget | undefined>((nearest, enemy) => {
      if (!nearest) {
        return enemy
      }

      const nearestDistance = Phaser.Math.Distance.Between(nearest.x, nearest.y, this.player.x, this.player.y)
      const currentDistance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y)
      return currentDistance < nearestDistance ? enemy : nearest
    }, undefined)
  }

  private getActiveBossTarget(): BossSpatialState | undefined {
    if (!this.boss || !this.bossSpatial || (this.boss.phase !== 'combat' && this.boss.phase !== 'enraged')) {
      return undefined
    }

    return this.bossSpatial
  }

  private getActiveDemonLairTarget(): DemonLairSpatialState | undefined {
    if (!this.demonLair.active || this.demonLair.destroyed || this.demonLair.phase !== 'battle') {
      return undefined
    }
    return {
      kind: 'lair',
      x: this.demonLair.x,
      y: this.demonLair.y,
      radius: this.demonLair.radius,
    }
  }

  private isWithinTarget(target: CombatTarget, x: number, y: number, extraRadius: number): boolean {
    return Phaser.Math.Distance.Between(x, y, target.x, target.y) <= target.radius + extraRadius
  }

  private damageBoss(damage: number) {
    if (!this.boss) {
      return
    }

    const result = damageWolfKing(this.boss, damage)
    this.boss = result.encounter
    this.bossReachedEnraged = this.bossReachedEnraged || this.boss.phase === 'enraged'
    this.bossBreachRemainingMs = this.boss.breachRemainingMs
    this.handleWolfKingEvents(result.events)
  }

  private receivePlayerDamage(nextHealth: number, source: DamageSource, bypassHitProtection = false) {
    const damageKind: PlayerDamageKind = bypassHitProtection || source === 'wolf-king-contact' || source === 'moon-howl'
      ? 'boss-heavy'
      : 'ordinary'
    const result = resolvePlayerDamage(
      {
        health: this.player.health,
        maxHealth: this.player.maxHealth,
        hitProtectionRemainingMs: this.hitProtectionRemainingMs,
        shieldRemainingMs: this.shieldRemainingMs,
      },
      { nextHealth, kind: damageKind },
    )
    if (result.blockedByShield) {
      if (damageKind === 'boss-heavy' && !this.shieldBlockedFeedback) {
        this.shieldBlockedFeedback = true
        this.spellImpactPulseRemainingMs = 260
        this.emitAudio('spell-blocked')
      }
      return
    }
    if (result.blockedByProtection) {
      this.spellImpactPulseRemainingMs = 180
      this.emitAudio('hit-protected')
      return
    }
    const previousHealth = this.player.health
    const resolvedHealth = result.nextState.health
    if (resolvedHealth >= previousHealth) {
      return
    }
    this.finalDamageSource = source
    this.player.health = resolvedHealth
    this.playerHitFlashMs = 180
    this.playerHitSparkMs = 220
    this.hitProtectionRemainingMs = result.nextState.hitProtectionRemainingMs
    this.emitAudio('player-hurt')
    if (previousHealth > this.player.maxHealth * 0.3 && this.player.health <= this.player.maxHealth * 0.3) {
      this.emitAudio('player-critical')
    }
  }

  private updateProjectiles(stepMs: number) {
    const alive: Projectile[] = []
    for (const projectile of this.projectiles) {
      projectile.x += projectile.velocityX * (stepMs / 1_000)
      projectile.y += projectile.velocityY * (stepMs / 1_000)
      projectile.remainingMs -= stepMs

      if (projectile.aoeRadius && projectile.aoeRadius > 0) {
        const hitIndex = this.enemies.findIndex(
          (enemy) => Phaser.Math.Distance.Between(projectile.x, projectile.y, enemy.x, enemy.y) < enemy.radius + 12,
        )
        const boss = this.getActiveBossTarget()
        const hitBoss = boss ? this.isWithinTarget(boss, projectile.x, projectile.y, 12) : false
        const lair = this.getActiveDemonLairTarget()
        const hitLair = lair ? this.isWithinTarget(lair, projectile.x, projectile.y, 12) : false
        if (hitIndex >= 0 || hitBoss || hitLair || projectile.remainingMs <= 0) {
          this.explodeThunder(projectile.x, projectile.y, projectile.damage, projectile.aoeRadius, projectile.artifactId)
          continue
        }
      } else {
        const hitIndex = this.enemies.findIndex(
          (enemy) => Phaser.Math.Distance.Between(projectile.x, projectile.y, enemy.x, enemy.y) < enemy.radius + 8,
        )
        const boss = this.getActiveBossTarget()
        const hitBoss = boss ? this.isWithinTarget(boss, projectile.x, projectile.y, 8) : false
        const lair = this.getActiveDemonLairTarget()
        const hitLair = lair ? this.isWithinTarget(lair, projectile.x, projectile.y, 8) : false
        if (hitIndex >= 0) {
          const enemy = this.enemies[hitIndex]
          if (!enemy) {
            continue
          }

          this.damageEnemy(hitIndex, projectile.damage, projectile.x, projectile.y)
          continue
        }
        if (hitBoss) {
          this.damageBoss(projectile.damage)
          continue
        }
        if (hitLair) {
          this.checkDemonLairHit(projectile.x, projectile.y, 8, projectile.damage)
          continue
        }
      }

      if (projectile.remainingMs > 0) {
        alive.push(projectile)
      }
    }
    this.projectiles = alive
  }

  private explodeThunder(x: number, y: number, damage: number, radius: number, artifactId: ArtifactId) {
    this.thunderEffects.push({ x, y, radius, remainingMs: 250, artifactId })

    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index]
      if (!enemy) {
        continue
      }

      if (Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) <= radius + enemy.radius) {
        this.damageEnemy(index, damage, x, y)
      }
    }

    const boss = this.getActiveBossTarget()
    if (boss && this.isWithinTarget(boss, x, y, radius)) {
      this.damageBoss(damage)
    }

    this.checkDemonLairHit(x, y, radius, damage)
  }

  private collectSpirits(stepMs: number) {
    const remaining: Spirit[] = []
    const bossTransition = this.boss?.phase === 'arrival'
    for (const spirit of this.spirits) {
      let distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, spirit.x, spirit.y)
      const pickupRadius = 110 * (this.pickupRadiusBoostRemainingMs > 0 ? this.lingquanEvent.pickupRadiusMultiplier : 1)
      if (bossTransition || distance < pickupRadius) {
        const travelDistance = bossTransition
          ? Math.min(distance, 1_600 * (stepMs / 1_000))
          : Math.min(distance, stepMs * 0.32)
        spirit.x += ((this.player.x - spirit.x) / Math.max(distance, 1)) * travelDistance
        spirit.y += ((this.player.y - spirit.y) / Math.max(distance, 1)) * travelDistance
        distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, spirit.x, spirit.y)
      }

      if (distance < 24) {
        this.emitAudio('spirit-collected')
        const result = grantExperience(this.progress, spirit.value)
        this.progress = result.progress
        this.completeOnboardingStep('collect-spirit')
        if (result.levelsGained > 0) {
          this.completeOnboardingStep('level-up')
          this.handleLevelUpGained(result.levelsGained)
        }
        continue
      }

      remaining.push(spirit)
    }
    this.spirits = remaining
  }

  private handleLevelUpGained(levels: number) {
    this.pendingLevelUps += levels
    this.triggerNextUpgradeIfAvailable()
  }

  private triggerNextUpgradeIfAvailable() {
    if (this.awaitingUpgradeSelection || this.pendingLevelUps <= 0) {
      return
    }

    const draft = draftUpgradeChoices(this.inventory, this.upgradeDraftState, { count: 3 })
    const choices = draft.choices
    this.upgradeDraftState = draft.nextState
    const ascensionChoices = getAvailableAscensionChoices(this.inventory)
    this.ascensionChoices = ascensionChoices

    if (choices.length > 0) {
      this.isZhouTianActive = false
      this.awaitingUpgradeSelection = true
      this.upgradeChoices = choices
      this.awaitingAscensionSelection = false
      this.reportRuntimeOutput({
        type: 'upgrade-requested',
        choices,
        deductionCount: this.deductionState.remainingCount,
        canDeduce: canPerformDeduction(
          this.deductionState,
          choices,
          this.inventory,
          this.upgradeDraftState,
        ),
        isZhouTian: false,
      })
      return
    }

    if (ascensionChoices.length > 0) {
      this.isZhouTianActive = false
      this.pendingLevelUps = 0
      this.awaitingUpgradeSelection = false
      this.upgradeChoices = []
      this.beginAscensionSelection(ascensionChoices)
      return
    }

    const zhouTianChoices = generateZhouTianChoices(this.zhouTianState)
    if (zhouTianChoices.length > 0) {
      this.isZhouTianActive = true
      this.awaitingUpgradeSelection = true
      this.awaitingAscensionSelection = false
      this.reportRuntimeOutput({
        type: 'upgrade-requested',
        choices: zhouTianChoices,
        deductionCount: this.deductionState.remainingCount,
        canDeduce: false,
        isZhouTian: true,
      })
      return
    }

    this.pendingLevelUps = 0
    this.awaitingUpgradeSelection = false
  }

  private beginAscensionSelection(choices: readonly AscensionRecipe[]) {
    if (choices.length === 0) {
      this.awaitingAscensionSelection = false
      this.ascensionChoices = []
      return
    }

    this.awaitingAscensionSelection = true
    this.ascensionChoices = choices
    this.reportRuntimeOutput({ type: 'ascension-requested', choices })
  }

  private updateCamera() {
    this.cameras.main.centerOn(this.player.x, this.player.y)
  }

  private castProtectiveSpell() {
    if (this.spellCooldownMs > 0) {
      return
    }

    this.spellCooldownMs = SPELL_COOLDOWN_MS
    this.shieldRemainingMs = SPELL_SHIELD_DURATION_MS
    this.shieldBlockedFeedback = false
    this.spellCastVisualRemainingMs = 520
    this.playerCastPoseMs = 520
    this.spellImpactPulseRemainingMs = 360
    this.emitAudio('spell-cast')
    this.completeOnboardingStep('cast-spell')
    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index]
      if (!enemy || Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) > 170) {
        continue
      }

      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y)
      const knockback = 74
      enemy.x = Phaser.Math.Clamp(enemy.x + (enemy.x - this.player.x) / Math.max(distance, 1) * knockback, 24, WORLD_SIZE - 24)
      enemy.y = Phaser.Math.Clamp(enemy.y + (enemy.y - this.player.y) / Math.max(distance, 1) * knockback, 24, WORLD_SIZE - 24)
      enemy.behavior = { ...enemy.behavior, action: 'recover', actionRemainingMs: 420 }
    }
  }

  private defeatEnemy(index: number) {
    const enemy = this.enemies[index]
    if (!enemy) {
      return
    }

    this.releaseEnemySprite(enemy.sprite)
    this.enemies.splice(index, 1)
    this.defeatedEnemies += 1
    if (enemy.isElite) {
      this.defeatedElites += 1
    }
    if (enemy.isLairGuard) {
      const result = markDemonLairGuardDefeated(this.demonLair)
      this.demonLair = result.nextState
      if (result.justCompleted) {
        this.emitAudio('event-complete')
      }
    }
    this.emitAudio('enemy-defeated')
    this.spawnCombatBurst('death', enemy.x, enemy.y, enemy.color, 260, enemy.radius * 1.8)
    this.spirits.push({ x: enemy.x, y: enemy.y, value: enemy.isElite ? 8 : 1 })
  }

  private getArtifactDamage(baseDamage: number): number {
    return Math.max(1, Math.round(baseDamage * this.playerDamageMultiplier))
  }

  private damageEnemy(index: number, damage: number, impactX = this.player.x, impactY = this.player.y) {
    const enemy = this.enemies[index]
    if (!enemy) {
      return
    }

    enemy.health = resolveDamage(enemy.health, Math.round(damage * enemy.vulnerableMultiplier))
    enemy.hitFlashMs = this.reducedMotion ? 0 : 80
    this.spawnCombatBurst('hit', enemy.x, enemy.y, enemy.color, 120, enemy.radius + 8)
    if (this.hitAudioCooldownMs === 0) {
      this.emitAudio('ordinary-hit')
      this.hitAudioCooldownMs = 70
    }
    const distance = Phaser.Math.Distance.Between(impactX, impactY, enemy.x, enemy.y)
    const knockback = enemy.isElite ? 2 : 4
    enemy.x = Phaser.Math.Clamp(enemy.x + (enemy.x - impactX) / Math.max(distance, 1) * knockback, 24, WORLD_SIZE - 24)
    enemy.y = Phaser.Math.Clamp(enemy.y + (enemy.y - impactY) / Math.max(distance, 1) * knockback, 24, WORLD_SIZE - 24)
    if (enemy.health <= 0) {
      this.defeatEnemy(index)
    }
  }

  private spawnCombatBurst(
    kind: CombatBurstKind,
    x: number,
    y: number,
    color: number,
    durationMs: number,
    radius: number,
  ) {
    const burst = this.combatBurstPool.pop() ?? {
      kind,
      x,
      y,
      color,
      remainingMs: durationMs,
      durationMs,
      radius,
    }
    burst.kind = kind
    burst.x = x
    burst.y = y
    burst.color = color
    burst.remainingMs = durationMs
    burst.durationMs = durationMs
    burst.radius = radius
    this.combatBursts.push(burst)
  }

  private advanceCombatBursts(stepMs: number) {
    const alive: CombatBurst[] = []
    for (const burst of this.combatBursts) {
      burst.remainingMs -= stepMs
      if (burst.remainingMs > 0) {
        alive.push(burst)
      } else {
        this.combatBurstPool.push(burst)
      }
    }
    this.combatBursts = alive
  }

  private completeOnboardingStep(step: OnboardingStep) {
    if (this.completedOnboardingSteps.has(step)) {
      return
    }

    this.completedOnboardingSteps.add(step)
    this.reportRuntimeOutput({ type: 'onboarding-step-completed', step })
  }

  private syncMusicStage() {
    const nextStage = musicStageForRun(this.progress.elapsedMs, this.progress.phase)
    if (nextStage === this.musicStage) {
      return
    }

    this.musicStage = nextStage
    this.reportRuntimeOutput({
      type: 'effect',
      effect: { type: 'audio', intent: { type: 'music', stage: nextStage } },
    })
  }

  private emitAudio(cue: SoundCue) {
    this.reportRuntimeOutput({
      type: 'effect',
      effect: { type: 'audio', intent: { type: 'effect', cue } },
    })
  }

  private createEnemySprite(id: string, x: number, y: number, radius: number) {
    const frame = id === 'xiaoyue-wolf-king-moon-shadow'
      ? 0
      : id === 'qing-shi-ridge-boar-demon'
        ? 0
        : id === 'qing-shi-ridge-mist-moth'
          ? 20
          : id === 'qing-shi-ridge-elite-wolf'
            ? 30
            : 10
    const texture = id === 'xiaoyue-wolf-king-moon-shadow'
      ? { textureKey: 'qingshi-combat-actors', frame }
      : resolveCommonActorAtlas(frame)
    const sprite = this.enemySpritePool.pop() ?? this.add.image(x, y, texture.textureKey, texture.frame)
    return sprite
      .setActive(true)
      .setVisible(true)
      .setTexture(texture.textureKey, texture.frame)
      .setPosition(x, y)
      .setDisplaySize(radius * 4.8, radius * 4.8)
      .setAlpha(1)
      .clearTint()
      .setDepth(4)
  }

  private releaseEnemySprite(sprite: Phaser.GameObjects.Image) {
    sprite.setActive(false).setVisible(false).clearTint()
    this.enemySpritePool.push(sprite)
  }

  private updateHudText() {
    let stageStatus = getDemonWaveStage(this.progress.elapsedMs).label
    if (this.boss) {
      stageStatus = `${
        {
          arrival: '啸月狼王降临',
          combat: '啸月狼王决战',
          enraged: '啸月狼王 · 狂月',
          defeated: '啸月狼王已伏',
        }[this.boss.phase]
      } ${Math.ceil(this.boss.health)}/${this.boss.maxHealth}`
    } else if (this.demonLair.phase === 'travel') {
      stageStatus = `🔥 妖巢暴动 · 前往 ${Math.ceil(this.demonLair.travelRemainingMs / 1000)}s`
    } else if (this.demonLair.phase === 'battle' || this.demonLair.phase === 'destroyed') {
      stageStatus = this.demonLair.destroyed
        ? `🔥 妖巢已毁 · 击败守巢精英 ${Math.ceil(this.demonLair.battleRemainingMs / 1000)}s`
        : `🔥 妖巢暴动 ${Math.ceil(this.demonLair.health)}/${this.demonLair.maxHealth} · ${Math.ceil(this.demonLair.battleRemainingMs / 1000)}s`
    } else if (this.lingquanEvent.phase === 'available' || this.lingquanEvent.phase === 'guiding') {
      stageStatus = this.lingquanEvent.phase === 'guiding'
        ? `💧 灵泉引导 ${Math.round(this.lingquanEvent.guideProgressMs / this.lingquanEvent.guideDurationMs * 100)}%`
        : `💧 灵泉涌现 · 前往 ${Math.ceil(this.lingquanEvent.travelRemainingMs / 1000)}s`
    }

    const elites = this.enemies.filter((enemy) => enemy.isElite)
    const weakestEliteHealthPercent = elites.length === 0
      ? null
      : Math.round(Math.min(...elites.map((enemy) => enemy.health / enemy.maxHealth)) * 100)

    const battlefieldEvent = this.practiceMode
      ? undefined
      : this.demonLair.phase !== 'dormant'
        && this.demonLair.phase !== 'expired'
        && this.demonLair.phase !== 'completed'
        ? {
            kind: 'demon-lair' as const,
            phase: this.demonLair.phase,
            name: BATTLEFIELD_EVENT_COPY['demon-lair'].name,
            objective: this.demonLair.phase === 'travel'
              ? BATTLEFIELD_EVENT_COPY['demon-lair'].objectives.travel
              : BATTLEFIELD_EVENT_COPY['demon-lair'].objectives.active,
            remainingMs: this.demonLair.phase === 'travel'
              ? this.demonLair.travelRemainingMs
              : this.demonLair.battleRemainingMs,
            progress: this.demonLair.destroyed ? 1 : 1 - this.demonLair.health / this.demonLair.maxHealth,
            reward: BATTLEFIELD_EVENT_COPY['demon-lair'].reward,
          }
        : this.lingquanEvent.phase !== 'dormant'
          && this.lingquanEvent.phase !== 'expired'
          && this.lingquanEvent.phase !== 'completed'
          ? {
              kind: 'lingquan' as const,
              phase: this.lingquanEvent.phase,
              name: BATTLEFIELD_EVENT_COPY.lingquan.name,
              objective: this.lingquanEvent.phase === 'available'
                ? BATTLEFIELD_EVENT_COPY.lingquan.objectives.travel
                : BATTLEFIELD_EVENT_COPY.lingquan.objectives.active,
              remainingMs: this.lingquanEvent.travelRemainingMs,
              progress: this.lingquanEvent.guideProgressMs / this.lingquanEvent.guideDurationMs,
              reward: BATTLEFIELD_EVENT_COPY.lingquan.reward,
            }
          : undefined

    this.reportRuntimeOutput({
      type: 'hud-updated',
      snapshot: {
        health: Math.ceil(this.player.health),
        maxHealth: this.player.maxHealth,
        level: this.progress.level,
        experience: this.progress.experience,
        experienceToNextLevel: this.progress.experienceToNextLevel,
        elapsedMs: this.progress.elapsedMs,
        enemyCount: this.enemies.length,
        eliteCount: elites.length,
        weakestEliteHealthPercent,
        stageLabel: stageStatus,
        spellCooldownMs: this.spellCooldownMs,
        spellShieldRemainingMs: this.shieldRemainingMs,
        hitProtectionRemainingMs: this.hitProtectionRemainingMs,
        pickupRadiusBoostRemainingMs: this.pickupRadiusBoostRemainingMs,
        battlefieldEvent,
        boss: this.boss
          ? {
              name: '啸月狼王',
              phase: this.boss.phase,
              health: this.boss.health,
              maxHealth: this.boss.maxHealth,
              enragedThreshold: this.boss.maxHealth * WOLF_KING_ENRAGED_HEALTH_RATIO,
              breachRemainingMs: this.boss.breachRemainingMs,
            }
          : undefined,
        artifacts: this.inventory.slots.map((slot) => ({
          id: slot.id,
          name: ARTIFACT_DEFINITIONS[slot.id].name,
          level: slot.level,
        })),
      },
    })
  }

  private renderBattlefield() {
    this.graphics.clear()
    this.graphics.fillStyle(0x07130d, 0.24).fillRect(0, 0, WORLD_SIZE, WORLD_SIZE)
    this.graphics.lineStyle(2, 0x496454, 0.55).strokeRect(16, 16, WORLD_SIZE - 32, WORLD_SIZE - 32)
    this.graphics.lineStyle(34, 0x3e4d34, 0.7).lineBetween(130, 1860, 1870, 250)
    this.graphics.fillStyle(0x4a4435, 0.13).fillRoundedRect(
      ABANDONED_VILLAGE.x,
      ABANDONED_VILLAGE.y,
      ABANDONED_VILLAGE.width,
      ABANDONED_VILLAGE.height,
      18,
    )
    for (const hut of [
      { x: 1208, y: 1092, width: 50, height: 34 },
      { x: 1324, y: 1118, width: 58, height: 38 },
      { x: 1258, y: 1182, width: 54, height: 36 },
    ]) {
      this.graphics.fillStyle(0x332c24, 0.88).fillRect(hut.x, hut.y, hut.width, hut.height)
      this.graphics.fillStyle(0x70543d, 0.92).fillTriangle(
        hut.x - 7,
        hut.y + 3,
        hut.x + hut.width / 2,
        hut.y - 18,
        hut.x + hut.width + 7,
        hut.y + 3,
      )
      this.graphics.fillStyle(0xc49a63, 0.5).fillRect(hut.x + hut.width * 0.42, hut.y + 16, 9, 18)
    }

    // Render randomized terrain groves
    for (const grove of this.terrainLayout.groves) {
      this.graphics.fillStyle(0x325b42, 0.92).fillCircle(grove.x, grove.y, grove.radius)
      this.graphics.lineStyle(3, 0x5d8a56, 0.7).strokeCircle(grove.x, grove.y, grove.radius)
    }

    // A dormant 灵脉节点 is a physical stone altar.  Only the activated
    // 灵泉涌现 gains a rounded cyan guide area and progress ring.
    for (const [index, node] of this.terrainLayout.spiritNodes.entries()) {
      const fountainActive = this.lingquanEvent.nodeIndex === index
        && (this.lingquanEvent.phase === 'available' || this.lingquanEvent.phase === 'guiding')
      const nodeLabel = this.spiritNodeLabels[index]
      nodeLabel?.setText(fountainActive ? '灵泉涌现 · 引导' : '灵脉石坛')
      nodeLabel?.setVisible(fountainActive || this.discoveredLandmarkIds.has(`spirit-node-${index}`))
      this.graphics.fillStyle(fountainActive ? 0x164e63 : 0x3f3f46, 0.95).fillRoundedRect(
        node.x - 20,
        node.y - 15,
        40,
        30,
        7,
      )
      this.graphics.fillStyle(fountainActive ? 0x67e8f9 : 0x78716c, 0.9).fillTriangle(
        node.x - 13,
        node.y - 15,
        node.x,
        node.y - 27,
        node.x + 13,
        node.y - 15,
      )
      this.graphics.lineStyle(2, fountainActive ? 0x67e8f9 : 0xa8a29e, 0.85).strokeRoundedRect(
        node.x - 20,
        node.y - 15,
        40,
        30,
        7,
      )
      if (fountainActive) {
        const pulse = this.reducedMotion ? 0.55 : 0.4 + Math.sin(this.presentationElapsedMs / 220) * 0.2
        this.graphics.fillStyle(0x22d3ee, 0.1 + pulse * 0.12).fillCircle(node.x, node.y, node.radius + 24)
        this.graphics.lineStyle(3, 0x67e8f9, 0.8).strokeCircle(node.x, node.y, node.radius + 24)
        this.graphics.lineStyle(3, 0xa7f3d0, 0.95).arc(
          node.x,
          node.y,
          node.radius + 17,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * (this.lingquanEvent.guideProgressMs / this.lingquanEvent.guideDurationMs),
        )
      }
    }

    // Render the hostile 妖巢 as an entity with a sharp silhouette, not a
    // generic red interaction circle.
    if (this.demonLair.phase === 'travel' || this.demonLair.phase === 'battle' || this.demonLair.phase === 'destroyed') {
      const pulse = this.reducedMotion ? 0.7 : 0.55 + Math.sin(this.presentationElapsedMs / 200) * 0.22
      if (!this.demonLair.destroyed) {
        this.graphics.fillStyle(0x4c0519, 0.82).fillTriangle(
          this.demonLair.x - 34,
          this.demonLair.y + 30,
          this.demonLair.x,
          this.demonLair.y - 42,
          this.demonLair.x + 34,
          this.demonLair.y + 30,
        )
        this.graphics.fillStyle(0xbe123c, pulse).fillCircle(this.demonLair.x, this.demonLair.y + 6, 24)
        this.graphics.lineStyle(4, 0xfb7185, 0.95).strokeCircle(this.demonLair.x, this.demonLair.y + 6, 32)
      } else {
        this.graphics.lineStyle(4, 0xfda4af, 0.7).strokeCircle(this.demonLair.x, this.demonLair.y + 8, 30)
        this.graphics.lineBetween(this.demonLair.x - 24, this.demonLair.y + 24, this.demonLair.x + 24, this.demonLair.y - 18)
        this.graphics.lineBetween(this.demonLair.x - 18, this.demonLair.y - 22, this.demonLair.x + 20, this.demonLair.y + 25)
      }
      this.graphics.fillStyle(0x1c101c, 0.9).fillRect(this.demonLair.x - 40, this.demonLair.y - 65, 80, 7)
      this.graphics.fillStyle(0xef4444, 1).fillRect(
        this.demonLair.x - 40,
        this.demonLair.y - 65,
        80 * Math.max(0, this.demonLair.health / this.demonLair.maxHealth),
        7,
      )
    }

    this.graphics.lineStyle(1, 0x2f4a3a, 0.38)
    for (let coordinate = 128; coordinate < WORLD_SIZE; coordinate += 128) {
      this.graphics.lineBetween(coordinate, 0, coordinate, WORLD_SIZE)
      this.graphics.lineBetween(0, coordinate, WORLD_SIZE, coordinate)
    }

    // Render the Four-Array aura for the base artifact or its ascended form.
    const arrayArtifactId =
      getArtifactLevel(this.inventory, 'si-xiang-zhen-qi') > 0
        ? 'si-xiang-zhen-qi'
        : 'zhu-xie-jian-zhen'
    const arrayLevel = getArtifactLevel(this.inventory, arrayArtifactId)
    if (arrayLevel > 0) {
      const stats = getArtifactStats(arrayArtifactId, arrayLevel)
      const signature = resolveArtifactVisualSignature(arrayArtifactId)
      this.graphics.lineStyle(signature.trailWidth, signature.accentColor, 0.45)
      this.graphics.strokeCircle(this.player.x, this.player.y, stats.aoeRadius)

      // Base 阵旗 keeps four cardinal anchors; 诛邪剑阵 adds a second
      // silhouette: floating blades that point inward before the pulse.
      for (let i = 0; i < 4; i++) {
        const rad = this.arrayRotationRad + (i * Math.PI) / 2
        const nx = this.player.x + Math.cos(rad) * stats.aoeRadius
        const ny = this.player.y + Math.sin(rad) * stats.aoeRadius
        this.graphics.fillStyle(signature.accentColor, 0.8)
        if (signature.macroShape === 'floating-sword-rain') {
          this.graphics.fillTriangle(nx, ny - 10, nx + 5, ny + 8, nx - 5, ny + 8)
          this.graphics.lineStyle(2, 0xfef3c7, 0.8).lineBetween(nx, ny - 5, nx, ny + 5)
        } else {
          this.graphics.fillCircle(nx, ny, 4)
          this.graphics.lineStyle(2, signature.accentColor, 0.7).lineBetween(
            nx,
            ny,
            this.player.x + Math.cos(rad) * (stats.aoeRadius - 18),
            this.player.y + Math.sin(rad) * (stats.aoeRadius - 18),
          )
        }
      }
      if (this.arrayPulseRemainingMs > 0) {
        const pulseSignature = resolveArtifactVisualSignature(this.arrayPulseArtifactId)
        const pulseProgress = 1 - this.arrayPulseRemainingMs / 320
        const pulseRadius = Math.max(22, stats.aoeRadius * (0.72 + pulseProgress * 0.28))
        this.graphics.lineStyle(pulseSignature.trailWidth + 1, pulseSignature.accentColor, 1 - pulseProgress * 0.6)
        this.graphics.strokeCircle(this.player.x, this.player.y, pulseRadius)
        if (pulseSignature.macroShape === 'floating-sword-rain') {
          for (let index = 0; index < 6; index += 1) {
            const angle = this.arrayRotationRad + index * Math.PI / 3
            const bladeX = this.player.x + Math.cos(angle) * pulseRadius
            const bladeY = this.player.y + Math.sin(angle) * pulseRadius
            this.graphics.fillStyle(pulseSignature.accentColor, 0.9)
            this.graphics.fillTriangle(
              bladeX,
              bladeY,
              bladeX - Math.sin(angle) * 9,
              bladeY + Math.cos(angle) * 9,
              bladeX + Math.sin(angle) * 9,
              bladeY - Math.cos(angle) * 9,
            )
          }
        }
      }
    }

    // Render spirits
    for (const spirit of this.spirits) {
      this.graphics.fillStyle(0x6ee7b7, 0.95).fillCircle(spirit.x, spirit.y, 5)
    }

    // Render thunder explosion effects with the source-specific talisman
    // or ground-array macro shape.
    for (const effect of this.thunderEffects) {
      const alpha = Math.max(0, effect.remainingMs / 250)
      const signature = resolveArtifactVisualSignature(effect.artifactId)
      this.graphics.fillStyle(signature.accentColor, alpha * 0.22).fillCircle(effect.x, effect.y, effect.radius)
      this.graphics.lineStyle(signature.trailWidth, signature.accentColor, alpha).strokeCircle(effect.x, effect.y, effect.radius)
      if (signature.macroShape === 'nine-heavens-thunder-array') {
        for (let index = 0; index < 4; index += 1) {
          const angle = index * Math.PI / 2 + this.arrayRotationRad
          const endX = effect.x + Math.cos(angle) * effect.radius
          const endY = effect.y + Math.sin(angle) * effect.radius
          this.graphics.lineStyle(3, 0xfef9c3, alpha)
          this.graphics.lineBetween(effect.x, effect.y, endX, endY)
          this.graphics.lineBetween(endX, endY, endX - Math.sin(angle) * 12, endY + Math.cos(angle) * 12)
        }
      } else {
        this.graphics.lineStyle(2, 0xfffbeb, alpha)
        this.graphics.lineBetween(effect.x - 8, effect.y, effect.x + 8, effect.y)
        this.graphics.lineBetween(effect.x, effect.y - 8, effect.x, effect.y + 8)
      }
    }

    this.renderCombatBursts()

    // Render projectiles according to their 法器视觉签名.
    for (const [index, projectile] of this.projectiles.entries()) {
      this.renderArtifactProjectile(projectile, index)
    }
    for (let index = this.projectiles.length; index < this.artifactProjectileSprites.length; index += 1) {
      this.artifactProjectileSprites[index]?.setVisible(false)
    }

    // Slow mist shots stay bright and outlined so their path remains readable in a dense wave.
    for (const projectile of this.enemyProjectiles) {
      this.graphics.fillStyle(0xc084fc, 0.7).fillCircle(projectile.x, projectile.y, projectile.radius)
      this.graphics.lineStyle(2, 0xf5d0fe, 0.9).strokeCircle(projectile.x, projectile.y, projectile.radius + 2)
    }

    // Render enemies through the shared 职责动作 grammar.
    for (const enemy of this.enemies) {
      this.renderEnemyPresentation(enemy)
    }

    if (this.boss && this.bossSpatial && this.boss.phase !== 'defeated') {
      this.renderBossPresentation()
    }

    // Render protective spell aura if cast recently
    if (this.shieldRemainingMs > 0) {
      const signature = resolveCombatVisualSignature('xuan-guang-hu-shen-jue')
      this.graphics.lineStyle(signature.trailWidth + 1, signature.accentColor, 0.7).strokeCircle(this.player.x, this.player.y, 88)
      this.graphics.fillStyle(signature.accentColor, 0.08).fillCircle(this.player.x, this.player.y, 88)
      this.graphics.lineStyle(2, signature.accentColor, 0.56).strokeCircle(this.player.x, this.player.y, 62)
      for (let index = 0; index < 4; index += 1) {
        const angle = this.playerMotionPhase * 0.015 + index * Math.PI / 2
        const symbolX = this.player.x + Math.cos(angle) * 62
        const symbolY = this.player.y + Math.sin(angle) * 62
        this.graphics.fillStyle(signature.accentColor, 0.85).fillTriangle(
          symbolX,
          symbolY - 5,
          symbolX + 5,
          symbolY,
          symbolX,
          symbolY + 5,
        )
      }
    }
    const spellVisualActive = this.shieldRemainingMs > 0
      || this.spellCastVisualRemainingMs > 0
      || this.spellImpactPulseRemainingMs > 0
      || this.spellEndVisualRemainingMs > 0
    if (spellVisualActive) {
      const spellFrame = 28 + (this.reducedMotion ? 0 : Math.floor(this.presentationElapsedMs / 120) % 4)
      this.spellPresentationSprite
        .setTexture('artifact-combat-effects', spellFrame)
        .setPosition(this.player.x, this.player.y)
        .setDisplaySize(this.shieldRemainingMs > 0 ? 112 : 94, this.shieldRemainingMs > 0 ? 112 : 94)
        .setAngle(this.reducedMotion ? 0 : this.presentationElapsedMs / 80)
        .setAlpha(this.shieldRemainingMs > 0 ? 0.72 : 0.9)
        .setVisible(true)
    } else {
      this.spellPresentationSprite.setVisible(false)
    }
    if (this.spellCastVisualRemainingMs > 0 || this.spellImpactPulseRemainingMs > 0 || this.spellEndVisualRemainingMs > 0) {
      const signature = resolveCombatVisualSignature('xuan-guang-hu-shen-jue')
      const pulseMs = Math.max(this.spellCastVisualRemainingMs, this.spellImpactPulseRemainingMs, this.spellEndVisualRemainingMs)
      const progress = 1 - pulseMs / 520
      const radius = 35 + Math.min(135, Math.max(0, progress) * 170)
      const alpha = this.reducedMotion ? 0.5 : Math.min(0.9, pulseMs / 220)
      this.graphics.lineStyle(signature.trailWidth + 1, signature.accentColor, alpha)
      this.graphics.strokeCircle(this.player.x, this.player.y, radius)
      this.graphics.lineStyle(2, signature.accentColor, alpha * 0.8)
      this.graphics.lineBetween(this.player.x - radius, this.player.y, this.player.x + radius, this.player.y)
      this.graphics.lineBetween(this.player.x, this.player.y - radius, this.player.x, this.player.y + radius)
    }

    // Render the player as a small pose state machine. The base atlas frame is
    // deliberately kept crisp; directional bob, cast lean, hit recoil and
    // downed posture are layered around it so the character still reads in a
    // crowded battlefield and in reduced-motion mode.
    const isMoving = this.inputIntent.moveX !== 0 || this.inputIntent.moveY !== 0
    const playerPose = this.playerDowned
      ? 'downed'
      : this.playerHitFlashMs > 0
        ? 'hit'
        : this.playerCastPoseMs > 0
          ? 'cast'
          : isMoving
            ? 'walk'
            : 'idle'
    const walkBob = isMoving && !this.reducedMotion ? Math.sin(this.playerMotionPhase) * 3 : 0
    const stopBounce = this.playerStopBounceRemainingMs > 0 && !this.reducedMotion
      ? Math.sin((1 - this.playerStopBounceRemainingMs / 180) * Math.PI) * 4
      : 0
    const bob = playerPose === 'downed' ? 10 : walkBob + stopBounce
    const squash = playerPose === 'walk' && !this.reducedMotion
      ? 1 + Math.sin(this.playerMotionPhase * 2) * 0.035
      : playerPose === 'cast'
        ? 1.06
        : 1
    const poseAngle = playerPose === 'downed'
      ? 78
      : playerPose === 'hit'
        ? (this.playerFacingX < 0 ? -10 : 10)
        : playerPose === 'cast'
          ? this.playerFacingX * 7
          : isMoving
            ? this.playerFacingX * this.playerFacingY * 2
            : 0
    const poseAlpha = playerPose === 'downed' ? 0.66 : 1
    this.playerSprite
      .setPosition(this.player.x, this.player.y - bob)
      .setFlipX(this.playerFacingX < -0.1)
      .setAngle(poseAngle)
      .setAlpha(poseAlpha)
      .setDisplaySize(84 * squash, 84 * (1 - (squash - 1) * 0.6))
    if (this.playerHitFlashMs > 0) {
      this.playerSprite.setTint(0xffffff)
    } else if (this.shieldRemainingMs > 0) {
      this.playerSprite.setTint(0xdff8ff)
    } else {
      this.playerSprite.clearTint()
    }
    if (this.playerHitSparkMs > 0) {
      const sparkProgress = 1 - this.playerHitSparkMs / 220
      const sparkAlpha = Math.max(0, 1 - sparkProgress)
      this.graphics.lineStyle(2, 0xfef3c7, sparkAlpha)
      for (let index = 0; index < 6; index += 1) {
        const angle = index * Math.PI / 3 + this.playerMotionPhase * 0.04
        const inner = 28 + sparkProgress * 4
        const outer = inner + 10 + sparkProgress * 12
        this.graphics.lineBetween(
          this.player.x + Math.cos(angle) * inner,
          this.player.y + Math.sin(angle) * inner,
          this.player.x + Math.cos(angle) * outer,
          this.player.y + Math.sin(angle) * outer,
        )
      }
    }
    if (playerPose === 'downed') {
      this.graphics.lineStyle(4, 0xfda4af, 0.72).strokeCircle(this.player.x, this.player.y, 44)
      this.graphics.lineStyle(2, 0xfef3c7, 0.6)
      this.graphics.lineBetween(this.player.x - 18, this.player.y - 18, this.player.x + 18, this.player.y + 18)
      this.graphics.lineBetween(this.player.x + 18, this.player.y - 18, this.player.x - 18, this.player.y + 18)
    }
    if (isMoving) {
      this.graphics.fillStyle(0xd6b96d, 0.3).fillEllipse(this.player.x - 10, this.player.y + 26, 12, 5)
      this.graphics.fillStyle(0xd6b96d, 0.3).fillEllipse(this.player.x + 10, this.player.y + 26, 12, 5)
    }
    this.graphics.fillStyle(0x13241d, 0.9).fillRect(this.player.x - 32, this.player.y - 35, 64, 6)
    this.graphics.fillStyle(0xef9a66, 1).fillRect(this.player.x - 32, this.player.y - 35, 64 * (this.player.health / this.player.maxHealth), 6)
    this.renderRadar()
  }

  private renderCombatBursts() {
    for (const burst of this.combatBursts) {
      const progress = Math.max(0, Math.min(1, 1 - burst.remainingMs / burst.durationMs))
      const alpha = this.reducedMotion ? 0.72 : Math.max(0.12, 1 - progress)
      if (burst.kind === 'hit') {
        this.graphics.lineStyle(2, 0xfef3c7, alpha)
        this.graphics.strokeCircle(burst.x, burst.y, burst.radius * (0.7 + progress * 0.3))
        for (let index = 0; index < 4; index += 1) {
          const angle = index * Math.PI / 2 + this.presentationElapsedMs * 0.01
          const inner = burst.radius * 0.35
          const outer = burst.radius * (0.75 + progress * 0.4)
          this.graphics.lineBetween(
            burst.x + Math.cos(angle) * inner,
            burst.y + Math.sin(angle) * inner,
            burst.x + Math.cos(angle) * outer,
            burst.y + Math.sin(angle) * outer,
          )
        }
        continue
      }
      if (burst.kind === 'death') {
        this.graphics.lineStyle(2, burst.color, alpha)
        this.graphics.strokeCircle(burst.x, burst.y, burst.radius * (0.55 + progress * 0.65))
        if (!this.reducedMotion) {
          for (let index = 0; index < 6; index += 1) {
            const angle = index * Math.PI / 3
            const distance = burst.radius * (0.45 + progress)
            this.graphics.fillStyle(burst.color, alpha)
            this.graphics.fillCircle(
              burst.x + Math.cos(angle) * distance,
              burst.y + Math.sin(angle) * distance,
              3,
            )
          }
        }
        continue
      }
      if (burst.kind === 'dust') {
        const radius = burst.radius * (0.55 + progress * 0.5)
        this.graphics.fillStyle(burst.color, alpha * 0.18).fillEllipse(burst.x, burst.y + 5, radius * 2, radius * 0.6)
        this.graphics.lineStyle(2, burst.color, alpha * 0.7).strokeCircle(burst.x, burst.y, radius)
        continue
      }

      const radius = burst.radius * (0.7 + progress * 0.6)
      this.graphics.lineStyle(4, burst.color, alpha)
      this.graphics.strokeCircle(burst.x, burst.y, radius)
      this.graphics.lineBetween(burst.x - radius, burst.y, burst.x + radius, burst.y)
      this.graphics.lineBetween(burst.x, burst.y - radius, burst.x, burst.y + radius)
    }
  }

  private renderArtifactProjectile(projectile: Projectile, index: number) {
    const signature = resolveArtifactVisualSignature(projectile.artifactId)
    const velocityLength = Math.hypot(projectile.velocityX, projectile.velocityY) || 1
    const directionX = projectile.velocityX / velocityLength
    const directionY = projectile.velocityY / velocityLength
    const normalX = -directionY
    const normalY = directionX
    const trailLength = this.reducedMotion ? 0 : 1
    const tailX = projectile.x - projectile.velocityX * 0.035 * trailLength
    const tailY = projectile.y - projectile.velocityY * 0.035 * trailLength
    const accent = signature.accentColor
    const iconIndex = {
      'qing-feng-jian-xia': 0,
      'lei-zhuan-fu-ce': 1,
      'si-xiang-zhen-qi': 2,
      'fu-yao-yu-yi': 3,
      'zhu-xie-jian-zhen': 4,
      'liu-guang-jian-yi': 5,
      'jiu-xiao-lei-zhen': 6,
    }[projectile.artifactId]
    const animationFrame = this.reducedMotion ? 0 : Math.floor(this.presentationElapsedMs / 90) % 4
    const combatFrame = iconIndex * 4 + animationFrame
    const icon = this.artifactProjectileSprites[index]
      ?? (this.artifactProjectileSprites[index] = this.add.image(projectile.x, projectile.y, 'artifact-combat-effects', combatFrame))
    icon
      .setTexture('artifact-combat-effects', combatFrame)
      .setPosition(projectile.x, projectile.y)
      .setDisplaySize(signature.isHighTier ? 30 : 24, signature.isHighTier ? 34 : 28)
      .setRotation(Math.atan2(directionY, directionX) + Math.PI / 2)
      .setAlpha(this.reducedMotion ? 0.9 : 1)
      .setDepth(5)
      .setVisible(true)

    if (!this.reducedMotion) {
      this.graphics.lineStyle(signature.trailWidth, accent, 0.9).lineBetween(tailX, tailY, projectile.x, projectile.y)
    }
    if (signature.macroShape === 'flying-sword' || signature.macroShape === 'floating-sword-rain') {
      const tipX = projectile.x + directionX * 10
      const tipY = projectile.y + directionY * 10
      this.graphics.fillStyle(0xfffbeb, 0.96)
      this.graphics.fillTriangle(
        tipX,
        tipY,
        projectile.x - directionX * 8 + normalX * 5,
        projectile.y - directionY * 8 + normalY * 5,
        projectile.x - directionX * 8 - normalX * 5,
        projectile.y - directionY * 8 - normalY * 5,
      )
      if (signature.macroShape === 'floating-sword-rain') {
        this.graphics.lineStyle(2, 0xf0abfc, 0.7)
        this.graphics.lineBetween(
          projectile.x + normalX * 8,
          projectile.y + normalY * 8,
          projectile.x - normalX * 8,
          projectile.y - normalY * 8,
        )
      }
      return
    }
    if (signature.macroShape === 'talisman-bolt' || signature.macroShape === 'nine-heavens-thunder-array') {
      this.graphics.fillStyle(0xfffbeb, 0.9).fillRect(projectile.x - 5, projectile.y - 7, 10, 14)
      this.graphics.lineStyle(1, 0x92400e, 0.9).strokeRect(projectile.x - 5, projectile.y - 7, 10, 14)
      this.graphics.lineStyle(2, accent, 0.9)
      this.graphics.lineBetween(projectile.x, projectile.y, projectile.x + normalX * 16 + directionX * 8, projectile.y + normalY * 16 + directionY * 8)
      this.graphics.lineBetween(projectile.x, projectile.y, projectile.x - normalX * 16 + directionX * 8, projectile.y - normalY * 16 + directionY * 8)
      return
    }

    // 羽衣 and 剑翼 retain a curved wind identity instead of becoming a
    // second straight projectile line.
    this.graphics.lineStyle(signature.trailWidth, 0xe0f2fe, 0.75)
    this.graphics.lineBetween(
      projectile.x - directionX * 5 + normalX * 12,
      projectile.y - directionY * 5 + normalY * 12,
      projectile.x + directionX * 6 - normalX * 4,
      projectile.y + directionY * 6 - normalY * 4,
    )
    if (signature.macroShape === 'light-sword-wing') {
      this.graphics.lineBetween(
        projectile.x - directionX * 5 - normalX * 12,
        projectile.y - directionY * 5 - normalY * 12,
        projectile.x + directionX * 6 + normalX * 4,
        projectile.y + directionY * 6 + normalY * 4,
      )
    }
  }

  private renderEnemyPresentation(enemy: Enemy) {
    const facingX = enemy.behavior.action === 'charge'
      ? enemy.chargeDirectionX
      : this.player.x - enemy.x
    const presentation = resolveEnemyPresentation({
      id: enemy.isMoonShadow ? 'xiaoyue-wolf-king-moon-shadow' : enemy.id as QingShiRidgeEnemyId,
      isElite: enemy.isElite,
      isMoonShadow: enemy.isMoonShadow,
      action: enemy.behavior.action,
      actionRemainingMs: enemy.behavior.actionRemainingMs,
      recoveryIsVulnerable: enemy.behavior.recoveryIsVulnerable,
      hitFlashMs: enemy.hitFlashMs,
      facingX,
      elapsedMs: this.presentationElapsedMs,
      reducedMotion: this.reducedMotion,
      attackVisualRemainingMs: enemy.attackVisualRemainingMs,
    })
    const texture = presentation.textureKey === 'qingshi-common-actors'
      ? resolveCommonActorAtlas(presentation.frame)
      : { textureKey: presentation.textureKey, frame: presentation.frame }
    enemy.sprite
      .setTexture(texture.textureKey, texture.frame)
      .setPosition(enemy.x, enemy.y - presentation.bob)
      .setFlipX(presentation.flipX)
      .setAngle(presentation.angle)
      .setAlpha(presentation.alpha)
      .setDisplaySize(enemy.radius * 4.8 * presentation.scale, enemy.radius * 4.8 * presentation.scale)
    if (presentation.tint !== null && (!this.reducedMotion || presentation.tint !== 0xffffff)) {
      enemy.sprite.setTint(presentation.tint)
    } else {
      enemy.sprite.clearTint()
    }

    const directionX = enemy.behavior.action === 'charge' ? enemy.chargeDirectionX : facingX / Math.max(Math.abs(facingX), 1)
    const directionY = enemy.behavior.action === 'charge'
      ? enemy.chargeDirectionY
      : (this.player.y - enemy.y) / Math.max(Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y), 1)
    if (presentation.telegraph === 'charge-lane') {
      if (presentation.silhouette !== 'boar-demon') {
        const warningLength = presentation.silhouette === 'elite-wolf' ? 250 : 150
        this.graphics.lineStyle(presentation.silhouette === 'elite-wolf' ? 5 : 3, presentation.accentColor, 0.9)
        this.graphics.lineBetween(enemy.x, enemy.y, enemy.x + directionX * warningLength, enemy.y + directionY * warningLength)
        this.graphics.fillStyle(presentation.accentColor, 0.24).fillTriangle(
          enemy.x + directionX * warningLength,
          enemy.y + directionY * warningLength,
          enemy.x + directionX * (warningLength - 20) - directionY * 9,
          enemy.y + directionY * (warningLength - 20) + directionX * 9,
          enemy.x + directionX * (warningLength - 20) + directionY * 9,
          enemy.y + directionY * (warningLength - 20) - directionX * 9,
        )
      }
      this.graphics.strokeCircle(enemy.x, enemy.y, enemy.radius + 10)
    } else if (presentation.telegraph === 'vulnerable-crack') {
      this.graphics.lineStyle(3, presentation.accentColor, 0.95)
      this.graphics.lineBetween(enemy.x - enemy.radius, enemy.y - enemy.radius, enemy.x + enemy.radius, enemy.y + enemy.radius)
      this.graphics.lineBetween(enemy.x + enemy.radius, enemy.y - enemy.radius, enemy.x - enemy.radius, enemy.y + enemy.radius)
      this.graphics.strokeCircle(enemy.x, enemy.y, enemy.radius + 8)
    } else if (presentation.telegraph === 'mist-cloud') {
      this.graphics.lineStyle(2, presentation.accentColor, 0.8)
      this.graphics.strokeCircle(enemy.x, enemy.y, enemy.radius + 12)
      this.graphics.strokeCircle(enemy.x + directionX * 14, enemy.y + directionY * 14, enemy.radius + 6)
    } else if (presentation.telegraph === 'moon-shadow') {
      this.graphics.lineStyle(2, presentation.accentColor, 0.82).strokeCircle(enemy.x, enemy.y, enemy.radius + 8)
      this.graphics.fillStyle(0xf5f3ff, 0.9).fillCircle(enemy.x - 4, enemy.y - 2, 2)
      this.graphics.fillCircle(enemy.x + 4, enemy.y - 2, 2)
    } else if (presentation.telegraph === 'flank') {
      this.graphics.lineStyle(2, presentation.accentColor, 0.52)
      this.graphics.arc(enemy.x, enemy.y, enemy.radius + 8, -Math.PI / 2, Math.PI / 2)
    }
    if (enemy.isElite) {
      this.graphics.lineStyle(3, presentation.accentColor, 0.9).strokeCircle(enemy.x, enemy.y, enemy.radius + 6)
      const barWidth = enemy.radius * 2.4
      const barY = enemy.y - enemy.radius - 13
      this.graphics.fillStyle(0x160d09, 0.92).fillRect(enemy.x - barWidth / 2, barY, barWidth, 6)
      this.graphics.fillStyle(presentation.isVulnerable ? 0xfef08a : presentation.accentColor, 1).fillRect(
        enemy.x - barWidth / 2,
        barY,
        barWidth * Math.max(0, enemy.health / enemy.maxHealth),
        6,
      )
    }
  }

  private renderBossPresentation() {
    if (!this.boss || !this.bossSpatial) {
      return
    }
    const presentation = resolveBossPresentation({
      phase: this.boss.phase,
      attack: this.boss.attack,
      introRemainingMs: this.boss.introRemainingMs,
      howlRemainingMs: this.bossHowlRemainingMs,
      breachRemainingMs: this.bossBreachRemainingMs,
      impactRemainingMs: this.bossImpactRemainingMs,
      elapsedMs: this.presentationElapsedMs,
      reducedMotion: this.reducedMotion,
    })
    const x = this.bossSpatial.x + presentation.shake
    const y = this.bossSpatial.y + presentation.shake
    this.bossSpatial.sprite
      .setTexture(presentation.textureKey, presentation.frame)
      .setPosition(x, y)
      .setAlpha(presentation.alpha)
      .setTint(presentation.tint)
      .setAngle(presentation.angle)
      .setDisplaySize(172 * presentation.scale, 172 * presentation.scale)

    this.graphics.lineStyle(4, presentation.accentColor, presentation.alpha)
    if (presentation.halo === 'arrival-pulse') {
      this.graphics.strokeCircle(x, y, 96)
    } else if (presentation.halo === 'cracked-moon') {
      this.graphics.arc(x, y, this.bossSpatial.radius + 18, -2.6, -0.45)
      this.graphics.arc(x, y, this.bossSpatial.radius + 18, 0.45, 2.6)
      this.graphics.lineStyle(3, 0x4c1d95, 0.8)
      this.graphics.lineBetween(x - 34, y - 8, x - 9, y + 4)
      this.graphics.lineBetween(x + 8, y - 4, x + 32, y + 12)
    } else if (presentation.halo === 'breach-open') {
      this.graphics.strokeCircle(x, y, this.bossSpatial.radius + 26)
      this.graphics.lineStyle(3, 0xfef08a, 0.95)
      this.graphics.fillStyle(0xfef08a, 0.24).fillTriangle(x, y - 28, x - 12, y - 3, x + 12, y - 3)
      this.graphics.lineBetween(x - 14, y - 12, x + 14, y - 12)
    } else {
      this.graphics.arc(x, y, this.bossSpatial.radius + 18, -2.7, -0.4)
      this.graphics.arc(x, y, this.bossSpatial.radius + 18, 0.4, 2.7)
    }
    if (presentation.shadowSplit) {
      this.graphics.lineStyle(3, 0x312e81, 0.7)
      this.graphics.lineBetween(x - 58, y + 36, x - 26, y + 48)
      this.graphics.lineBetween(x + 26, y + 48, x + 58, y + 36)
    }
    if (presentation.telegraph === 'howl-sector') {
      const howlProgress = Math.max(0, Math.min(1, this.bossHowlElapsedMs / WOLF_KING_HOWL_DURATION_MS))
      const effectRadius = 24 + howlProgress * (WOLF_KING_HOWL_RADIUS - 24)
      const effectAlpha = this.bossHowlRemainingMs / WOLF_KING_HOWL_DURATION_MS
      const safeGapAngle = Math.atan2(this.bossHowlDirectionY, this.bossHowlDirectionX)
      this.graphics.lineStyle(5, 0xfda4af, effectAlpha)
      this.graphics.arc(x, y, effectRadius, safeGapAngle + WOLF_KING_HOWL_SAFE_GAP_HALF_ANGLE, safeGapAngle + Math.PI * 2 - WOLF_KING_HOWL_SAFE_GAP_HALF_ANGLE)
      this.graphics.lineStyle(2, 0xa7f3d0, effectAlpha)
      this.graphics.arc(x, y, effectRadius - 12, safeGapAngle - WOLF_KING_HOWL_SAFE_GAP_HALF_ANGLE + 0.14, safeGapAngle + WOLF_KING_HOWL_SAFE_GAP_HALF_ANGLE - 0.14)
    } else if (presentation.telegraph === 'charge-lane' || presentation.telegraph === 'assault-lane') {
      const warningLength = presentation.telegraph === 'assault-lane' ? 210 : 260
      const warningColor = presentation.telegraph === 'assault-lane' ? 0xf472b6 : 0xfbbf24
      this.graphics.lineStyle(5, warningColor, 0.9)
      this.graphics.lineBetween(x, y, x + this.bossSpatial.chargeDirectionX * warningLength, y + this.bossSpatial.chargeDirectionY * warningLength)
      this.graphics.fillStyle(warningColor, 0.24).fillTriangle(
        x + this.bossSpatial.chargeDirectionX * warningLength,
        y + this.bossSpatial.chargeDirectionY * warningLength,
        x + this.bossSpatial.chargeDirectionX * (warningLength - 24) - this.bossSpatial.chargeDirectionY * 12,
        y + this.bossSpatial.chargeDirectionY * (warningLength - 24) + this.bossSpatial.chargeDirectionX * 12,
        x + this.bossSpatial.chargeDirectionX * (warningLength - 24) + this.bossSpatial.chargeDirectionY * 12,
        y + this.bossSpatial.chargeDirectionY * (warningLength - 24) - this.bossSpatial.chargeDirectionX * 12,
      )
    }
    if (this.bossAttack === 'assault' || this.bossAttack === 'charge') {
      this.graphics.lineStyle(3, 0xfda4af, 0.55).strokeCircle(x, y, this.bossSpatial.radius + 16)
    }
    this.graphics.fillStyle(0x1c101c, 0.9).fillRect(x - 46, y - 58, 92, 7)
    this.graphics.fillStyle(presentation.accentColor, 1).fillRect(x - 46, y - 58, 92 * (this.boss.health / this.boss.maxHealth), 7)
  }

  private renderRadar() {
    const radar = this.radarGraphics
    radar.clear()

    const camera = this.cameras.main.worldView
    const pixelSize = this.compactRadar ? 136 : 220
    const pixelTopOffset = this.compactRadar ? 58 : 64
    const pixelPadding = this.compactRadar ? 14 : 20
    const size = pixelSize / this.cameraZoom
    const x = camera.x + camera.width - size - pixelPadding / this.cameraZoom
    const y = camera.y + pixelTopOffset / this.cameraZoom
    const bounds = { x, y, size }
    this.radarLabel
      .setPosition(x, y - 5 / this.cameraZoom)
      .setScale(1 / this.cameraZoom)

    radar.fillStyle(0x03100b, 0.86).fillRoundedRect(x, y, size, size, 5 / this.cameraZoom)
    radar.lineStyle(2 / this.cameraZoom, 0xd6b96d, 0.75).strokeRect(x, y, size, size)

    for (let index = 1; index < 4; index += 1) {
      const offset = size * index / 4
      radar.lineStyle(1 / this.cameraZoom, 0x7d8d78, 0.2)
      radar.lineBetween(x + offset, y, x + offset, y + size)
      radar.lineBetween(x, y + offset, x + size, y + offset)
    }

    const commonEnemyCells = aggregateRadarPoints(
      this.enemies.filter((enemy) => !enemy.isElite),
      WORLD_SIZE,
      12,
    )
    for (const cell of commonEnemyCells) {
      const point = projectRadarPoint(
        { x: (cell.gridX + 0.5) * WORLD_SIZE / 12, y: (cell.gridY + 0.5) * WORLD_SIZE / 12 },
        WORLD_SIZE,
        bounds,
      )
      const radius = Math.min(8, 2.2 + cell.count * 0.75) / this.cameraZoom
      radar.fillStyle(0xdc6b50, Math.min(0.82, 0.22 + cell.count * 0.08)).fillCircle(point.x, point.y, radius)
    }

    const spiritCells = aggregateRadarPoints(this.spirits, WORLD_SIZE, 14)
    for (const cell of spiritCells) {
      const point = projectRadarPoint(
        { x: (cell.gridX + 0.5) * WORLD_SIZE / 14, y: (cell.gridY + 0.5) * WORLD_SIZE / 14 },
        WORLD_SIZE,
        bounds,
      )
      const radius = Math.min(6, 1.5 + Math.sqrt(cell.totalValue)) / this.cameraZoom
      radar.fillStyle(0x6ee7b7, 0.78).fillCircle(point.x, point.y, radius)
    }

    const village = this.terrainLayout.village
    const landmarks = [
      {
        id: 'abandoned-village',
        x: village.x + village.width / 2,
        y: village.y + village.height / 2,
        color: 0xd6b96d,
      },
      ...this.terrainLayout.spiritNodes.map((node, index) => ({
        id: `spirit-node-${index}`,
        x: node.x,
        y: node.y,
        color: 0x38bdf8,
      })),
    ].filter((landmark) => this.discoveredLandmarkIds.has(landmark.id))
    for (const landmark of landmarks) {
      const point = projectRadarPoint(landmark, WORLD_SIZE, bounds)
      const radius = 4.5 / this.cameraZoom
      radar.fillStyle(landmark.color, 1).fillTriangle(
        point.x,
        point.y - radius,
        point.x + radius,
        point.y,
        point.x,
        point.y + radius,
      )
      radar.fillTriangle(
        point.x,
        point.y - radius,
        point.x - radius,
        point.y,
        point.x,
        point.y + radius,
      )
    }

    for (const enemy of this.enemies) {
      if (!enemy.isElite) {
        continue
      }
      const point = projectRadarPoint(enemy, WORLD_SIZE, bounds)
      radar.fillStyle(0xf59e0b, 1).fillCircle(point.x, point.y, 4.5 / this.cameraZoom)
      radar.lineStyle(1.5 / this.cameraZoom, 0xfff0b5, 0.95).strokeCircle(point.x, point.y, 6.5 / this.cameraZoom)
    }

    if (this.bossSpatial && this.boss?.phase !== 'defeated') {
      const point = projectRadarPoint(this.bossSpatial, WORLD_SIZE, bounds)
      radar.fillStyle(0xd8b4fe, 1).fillCircle(point.x, point.y, 6 / this.cameraZoom)
    }

    if (this.demonLair.active && !this.demonLair.destroyed) {
      const point = projectRadarPoint(this.demonLair, WORLD_SIZE, bounds)
      radar.fillStyle(0xef4444, 1).fillRect(
        point.x - 4 / this.cameraZoom,
        point.y - 4 / this.cameraZoom,
        8 / this.cameraZoom,
        8 / this.cameraZoom,
      )
    }

    const player = projectRadarPoint(this.player, WORLD_SIZE, bounds)
    radar.fillStyle(0x67e8f9, 1).fillCircle(player.x, player.y, 4.2 / this.cameraZoom)
    radar.lineStyle(1.5 / this.cameraZoom, 0xffffff, 0.95).strokeCircle(player.x, player.y, 6.2 / this.cameraZoom)

    this.emitInstrumentation?.({
      distanceTravelled: Math.floor(this.distanceTravelled),
      radarRendered: true,
      radarEnemyRegions: commonEnemyCells.length,
      radarSpiritRegions: spiritCells.length,
      radarLandmarks: landmarks.length,
      presentationCheckpoint: resolveCombatPresentationCheckpoint(this.progress.elapsedMs)?.id ?? null,
    })
  }
}

interface BattleRuntimeSceneAdapter {
  selectInitialArtifact(artifactId: BaseArtifactId): void
  selectUpgrade(choiceId: string): void
  selectAscension(choiceId: string): void
  skipAscension(): void
  deduceUpgrade(): void
  tunaHeal(): void
  skipOnboarding(): void
  setInputIntent(intent: InputIntent): void
  castSpell(): void
  resizeViewport(width: number, height: number): void
  setCompactRadar?(compact: boolean): void
  setReducedMotion(reducedMotion: boolean): void
  setPaused(paused: boolean): void
}

interface BattleGameAdapter {
  readonly scale: {
    setGameSize(width: number, height: number): void
  }
  destroy(removeCanvas?: boolean): void
}

export function createBattleRuntimeAdapter(
  scene: BattleRuntimeSceneAdapter,
  game: BattleGameAdapter,
  renderScale: number,
): BattleRuntime {
  return {
    selectInitialArtifact: (artifactId) => scene.selectInitialArtifact(artifactId),
    selectUpgrade: (choiceId) => scene.selectUpgrade(choiceId),
    selectAscension: (choiceId) => scene.selectAscension(choiceId),
    skipAscension: () => scene.skipAscension(),
    deduceUpgrade: () => scene.deduceUpgrade(),
    tunaHeal: () => scene.tunaHeal(),
    skipOnboarding: () => scene.skipOnboarding(),
    setInputIntent: (intent) => scene.setInputIntent(intent),
    castSpell: () => scene.castSpell(),
    resize: (viewport) => {
      game.scale.setGameSize(
        viewport.internalWidth * renderScale,
        viewport.internalHeight * renderScale,
      )
      scene.resizeViewport(viewport.internalWidth, viewport.internalHeight)
      scene.setCompactRadar?.(viewport.compact ?? false)
    },
    setReducedMotion: (reducedMotion) => scene.setReducedMotion(reducedMotion),
    setPaused: (paused) => scene.setPaused(paused),
    destroy: () => game.destroy(true),
  }
}

export function createBattleSession(options: CreateGameSessionOptions) {
  let reportRuntimeOutput: (output: BattleRuntimeOutput) => void = () => undefined
  const scene = new QingShiRidgeScene(
    (output) => reportRuntimeOutput(output),
    options.renderScale,
    options.reducedMotion,
    options.viewport.internalWidth,
    options.viewport.internalHeight,
    options.compactRadar ?? false,
    options.runSeed ?? Date.now(),
    options.elapsedTimeScale ?? 1,
    options.onInstrumentation,
    options.deterministicAcceptance ?? false,
    options.practiceMode ?? false,
  )
  let game!: Phaser.Game
  const runtime = createBattleRuntimeAdapter(scene, {
    scale: {
      setGameSize: (width, height) => game.scale.setGameSize(width, height),
    },
    destroy: (removeCanvas) => game.destroy(removeCanvas ?? true),
  }, options.renderScale)

  const controller = createGameSessionController(runtime, {
    onSnapshot: options.onSnapshot,
    onEffect: options.onEffect,
  })
  reportRuntimeOutput = controller.reportRuntimeOutput
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: options.parent,
    width: options.viewport.internalWidth * options.renderScale,
    height: options.viewport.internalHeight * options.renderScale,
    antialias: false,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#12251d',
    scene,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      autoRound: true,
    },
  })

  return controller.session
}
