import { useEffect } from 'react'
import AppRouter from './app/Router'
import useTimerBridge from './hooks/useTimerBridge'
import { useSettingsStore } from './stores/settingsStore'
import { useTimerStore } from './stores/timerStore'

function App(): React.JSX.Element {
  const load = useSettingsStore((s) => s.load)
  const syncFromSettings = useTimerStore((s) => s.syncFromSettings)
  const isMini = window.location.hash.replace(/^#/, '') === '/mini'

  useTimerBridge(!isMini)

  useEffect(() => {
    document.documentElement.classList.toggle('is-mini', isMini)
    return () => document.documentElement.classList.remove('is-mini')
  }, [isMini])

  useEffect(() => {
    if (isMini) return
    void (async () => {
      await load()
      syncFromSettings()
    })()
  }, [isMini, load, syncFromSettings])

  return <AppRouter />
}

export default App
