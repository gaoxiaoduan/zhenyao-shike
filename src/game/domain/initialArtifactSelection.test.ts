import { describe, expect, it } from 'vitest'
import {
  createInitialArtifactSelection,
  selectInitialArtifact,
} from './initialArtifactSelection'

describe('首次法器选择', () => {
  it('固定展示三件适合教学的基础法器', () => {
    expect(createInitialArtifactSelection().candidates.map((artifact) => artifact.id)).toEqual([
      'qing-feng-jian-xia',
      'lei-zhuan-fu-ce',
      'fu-yao-yu-yi',
    ])
  })

  it('只能从当前候选中选择一件法器', () => {
    const selection = createInitialArtifactSelection()

    expect(selectInitialArtifact(selection, 'lei-zhuan-fu-ce').selected.id).toBe('lei-zhuan-fu-ce')
    expect(() => selectInitialArtifact(selection, 'si-xiang-zhen-qi')).toThrow(RangeError)
  })
})
