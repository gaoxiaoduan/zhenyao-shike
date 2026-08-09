import { describe, expect, it } from 'vitest'
import { createRunSummary } from './runSummary'

describe('createRunSummary', () => {
  it('explains a failed run with retained event rewards and its final damage source', () => {
    expect(createRunSummary({
      result: 'defeat',
      elapsedMs: 225_000,
      defeatedEnemies: 42,
      defeatedElites: 1,
      demonLairDestroyed: true,
      artifacts: [{ id: 'qing-feng-jian-xia', name: '青锋剑匣', level: 4 }],
      finalDamageSource: 'ordinary-enemy',
    })).toEqual({
      result: 'defeat',
      elapsedMs: 225_000,
      defeatedEnemies: 42,
      artifacts: [{ id: 'qing-feng-jian-xia', name: '青锋剑匣', level: 4 }],
      spiritStones: 10,
      demonCores: 0,
      demonLairDestroyed: true,
      finalDamageSource: 'ordinary-enemy',
      hint: '妖群贴身造成了最后一击；保持移动，并优先补足范围压制。',
    })
  })
})
