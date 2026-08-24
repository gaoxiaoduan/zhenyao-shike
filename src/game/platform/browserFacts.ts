import { computeBattleViewport, type BattleViewport } from './viewportPolicy'

export interface BrowserFacts {
  readonly visible: boolean
  readonly focused: boolean
  readonly compactMode: boolean
  readonly viewport: BattleViewport
}

export interface BrowserFactsAdapter {
  getSnapshot(): BrowserFacts
  subscribe(listener: (facts: BrowserFacts) => void): () => void
  setCompactMode(compactMode: boolean): void
  dispose(): void
}

export interface BrowserFactsEnvironment {
  readonly window: Window
  readonly document: Document
}

export interface CreateBrowserFactsAdapterOptions {
  readonly compactMode: boolean
  readonly environment?: BrowserFactsEnvironment
}

function getEnvironment(environment?: BrowserFactsEnvironment): BrowserFactsEnvironment {
  return environment ?? { window, document }
}

export function createBrowserFactsAdapter(options: CreateBrowserFactsAdapterOptions): BrowserFactsAdapter {
  const { window: browserWindow, document: browserDocument } = getEnvironment(options.environment)
  const desktopMedia = browserWindow.matchMedia('(hover: hover) and (pointer: fine)')
  const listeners = new Set<(facts: BrowserFacts) => void>()
  let compactMode = options.compactMode
  let focused = browserDocument.hasFocus?.() ?? true
  let disposed = false

  function readSnapshot(): BrowserFacts {
    return {
      visible: !browserDocument.hidden,
      focused,
      compactMode,
      viewport: computeBattleViewport({
        width: browserWindow.innerWidth,
        height: browserWindow.innerHeight,
        desktop: desktopMedia.matches,
        compact: compactMode,
      }),
    }
  }

  let snapshot = readSnapshot()

  function publish() {
    if (disposed) {
      return
    }
    snapshot = readSnapshot()
    for (const listener of listeners) {
      listener(snapshot)
    }
  }

  function handleFocus() {
    focused = true
    publish()
  }

  function handleBlur() {
    focused = false
    publish()
  }

  browserWindow.addEventListener('resize', publish)
  browserWindow.addEventListener('focus', handleFocus)
  browserWindow.addEventListener('blur', handleBlur)
  browserDocument.addEventListener('visibilitychange', publish)
  desktopMedia.addEventListener('change', publish)

  return {
    getSnapshot() {
      return snapshot
    },
    subscribe(listener) {
      if (disposed) {
        return () => undefined
      }
      listeners.add(listener)
      listener(snapshot)
      return () => {
        listeners.delete(listener)
      }
    },
    setCompactMode(nextCompactMode) {
      if (disposed || compactMode === nextCompactMode) {
        return
      }
      compactMode = nextCompactMode
      publish()
    },
    dispose() {
      if (disposed) {
        return
      }
      disposed = true
      browserWindow.removeEventListener('resize', publish)
      browserWindow.removeEventListener('focus', handleFocus)
      browserWindow.removeEventListener('blur', handleBlur)
      browserDocument.removeEventListener('visibilitychange', publish)
      desktopMedia.removeEventListener('change', publish)
      listeners.clear()
    },
  }
}
