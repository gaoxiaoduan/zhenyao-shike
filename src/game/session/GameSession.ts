export type PauseReason = 'manual' | 'orientation' | 'visibility' | 'upgrade'

export type GameSessionEvent =
  | { readonly type: 'pause-requested' }
  | { readonly type: 'run-ended'; readonly result: 'victory' | 'defeat' }

export interface GameSession {
  pause(reason: PauseReason): void
  resume(reason: PauseReason): void
  setInputIntent(intent: InputIntent): void
  dispose(): void
}

export interface CreateGameSessionOptions {
  readonly parent: HTMLElement
  readonly onEvent: (event: GameSessionEvent) => void
}
import type { InputIntent } from '../domain/inputIntent'
