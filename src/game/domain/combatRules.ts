export const BASE_FLYING_SWORD_DAMAGE = 12

export type EnemyRole = 'armored-charger' | 'pursuer-flanker' | 'ranged-kiter' | 'elite-pouncer'

export interface EnemyStats {
  readonly id: QingShiRidgeEnemyId
  readonly role: EnemyRole
  readonly health: number
  readonly radius: number
  readonly speed: number
  readonly color: number
  readonly isElite?: boolean
}

export type QingShiRidgeEnemyId =
  | 'qing-shi-ridge-boar-demon'
  | 'qing-shi-ridge-wood-wolf'
  | 'qing-shi-ridge-mist-moth'
  | 'qing-shi-ridge-elite-wolf'

export const QING_SHI_RIDGE_COMMON_ENEMY_IDS: readonly QingShiRidgeEnemyId[] = [
  'qing-shi-ridge-boar-demon',
  'qing-shi-ridge-wood-wolf',
  'qing-shi-ridge-mist-moth',
]

export const QING_SHI_RIDGE_ENEMY_IDS: readonly QingShiRidgeEnemyId[] = [
  ...QING_SHI_RIDGE_COMMON_ENEMY_IDS,
  'qing-shi-ridge-elite-wolf',
]

const QING_SHI_RIDGE_ENEMY_STATS: readonly EnemyStats[] = [
  { id: 'qing-shi-ridge-boar-demon', role: 'armored-charger', health: 54, radius: 17, speed: 22, color: 0x8b5a3c },
  { id: 'qing-shi-ridge-wood-wolf', role: 'pursuer-flanker', health: 26, radius: 14, speed: 38, color: 0x6f884c },
  { id: 'qing-shi-ridge-mist-moth', role: 'ranged-kiter', health: 30, radius: 15, speed: 25, color: 0x81648a },
  { id: 'qing-shi-ridge-elite-wolf', role: 'elite-pouncer', health: 240, radius: 24, speed: 34, color: 0xd97706, isElite: true },
]

export function createEnemyStats(id: QingShiRidgeEnemyId): EnemyStats {
  return QING_SHI_RIDGE_ENEMY_STATS.find((stats) => stats.id === id) ?? QING_SHI_RIDGE_ENEMY_STATS[0]!
}

export interface DemonWaveStage {
  readonly index: 0 | 1 | 2 | 3
  readonly startsAtMs: number
  readonly label: string
  readonly activeEnemyTarget: number
  readonly spawnIntervalMs: number
}

const DEMON_WAVE_STAGES: readonly DemonWaveStage[] = [
  { index: 0, startsAtMs: 0, label: '初潮 · 走位求生', activeEnemyTarget: 18, spawnIntervalMs: 900 },
  { index: 1, startsAtMs: 150_000, label: '合围 · 职责交错', activeEnemyTarget: 45, spawnIntervalMs: 520 },
  { index: 2, startsAtMs: 330_000, label: '盛潮 · 构筑成型', activeEnemyTarget: 70, spawnIntervalMs: 360 },
  { index: 3, startsAtMs: 480_000, label: '月蚀 · 密潮压境', activeEnemyTarget: 90, spawnIntervalMs: 250 },
]

export function getDemonWaveStage(elapsedMs: number): DemonWaveStage {
  const safeElapsedMs = Math.max(0, elapsedMs)
  return [...DEMON_WAVE_STAGES]
    .reverse()
    .find((stage) => safeElapsedMs >= stage.startsAtMs) ?? DEMON_WAVE_STAGES[0]!
}

export function chooseCommonEnemyForWave(
  stageIndex: DemonWaveStage['index'],
  randomFloat: number,
): QingShiRidgeEnemyId {
  const roll = Math.max(0, Math.min(0.999_999, randomFloat))
  if (stageIndex === 0) {
    return roll < 0.55 ? 'qing-shi-ridge-boar-demon' : 'qing-shi-ridge-wood-wolf'
  }
  if (stageIndex === 1) {
    return roll < 0.35
      ? 'qing-shi-ridge-boar-demon'
      : roll < 0.75
        ? 'qing-shi-ridge-wood-wolf'
        : 'qing-shi-ridge-mist-moth'
  }
  if (stageIndex === 2) {
    return roll < 0.3
      ? 'qing-shi-ridge-boar-demon'
      : roll < 0.62
        ? 'qing-shi-ridge-wood-wolf'
        : 'qing-shi-ridge-mist-moth'
  }
  return roll < 0.28
    ? 'qing-shi-ridge-boar-demon'
    : roll < 0.58
      ? 'qing-shi-ridge-wood-wolf'
      : 'qing-shi-ridge-mist-moth'
}

