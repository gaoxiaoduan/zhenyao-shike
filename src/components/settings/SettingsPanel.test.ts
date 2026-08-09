// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DEFAULT_GAME_SETTINGS } from '../../game/settings/gameSettings'
import SettingsPanel from './SettingsPanel.vue'

describe('SettingsPanel', () => {
  it('reports music volume changes through its public event', async () => {
    const wrapper = mount(SettingsPanel, {
      props: {
        settings: DEFAULT_GAME_SETTINGS,
        fullscreenAvailable: true,
        rebindError: null,
      },
    })

    await wrapper.get('input[aria-label="音乐音量"]').setValue('0.3')

    expect(wrapper.emitted('updateSettings')?.at(-1)).toEqual([{ musicVolume: 0.3 }])
  })

  it('owns Escape while open so the battle cannot resume behind it', async () => {
    const wrapper = mount(SettingsPanel, {
      props: {
        settings: DEFAULT_GAME_SETTINGS,
        fullscreenAvailable: true,
        rebindError: null,
      },
    })

    await wrapper.trigger('keydown', { key: 'Escape' })

    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
