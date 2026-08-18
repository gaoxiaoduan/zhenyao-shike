// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createEmptyRunHistory } from '../../game/domain/runRecord'
import type { RunSummary } from '../../game/domain/runSummary'
import ResultScreen from './ResultScreen.vue'

const summary: RunSummary = {
  result: 'victory',
  elapsedMs: 602_000,
  defeatedEnemies: 213,
  defeatedElites: 3,
  bossElapsedMs: 96_000,
  completedEvents: ['demon-lair', 'lingquan'],
  artifacts: [{ id: 'qing-feng-jian-xia', name: '青锋剑匣', level: 3 }],
  spiritStones: 12,
  demonCores: 1,
  finalDamageSource: 'unknown',
  hint: '换一条构筑路线试试。',
}

describe('ResultScreen', () => {
  it('shows the run record and exposes the retry action', async () => {
    const wrapper = mount(ResultScreen, { props: { summary, newRecord: true, runHistory: createEmptyRunHistory() } })

    expect(wrapper.text()).toContain('妖王伏诛')
    expect(wrapper.text()).toContain('213')
    expect(wrapper.text()).toContain('精英斩妖')
    expect(wrapper.text()).toContain('10:02')
    expect(wrapper.text()).toContain('1:36')
    expect(wrapper.text()).toContain('新纪录')
    expect(wrapper.text()).toContain('妖巢暴动已完成')
    expect(wrapper.text()).toContain('灵泉涌现已完成')
    expect(wrapper.text()).toContain('已写入历练记录')

    await wrapper.get('button[aria-label="查看历练记录"]').trigger('click')
    expect(wrapper.emitted('openHistory')).toHaveLength(1)

    await wrapper.get('button[aria-label="再次进入青石岭"]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('explains when the history is only kept for the current session', () => {
    const wrapper = mount(ResultScreen, {
      props: { summary, newRecord: false, persistenceStatus: 'session-only' },
    })

    expect(wrapper.text()).toContain('本局记录仅保留在当前会话')
  })
})
