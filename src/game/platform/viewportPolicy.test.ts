import { describe, expect, it } from 'vitest'
import { computeBattleViewport, computeRenderScale } from './viewportPolicy'

describe('computeBattleViewport', () => {
  it('keeps the 16:9 battlefield at the 1280 by 720 design baseline', () => {
    expect(computeBattleViewport({ width: 1280, height: 720, desktop: true })).toEqual({
      aspectRatio: 16 / 9,
      internalWidth: 1280,
      internalHeight: 720,
      compact: false,
      requiresOrientation: false,
      requiresLargerWindow: false,
      hasInformationWings: false,
    })
  })

  it('expands the battlefield to 21:9 without increasing its design height', () => {
    expect(computeBattleViewport({ width: 2100, height: 900, desktop: true })).toMatchObject({
      aspectRatio: 21 / 9,
      internalWidth: 1680,
      internalHeight: 720,
      hasInformationWings: false,
    })
  })

  it('caps a 32:9 battlefield at 21:9 and exposes information wings', () => {
    expect(computeBattleViewport({ width: 3200, height: 900, desktop: true })).toMatchObject({
      aspectRatio: 21 / 9,
      internalWidth: 1680,
      hasInformationWings: true,
    })
  })

  it('asks a small desktop window to grow without treating it as a rotated phone', () => {
    expect(computeBattleViewport({ width: 800, height: 700, desktop: true })).toMatchObject({
      requiresOrientation: false,
      requiresLargerWindow: true,
    })
  })

  it('keeps a compact desktop run playable below the standard window minimum', () => {
    expect(computeBattleViewport({ width: 800, height: 500, desktop: true, compact: true })).toMatchObject({
      requiresOrientation: false,
      requiresLargerWindow: false,
    })
  })

  it('requires landscape only for a portrait mobile viewport', () => {
    expect(computeBattleViewport({ width: 430, height: 932, desktop: false })).toMatchObject({
      compact: true,
      requiresOrientation: true,
      requiresLargerWindow: false,
    })
  })

  it('uses up to two device pixels on desktop while smooth mode stays at one', () => {
    expect(computeRenderScale({ quality: 'auto', devicePixelRatio: 2.5, desktop: true })).toBe(2)
    expect(computeRenderScale({ quality: 'smooth', devicePixelRatio: 2.5, desktop: true })).toBe(1)
  })
})
