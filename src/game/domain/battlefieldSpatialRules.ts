const BASE_ASPECT_RATIO = 16 / 9
export const COMBAT_VIEW_WIDTH_RATIO = 0.35
export const TARGETING_BUFFER_RATIO = 0.05

export interface WorldPoint {
  readonly x: number
  readonly y: number
}

export interface WorldView extends WorldPoint {
  readonly width: number
  readonly height: number
}

export interface CombatCameraInput {
  readonly viewportWidth: number
  readonly viewportHeight: number
  readonly worldSize: number
}

export interface CombatCamera {
  readonly worldWidth: number
  readonly worldHeight: number
  readonly zoom: number
}

export function computeCombatCamera(input: CombatCameraInput): CombatCamera {
  const baselineWorldWidth = input.worldSize * COMBAT_VIEW_WIDTH_RATIO
  const worldHeight = baselineWorldWidth / BASE_ASPECT_RATIO
  const zoom = input.viewportHeight / worldHeight

  return {
    worldWidth: input.viewportWidth / zoom,
    worldHeight,
    zoom,
  }
}

export function isInsideTargetingEnvelope(
  point: WorldPoint,
  view: WorldView,
  bufferRatio = TARGETING_BUFFER_RATIO,
): boolean {
  const bufferX = view.width * Math.max(0, bufferRatio)
  const bufferY = view.height * Math.max(0, bufferRatio)
  return point.x >= view.x - bufferX
    && point.x <= view.x + view.width + bufferX
    && point.y >= view.y - bufferY
    && point.y <= view.y + view.height + bufferY
}

export interface RadarBounds extends WorldPoint {
  readonly size: number
}

export function projectRadarPoint(
  point: WorldPoint,
  worldSize: number,
  bounds: RadarBounds,
): WorldPoint {
  const safeWorldSize = Math.max(1, worldSize)
  return {
    x: bounds.x + Math.max(0, Math.min(1, point.x / safeWorldSize)) * bounds.size,
    y: bounds.y + Math.max(0, Math.min(1, point.y / safeWorldSize)) * bounds.size,
  }
}

export interface WeightedRadarPoint extends WorldPoint {
  readonly value?: number
}

export interface RadarCell {
  readonly gridX: number
  readonly gridY: number
  readonly count: number
  readonly totalValue: number
}

export function aggregateRadarPoints(
  points: readonly WeightedRadarPoint[],
  worldSize: number,
  gridSize = 10,
): readonly RadarCell[] {
  const safeGridSize = Math.max(1, Math.floor(gridSize))
  const safeWorldSize = Math.max(1, worldSize)
  const cells = new Map<string, RadarCell>()

  for (const point of points) {
    const gridX = Math.min(safeGridSize - 1, Math.max(0, Math.floor(point.x / safeWorldSize * safeGridSize)))
    const gridY = Math.min(safeGridSize - 1, Math.max(0, Math.floor(point.y / safeWorldSize * safeGridSize)))
    const key = `${gridX}:${gridY}`
    const current = cells.get(key)
    cells.set(key, {
      gridX,
      gridY,
      count: (current?.count ?? 0) + 1,
      totalValue: (current?.totalValue ?? 0) + Math.max(0, point.value ?? 1),
    })
  }

  return [...cells.values()].sort((left, right) => left.gridY - right.gridY || left.gridX - right.gridX)
}
