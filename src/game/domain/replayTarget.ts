import { formatElapsedTime, GROWTH_PHASE_DURATION_MS } from './runProgress'
import type { RunHistorySnapshot } from './runRecord'
import { BATTLEFIELD_EVENT_COPY } from './runEventPresentation'
import type { RunArtifactSummary, RunEventId, RunSummary } from './runSummary'

const FIRST_SURVIVAL_TARGET_MS = 150_000
const SURVIVAL_STEP_MS = 30_000
const FAST_VICTORY_STEP_MS = 15_000
const KILL_STEP = 15

interface ReplayTargetBase {
  readonly id: string
  readonly title: string
  readonly description: string
}

export type ReplayTarget =
  | (ReplayTargetBase & { readonly kind: 'survival'; readonly goalMs: number })
  | (ReplayTargetBase & { readonly kind: 'event'; readonly eventId: RunEventId })
  | (ReplayTargetBase & { readonly kind: 'victory' })
  | (ReplayTargetBase & { readonly kind: 'boss-enraged' })
  | (ReplayTargetBase & { readonly kind: 'fast-victory'; readonly goalMs: number })
  | (ReplayTargetBase & { readonly kind: 'kills'; readonly goalCount: number })
  | (ReplayTargetBase & {
    readonly kind: 'build'
    readonly baselineArtifactIds: readonly RunArtifactSummary['id'][]
  })

export function createReplayTarget(history: RunHistorySnapshot): ReplayTarget {
  const latest = history.entries[0]
  if (!latest) {
    return createSurvivalTarget(FIRST_SURVIVAL_TARGET_MS, true)
  }

  const unfinishedEvent = findFirstUnfinishedEvent(history.entries)
  const previous = history.entries[1]
  if (latest.result === 'victory') {
    if (unfinishedEvent) {
      return createEventTarget(unfinishedEvent)
    }

    if (latest.bossElapsedMs !== null && !latest.bossReachedEnraged) {
      return createBossEnragedTarget()
    }

    if (previous && hasSameBuild(latest.artifacts, previous.artifacts)) {
      return createBuildTarget(latest)
    }

    if (latest.defeatedEnemies < history.best.mostKills) {
      return createKillTarget(history.best.mostKills + KILL_STEP)
    }

    const fastestVictoryMs = history.best.fastestVictoryMs ?? latest.elapsedMs
    const fasterGoalMs = fastestVictoryMs - FAST_VICTORY_STEP_MS
    return fasterGoalMs > GROWTH_PHASE_DURATION_MS
      ? createFastVictoryTarget(fasterGoalMs)
      : createKillTarget(history.best.mostKills + KILL_STEP)
  }

  const reachedBoss = latest.bossElapsedMs !== null || latest.elapsedMs >= GROWTH_PHASE_DURATION_MS
  if (reachedBoss) {
    if (unfinishedEvent) {
      return createEventTarget(unfinishedEvent)
    }
    return createVictoryTarget()
  }

  if (previous && hasSameBuild(latest.artifacts, previous.artifacts)) {
    return createBuildTarget(latest)
  }

  const survivalBaseMs = Math.max(latest.elapsedMs, history.best.longestSurvivalMs)
  const goalMs = Math.min(
    GROWTH_PHASE_DURATION_MS,
    Math.max(FIRST_SURVIVAL_TARGET_MS, survivalBaseMs + SURVIVAL_STEP_MS),
  )
  return createSurvivalTarget(goalMs, false)
}

export function isReplayTargetCompleted(target: ReplayTarget, summary: RunSummary): boolean {
  switch (target.kind) {
    case 'survival':
      return summary.elapsedMs >= target.goalMs
    case 'event':
      return summary.completedEvents.includes(target.eventId)
    case 'victory':
      return summary.result === 'victory'
    case 'boss-enraged':
      return summary.bossReachedEnraged
    case 'fast-victory':
      return summary.result === 'victory' && summary.elapsedMs <= target.goalMs
    case 'kills':
      return summary.defeatedEnemies >= target.goalCount
    case 'build':
      return summary.artifacts.some((artifact) => !target.baselineArtifactIds.includes(artifact.id))
  }
}

function findFirstUnfinishedEvent(
  entries: RunHistorySnapshot['entries'],
): RunEventId | null {
  const completedEvents = new Set(entries.flatMap((entry) => entry.completedEvents))
  return (['demon-lair', 'lingquan'] as const).find((eventId) => !completedEvents.has(eventId)) ?? null
}

function createSurvivalTarget(goalMs: number, firstTarget: boolean): ReplayTarget {
  const formattedGoal = formatElapsedTime(goalMs)
  return {
    id: `survival-${goalMs}`,
    kind: 'survival',
    goalMs,
    title: firstTarget ? `先撑过 ${formattedGoal}` : `再撑到 ${formattedGoal}`,
    description: `把坚持时间推到 ${formattedGoal}，为下一次升级多留一段走位空间。`,
  }
}

function createEventTarget(eventId: RunEventId): ReplayTarget {
  const eventLabel = BATTLEFIELD_EVENT_COPY[eventId].name
  return {
    id: `event-${eventId}`,
    kind: 'event',
    eventId,
    title: `完成${eventLabel}`,
    description: `完成${eventLabel}，把这场高价值事件带来的成长带回结算。`,
  }
}

function createVictoryTarget(): ReplayTarget {
  return {
    id: 'victory-wolf-king',
    kind: 'victory',
    title: '击败啸月狼王',
    description: '走完十刻成长阶段，击败啸月狼王，完成一局胜利。',
  }
}

function createBossEnragedTarget(): ReplayTarget {
  return {
    id: 'boss-enraged',
    kind: 'boss-enraged',
    title: '经历啸月狼王·狂月',
    description: '把妖王战推进到狂月阶段，读懂月影突袭，再寻找破绽完成镇压。',
  }
}

function createFastVictoryTarget(goalMs: number): ReplayTarget {
  const formattedGoal = formatElapsedTime(goalMs)
  return {
    id: `fast-victory-${goalMs}`,
    kind: 'fast-victory',
    goalMs,
    title: '更快镇压妖王',
    description: `在 ${formattedGoal} 内击败啸月狼王，比个人最快胜场再快一步。`,
  }
}

function createBuildTarget(entry: RunHistorySnapshot['entries'][number]): ReplayTarget {
  const baselineArtifactIds = entry.artifacts.map((artifact) => artifact.id)
  return {
    id: `build-${baselineArtifactIds.join('-')}`,
    kind: 'build',
    baselineArtifactIds,
    title: '换一条法器构筑',
    description: '下一局至少换掉一件本局法器，让构筑走出不同的路。',
  }
}

function createKillTarget(goalCount: number): ReplayTarget {
  return {
    id: `kills-${goalCount}`,
    kind: 'kills',
    goalCount,
    title: `再斩 ${goalCount} 只妖物`,
    description: `本局斩妖至少 ${goalCount} 只，刷新“最高斩妖”个人最佳。`,
  }
}

function hasSameBuild(
  left: readonly RunArtifactSummary[],
  right: readonly RunArtifactSummary[],
): boolean {
  if (!left.length || left.length !== right.length) {
    return false
  }

  const leftIds = left.map((artifact) => artifact.id).sort()
  const rightIds = right.map((artifact) => artifact.id).sort()
  return leftIds.every((artifactId, index) => artifactId === rightIds[index])
}
