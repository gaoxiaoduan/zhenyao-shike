import type { RunResult } from './runSummary'

export const RUN_RECORD_STORAGE_KEY = 'zhenyao-shike.run-record.v1'

interface RunRecordStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface StoredRunRecord {
  readonly version: 1
  readonly longestElapsedMs: number
  readonly firstVictoryRecorded: boolean
}

export interface RunRecordUpdate {
  readonly isNewRecord: boolean
  readonly demonCoreEarned: boolean
}

export function recordRunResult(
  storage: RunRecordStorage,
  elapsedMs: number,
  result: RunResult,
): RunRecordUpdate {
  const currentRecord = readRunRecord(storage)
  const isNewRecord = elapsedMs > currentRecord.longestElapsedMs
  const demonCoreEarned = result === 'victory' && !currentRecord.firstVictoryRecorded
  const nextRecord: StoredRunRecord = {
    version: 1,
    longestElapsedMs: Math.max(currentRecord.longestElapsedMs, elapsedMs),
    firstVictoryRecorded: currentRecord.firstVictoryRecorded || result === 'victory',
  }
  storage.setItem(RUN_RECORD_STORAGE_KEY, JSON.stringify(nextRecord))
  return { isNewRecord, demonCoreEarned }
}

function readRunRecord(storage: RunRecordStorage): StoredRunRecord {
  const fallback: StoredRunRecord = { version: 1, longestElapsedMs: 0, firstVictoryRecorded: false }
  const raw = storage.getItem(RUN_RECORD_STORAGE_KEY)
  if (!raw) {
    return fallback
  }

  try {
    const record: unknown = JSON.parse(raw)
    if (
      typeof record === 'object' &&
      record !== null &&
      'version' in record &&
      record.version === 1 &&
      'longestElapsedMs' in record &&
      typeof record.longestElapsedMs === 'number' &&
      Number.isFinite(record.longestElapsedMs)
    ) {
      return {
        version: 1,
        longestElapsedMs: record.longestElapsedMs,
        firstVictoryRecorded:
          'firstVictoryRecorded' in record && typeof record.firstVictoryRecorded === 'boolean'
            ? record.firstVictoryRecorded
            : false,
      }
    }
  } catch {
    return fallback
  }
  return fallback
}
