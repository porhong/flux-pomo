import { useEffect } from 'react'
import AppRouter from './app/Router'
import { useSettingsStore } from './stores/settingsStore'
import { useTimerStore } from './stores/timerStore'

function App(): React.JSX.Element {
  const load = useSettingsStore((s) => s.load)
  const syncFromSettings = useTimerStore((s) => s.syncFromSettings)

  useEffect(() => {
    void (async () => {
      await load()
      syncFromSettings()
    })()
  }, [load, syncFromSettings])

  return <AppRouter />
}

export default App
