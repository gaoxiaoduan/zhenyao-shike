import type { QualityMode } from '../settings/gameSettings'

export const BATTLE_DESIGN_HEIGHT = 720
export const BATTLE_BASE_ASPECT_RATIO = 16 / 9
export const BATTLE_MAX_ASPECT_RATIO = 21 / 9
export const MIN_DESKTOP_WIDTH = 960
export const MIN_DESKTOP_HEIGHT = 540

export interface BattleViewportInput {
  readonly width: number
  readonly height: number
  readonly desktop: boolean
  readonly compact?: boolean
}

export interface BattleViewport {
  readonly aspectRatio: number
  readonly internalWidth: number
  readonly internalHeight: number
  readonly compact?: boolean
  readonly requiresOrientation: boolean
  readonly requiresLargerWindow: boolean
  readonly hasInformationWings: boolean
}

export interface RenderScaleInput {
  readonly quality: QualityMode
  readonly devicePixelRatio: number
  readonly desktop: boolean
}

export function computeBattleViewport(input: BattleViewportInput): BattleViewport {
  const windowAspect = input.height > 0 ? input.width / input.height : BATTLE_BASE_ASPECT_RATIO
  const aspectRatio = Math.min(
    BATTLE_MAX_ASPECT_RATIO,
    Math.max(BATTLE_BASE_ASPECT_RATIO, windowAspect),
  )

  return {
    aspectRatio,
    internalWidth: Math.round(BATTLE_DESIGN_HEIGHT * aspectRatio),
    internalHeight: BATTLE_DESIGN_HEIGHT,
    compact: Boolean(input.compact),
    requiresOrientation: !input.desktop && input.height > input.width,
    requiresLargerWindow:
      input.desktop
      && !input.compact
      && (input.width < MIN_DESKTOP_WIDTH || input.height < MIN_DESKTOP_HEIGHT),
    hasInformationWings: windowAspect > BATTLE_MAX_ASPECT_RATIO,
  }
}

export function computeRenderScale(input: RenderScaleInput): number {
  if (input.quality === 'smooth') {
    return 1
  }

  const cap = input.desktop ? 2 : 1.5
  if (input.quality === 'sharp') {
    return cap
  }

  return Math.min(cap, Math.max(1, input.devicePixelRatio))
}
