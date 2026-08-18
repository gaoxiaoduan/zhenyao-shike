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

  it('exposes the personal history and compact run entry points', async () => {
    const wrapper = mount(HomeScreen, { props: { fullscreenAvailable: true } })

    await wrapper.get('button[aria-label="打开历练记录"]').trigger('click')
    await wrapper.get('button[aria-label="开始小窗历练"]').trigger('click')

    expect(wrapper.emitted('openHistory')).toHaveLength(1)
    expect(wrapper.emitted('compactStart')).toHaveLength(1)
  })
})
