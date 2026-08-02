import * as Phaser from 'phaser'
import {
  BASE_FLYING_SWORD_DAMAGE,
  QING_SHI_RIDGE_ENEMY_IDS,
  applyEnemyPressure,
  createEnemyStats,
  resolveDamage,
} from '../domain/combatRules'
import { createInputIntent, type InputIntent } from '../domain/inputIntent'
import {
  advanceRunProgress,
  createRunProgress,
  formatElapsedTime,
  grantExperience,
  type RunProgress,
} from '../domain/runProgress'
import type { CreateGameSessionOptions, GameSessionEvent } from '../session/GameSession'
import { createGameSessionController, type BattleRuntime } from '../session/GameSessionController'

const BATTLE_WIDTH = 1280
const BATTLE_HEIGHT = 720
const WORLD_SIZE = 2048
const PLAYER_SPEED = 36
const CAMERA_WORLD_WIDTH = WORLD_SIZE * 0.2
const CAMERA_ZOOM = BATTLE_WIDTH / CAMERA_WORLD_WIDTH
const HUD_INTERVAL_MS = 120
const AUTO_ATTACK_INTERVAL_MS = 420
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
  id: string
  x: number
  y: number
  health: number
  radius: number
  speed: number
  color: number
}

interface Projectile {
  x: number
  y: number
  velocityX: number
  velocityY: number
  remainingMs: number
}

interface Spirit {
  x: number
  y: number
  value: number
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
  private paused = false
  private attackElapsedMs = AUTO_ATTACK_INTERVAL_MS
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

    for (let index = 0; index < 8; index += 1) {
      this.spawnEnemy()
    }

    this.updateHudText()
    this.renderBattlefield()
  }

  update(_time: number, deltaMs: number) {
    if (this.paused || this.ended) {
      return
    }

    const stepMs = Math.min(deltaMs, 50)
    this.progress = advanceRunProgress(this.progress, stepMs)
    this.movePlayer(stepMs)
    this.updateEnemies(stepMs)
    this.collectSpirits(stepMs)
    this.attackElapsedMs += stepMs
    this.spawnElapsedMs += stepMs
    this.spellCooldownMs = Math.max(0, this.spellCooldownMs - stepMs)
    this.hudElapsedMs += stepMs

    if (this.attackElapsedMs >= AUTO_ATTACK_INTERVAL_MS) {
      this.attackElapsedMs = 0
      this.fireFlyingSword()
    }

    if (this.spawnElapsedMs >= SPAWN_INTERVAL_MS && this.enemies.length < 36) {
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
      this.ended = true
      this.emitSessionEvent({ type: 'run-ended', result: 'defeat' })
    }

    this.renderBattlefield()
  }

  setInputIntent(intent: InputIntent) {
    this.inputIntent = intent
    if (intent.castSpell) {
      this.castProtectiveSpell()
    }
  }

  setPaused(paused: boolean) {
    this.paused = paused
  }

  private movePlayer(stepMs: number) {
    const distance = PLAYER_SPEED * (stepMs / 1_000)
    this.player.x = Phaser.Math.Clamp(this.player.x + this.inputIntent.moveX * distance, 28, WORLD_SIZE - 28)
    this.player.y = Phaser.Math.Clamp(this.player.y + this.inputIntent.moveY * distance, 28, WORLD_SIZE - 28)
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

  private fireFlyingSword() {
    const target = this.enemies.reduce<Enemy | undefined>((nearest, enemy) => {
      if (!nearest) {
        return enemy
      }

      const nearestDistance = Phaser.Math.Distance.Between(nearest.x, nearest.y, this.player.x, this.player.y)
      const currentDistance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y)
      return currentDistance < nearestDistance ? enemy : nearest
    }, undefined)

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
    })
  }

  private updateProjectiles(stepMs: number) {
    const alive: Projectile[] = []
    for (const projectile of this.projectiles) {
      projectile.x += projectile.velocityX * (stepMs / 1_000)
      projectile.y += projectile.velocityY * (stepMs / 1_000)
      projectile.remainingMs -= stepMs

      const hitIndex = this.enemies.findIndex(
        (enemy) => Phaser.Math.Distance.Between(projectile.x, projectile.y, enemy.x, enemy.y) < enemy.radius + 8,
      )
      if (hitIndex >= 0) {
        const enemy = this.enemies[hitIndex]
        if (!enemy) {
          continue
        }

        enemy.health = resolveDamage(enemy.health, BASE_FLYING_SWORD_DAMAGE)
        if (enemy.health <= 0) {
          this.defeatEnemy(hitIndex)
        }
        continue
      }

      if (projectile.remainingMs > 0) {
        alive.push(projectile)
      }
    }
    this.projectiles = alive
  }

  private collectSpirits(stepMs: number) {
    const remaining: Spirit[] = []
    for (const spirit of this.spirits) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, spirit.x, spirit.y)
      if (distance < 110) {
        spirit.x += ((this.player.x - spirit.x) / Math.max(distance, 1)) * stepMs * 0.32
        spirit.y += ((this.player.y - spirit.y) / Math.max(distance, 1)) * stepMs * 0.32
      }

      if (distance < 24) {
        const result = grantExperience(this.progress, spirit.value)
        this.progress = result.progress
        continue
      }

      remaining.push(spirit)
    }
    this.spirits = remaining
  }

  private updateCamera() {
    this.cameras.main.centerOn(this.player.x, this.player.y)
  }

  private castProtectiveSpell() {
    if (this.spellCooldownMs > 0) {
      return
    }

    this.spellCooldownMs = SPELL_COOLDOWN_MS
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
  }

  private defeatEnemy(index: number) {
    const enemy = this.enemies[index]
    if (!enemy) {
      return
    }

    this.enemies.splice(index, 1)
    this.spirits.push({ x: enemy.x, y: enemy.y, value: 2 })
  }

  private updateHudText() {
    this.hudText.setText([
      `陈砺安  ·  灵蕴进度 ${this.progress.level}`,
      `生命 ${Math.ceil(this.player.health)}/${this.player.maxHealth}  ·  妖物 ${this.enemies.length}`,
      `灵蕴 ${this.progress.experience}/${this.progress.experienceToNextLevel}  ·  玄光 ${Math.ceil(this.spellCooldownMs / 1_000)}  ·  ${formatElapsedTime(this.progress.elapsedMs)}`,
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

    for (const spirit of this.spirits) {
      this.graphics.fillStyle(0x6ee7b7, 0.95).fillCircle(spirit.x, spirit.y, 5)
    }
    for (const projectile of this.projectiles) {
      this.graphics.lineStyle(3, 0xe9d5ff, 0.9).lineBetween(projectile.x, projectile.y, projectile.x - projectile.velocityX * 0.035, projectile.y - projectile.velocityY * 0.035)
    }
    for (const enemy of this.enemies) {
      this.graphics.fillStyle(enemy.color, 1).fillCircle(enemy.x, enemy.y, enemy.radius)
      this.graphics.lineStyle(2, 0x2a180f, 0.7).strokeCircle(enemy.x, enemy.y, enemy.radius)
    }

    if (this.spellCooldownMs > SPELL_COOLDOWN_MS - 300) {
      this.graphics.lineStyle(4, 0xd8f3ff, 0.7).strokeCircle(this.player.x, this.player.y, 88)
    }
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
    setInputIntent: (intent) => scene.setInputIntent(intent),
    setPaused: (paused) => scene.setPaused(paused),
    destroy: () => game.destroy(true),
  }

  return createGameSessionController(runtime)
}
