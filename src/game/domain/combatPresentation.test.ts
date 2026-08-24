import { describe, expect, it } from 'vitest'
import type { ArtifactId } from './artifactInventory'
import {
  QING_SHI_RIDGE_PRESENTATION_CHECKPOINTS,
  resolveCombatPresentationCheckpoint,
} from './combatPresentationAcceptance'
import {
  createRecordingCombatPresentationAdapter,
  resolveCombatPresentationFrame,
  resolveCombatVisualSignature,
  resolveArtifactVisualSignature,
  resolveBossPresentation,
  resolveEnemyPresentation,
} from './combatPresentation'

describe('semantic combat presentation', () => {
  it('turns a boar windup into a readable charge pose and lane telegraph', () => {
    const presentation = resolveEnemyPresentation({
      id: 'qing-shi-ridge-boar-demon',
      isElite: false,
      isMoonShadow: false,
      action: 'windup',
      actionRemainingMs: 500,
      recoveryIsVulnerable: false,
      hitFlashMs: 0,
      facingX: 1,
      elapsedMs: 0,
      reducedMotion: false,
    })

    expect(presentation.pose).toBe('windup')
    expect(presentation.telegraph).toBe('charge-lane')
    expect(presentation.silhouette).toBe('boar-demon')
    expect(presentation.animationStep).toBe(0)
    expect(presentation.scale).toBeLessThan(1)

    const walkingFrame = resolveEnemyPresentation({
      id: 'qing-shi-ridge-boar-demon',
      isElite: false,
      isMoonShadow: false,
      action: 'approach',
      actionRemainingMs: 0,
      recoveryIsVulnerable: false,
      hitFlashMs: 0,
      facingX: 1,
      elapsedMs: 121,
      reducedMotion: false,
    })
    expect(walkingFrame.animationStep).toBe(1)
  })

  it('gives an elite miss a distinct vulnerable silhouette without changing its lineage', () => {
    const presentation = resolveEnemyPresentation({
      id: 'qing-shi-ridge-elite-wolf',
      isElite: true,
      isMoonShadow: false,
      action: 'recover',
      actionRemainingMs: 700,
      recoveryIsVulnerable: true,
      hitFlashMs: 0,
      facingX: -1,
      elapsedMs: 120,
      reducedMotion: false,
    })

    expect(presentation.silhouette).toBe('elite-wolf')
    expect(presentation.telegraph).toBe('vulnerable-crack')
    expect(presentation.isVulnerable).toBe(true)
    expect(presentation.accentColor).toBe(0xfbbf24)
    expect(presentation.flipX).toBe(true)
    expect(presentation.animationStep).toBe(1)
  })

  it('cycles an elite pounce through ten readable pixel poses', () => {
    const first = resolveEnemyPresentation({
      id: 'qing-shi-ridge-elite-wolf',
      isElite: true,
      isMoonShadow: false,
      action: 'charge',
      actionRemainingMs: 420,
      recoveryIsVulnerable: false,
      hitFlashMs: 0,
      facingX: 1,
      elapsedMs: 0,
      reducedMotion: false,
    })
    const last = resolveEnemyPresentation({
      id: 'qing-shi-ridge-elite-wolf',
      isElite: true,
      isMoonShadow: false,
      action: 'charge',
      actionRemainingMs: 120,
      recoveryIsVulnerable: false,
      hitFlashMs: 0,
      facingX: 1,
      elapsedMs: 1_080,
      reducedMotion: false,
    })

    expect(first.animationStep).toBe(0)
    expect(last.animationStep).toBe(9)
  })

  it('keeps moon shadows visually separate from ordinary wood wolves', () => {
    const presentation = resolveEnemyPresentation({
      id: 'xiaoyue-wolf-king-moon-shadow',
      isElite: false,
      isMoonShadow: true,
      action: 'approach',
      actionRemainingMs: 0,
      recoveryIsVulnerable: false,
      hitFlashMs: 0,
      facingX: 1,
      elapsedMs: 240,
      reducedMotion: true,
    })

    expect(presentation.silhouette).toBe('moon-shadow')
    expect(presentation.animationStep).toBe(0)
    expect(presentation.tint).toBe(0x2e1065)
    expect(presentation.telegraph).toBe('moon-shadow')
    expect(presentation.bob).toBe(0)
  })

  it('gives the boss a broken moon identity and a readable breach state', () => {
    const enraged = resolveBossPresentation({
      phase: 'enraged',
      attack: 'assault-warning',
      introRemainingMs: 0,
      howlRemainingMs: 0,
      breachRemainingMs: 0,
      elapsedMs: 400,
      reducedMotion: false,
    })
    const breach = resolveBossPresentation({
      phase: 'enraged',
      attack: 'none',
      introRemainingMs: 0,
      howlRemainingMs: 0,
      breachRemainingMs: 900,
      elapsedMs: 400,
      reducedMotion: true,
    })

    expect(enraged.halo).toBe('cracked-moon')
    expect(enraged.animationStep).toBe(3)
    expect(enraged.shadowSplit).toBe(true)
    expect(enraged.telegraph).toBe('assault-lane')
    expect(breach.halo).toBe('breach-open')
    expect(breach.moonMarkOpen).toBe(true)
    expect(breach.shake).toBe(0)

    const bossIdleStart = resolveBossPresentation({
      phase: 'combat',
      attack: 'none',
      introRemainingMs: 0,
      howlRemainingMs: 0,
      breachRemainingMs: 0,
      elapsedMs: 0,
      reducedMotion: false,
    })
    const bossIdleLater = resolveBossPresentation({
      phase: 'combat',
      attack: 'none',
      introRemainingMs: 0,
      howlRemainingMs: 0,
      breachRemainingMs: 0,
      elapsedMs: 240,
      reducedMotion: false,
    })
    expect(bossIdleLater.animationStep).not.toBe(bossIdleStart.animationStep)
  })

  it('maps every implemented artifact to a source motif and a distinct macro shape', () => {
    const artifactIds: ArtifactId[] = [
      'qing-feng-jian-xia',
      'lei-zhuan-fu-ce',
      'si-xiang-zhen-qi',
      'fu-yao-yu-yi',
      'zhu-xie-jian-zhen',
      'liu-guang-jian-yi',
      'jiu-xiao-lei-zhen',
    ]
    const signatures = artifactIds.map(resolveArtifactVisualSignature)

    expect(signatures.map((signature) => signature.family)).toEqual([
      'sword',
      'thunder',
      'array',
      'wind',
      'sword',
      'wind',
      'thunder',
    ])
    expect(signatures.slice(4).every((signature) => signature.isHighTier)).toBe(true)
    expect(new Set(signatures.map((signature) => signature.macroShape)).size).toBe(signatures.length)
  })

  it('gives 玄光护身诀 a stable spell signature without treating it as a 法器', () => {
    const signature = resolveCombatVisualSignature('xuan-guang-hu-shen-jue')

    expect(signature.family).toBe('spell')
    expect(signature.macroShape).toBe('protective-talisman-shield')
    expect(signature.sourceMotif).toContain('结印玄光')
  })

  it('keeps the visual review checkpoints stable across accelerated acceptance runs', () => {
    expect(QING_SHI_RIDGE_PRESENTATION_CHECKPOINTS.map(({ id, elapsedMs }) => [id, elapsedMs])).toEqual([
      ['opening-00-30', 30_000],
      ['surge-02-00', 120_000],
      ['event-04-00', 240_000],
      ['density-08-30', 510_000],
      ['boss-10-00', 600_000],
    ])
    expect(resolveCombatPresentationCheckpoint(29_999)).toBeNull()
    expect(resolveCombatPresentationCheckpoint(30_000)?.id).toBe('opening-00-30')
    expect(resolveCombatPresentationCheckpoint(510_000)?.id).toBe('density-08-30')
    expect(resolveCombatPresentationCheckpoint(600_000)?.id).toBe('boss-10-00')
  })

  it('publishes one semantic frame that a Phaser or recording adapter can consume', () => {
    const frame = resolveCombatPresentationFrame({
      elapsedMs: 240,
      reducedMotion: false,
      player: {
        x: 100,
        y: 120,
        health: 72,
        maxHealth: 100,
        facingX: 1,
        facingY: 0,
        isMoving: true,
        hitFlashMs: 0,
        hitSparkMs: 0,
        castPoseMs: 0,
        downed: false,
        stopBounceRemainingMs: 0,
        shieldRemainingMs: 0,
      },
      enemies: [{
        x: 180,
        y: 120,
        directionX: -1,
        directionY: 0,
        radius: 22,
        health: 40,
        maxHealth: 60,
        isElite: false,
        input: {
          id: 'qing-shi-ridge-boar-demon',
          isElite: false,
          isMoonShadow: false,
          action: 'windup',
          actionRemainingMs: 500,
          recoveryIsVulnerable: false,
          hitFlashMs: 0,
          facingX: -1,
        },
      }],
      boss: {
        x: 300,
        y: 120,
        radius: 38,
        health: 12_000,
        maxHealth: 30_000,
        chargeDirectionX: -1,
        chargeDirectionY: 0,
        howlDirectionX: 1,
        howlDirectionY: 0,
        howlProgress: 0,
        input: {
          phase: 'enraged',
          attack: 'assault-warning',
          introRemainingMs: 0,
          howlRemainingMs: 0,
          breachRemainingMs: 0,
          impactRemainingMs: 0,
        },
      },
      projectiles: [{
        x: 140,
        y: 120,
        velocityX: 300,
        velocityY: 0,
        artifactId: 'zhu-xie-jian-zhen',
      }],
      artifactFields: [{
        kind: 'array',
        artifactId: 'zhu-xie-jian-zhen',
        x: 100,
        y: 120,
        radius: 180,
        rotation: 0.8,
        pulseRemainingMs: 80,
        pulseDurationMs: 320,
      }],
      enemyProjectiles: [{ x: 220, y: 120, radius: 8 }],
      spell: {
        shieldRemainingMs: 1_200,
        castVisualRemainingMs: 0,
        impactPulseRemainingMs: 0,
        endVisualRemainingMs: 0,
      },
      bursts: [{
        kind: 'hit',
        x: 180,
        y: 120,
        color: 0xf59e0b,
        remainingMs: 60,
        durationMs: 120,
        radius: 30,
      }],
    })
    const recorder = createRecordingCombatPresentationAdapter()

    recorder.present(frame)

    expect(frame.player.presentation.pose).toBe('walk')
    expect(frame.enemies[0]?.presentation.telegraph).toBe('charge-lane')
    expect(frame.boss?.presentation.halo).toBe('cracked-moon')
    expect(frame.projectiles[0]?.presentation.macroShape).toBe('floating-sword-rain')
    expect(frame.artifactFields[0]?.kind).toBe('array')
    expect(frame.enemyProjectiles).toHaveLength(1)
    expect(frame.spell.active).toBe(true)
    expect(frame.feedback[0]?.kind).toBe('hit')
    expect(recorder.frames).toHaveLength(1)
    expect(recorder.frames[0]?.boss?.presentation.telegraph).toBe('assault-lane')
  })

  it('keeps threat semantics while reducing motion intensity', () => {
    const frame = resolveCombatPresentationFrame({
      elapsedMs: 240,
      reducedMotion: true,
      player: {
        x: 100,
        y: 120,
        health: 72,
        maxHealth: 100,
        facingX: 1,
        facingY: 0,
        isMoving: true,
        hitFlashMs: 80,
        hitSparkMs: 220,
        castPoseMs: 0,
        downed: false,
        stopBounceRemainingMs: 0,
        shieldRemainingMs: 1_200,
      },
      enemies: [{
        x: 180,
        y: 120,
        directionX: -1,
        directionY: 0,
        radius: 22,
        health: 40,
        maxHealth: 60,
        isElite: true,
        input: {
          id: 'qing-shi-ridge-elite-wolf',
          isElite: true,
          isMoonShadow: false,
          action: 'windup',
          actionRemainingMs: 500,
          recoveryIsVulnerable: false,
          hitFlashMs: 0,
          facingX: -1,
        },
      }],
      boss: {
        x: 300,
        y: 120,
        radius: 38,
        health: 12_000,
        maxHealth: 30_000,
        chargeDirectionX: -1,
        chargeDirectionY: 0,
        howlDirectionX: 1,
        howlDirectionY: 0,
        howlProgress: 0.5,
        input: {
          phase: 'enraged',
          attack: 'assault-warning',
          introRemainingMs: 0,
          howlRemainingMs: 1_200,
          breachRemainingMs: 0,
          impactRemainingMs: 120,
        },
      },
      projectiles: [{
        x: 140,
        y: 120,
        velocityX: 300,
        velocityY: 0,
        artifactId: 'liu-guang-jian-yi',
      }],
      artifactFields: [{
        kind: 'thunder-impact',
        artifactId: 'jiu-xiao-lei-zhen',
        x: 160,
        y: 120,
        radius: 60,
        remainingMs: 100,
        durationMs: 250,
      }],
      enemyProjectiles: [{ x: 220, y: 120, radius: 8 }],
      spell: {
        shieldRemainingMs: 1_200,
        castVisualRemainingMs: 0,
        impactPulseRemainingMs: 0,
        endVisualRemainingMs: 0,
      },
      bursts: [],
    })

    expect(frame.player.presentation.pose).toBe('hit')
    expect(frame.player.presentation.bob).toBe(0)
    expect(frame.enemies[0]?.presentation.telegraph).toBe('charge-lane')
    expect(frame.boss?.presentation.telegraph).toBe('howl-sector')
    expect(frame.boss?.presentation.shake).toBe(0)
    expect(frame.projectiles[0]?.presentation.hasTrail).toBe(false)
    expect(frame.artifactFields[0]?.kind).toBe('thunder-impact')
    expect(frame.spell.active).toBe(true)
    expect(frame.spell.angle).toBe(0)
  })
})
