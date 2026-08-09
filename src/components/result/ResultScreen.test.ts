// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { RunSummary } from '../../game/domain/runSummary'
import ResultScreen from './ResultScreen.vue'

const summary: RunSummary = {
  result: 'victory',
  elapsedMs: 602_000,
  defeatedEnemies: 213,
  artifacts: [{ id: 'qing-feng-jian-xia', name: '青锋剑匣', level: 3 }],
  spiritStones: 12,
  demonCores: 1,
  demonLairDestroyed: true,
  finalDamageSource: 'unknown',
  hint: '换一条构筑路线试试。',
}

describe('ResultScreen', () => {
  it('shows the run record and exposes the retry action', async () => {
    const wrapper = mount(ResultScreen, { props: { summary, newRecord: true } })

    expect(wrapper.text()).toContain('妖王伏诛')
    expect(wrapper.text()).toContain('213')
    expect(wrapper.text()).toContain('10:02')
    expect(wrapper.text()).toContain('新纪录')
    expect(wrapper.text()).toContain('妖巢暴动已完成')

    await wrapper.get('button[aria-label="再次进入青石岭"]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
