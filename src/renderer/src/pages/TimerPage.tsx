import { useEffect } from 'react'
import TimerControls from '../components/timer/TimerControls'
import TimerDisplay from '../components/timer/TimerDisplay'
import { useSettingsStore } from '../stores/settingsStore'
import { useTimerStore } from '../stores/timerStore'

function TimerPage(): React.JSX.Element {
  const settings = useSettingsStore((s) => s.settings)
  const phase = useTimerStore((s) => s.phase)
  const status = useTimerStore((s) => s.status)
  const remainingMs = useTimerStore((s) => s.remainingMs)
  const plannedMs = useTimerStore((s) => s.plannedMs)
  const focusCountInCycle = useTimerStore((s) => s.focusCountInCycle)
  const start = useTimerStore((s) => s.start)
  const pause = useTimerStore((s) => s.pause)
  const reset = useTimerStore((s) => s.reset)
  const skip = useTimerStore((s) => s.skip)
  const syncFromSettings = useTimerStore((s) => s.syncFromSettings)

  useEffect(() => {
    syncFromSettings()
  }, [settings, syncFromSettings])

  const mood = phase === 'focus' && status === 'running' ? 'focus' : 'calm'

  return (
    <div className="page page-timer">
      <header className="page-header page-header-center">
        <h1 className="brand">Flux Pomo</h1>
        <p className="page-sub">
          {mood === 'focus' ? 'Deep work in progress.' : 'Stay with one thing, then rest.'}
        </p>
      </header>

      <div className="timer-home">
        <TimerDisplay
          phase={phase}
          status={status}
          remainingMs={remainingMs}
          plannedMs={plannedMs}
          focusCountInCycle={focusCountInCycle}
          sessionsUntilLongBreak={settings.sessionsUntilLongBreak}
          onStart={start}
          onPause={pause}
        />
        <TimerControls
          onReset={reset}
          onSkip={() => {
            void skip()
          }}
        />
      </div>
    </div>
  )
}

export default TimerPage
