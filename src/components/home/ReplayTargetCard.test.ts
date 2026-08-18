// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ReplayTargetCard from './ReplayTargetCard.vue'

const target = {
  id: 'survival-150000',
  kind: 'survival' as const,
  goalMs: 150_000,
  title: '先撑过 02:30',
  description: '把坚持时间推到 02:30，为下一次升级多留一段走位空间。',
}

describe('ReplayTargetCard', () => {
  it('shows the next run target in a compact, player-facing card', () => {
    const wrapper = mount(ReplayTargetCard, { props: { target } })

    expect(wrapper.get('[aria-label="再来一把目标"]').text()).toContain('先撑过 02:30')
    expect(wrapper.text()).toContain('为下一次升级多留一段走位空间')
  })

  it('shows completion feedback after the previous run met its target', () => {
    const wrapper = mount(ReplayTargetCard, {
      props: {
        target,
        previousTarget: target,
        previousTargetCompleted: true,
        variant: 'result',
      },
    })

    expect(wrapper.text()).toContain('上一局目标已完成')
    expect(wrapper.text()).toContain('完成：先撑过 02:30')
    expect(wrapper.text()).toContain('下一局目标')
  })

  it('keeps an unfinished target visible as a low-pressure continuation', () => {
    const wrapper = mount(ReplayTargetCard, {
      props: { target, previousTarget: target, variant: 'result' },
    })

    expect(wrapper.text()).toContain('上一局目标未完成')
    expect(wrapper.text()).toContain('继续：先撑过 02:30')
  })
})
