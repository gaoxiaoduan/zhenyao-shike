// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import HomeScreen from './HomeScreen.vue'

describe('HomeScreen', () => {
  it('starts a run from the visible primary action', async () => {
    const wrapper = mount(HomeScreen, { props: { fullscreenAvailable: true } })

    await wrapper.get('button[aria-label="开始青石岭历练"]').trigger('click')

    expect(wrapper.emitted('start')).toHaveLength(1)
  })

  it('shows the no-reward 妖王演练 only after it is unlocked', async () => {
    const wrapper = mount(HomeScreen, { props: { fullscreenAvailable: true, bossPracticeUnlocked: true } })
    await wrapper.get('button[aria-label="进入妖王演练"]').trigger('click')
    expect(wrapper.emitted('practice')).toHaveLength(1)
  })
})
