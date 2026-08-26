import { useEffect } from 'react'
import type { TimerSnapshot } from '../../../shared/ipc'
import { useSettingsStore } from '../stores/settingsStore'
import { useTimerStore } from '../stores/timerStore'

function toSnapshot(
  state: ReturnType<typeof useTimerStore.getState>,
  sessionsUntilLongBreak: number
): TimerSnapshot {
  return {
    phase: state.phase,
    status: state.status,
    remainingMs: state.remainingMs,
    plannedMs: state.plannedMs,
    endsAt: state.endsAt,
    focusCountInCycle: state.focusCountInCycle,
    sessionsUntilLongBreak
  }
}

function isRunningTickOnly(
  state: ReturnType<typeof useTimerStore.getState>,
  prev: ReturnType<typeof useTimerStore.getState>
): boolean {
  return (
    state.status === 'running' &&
    prev.status === 'running' &&
    state.endsAt === prev.endsAt &&
    state.phase === prev.phase &&
    state.plannedMs === prev.plannedMs &&
    state.focusCountInCycle === prev.focusCountInCycle
  )
}

/** Bridge the main-window timer (owns the ticker) with the mini floating view. */
function useTimerBridge(enabled: boolean): void {
  const sessionsUntilLongBreak = useSettingsStore((s) => s.settings.sessionsUntilLongBreak)

  useEffect(() => {
    if (!enabled) return

    const publish = (): void => {
      void window.api.timer.publish(toSnapshot(useTimerStore.getState(), sessionsUntilLongBreak))
    }

    publish()

    // Skip per-tick remainingMs updates while running — mini countdowns from endsAt locally.
    const unsubscribeStore = useTimerStore.subscribe((state, prev) => {
      if (isRunningTickOnly(state, prev)) return
      publish()
    })

    const unsubscribeCommands = window.api.timer.onCommand((command) => {
      const timer = useTimerStore.getState()
      if (command === 'toggle') {
        if (timer.status === 'running') timer.pause()
        else timer.start()
        return
      }
      if (command === 'start') timer.start()
      else timer.pause()
    })

    return () => {
      unsubscribeStore()
      unsubscribeCommands()
    }
  }, [enabled, sessionsUntilLongBreak])
}

export default useTimerBridge
