import * as Phaser from 'phaser'
import {
  applyAscensionChoice,
  applyUpgradeChoice,
  ARTIFACT_DEFINITIONS,
  createArtifactInventory,
  getAvailableAscensionChoices,
  generateUpgradeChoices,
  getArtifactLevel,
  getArtifactStats,
  type ArtifactInventory,
  type ArtifactStats,
  type ArtifactId,
  type AscensionRecipe,
  type UpgradeChoice,
} from '../domain/artifactInventory'
import {
  QING_SHI_RIDGE_ENEMY_IDS,
  applyEnemyPressure,
  createEnemyStats,
  resolveDamage,
} from '../domain/combatRules'
import { createInputIntent, type InputIntent } from '../domain/inputIntent'
import {
  createInitialArtifactSelection,
  selectInitialArtifact,
  type BaseArtifact,
  type BaseArtifactId,
} from '../domain/initialArtifactSelection'
import type { OnboardingStep } from '../domain/onboardingProgress'
import {
  advanceRunProgress,
  createRunProgress,
  endRun,
  formatElapsedTime,
  grantExperience,
  type RunProgress,
} from '../domain/runProgress'
import {
  advanceWolfKingEncounter,
  createWolfKingEncounter,
  createWolfKingMinionStats,
  damageWolfKing,
  WOLF_KING_COMBAT_SPEED,
  WOLF_KING_CONTACT_DAMAGE_PER_SECOND,
  WOLF_KING_ENRAGED_SPEED,
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
import type { CreateGameSessionOptions, GameSessionEvent } from '../session/GameSession'
import { createGameSessionController, type BattleRuntime } from '../session/GameSessionController'

const BATTLE_WIDTH = 1280
const BATTLE_HEIGHT = 720
const WORLD_SIZE = 2048
const PLAYER_SPEED = 36
const CAMERA_WORLD_WIDTH = WORLD_SIZE * 0.2
const CAMERA_ZOOM = BATTLE_WIDTH / CAMERA_WORLD_WIDTH
const HUD_INTERVAL_MS = 120
const SPAWN_INTERVAL_MS = 700
const SPELL_COOLDOWN_MS = 6_000
const SPELL_DAMAGE = 18

const FIXED_BAMBOO_GROVES = [
  { x: 420, y: 440, radius: 104 },
  { x: 1610, y: 510, radius: 126 },
  { x: 1420, y: 1590, radius: 112 },
] as const
const ABANDONED_VILLAGE = { x: 1160, y: 1040, width: 290, height: 190 } as const

interface Enemy {
  kind: 'enemy'
  id: string
  x: number
  y: number
  health: number
  radius: number
  speed: number
  color: number
}

interface BossSpatialState {
  readonly kind: 'boss'
  x: number
  y: number
  readonly radius: number
}

type CombatTarget = Enemy | BossSpatialState

interface Projectile {
  x: number
  y: number
  velocityX: number
  velocityY: number
  remainingMs: number
  color: number
  damage: number
  aoeRadius?: number
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
}

class QingShiRidgeScene extends Phaser.Scene {
  private readonly emitSessionEvent: (event: GameSessionEvent) => void
  private graphics!: Phaser.GameObjects.Graphics
  private inputIntent = createInputIntent()
  private progress: RunProgress = createRunProgress()
  private player = { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2, health: 100, maxHealth: 100 }
  private enemies: Enemy[] = []
  private projectiles: Projectile[] = []
  private spirits: Spirit[] = []
  private thunderEffects: ThunderEffect[] = []
  private selectedArtifact?: BaseArtifact
  private inventory: ArtifactInventory = createArtifactInventory()
  private pendingLevelUps = 0
  private awaitingUpgradeSelection = false
  private upgradeChoices: readonly UpgradeChoice[] = []
  private awaitingAscensionSelection = false
  private ascensionChoices: readonly AscensionRecipe[] = []
  private deductionState = createDeductionState(1)
  private zhouTianState = createZhouTianState()
  private isZhouTianActive = false
  private playerDamageMultiplier = 1.0
  private playerSpeedMultiplier = 1.0
  private playerMaxHealthMultiplier = 1.0
  private readonly initialArtifactSelection = createInitialArtifactSelection()
  private readonly completedOnboardingSteps = new Set<OnboardingStep>()
  private awaitingInitialArtifact = true
  private onboardingSkipped = false
  private paused = false
  private boss?: WolfKingEncounter
  private bossSpatial?: BossSpatialState
  private bossHowlRemainingMs = 0

  private swordElapsedMs = 0
  private thunderElapsedMs = 0
  private fourArrayElapsedMs = 0
  private windBladeElapsedMs = 0
  private arrayRotationRad = 0

  private spawnElapsedMs = 0
  private spellCooldownMs = 0
  private hudElapsedMs = HUD_INTERVAL_MS
  private ended = false
  private hudText!: Phaser.GameObjects.Text

  constructor(emitSessionEvent: (event: GameSessionEvent) => void) {
    super({ key: 'qing-shi-ridge' })
    this.emitSessionEvent = emitSessionEvent
  }

  create() {
    this.graphics = this.add.graphics()
    this.cameras.main.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE)
    this.cameras.main.setZoom(CAMERA_ZOOM)
    this.hudText = this.add
      .text(24, 20, '', {
        color: '#fef3c7',
        fontFamily: 'monospace',
        fontSize: '18px',
        lineSpacing: 8,
        stroke: '#090e0d',
        strokeThickness: 5,
      })
      .setDepth(10)
      .setScrollFactor(0)

    this.updateHudText()
    this.renderBattlefield()
    this.emitSessionEvent({
      type: 'initial-artifact-selection-requested',
      candidates: this.initialArtifactSelection.candidates,
    })
  }

  update(_time: number, deltaMs: number) {
    if (this.paused || this.ended || this.awaitingInitialArtifact) {
      return
    }

    const stepMs = Math.min(deltaMs, 50)
    const previousPhase = this.progress.phase
    this.progress = advanceRunProgress(this.progress, stepMs)
    if (previousPhase === 'growth' && this.progress.phase === 'boss') {
      this.startBossEncounter()
    }
    this.movePlayer(stepMs)
    this.updateEnemies(stepMs)
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
    this.hudElapsedMs += stepMs

    const isTeaching = !this.onboardingSkipped && this.progress.elapsedMs < 60_000
    const spawnIntervalMs = isTeaching ? SPAWN_INTERVAL_MS * 1.8 : SPAWN_INTERVAL_MS
    const enemyLimit = isTeaching ? 14 : 36
    if (this.progress.phase === 'growth' && this.spawnElapsedMs >= spawnIntervalMs && this.enemies.length < enemyLimit) {
      this.spawnElapsedMs = 0
      this.spawnEnemy()
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

    this.inputIntent = intent
    if (intent.castSpell) {
      this.castProtectiveSpell()
    }
  }

  selectInitialArtifact(artifactId: BaseArtifactId) {
    if (!this.awaitingInitialArtifact) {
      return
    }

    this.selectedArtifact = selectInitialArtifact(this.initialArtifactSelection, artifactId).selected
    this.inventory = createArtifactInventory(artifactId)
    this.awaitingInitialArtifact = false
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
        this.playerSpeedMultiplier += result.moveSpeedMultiplierDelta
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
      this.updateHudText()

      if (this.pendingLevelUps > 0) {
        this.triggerNextUpgradeIfAvailable()
      } else {
        this.setPaused(false)
      }
      return
    }

    const choice = this.upgradeChoices.find((c) => c.choiceId === choiceId)
    if (!choice) {
      return
    }

    this.inventory = applyUpgradeChoice(this.inventory, choice.artifactId)
    this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1)
    this.awaitingUpgradeSelection = false
    this.upgradeChoices = []

    this.updateHudText()

    if (this.pendingLevelUps > 0) {
      this.triggerNextUpgradeIfAvailable()
    } else if (this.ascensionChoices.length > 0) {
      this.beginAscensionSelection(this.ascensionChoices)
    } else {
      this.setPaused(false)
    }
  }

  deduceUpgrade() {
    if (!this.awaitingUpgradeSelection || this.isZhouTianActive) {
      return
    }

    if (!canPerformDeduction(this.deductionState)) {
      return
    }

    const result = performDeduction(this.deductionState, this.upgradeChoices, this.inventory)
    this.deductionState = result.nextState
    this.upgradeChoices = result.newChoices
    this.emitSessionEvent({
      type: 'upgrade-requested',
      choices: this.upgradeChoices,
      deductionCount: this.deductionState.remainingCount,
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

    this.updateHudText()
    this.setPaused(false)
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
    this.awaitingAscensionSelection = false
    this.ascensionChoices = []
    this.updateHudText()

    const nextAscensions = getAvailableAscensionChoices(this.inventory)
    if (nextAscensions.length > 0) {
      this.beginAscensionSelection(nextAscensions)
    } else {
      this.setPaused(false)
    }
  }

  skipAscension() {
    if (!this.awaitingAscensionSelection) {
      return
    }

    this.awaitingAscensionSelection = false
    this.ascensionChoices = []
    if (!this.awaitingUpgradeSelection) {
      this.setPaused(false)
    }
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

  private startBossEncounter() {
    this.recallEnemiesForBossTransition()
    this.projectiles = []
    this.thunderEffects = []
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
    const distance = 180
    this.boss = createWolfKingEncounter()
    this.bossSpatial = {
      kind: 'boss',
      x: Phaser.Math.Clamp(this.player.x + Math.cos(angle) * distance, 80, WORLD_SIZE - 80),
      y: Phaser.Math.Clamp(this.player.y + Math.sin(angle) * distance, 80, WORLD_SIZE - 80),
      radius: 38,
    }
    this.bossHowlRemainingMs = 0
    this.updateHudText()
  }

  private recallEnemiesForBossTransition() {
    this.enemies = []
  }

  private updateBoss(stepMs: number) {
    if (!this.boss || !this.bossSpatial || this.boss.phase === 'defeated') {
      return
    }

    this.bossHowlRemainingMs = Math.max(0, this.bossHowlRemainingMs - stepMs)
    const result = advanceWolfKingEncounter(this.boss, stepMs)
    this.boss = result.encounter
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
    const speed = this.boss.phase === 'enraged' ? WOLF_KING_ENRAGED_SPEED : WOLF_KING_COMBAT_SPEED
    this.bossSpatial.x = Phaser.Math.Clamp(
      this.bossSpatial.x + directionX * speed * (stepMs / 1_000),
      60,
      WORLD_SIZE - 60,
    )
    this.bossSpatial.y = Phaser.Math.Clamp(
      this.bossSpatial.y + directionY * speed * (stepMs / 1_000),
      60,
      WORLD_SIZE - 60,
    )

    if (distance < this.bossSpatial.radius + 24) {
      this.player.health = Math.max(
        0,
        this.player.health - WOLF_KING_CONTACT_DAMAGE_PER_SECOND * (stepMs / 1_000),
      )
    }
  }

  private handleWolfKingEvents(events: readonly WolfKingEvent[]) {
    for (const event of events) {
      if (event.type === 'summon-requested') {
        for (let index = 0; index < event.count; index += 1) {
          this.spawnWolfKingMinion()
        }
      } else if (event.type === 'moon-howl') {
        this.bossHowlRemainingMs = 900
        const damage = this.boss?.phase === 'enraged' ? 18 : 10
        this.player.health = Math.max(0, this.player.health - damage)
      } else if (event.type === 'defeated') {
        this.finishRun('victory')
      }
    }
  }

  private spawnWolfKingMinion() {
    if (!this.bossSpatial || this.enemies.length >= 18) {
      return
    }

    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
    const distance = Phaser.Math.Between(90, 150)
    const enraged = this.boss?.phase === 'enraged'
    const stats = createWolfKingMinionStats(enraged)
    this.enemies.push({
      kind: 'enemy',
      x: Phaser.Math.Clamp(this.bossSpatial.x + Math.cos(angle) * distance, 36, WORLD_SIZE - 36),
      y: Phaser.Math.Clamp(this.bossSpatial.y + Math.sin(angle) * distance, 36, WORLD_SIZE - 36),
      ...stats,
    })
  }

  private finishRun(result: 'victory' | 'defeat') {
    if (this.ended) {
      return
    }

    this.ended = true
    this.progress = endRun(this.progress)
    this.inputIntent = createInputIntent()
    this.emitSessionEvent({ type: 'run-ended', result })
  }

  private movePlayer(stepMs: number) {
    let speedMultiplier = 1.0
    for (const slot of this.inventory.slots) {
      const stats = getArtifactStats(slot.id, slot.level)
      if (stats.moveSpeedMultiplier > speedMultiplier) {
        speedMultiplier = stats.moveSpeedMultiplier
      }
    }

    const distance = PLAYER_SPEED * speedMultiplier * (stepMs / 1_000)
    this.player.x = Phaser.Math.Clamp(this.player.x + this.inputIntent.moveX * distance, 28, WORLD_SIZE - 28)
    this.player.y = Phaser.Math.Clamp(this.player.y + this.inputIntent.moveY * distance, 28, WORLD_SIZE - 28)
    if (this.inputIntent.moveX !== 0 || this.inputIntent.moveY !== 0) {
      this.completeOnboardingStep('move')
    }
  }

  private spawnEnemy() {
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
    const distance = Phaser.Math.Between(420, 620)
    const enemyId = QING_SHI_RIDGE_ENEMY_IDS[Phaser.Math.Between(0, QING_SHI_RIDGE_ENEMY_IDS.length - 1)]
    if (!enemyId) {
      return
    }
    const stats = createEnemyStats(enemyId)
    this.enemies.push({
      kind: 'enemy',
      x: Phaser.Math.Clamp(this.player.x + Math.cos(angle) * distance, 36, WORLD_SIZE - 36),
      y: Phaser.Math.Clamp(this.player.y + Math.sin(angle) * distance, 36, WORLD_SIZE - 36),
      ...stats,
    })
  }

  private updateEnemies(stepMs: number) {
    let pressure = 0
    for (const enemy of this.enemies) {
      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y)
      const directionX = (this.player.x - enemy.x) / Math.max(distance, 1)
      const directionY = (this.player.y - enemy.y) / Math.max(distance, 1)
      const distanceStep = enemy.speed * (stepMs / 1_000)
      enemy.x += directionX * distanceStep
      enemy.y += directionY * distanceStep

      if (distance < enemy.radius + 22) {
        pressure += 1
      }
    }

    if (pressure > 0) {
      this.player.health = applyEnemyPressure(this.player.health, pressure, stepMs)
    }
  }

  private updateArtifactAttacks(stepMs: number) {
    this.arrayRotationRad += (stepMs / 1000) * 1.5

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

      if (slot.id === 'qing-feng-jian-xia') {
        this.swordElapsedMs += stepMs
        if (this.swordElapsedMs >= stats.intervalMs) {
          this.swordElapsedMs = 0
          this.fireFlyingSword(stats)
        }
      } else if (slot.id === 'lei-zhuan-fu-ce' || slot.id === 'jiu-xiao-lei-zhen') {
        this.thunderElapsedMs += stepMs
        if (this.thunderElapsedMs >= stats.intervalMs) {
          this.thunderElapsedMs = 0
          this.fireThunderTalisman(stats, slot.id)
        }
      } else if (slot.id === 'si-xiang-zhen-qi' || slot.id === 'zhu-xie-jian-zhen') {
        this.fourArrayElapsedMs += stepMs
        if (this.fourArrayElapsedMs >= stats.intervalMs) {
          this.fourArrayElapsedMs = 0
          this.pulseFourArray(stats)
        }
      } else if (slot.id === 'fu-yao-yu-yi' || slot.id === 'liu-guang-jian-yi') {
        this.windBladeElapsedMs += stepMs
        if (this.windBladeElapsedMs >= stats.intervalMs) {
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
      damage: stats.damage,
    })
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
      damage: stats.damage,
      aoeRadius: stats.aoeRadius,
    })
  }

  private pulseFourArray(stats: ArtifactStats) {
    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index]
      if (!enemy) {
        continue
      }

      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y)
      if (distance <= stats.aoeRadius + enemy.radius) {
        enemy.health = resolveDamage(enemy.health, stats.damage)
        if (enemy.health <= 0) {
          this.defeatEnemy(index)
        }
      }
    }

    const boss = this.getActiveBossTarget()
    if (boss && this.isWithinTarget(boss, this.player.x, this.player.y, stats.aoeRadius)) {
      this.damageBoss(stats.damage)
    }
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
        damage: stats.damage,
      })
    }
  }

  private findNearestCombatTarget(): CombatTarget | undefined {
    const targets: CombatTarget[] = [...this.enemies]
    const boss = this.getActiveBossTarget()
    if (boss) {
      targets.push(boss)
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

  private isWithinTarget(target: CombatTarget, x: number, y: number, extraRadius: number): boolean {
    return Phaser.Math.Distance.Between(x, y, target.x, target.y) <= target.radius + extraRadius
  }

  private damageBoss(damage: number) {
    if (!this.boss) {
      return
    }

    const result = damageWolfKing(this.boss, damage)
    this.boss = result.encounter
    this.handleWolfKingEvents(result.events)
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
        if (hitIndex >= 0 || hitBoss || projectile.remainingMs <= 0) {
          this.explodeThunder(projectile.x, projectile.y, projectile.damage, projectile.aoeRadius)
          continue
        }
      } else {
        const hitIndex = this.enemies.findIndex(
          (enemy) => Phaser.Math.Distance.Between(projectile.x, projectile.y, enemy.x, enemy.y) < enemy.radius + 8,
        )
        const boss = this.getActiveBossTarget()
        const hitBoss = boss ? this.isWithinTarget(boss, projectile.x, projectile.y, 8) : false
        if (hitIndex >= 0) {
          const enemy = this.enemies[hitIndex]
          if (!enemy) {
            continue
          }

          enemy.health = resolveDamage(enemy.health, projectile.damage)
          if (enemy.health <= 0) {
            this.defeatEnemy(hitIndex)
          }
          continue
        }
        if (hitBoss) {
          this.damageBoss(projectile.damage)
          continue
        }
      }

      if (projectile.remainingMs > 0) {
        alive.push(projectile)
      }
    }
    this.projectiles = alive
  }

  private explodeThunder(x: number, y: number, damage: number, radius: number) {
    this.thunderEffects.push({ x, y, radius, remainingMs: 250 })

    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index]
      if (!enemy) {
        continue
      }

      if (Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) <= radius + enemy.radius) {
        enemy.health = resolveDamage(enemy.health, damage)
        if (enemy.health <= 0) {
          this.defeatEnemy(index)
        }
      }
    }

    const boss = this.getActiveBossTarget()
    if (boss && this.isWithinTarget(boss, x, y, radius)) {
      this.damageBoss(damage)
    }
  }

  private collectSpirits(stepMs: number) {
    const remaining: Spirit[] = []
    const bossTransition = this.boss?.phase === 'arrival'
    for (const spirit of this.spirits) {
      let distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, spirit.x, spirit.y)
      if (bossTransition || distance < 110) {
        const travelDistance = bossTransition
          ? Math.min(distance, 1_600 * (stepMs / 1_000))
          : Math.min(distance, stepMs * 0.32)
        spirit.x += ((this.player.x - spirit.x) / Math.max(distance, 1)) * travelDistance
        spirit.y += ((this.player.y - spirit.y) / Math.max(distance, 1)) * travelDistance
        distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, spirit.x, spirit.y)
      }

      if (distance < 24) {
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

    const choices = generateUpgradeChoices(this.inventory, 3)
    const ascensionChoices = getAvailableAscensionChoices(this.inventory)
    this.ascensionChoices = ascensionChoices

    if (choices.length > 0) {
      this.isZhouTianActive = false
      this.awaitingUpgradeSelection = true
      this.upgradeChoices = choices
      this.awaitingAscensionSelection = false
      this.setPaused(true)
      this.emitSessionEvent({
        type: 'upgrade-requested',
        choices,
        deductionCount: this.deductionState.remainingCount,
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
      this.setPaused(true)
      this.emitSessionEvent({
        type: 'upgrade-requested',
        choices: zhouTianChoices,
        deductionCount: this.deductionState.remainingCount,
        isZhouTian: true,
      })
      return
    }

    this.pendingLevelUps = 0
    this.awaitingUpgradeSelection = false
    this.setPaused(false)
  }

  private beginAscensionSelection(choices: readonly AscensionRecipe[]) {
    if (choices.length === 0) {
      this.awaitingAscensionSelection = false
      this.ascensionChoices = []
      this.setPaused(false)
      return
    }

    this.awaitingAscensionSelection = true
    this.ascensionChoices = choices
    this.setPaused(true)
    this.emitSessionEvent({ type: 'ascension-requested', choices })
  }

  private updateCamera() {
    this.cameras.main.centerOn(this.player.x, this.player.y)
  }

  private castProtectiveSpell() {
    if (this.spellCooldownMs > 0) {
      return
    }

    this.spellCooldownMs = SPELL_COOLDOWN_MS
    this.completeOnboardingStep('cast-spell')
    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index]
      if (!enemy || Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) > 170) {
        continue
      }

      enemy.health = resolveDamage(enemy.health, SPELL_DAMAGE)
      if (enemy.health === 0) {
        this.defeatEnemy(index)
      }
    }

    const boss = this.getActiveBossTarget()
    if (boss && this.isWithinTarget(boss, this.player.x, this.player.y, 170)) {
      this.damageBoss(SPELL_DAMAGE)
    }
  }

  private defeatEnemy(index: number) {
    const enemy = this.enemies[index]
    if (!enemy) {
      return
    }

    this.enemies.splice(index, 1)
    this.spirits.push({ x: enemy.x, y: enemy.y, value: 2 })
  }

  private completeOnboardingStep(step: OnboardingStep) {
    if (this.completedOnboardingSteps.has(step)) {
      return
    }

    this.completedOnboardingSteps.add(step)
    this.emitSessionEvent({ type: 'onboarding-step-completed', step })
  }

  private updateHudText() {
    const artifactList =
      this.inventory.slots.length > 0
        ? this.inventory.slots.map((s) => `${ARTIFACT_DEFINITIONS[s.id].name} Lv.${s.level}`).join(' | ')
        : this.selectedArtifact?.name ?? '择一法器'
    const bossStatus = this.boss
      ? `${
          {
            arrival: '啸月狼王降临',
            combat: '啸月狼王决战',
            enraged: '啸月狼王 · 狂月',
            defeated: '啸月狼王已伏',
          }[this.boss.phase]
        } ${Math.ceil(this.boss.health)}/${this.boss.maxHealth}`
      : '成长阶段'

    this.hudText.setText([
      `${artifactList}  ·  灵蕴进度 ${this.progress.level}`,
      `生命 ${Math.ceil(this.player.health)}/${this.player.maxHealth}  ·  妖物 ${this.enemies.length}`,
      `${bossStatus}  ·  灵蕴 ${this.progress.experience}/${this.progress.experienceToNextLevel}`,
      `玄光 ${Math.ceil(this.spellCooldownMs / 1_000)}  ·  ${formatElapsedTime(this.progress.elapsedMs)}`,
    ])
  }

  private renderBattlefield() {
    this.graphics.clear()
    this.graphics.fillStyle(0x12251d, 1).fillRect(0, 0, WORLD_SIZE, WORLD_SIZE)
    this.graphics.lineStyle(2, 0x496454, 0.55).strokeRect(16, 16, WORLD_SIZE - 32, WORLD_SIZE - 32)
    this.graphics.lineStyle(34, 0x3e4d34, 0.7).lineBetween(130, 1860, 1870, 250)
    this.graphics.fillStyle(0x554536, 0.9).fillRect(ABANDONED_VILLAGE.x, ABANDONED_VILLAGE.y, ABANDONED_VILLAGE.width, ABANDONED_VILLAGE.height)
    this.graphics.lineStyle(4, 0xc29b64, 0.65).strokeRect(ABANDONED_VILLAGE.x, ABANDONED_VILLAGE.y, ABANDONED_VILLAGE.width, ABANDONED_VILLAGE.height)
    for (const grove of FIXED_BAMBOO_GROVES) {
      this.graphics.fillStyle(0x325b42, 0.92).fillCircle(grove.x, grove.y, grove.radius)
      this.graphics.lineStyle(3, 0x5d8a56, 0.7).strokeCircle(grove.x, grove.y, grove.radius)
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
      this.graphics.lineStyle(2, ARTIFACT_DEFINITIONS[arrayArtifactId].attackColor, 0.45)
      this.graphics.strokeCircle(this.player.x, this.player.y, stats.aoeRadius)

      // Draw 4 rotating node flags
      for (let i = 0; i < 4; i++) {
        const rad = this.arrayRotationRad + (i * Math.PI) / 2
        const nx = this.player.x + Math.cos(rad) * stats.aoeRadius
        const ny = this.player.y + Math.sin(rad) * stats.aoeRadius
        this.graphics.fillStyle(ARTIFACT_DEFINITIONS[arrayArtifactId].attackColor, 0.8)
        this.graphics.fillCircle(nx, ny, 4)
      }
    }

    // Render spirits
    for (const spirit of this.spirits) {
      this.graphics.fillStyle(0x6ee7b7, 0.95).fillCircle(spirit.x, spirit.y, 5)
    }

    // Render thunder explosion effects
    for (const effect of this.thunderEffects) {
      const alpha = Math.max(0, effect.remainingMs / 250)
      this.graphics.fillStyle(0xfde68a, alpha * 0.35).fillCircle(effect.x, effect.y, effect.radius)
      this.graphics.lineStyle(3, 0xfde68a, alpha).strokeCircle(effect.x, effect.y, effect.radius)
    }

    // Render projectiles
    for (const projectile of this.projectiles) {
      this.graphics.lineStyle(3, projectile.color, 0.9).lineBetween(projectile.x, projectile.y, projectile.x - projectile.velocityX * 0.035, projectile.y - projectile.velocityY * 0.035)
    }

    // Render enemies
    for (const enemy of this.enemies) {
      this.graphics.fillStyle(enemy.color, 1).fillCircle(enemy.x, enemy.y, enemy.radius)
      this.graphics.lineStyle(2, 0x2a180f, 0.7).strokeCircle(enemy.x, enemy.y, enemy.radius)
    }

    if (this.boss && this.bossSpatial && this.boss.phase !== 'defeated') {
      const isArrival = this.boss.phase === 'arrival'
      const isEnraged = this.boss.phase === 'enraged'
      const pulse = isArrival ? 0.5 + Math.sin(this.boss.introRemainingMs / 180) * 0.25 : 0.7
      const bossColor = isEnraged ? 0xf87171 : 0xc084fc
      this.graphics.fillStyle(bossColor, isArrival ? 0.18 : 0.9).fillCircle(
        this.bossSpatial.x,
        this.bossSpatial.y,
        this.bossSpatial.radius,
      )
      this.graphics.lineStyle(isArrival ? 4 : 3, bossColor, pulse)
      this.graphics.strokeCircle(this.bossSpatial.x, this.bossSpatial.y, this.bossSpatial.radius + 12)
      if (isArrival || this.bossHowlRemainingMs > 0) {
        const effectRadius = isArrival ? 96 : 140
        const effectAlpha = isArrival ? pulse : this.bossHowlRemainingMs / 900
        this.graphics.lineStyle(5, isArrival ? 0xf0abfc : 0xfda4af, effectAlpha)
        this.graphics.strokeCircle(this.bossSpatial.x, this.bossSpatial.y, effectRadius)
      }
      this.graphics.fillStyle(0x1c101c, 0.9).fillRect(
        this.bossSpatial.x - 46,
        this.bossSpatial.y - 58,
        92,
        7,
      )
      this.graphics.fillStyle(isEnraged ? 0xef4444 : 0xd8b4fe, 1).fillRect(
        this.bossSpatial.x - 46,
        this.bossSpatial.y - 58,
        92 * (this.boss.health / this.boss.maxHealth),
        7,
      )
    }

    // Render protective spell aura if cast recently
    if (this.spellCooldownMs > SPELL_COOLDOWN_MS - 300) {
      this.graphics.lineStyle(4, 0xd8f3ff, 0.7).strokeCircle(this.player.x, this.player.y, 88)
    }

    // Render player
    this.graphics.fillStyle(0xe9d5a1, 1).fillCircle(this.player.x, this.player.y, 18)
    this.graphics.lineStyle(3, 0xffffff, 0.85).strokeCircle(this.player.x, this.player.y, 18)
    this.graphics.fillStyle(0x13241d, 0.9).fillRect(this.player.x - 32, this.player.y - 35, 64, 6)
    this.graphics.fillStyle(0xef9a66, 1).fillRect(this.player.x - 32, this.player.y - 35, 64 * (this.player.health / this.player.maxHealth), 6)
  }
}

export function createBattleSession(options: CreateGameSessionOptions) {
  const scene = new QingShiRidgeScene(options.onEvent)
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: options.parent,
    width: BATTLE_WIDTH,
    height: BATTLE_HEIGHT,
    backgroundColor: '#12251d',
    scene,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  })

  const runtime: BattleRuntime = {
    selectInitialArtifact: (artifactId) => scene.selectInitialArtifact(artifactId),
    selectUpgrade: (choiceId) => scene.selectUpgrade(choiceId),
    selectAscension: (choiceId) => scene.selectAscension(choiceId),
    skipAscension: () => scene.skipAscension(),
    deduceUpgrade: () => scene.deduceUpgrade(),
    tunaHeal: () => scene.tunaHeal(),
    skipOnboarding: () => scene.skipOnboarding(),
    setInputIntent: (intent) => scene.setInputIntent(intent),
    setPaused: (paused) => scene.setPaused(paused),
    destroy: () => game.destroy(true),
  }

  return createGameSessionController(runtime)
}
