import { useEffect } from 'react'
import { useMusicStore } from '../stores/musicStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useTimerStore } from '../stores/timerStore'

/**
 * Keeps the focus playlist loaded from settings and auto play/pauses with the timer.
 * Mount only on the main timer surface (not the mini window).
 */
function useFocusMusic(): void {
  const musicEnabled = useSettingsStore((s) => s.settings.musicEnabled)
  const musicFolderPath = useSettingsStore((s) => s.settings.musicFolderPath)
  const musicVolume = useSettingsStore((s) => s.settings.musicVolume)
  const phase = useTimerStore((s) => s.phase)
  const status = useTimerStore((s) => s.status)
  const trackCount = useMusicStore((s) => s.tracks.length)
  const loadFromFolder = useMusicStore((s) => s.loadFromFolder)
  const setVolume = useMusicStore((s) => s.setVolume)
  const syncAutoPlayback = useMusicStore((s) => s.syncAutoPlayback)
  const bindPlayerEvents = useMusicStore((s) => s.bindPlayerEvents)

  useEffect(() => bindPlayerEvents(), [bindPlayerEvents])

  useEffect(() => {
    setVolume(musicVolume)
  }, [musicVolume, setVolume])

  useEffect(() => {
    void loadFromFolder(musicFolderPath, musicEnabled)
  }, [musicFolderPath, musicEnabled, loadFromFolder])

  useEffect(() => {
    const shouldPlay = musicEnabled && phase === 'focus' && status === 'running'
    syncAutoPlayback(shouldPlay)
  }, [musicEnabled, phase, status, trackCount, syncAutoPlayback])
}

export default useFocusMusic
