// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createArtifactInventory, generateUpgradeChoices } from '../game/domain/artifactInventory'
import UpgradeSelectionModal from './UpgradeSelectionModal.vue'

describe('UpgradeSelectionModal', () => {
  it('maps number-row and numpad keys to the three main choices', async () => {
    const choices = generateUpgradeChoices(createArtifactInventory('qing-feng-jian-xia'), 3)
    const wrapper = mount(UpgradeSelectionModal, {
      props: { choices, ascensions: [], deductionCount: 1 },
    })

    await wrapper.trigger('keydown', { key: '3', code: 'Numpad3' })

    expect(wrapper.emitted('select')).toEqual([[choices[2]!.choiceId]])
    expect(wrapper.findAll('kbd').map((badge) => badge.text())).toEqual(['按 1', '按 2', '按 3'])
  })

  it('maps number keys to ascensions when the ascension phase is shown alone', async () => {
    const ascensions = [{
      choiceId: 'ascend-test',
      resultId: 'liu-guang-jian-yi',
      name: '流光剑意',
      description: '升阶测试',
      sourceIds: ['qing-feng-jian-xia', 'fu-yao-yu-yi'],
      sourceNames: ['青锋剑匣', '缚妖羽衣'],
      slotCountBefore: 2,
      slotCountAfter: 1,
      attackColor: 0xf0abfc,
    }] as const
    const wrapper = mount(UpgradeSelectionModal, {
      props: { choices: [], ascensions, deductionCount: 0 },
    })

    await wrapper.trigger('keydown', { key: '1', code: 'Digit1' })

    expect(wrapper.emitted('selectAscension')).toEqual([['ascend-test']])
    expect(wrapper.find('kbd').text()).toBe('按 1')
  })
})
