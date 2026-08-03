export const BASE_FLYING_SWORD_DAMAGE = 12

export interface EnemyStats {
  readonly id: QingShiRidgeEnemyId
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
  { id: 'qing-shi-ridge-boar-demon', health: 24, radius: 13, speed: 24, color: 0x8b5a3c },
  { id: 'qing-shi-ridge-wood-wolf', health: 34, radius: 15, speed: 30, color: 0x6f884c },
  { id: 'qing-shi-ridge-mist-moth', health: 44, radius: 17, speed: 36, color: 0x81648a },
  { id: 'qing-shi-ridge-elite-wolf', health: 180, radius: 24, speed: 40, color: 0xd97706, isElite: true },
]

export function createEnemyStats(id: QingShiRidgeEnemyId): EnemyStats {
  return QING_SHI_RIDGE_ENEMY_STATS.find((stats) => stats.id === id) ?? QING_SHI_RIDGE_ENEMY_STATS[0]!
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
