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
})
