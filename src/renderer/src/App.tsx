import { useEffect } from 'react'
import appLogoUrl from '@resources/Flux Pomo logo.webp?url'
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
    let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.type = 'image/webp'
    link.href = appLogoUrl
  }, [])

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
