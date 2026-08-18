import { describe, expect, it } from 'vitest'
import type { ArtifactId } from './artifactInventory'
import {
  QING_SHI_RIDGE_PRESENTATION_CHECKPOINTS,
  resolveCombatPresentationCheckpoint,
} from './combatPresentationAcceptance'
import {
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
    expect(presentation.textureKey).toBe('qingshi-common-actors')
    expect(presentation.frame).toBe(2)
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
    expect(walkingFrame.frame).toBe(1)
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
    expect(presentation.textureKey).toBe('qingshi-common-actors')
    expect(presentation.frame).toBe(23)
  })

  it('cycles an elite pounce through six readable pixel poses', () => {
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
      elapsedMs: 600,
      reducedMotion: false,
    })

    expect(first.frame).toBe(18)
    expect(last.frame).toBe(23)
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
    expect(presentation.textureKey).toBe('qingshi-combat-actors')
    expect(presentation.frame).toBe(0)
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
    expect(enraged.textureKey).toBe('qingshi-combat-actors')
    expect(enraged.frame).toBe(10)
    expect(enraged.shadowSplit).toBe(true)
    expect(enraged.telegraph).toBe('assault-lane')
    expect(breach.halo).toBe('breach-open')
    expect(breach.moonMarkOpen).toBe(true)
    expect(breach.shake).toBe(0)
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
      ['boss-08-30', 510_000],
    ])
    expect(resolveCombatPresentationCheckpoint(29_999)).toBeNull()
    expect(resolveCombatPresentationCheckpoint(30_000)?.id).toBe('opening-00-30')
    expect(resolveCombatPresentationCheckpoint(510_000)?.id).toBe('boss-08-30')
  })
})
