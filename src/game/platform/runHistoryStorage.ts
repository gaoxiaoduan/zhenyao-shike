import {
  BOSS_PRACTICE_STORAGE_KEY,
  RUN_HISTORY_STORAGE_KEY,
  type RunRecordStorage,
} from '../domain/runRecord'

export const RUN_HISTORY_DATABASE_NAME = 'zhenyao-shike.saves.v1'
export const RUN_HISTORY_DATABASE_VERSION = 1
export const RUN_HISTORY_STORE_NAME = 'records'

export interface BrowserRunHistoryStorage extends RunRecordStorage {
  readonly ready: Promise<void>
  flush(): Promise<void>
}

const BACKUP_KEY_SUFFIX = ':backup'

export function createBrowserRunHistoryStorage(): BrowserRunHistoryStorage {
  const memoryValues = new Map<string, string>()
  let database: IDBDatabase | null = null
  let pendingWrite = Promise.resolve()

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
          if (database) {
            await writeRecord(database, key, value)
          }
        })
        .catch(() => undefined)
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
        const value = await readRecord(database, key)
        if (value !== null) {
          memoryValues.set(key, value)
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

function readRecord(database: IDBDatabase, key: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(RUN_HISTORY_STORE_NAME, 'readonly')
    const store = transaction.objectStore(RUN_HISTORY_STORE_NAME)
    const request = store.get(key)
    request.onsuccess = () => {
      if (typeof request.result === 'string') {
        resolve(request.result)
        return
      }
      const backupRequest = store.get(`${key}${BACKUP_KEY_SUFFIX}`)
      backupRequest.onsuccess = () => resolve(typeof backupRequest.result === 'string' ? backupRequest.result : null)
      backupRequest.onerror = () => reject(backupRequest.error ?? new Error('Unable to read backup save'))
    }
    request.onerror = () => reject(request.error ?? new Error('Unable to read local save'))
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to read local save transaction'))
  })
}

function writeRecord(database: IDBDatabase, key: string, value: string): Promise<void> {
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
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to write local save transaction'))
  })
}
