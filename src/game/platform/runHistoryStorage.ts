import {
  BOSS_PRACTICE_STORAGE_KEY,
  isValidRunHistoryStorageValue,
  RUN_HISTORY_STORAGE_KEY,
  type RunRecordStorage,
} from '../domain/runRecord'

export const RUN_HISTORY_DATABASE_NAME = 'zhenyao-shike.saves.v1'
export const RUN_HISTORY_DATABASE_VERSION = 1
export const RUN_HISTORY_STORE_NAME = 'records'

export interface BrowserRunHistoryStorage extends RunRecordStorage {
  readonly ready: Promise<void>
  flush(): Promise<boolean>
}

const BACKUP_KEY_SUFFIX = ':backup'

interface StoredRecordPair {
  readonly current: string | null
  readonly backup: string | null
}

export function createBrowserRunHistoryStorage(): BrowserRunHistoryStorage {
  const memoryValues = new Map<string, string>()
  let database: IDBDatabase | null = null
  let pendingWrite: Promise<boolean> = Promise.resolve(true)

  const ready = hydrate()

  return {
    ready,
    getItem(key) {
      return memoryValues.get(key) ?? null
    },
    setItem(key, value) {
      memoryValues.set(key, value)
      pendingWrite = pendingWrite
        .then(async () => {
          await ready
          return database ? writeRecord(database, key, value) : false
        })
        .catch(() => false)
    },
    flush() {
      return pendingWrite
    },
  }

  async function hydrate(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      return
    }

    try {
      database = await openDatabase()
      for (const key of [RUN_HISTORY_STORAGE_KEY, BOSS_PRACTICE_STORAGE_KEY]) {
        const pair = await readRecordPair(database, key)
        const currentIsValid = isValidStoredRecord(key, pair.current)
        const backupIsValid = isValidStoredRecord(key, pair.backup)
        const value = currentIsValid
          ? pair.current
          : backupIsValid
            ? pair.backup
            : pair.current ?? pair.backup
        if (value !== null) {
          memoryValues.set(key, value)
        }
        if (!currentIsValid && backupIsValid && pair.backup !== null) {
          await restoreRecord(database, key, pair.backup)
        }
      }
    } catch {
      database = null
    }
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(RUN_HISTORY_DATABASE_NAME, RUN_HISTORY_DATABASE_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(RUN_HISTORY_STORE_NAME)) {
        request.result.createObjectStore(RUN_HISTORY_STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open local save database'))
    request.onblocked = () => reject(new Error('Local save database is blocked'))
  })
}

function isValidStoredRecord(key: string, value: string | null): boolean {
  if (value === null) {
    return false
  }
  return key === RUN_HISTORY_STORAGE_KEY ? isValidRunHistoryStorageValue(value) : value === 'unlocked'
}

function readRecordPair(database: IDBDatabase, key: string): Promise<StoredRecordPair> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(RUN_HISTORY_STORE_NAME, 'readonly')
    const store = transaction.objectStore(RUN_HISTORY_STORE_NAME)
    const request = store.get(key)
    const backupRequest = store.get(`${key}${BACKUP_KEY_SUFFIX}`)
    let current: string | null | undefined
    let backup: string | null | undefined
    const finish = () => {
      if (current !== undefined && backup !== undefined) {
        resolve({ current, backup })
      }
    }
    request.onsuccess = () => {
      current = typeof request.result === 'string' ? request.result : null
      finish()
    }
    backupRequest.onsuccess = () => {
      backup = typeof backupRequest.result === 'string' ? backupRequest.result : null
      finish()
    }
    request.onerror = () => reject(request.error ?? new Error('Unable to read local save'))
    backupRequest.onerror = () => reject(backupRequest.error ?? new Error('Unable to read backup save'))
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to read local save transaction'))
  })
}

function restoreRecord(database: IDBDatabase, key: string, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(RUN_HISTORY_STORE_NAME, 'readwrite')
    transaction.objectStore(RUN_HISTORY_STORE_NAME).put(value, key)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to write local save transaction'))
  })
}

function writeRecord(database: IDBDatabase, key: string, value: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(RUN_HISTORY_STORE_NAME, 'readwrite')
    const store = transaction.objectStore(RUN_HISTORY_STORE_NAME)
    const currentRequest = store.get(key)
    currentRequest.onsuccess = () => {
      if (typeof currentRequest.result === 'string') {
        store.put(currentRequest.result, `${key}${BACKUP_KEY_SUFFIX}`)
      }
      store.put(value, key)
    }
    currentRequest.onerror = () => reject(currentRequest.error ?? new Error('Unable to prepare local save'))
    transaction.oncomplete = () => resolve(true)
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to write local save transaction'))
  })
}
