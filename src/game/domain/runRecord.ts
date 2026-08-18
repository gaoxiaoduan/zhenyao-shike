import type {
  DamageSource,
  RunArtifactSummary,
  RunEventId,
  RunResult,
  RunSummary,
} from './runSummary'

export const RUN_HISTORY_STORAGE_KEY = 'zhenyao-shike.run-history.v3'
export const BOSS_PRACTICE_STORAGE_KEY = 'zhenyao-shike.boss-practice.v1'
export const MAX_RUN_HISTORY_ENTRIES = 12
const RUN_HISTORY_SCHEMA_VERSION = 3
const RUN_HISTORY_GAME_VERSION = '0.1.0'

export interface RunRecordStorage {
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
  readonly schemaVersion: 3
  readonly gameVersion: string
  readonly writtenAtMs: number
  readonly checksum: string
  readonly data: StoredRunHistoryData
}

interface StoredRunHistoryData {
  readonly entries: readonly unknown[]
  readonly best: RunHistoryBest
  readonly firstVictoryRecorded: boolean
}

interface StoredRunHistoryState {
  readonly history: RunHistorySnapshot
  readonly firstVictoryRecorded: boolean
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
  return readStoredRunHistory(storage).history
}

function readStoredRunHistory(storage: Pick<RunRecordStorage, 'getItem'>): StoredRunHistoryState {
  const raw = storage.getItem(RUN_HISTORY_STORAGE_KEY)
  if (!raw) {
    return { history: createEmptyRunHistory(), firstVictoryRecorded: false }
  }

  try {
    const parsed = parseStoredRunHistory(raw)
    if (!parsed) {
      return { history: createEmptyRunHistory(), firstVictoryRecorded: false }
    }

    const entries = parsed.data.entries.filter(isRunHistoryEntry)
    if (entries.length !== parsed.data.entries.length) {
      return { history: createEmptyRunHistory(), firstVictoryRecorded: false }
    }
    return {
      history: createHistorySnapshot(entries, parsed.data.best),
      firstVictoryRecorded: parsed.data.firstVictoryRecorded,
    }
  } catch {
    return { history: createEmptyRunHistory(), firstVictoryRecorded: false }
  }
}

export function recordRunResult(
  storage: RunRecordStorage,
  summary: RunSummary,
  recordedAtMs = Date.now(),
): RunRecordUpdate {
  const current = readStoredRunHistory(storage)
  const entry = createRunHistoryEntry(summary, recordedAtMs, current.history.entries)
  const entries = [entry, ...current.history.entries].slice(0, MAX_RUN_HISTORY_ENTRIES)
  const history = createHistorySnapshot(entries, mergeBest(current.history.best, entry))
  const firstVictoryRecorded = current.firstVictoryRecorded || summary.result === 'victory'
  storage.setItem(
    RUN_HISTORY_STORAGE_KEY,
    JSON.stringify(createStoredRunHistory(entries, history.best, firstVictoryRecorded, recordedAtMs)),
  )

  return {
    isNewRecord: isNewPersonalRecord(summary, current.history),
    demonCoreEarned: summary.result === 'victory' && !current.firstVictoryRecorded,
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

function createHistorySnapshot(entries: readonly RunHistoryEntry[], best: RunHistoryBest): RunHistorySnapshot {
  return {
    entries: entries.map((entry) => ({
      ...entry,
      completedEvents: [...entry.completedEvents],
      artifacts: entry.artifacts.map((artifact) => ({ ...artifact })),
    })),
    best: { ...best },
  }
}

function mergeBest(best: RunHistoryBest, entry: RunHistoryEntry): RunHistoryBest {
  return {
    fastestVictoryMs: entry.result === 'victory'
      ? best.fastestVictoryMs === null ? entry.elapsedMs : Math.min(best.fastestVictoryMs, entry.elapsedMs)
      : best.fastestVictoryMs,
    mostKills: Math.max(best.mostKills, entry.defeatedEnemies),
    longestSurvivalMs: Math.max(best.longestSurvivalMs, entry.elapsedMs),
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
  if (!isRecord(value)
    || value.schemaVersion !== RUN_HISTORY_SCHEMA_VERSION
    || value.gameVersion !== RUN_HISTORY_GAME_VERSION
    || !isFiniteNumber(value.writtenAtMs)
    || typeof value.checksum !== 'string'
    || !isRecord(value.data)
    || !Array.isArray(value.data.entries)
    || !value.data.entries.every(isRunHistoryEntry)
    || !isRunHistoryBest(value.data.best)
    || typeof value.data.firstVictoryRecorded !== 'boolean') {
    return false
  }

  return value.checksum === calculateChecksum(JSON.stringify(value.data))
}

function parseStoredRunHistory(raw: string): StoredRunHistory | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    return isStoredRunHistory(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function isValidRunHistoryStorageValue(raw: string): boolean {
  return parseStoredRunHistory(raw) !== null
}

function createStoredRunHistory(
  entries: readonly RunHistoryEntry[],
  best: RunHistoryBest,
  firstVictoryRecorded: boolean,
  writtenAtMs: number,
): StoredRunHistory {
  const data: StoredRunHistoryData = {
    entries,
    best,
    firstVictoryRecorded,
  }
  return {
    schemaVersion: RUN_HISTORY_SCHEMA_VERSION,
    gameVersion: RUN_HISTORY_GAME_VERSION,
    writtenAtMs,
    checksum: calculateChecksum(JSON.stringify(data)),
    data,
  }
}

function calculateChecksum(value: string): string {
  let hash = 2_166_136_261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return (hash >>> 0).toString(16)
}

function isRunHistoryBest(value: unknown): value is RunHistoryBest {
  return isRecord(value)
    && (value.fastestVictoryMs === null || isFiniteNumber(value.fastestVictoryMs))
    && isFiniteNumber(value.mostKills)
    && isFiniteNumber(value.longestSurvivalMs)
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