const WAVE_COMPOSITIONS: Readonly<Record<DemonWaveStage['index'], readonly QingShiRidgeEnemyId[]>> = {
  0: ['qing-shi-ridge-boar-demon', 'qing-shi-ridge-wood-wolf', 'qing-shi-ridge-wood-wolf'],
  1: ['qing-shi-ridge-boar-demon', 'qing-shi-ridge-wood-wolf', 'qing-shi-ridge-mist-moth', 'qing-shi-ridge-wood-wolf'],
  2: ['qing-shi-ridge-boar-demon', 'qing-shi-ridge-boar-demon', 'qing-shi-ridge-wood-wolf', 'qing-shi-ridge-mist-moth', 'qing-shi-ridge-wood-wolf'],
  3: ['qing-shi-ridge-mist-moth', 'qing-shi-ridge-wood-wolf', 'qing-shi-ridge-boar-demon', 'qing-shi-ridge-wood-wolf', 'qing-shi-ridge-mist-moth'],
}

export interface WaveSpawnDirective {
  readonly enemyId: QingShiRidgeEnemyId
  readonly intervalMultiplier: number
  readonly burstCount: 1 | 2
}

export function getWaveSpawnDirective(elapsedMs: number, spawnOrdinal: number): WaveSpawnDirective {
  const stage = getDemonWaveStage(elapsedMs)
  const composition = WAVE_COMPOSITIONS[stage.index]
  const safeOrdinal = Math.max(0, Math.floor(spawnOrdinal))
  const stageElapsedMs = Math.max(0, elapsedMs - stage.startsAtMs)
  const pulseOffsetMs = stageElapsedMs % 45_000
  const densityPulse = stage.index > 0 && pulseOffsetMs >= 28_000 && pulseOffsetMs < 38_000

  return {
    enemyId: composition[safeOrdinal % composition.length]!,
    intervalMultiplier: densityPulse ? 0.58 : 1,
    burstCount: densityPulse ? 2 : 1,
  }
}

export interface EliteSpawnInput {
  readonly elapsedMs: number
  readonly lastEliteSpawnMs: number | null
  readonly activeEliteCount: number
}

export function shouldSpawnElite(input: EliteSpawnInput): boolean {
  if (input.elapsedMs < 120_000) {
    return false
  }
  const activeLimit = input.elapsedMs >= 480_000 ? 2 : 1
  if (input.activeEliteCount >= activeLimit) {
    return false
  }
  return input.lastEliteSpawnMs === null || input.elapsedMs - input.lastEliteSpawnMs >= 82_500
}

export function applyEnemyPressure(health: number, enemyCount: number, deltaMs: number): number {
  return Math.max(0, health - Math.max(0, enemyCount) * Math.max(0, deltaMs) * 0.009)
}

export function resolveDamage(health: number, damage: number): number {
  return Math.max(0, health - Math.max(0, damage))
}

export interface CameraViewport {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export function getOffscreenSpawnPosition(
  camera: CameraViewport,
  worldSize: number,
  margin = 60,
  randomFloat: () => number = Math.random,
): { readonly x: number; readonly y: number } {
  const side = Math.floor(randomFloat() * 4)
  let x = 0
  let y = 0

  const minX = camera.x - margin
  const maxX = camera.x + camera.width + margin
  const minY = camera.y - margin
  const maxY = camera.y + camera.height + margin

  switch (side) {
    case 0: // Top
      x = minX + randomFloat() * (maxX - minX)
      y = camera.y - margin
      break
    case 1: // Right
      x = camera.x + camera.width + margin
      y = minY + randomFloat() * (maxY - minY)
      break
    case 2: // Bottom
      x = minX + randomFloat() * (maxX - minX)
      y = camera.y + camera.height + margin
      break
    case 3: // Left
    default:
      x = camera.x - margin
      y = minY + randomFloat() * (maxY - minY)
      break
  }

  return {
    x: Math.max(36, Math.min(worldSize - 36, x)),
    y: Math.max(36, Math.min(worldSize - 36, y)),
  }
}
