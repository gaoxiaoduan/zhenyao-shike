// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import BattleTouchControls from './BattleTouchControls.vue'

describe('BattleTouchControls input adapter', () => {
  it('将摇杆移动与指针取消分别上报为移动和结束事件', async () => {
    const wrapper = mount(BattleTouchControls)
    const movementZone = wrapper.get('.battle-touch-controls__move-zone')
    vi.spyOn(movementZone.element, 'getBoundingClientRect').mockReturnValue({
      bottom: 200,
      height: 200,
      left: 0,
      right: 200,
      top: 0,
      width: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    Object.assign(movementZone.element, { setPointerCapture: vi.fn() })

    await movementZone.trigger('pointerdown', { clientX: 20, clientY: 20, pointerId: 1 })
    await movementZone.trigger('pointermove', { clientX: 78, clientY: 20, pointerId: 1 })
    await movementZone.trigger('pointercancel', { pointerId: 1 })

    expect(wrapper.emitted('move')).toEqual([
      [{ moveX: 0, moveY: 0 }],
      [{ moveX: 1, moveY: 0 }],
    ])
    expect(wrapper.emitted('end')).toEqual([[]])
  })

  it('在输入重置后忽略旧触点的后续移动', async () => {
    const wrapper = mount(BattleTouchControls, {
      props: { inputResetRevision: 0 },
    })
    const movementZone = wrapper.get('.battle-touch-controls__move-zone')
    vi.spyOn(movementZone.element, 'getBoundingClientRect').mockReturnValue({
      bottom: 200,
      height: 200,
      left: 0,
      right: 200,
      top: 0,
      width: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    Object.assign(movementZone.element, { setPointerCapture: vi.fn() })

    await movementZone.trigger('pointerdown', { clientX: 20, clientY: 20, pointerId: 1 })
    await wrapper.setProps({ inputResetRevision: 1 })
    await movementZone.trigger('pointermove', { clientX: 78, clientY: 20, pointerId: 1 })

    expect(wrapper.emitted('move')).toEqual([[{ moveX: 0, moveY: 0 }]])
  })
})
