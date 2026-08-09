// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createInitialArtifactSelection } from '../game/domain/initialArtifactSelection'
import InitialArtifactSelectionModal from './InitialArtifactSelectionModal.vue'

describe('InitialArtifactSelectionModal', () => {
  it('selects the matching visible card when the player presses 1, 2, or 3', async () => {
    const candidates = createInitialArtifactSelection().candidates
    const wrapper = mount(InitialArtifactSelectionModal, { props: { candidates } })

    await wrapper.trigger('keydown', { key: '2' })

    expect(wrapper.emitted('select')).toEqual([[candidates[1]!.id]])
    expect(wrapper.text()).toContain('按 1')
    expect(wrapper.text()).toContain('按 2')
    expect(wrapper.text()).toContain('按 3')
  })
})
