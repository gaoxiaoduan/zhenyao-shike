import type {
  DamageSource,
  RunArtifactSummary,
  RunEventId,
  RunResult,
  RunSummary,
} from './runSummary'

export const RUN_HISTORY_STORAGE_KEY = 'zhenyao-shike.run-history.v1'
export const BOSS_PRACTICE_STORAGE_KEY = 'zhenyao-shike.boss-practice.v1'
export const MAX_RUN_HISTORY_ENTRIES = 12

interface RunRecordStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface BossPracticeStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface RunHistoryEntry {
  readonly id: string
  readonly recordedAtMs: number
  readonly result: RunResult
  readonly elapsedMs: number
  readonly defeatedEnemies: number
  readonly defeatedElites: number
  readonly bossElapsedMs: number | null
  readonly completedEvents: readonly RunEventId[]
  readonly artifacts: readonly RunArtifactSummary[]
  readonly finalDamageSource: DamageSource
}

export interface RunHistoryBest {
  readonly fastestVictoryMs: number | null
  readonly mostKills: number
  readonly longestSurvivalMs: number
}

export interface RunHistorySnapshot {
  readonly entries: readonly RunHistoryEntry[]
  readonly best: RunHistoryBest
}

export interface RunRecordUpdate {
  readonly isNewRecord: boolean
  readonly demonCoreEarned: boolean
  readonly entry: RunHistoryEntry
  readonly history: RunHistorySnapshot
}

interface StoredRunHistory {
  readonly version: 1
  readonly entries: readonly unknown[]
}

export function createEmptyRunHistory(): RunHistorySnapshot {
  return {
    entries: [],
    best: {
      fastestVictoryMs: null,
      mostKills: 0,
      longestSurvivalMs: 0,
    },
  }
}

export function hasBossPracticeUnlocked(storage: BossPracticeStorage): boolean {
  return storage.getItem(BOSS_PRACTICE_STORAGE_KEY) === 'unlocked'
}

export function unlockBossPractice(storage: BossPracticeStorage): void {
  storage.setItem(BOSS_PRACTICE_STORAGE_KEY, 'unlocked')
}

export function readRunHistory(storage: Pick<RunRecordStorage, 'getItem'>): RunHistorySnapshot {
  const raw = storage.getItem(RUN_HISTORY_STORAGE_KEY)
  if (!raw) {
    return createEmptyRunHistory()
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isStoredRunHistory(parsed)) {
      return createEmptyRunHistory()
    }

    const entries = parsed.entries.filter(isRunHistoryEntry)
    if (entries.length !== parsed.entries.length) {
      return createEmptyRunHistory()
    }
    return createHistorySnapshot(entries)
  } catch {
    return createEmptyRunHistory()
  }
}

export function recordRunResult(
  storage: RunRecordStorage,
  summary: RunSummary,
  recordedAtMs = Date.now(),
): RunRecordUpdate {
  const current = readRunHistory(storage)
  const entry = createRunHistoryEntry(summary, recordedAtMs, current.entries)
  const entries = [entry, ...current.entries].slice(0, MAX_RUN_HISTORY_ENTRIES)
  const history = createHistorySnapshot(entries)
  storage.setItem(RUN_HISTORY_STORAGE_KEY, JSON.stringify({ version: 1, entries }))

  return {
    isNewRecord: isNewPersonalRecord(summary, current),
    demonCoreEarned: summary.result === 'victory' && !current.entries.some((item) => item.result === 'victory'),
    entry,
    history,
  }
}

function createRunHistoryEntry(
  summary: RunSummary,
  recordedAtMs: number,
  existingEntries: readonly RunHistoryEntry[],
): RunHistoryEntry {
  const baseId = `run-${recordedAtMs}`
  let id = baseId
  let suffix = 1
  while (existingEntries.some((entry) => entry.id === id)) {
    id = `${baseId}-${suffix}`
    suffix += 1
  }

  return {
    id,
    recordedAtMs,
    result: summary.result,
    elapsedMs: summary.elapsedMs,
    defeatedEnemies: summary.defeatedEnemies,
    defeatedElites: summary.defeatedElites,
    bossElapsedMs: summary.bossElapsedMs,
    completedEvents: [...summary.completedEvents],
    artifacts: summary.artifacts.map((artifact) => ({ ...artifact })),
    finalDamageSource: summary.finalDamageSource,
  }
}

function createHistorySnapshot(entries: readonly RunHistoryEntry[]): RunHistorySnapshot {
  const victories = entries.filter((entry) => entry.result === 'victory')
  return {
    entries: entries.map((entry) => ({
      ...entry,
      completedEvents: [...entry.completedEvents],
      artifacts: entry.artifacts.map((artifact) => ({ ...artifact })),
    })),
    best: {
      fastestVictoryMs: victories.length ? Math.min(...victories.map((entry) => entry.elapsedMs)) : null,
      mostKills: entries.length ? Math.max(...entries.map((entry) => entry.defeatedEnemies)) : 0,
      longestSurvivalMs: entries.length ? Math.max(...entries.map((entry) => entry.elapsedMs)) : 0,
    },
  }
}

function isNewPersonalRecord(summary: RunSummary, current: RunHistorySnapshot): boolean {
  return current.entries.length === 0
    || summary.defeatedEnemies > current.best.mostKills
    || (summary.result === 'defeat' && summary.elapsedMs > current.best.longestSurvivalMs)
    || (summary.result === 'victory'
      && (current.best.fastestVictoryMs === null || summary.elapsedMs < current.best.fastestVictoryMs))
}

function isStoredRunHistory(value: unknown): value is StoredRunHistory {
  return isRecord(value) && value.version === 1 && Array.isArray(value.entries)
}

function isRunHistoryEntry(value: unknown): value is RunHistoryEntry {
  return isRecord(value)
    && typeof value.id === 'string'
    && isFiniteNumber(value.recordedAtMs)
    && isRunResult(value.result)
    && isFiniteNumber(value.elapsedMs)
    && isFiniteNumber(value.defeatedEnemies)
    && isFiniteNumber(value.defeatedElites)
    && (value.bossElapsedMs === null || isFiniteNumber(value.bossElapsedMs))
    && Array.isArray(value.completedEvents)
    && value.completedEvents.every(isRunEventId)
    && Array.isArray(value.artifacts)
    && value.artifacts.every(isRunArtifactSummary)
    && isDamageSource(value.finalDamageSource)
}

function isRunArtifactSummary(value: unknown): value is RunArtifactSummary {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && isFiniteNumber(value.level)
}

function isRunResult(value: unknown): value is RunResult {
  return value === 'victory' || value === 'defeat'
}

function isRunEventId(value: unknown): value is RunEventId {
  return value === 'demon-lair' || value === 'lingquan'
}

function isDamageSource(value: unknown): value is DamageSource {
  return value === 'ordinary-enemy'
    || value === 'elite-enemy'
    || value === 'wolf-king-contact'
    || value === 'moon-howl'
    || value === 'unknown'
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
