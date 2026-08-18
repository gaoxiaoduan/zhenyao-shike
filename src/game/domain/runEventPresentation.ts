import type { RunEventId } from './runSummary'

export interface RunEventCopy {
  readonly name: string
  readonly reward: string
  readonly objectives: {
    readonly report: string
    readonly travel: string
    readonly active: string
  }
}

export const BATTLEFIELD_EVENT_COPY: Readonly<Record<RunEventId, RunEventCopy>> = {
  'demon-lair': {
    name: '妖巢暴动',
    objectives: {
      report: '45 秒内前往妖巢；抵达后有独立 60 秒战斗期，摧毁妖巢并击败守巢精英。',
      travel: '45 秒内前往妖巢',
      active: '60 秒内摧毁妖巢并击败守巢精英',
    },
    reward: '40 灵蕴 · +1 推演 · 结算 8 灵石',
  },
  lingquan: {
    name: '灵泉涌现',
    objectives: {
      report: '45 秒内前往青蓝区域并维持两秒引导，恢复生命并扩大灵蕴拾取范围。',
      travel: '45 秒内前往青蓝区域',
      active: '完成两秒引导，恢复生命并扩大拾取范围',
    },
    reward: '恢复 35% 最大生命 · 拾取范围 ×2（30 秒）',
  },
}
