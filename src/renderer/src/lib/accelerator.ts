import { formatAcceleratorLabel } from '../../../shared/types'

/** Convert a browser KeyboardEvent into an Electron accelerator string. */
export function acceleratorFromKeyboardEvent(event: KeyboardEvent): string | null {
  const modifiers: string[] = []
  if (event.ctrlKey || event.metaKey) modifiers.push('CommandOrControl')
  if (event.altKey) modifiers.push('Alt')
  if (event.shiftKey) modifiers.push('Shift')

  // Require a modifier for safer global shortcuts.
  if (modifiers.length === 0) return null

  const raw = event.key
  if (['Control', 'Meta', 'Alt', 'Shift', 'OS', 'Dead'].includes(raw)) return null

  let key: string
  if (raw === ' ') key = 'Space'
  else if (raw === '+') key = 'Plus'
  else if (raw === '-') key = 'Minus'
  else if (raw === 'ArrowUp') key = 'Up'
  else if (raw === 'ArrowDown') key = 'Down'
  else if (raw === 'ArrowLeft') key = 'Left'
  else if (raw === 'ArrowRight') key = 'Right'
  else if (raw === 'Escape') key = 'Escape'
  else if (raw === 'Enter') key = 'Enter'
  else if (raw === 'Tab') key = 'Tab'
  else if (raw.length === 1) key = raw.toUpperCase()
  else if (/^F\d{1,2}$/i.test(raw)) key = raw.toUpperCase()
  else return null

  return [...modifiers, key].join('+')
}

export { formatAcceleratorLabel }
