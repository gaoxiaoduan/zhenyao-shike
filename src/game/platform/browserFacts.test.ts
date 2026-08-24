import { describe, expect, it, vi } from 'vitest'
import { createBrowserFactsAdapter } from './browserFacts'

function createEnvironment(desktop = true, focused = true) {
  const listeners = new Map<string, Set<EventListener>>()
  const mediaListeners = new Set<EventListener>()
  const browserWindow = {
    innerWidth: 800,
    innerHeight: 500,
    matchMedia: vi.fn(() => ({
      matches: desktop,
      addEventListener: (_type: string, listener: EventListener) => mediaListeners.add(listener),
      removeEventListener: (_type: string, listener: EventListener) => mediaListeners.delete(listener),
    })),
    addEventListener: (type: string, listener: EventListener) => {
      const next = listeners.get(type) ?? new Set<EventListener>()
      next.add(listener)
      listeners.set(type, next)
    },
    removeEventListener: (type: string, listener: EventListener) => {
      listeners.get(type)?.delete(listener)
    },
  } as unknown as Window
  const browserDocument = {
    hidden: false,
    hasFocus: () => focused,
    addEventListener: (type: string, listener: EventListener) => {
      const next = listeners.get(`document:${type}`) ?? new Set<EventListener>()
      next.add(listener)
      listeners.set(`document:${type}`, next)
    },
    removeEventListener: (type: string, listener: EventListener) => {
      listeners.get(`document:${type}`)?.delete(listener)
    },
  } as unknown as Document

  return {
    environment: { window: browserWindow, document: browserDocument },
    emit(type: string) {
      for (const listener of listeners.get(type) ?? []) {
        listener(new Event(type))
      }
    },
    emitDocument(type: string) {
      for (const listener of listeners.get(`document:${type}`) ?? []) {
        listener(new Event(type))
      }
    },
    setSize(width: number, height: number) {
      Object.assign(browserWindow, { innerWidth: width, innerHeight: height })
      this.emit('resize')
    },
    setHidden(hidden: boolean) {
      Object.assign(browserDocument, { hidden })
      this.emitDocument('visibilitychange')
    },
  }
}

describe('createBrowserFactsAdapter', () => {
  it('读取创建时的窗口焦点，避免已失焦的紧凑历练漏掉暂停事实', () => {
    const environment = createEnvironment(true, false)
    const adapter = createBrowserFactsAdapter({ compactMode: true, environment: environment.environment })

    expect(adapter.getSnapshot()).toMatchObject({ focused: false, compactMode: true })
    adapter.dispose()
  })

  it('只报告浏览器事实，并在紧凑模式变化时重算视口', () => {
    const environment = createEnvironment()
    const adapter = createBrowserFactsAdapter({ compactMode: false, environment: environment.environment })
    const facts: ReturnType<typeof adapter.getSnapshot>[] = []
    adapter.subscribe((nextFacts) => facts.push(nextFacts))

    expect(adapter.getSnapshot()).toMatchObject({
      visible: true,
      focused: true,
      compactMode: false,
      viewport: { requiresLargerWindow: true, requiresOrientation: false },
    })

    adapter.setCompactMode(true)
    expect(adapter.getSnapshot()).toMatchObject({
      compactMode: true,
      viewport: { requiresLargerWindow: false, compact: true },
    })
    expect(facts).toHaveLength(2)
  })

  it('把失焦、回焦、页面隐藏和尺寸变化作为可替换适配器事实发布', () => {
    const environment = createEnvironment(false)
    const adapter = createBrowserFactsAdapter({ compactMode: true, environment: environment.environment })
    const facts: ReturnType<typeof adapter.getSnapshot>[] = []
    adapter.subscribe((nextFacts) => facts.push(nextFacts))

    environment.emit('blur')
    environment.setHidden(true)
    environment.setSize(430, 932)
    environment.emit('focus')

    expect(facts.slice(1).map((nextFacts) => ({
      visible: nextFacts.visible,
      focused: nextFacts.focused,
      orientation: nextFacts.viewport.requiresOrientation,
      viewport: nextFacts.viewport.requiresLargerWindow,
    }))).toEqual([
      { visible: true, focused: false, orientation: false, viewport: false },
      { visible: false, focused: false, orientation: false, viewport: false },
      { visible: false, focused: false, orientation: true, viewport: false },
      { visible: false, focused: true, orientation: true, viewport: false },
    ])

    adapter.dispose()
    environment.emit('focus')
    expect(facts).toHaveLength(5)
  })
})
