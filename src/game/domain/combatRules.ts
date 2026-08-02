export const BASE_FLYING_SWORD_DAMAGE = 12

export interface EnemyStats {
  readonly id: QingShiRidgeEnemyId
  readonly health: number
  readonly radius: number
  readonly speed: number
  readonly color: number
}

export type QingShiRidgeEnemyId =
  | 'qing-shi-ridge-boar-demon'
  | 'qing-shi-ridge-wood-wolf'
  | 'qing-shi-ridge-mist-moth'

export const QING_SHI_RIDGE_ENEMY_IDS: readonly QingShiRidgeEnemyId[] = [
  'qing-shi-ridge-boar-demon',
  'qing-shi-ridge-wood-wolf',
  'qing-shi-ridge-mist-moth',
]

const QING_SHI_RIDGE_ENEMY_STATS: readonly EnemyStats[] = [
  { id: 'qing-shi-ridge-boar-demon', health: 24, radius: 13, speed: 24, color: 0x8b5a3c },
  { id: 'qing-shi-ridge-wood-wolf', health: 34, radius: 15, speed: 30, color: 0x6f884c },
  { id: 'qing-shi-ridge-mist-moth', health: 44, radius: 17, speed: 36, color: 0x81648a },
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
