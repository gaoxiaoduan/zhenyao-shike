// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { RunHistorySnapshot } from '../../game/domain/runRecord'
import RunHistoryPanel from './RunHistoryPanel.vue'

const history: RunHistorySnapshot = {
  best: {
    fastestVictoryMs: 180_000,
    mostKills: 55,
    longestSurvivalMs: 225_000,
  },
  entries: [{
    id: 'run-1',
    recordedAtMs: 1_700_000_000_000,
    result: 'victory',
    elapsedMs: 180_000,
    defeatedEnemies: 55,
    defeatedElites: 2,
    bossElapsedMs: 42_000,
    completedEvents: ['demon-lair', 'lingquan'],
    artifacts: [{ id: 'qing-feng-jian-xia', name: '青锋剑匣', level: 5 }],
    finalDamageSource: 'unknown',
  }],
}

describe('RunHistoryPanel', () => {
  it('shows replay metrics and closes through its public action', async () => {
    const wrapper = mount(RunHistoryPanel, { props: { history } })

    expect(wrapper.get('[role="dialog"]').text()).toContain('最快胜场')
    expect(wrapper.text()).toContain('03:00')
    expect(wrapper.text()).toContain('55')
    expect(wrapper.text()).toContain('妖王战 00:42')
    expect(wrapper.text()).toContain('妖巢暴动 · 灵泉涌现')
    expect(wrapper.text()).toContain('青锋剑匣 · Lv.5')

    await wrapper.get('button[aria-label="关闭历练记录"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
