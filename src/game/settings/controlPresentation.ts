import type { ControlAction } from './gameSettings'

export const CONTROL_ACTION_LABELS: Readonly<Record<ControlAction, string>> = {
  moveUp: '向上移动',
  moveDown: '向下移动',
  moveLeft: '向左移动',
  moveRight: '向右移动',
  castSpell: '施放术法',
  pause: '暂停历练',
}

const KEY_LABELS: Readonly<Record<string, string>> = {
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  space: 'Space',
  escape: 'Esc',
}

export function displayControlKey(key: string): string {
  return KEY_LABELS[key] ?? key.toUpperCase()
}
