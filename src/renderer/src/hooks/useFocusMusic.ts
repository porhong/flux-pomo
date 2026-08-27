import { useEffect, useRef } from 'react'
import type { MusicStopSfx } from '../stores/musicStore'
import { useMusicStore } from '../stores/musicStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useTimerStore } from '../stores/timerStore'

/**
 * Keeps the focus playlist loaded from settings and auto play/pauses with the timer.
 * Lives on AppShell so navigation between Timer / History / Settings does not interrupt playback.
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
  const prevShouldPlay = useRef(false)

  useEffect(() => bindPlayerEvents(), [bindPlayerEvents])

  useEffect(() => {
    setVolume(musicVolume)
  }, [musicVolume, setVolume])

  useEffect(() => {
    void loadFromFolder(musicFolderPath, musicEnabled)
  }, [musicFolderPath, musicEnabled, loadFromFolder])

  useEffect(() => {
    const shouldPlay = musicEnabled && phase === 'focus' && status === 'running'
    let stopSfx: MusicStopSfx | null = null

    if (prevShouldPlay.current && !shouldPlay && musicEnabled) {
      if (phase !== 'focus') stopSfx = 'rest'
      else if (status === 'paused') stopSfx = 'pause'
    }

    syncAutoPlayback(shouldPlay, stopSfx)
    prevShouldPlay.current = shouldPlay
  }, [musicEnabled, phase, status, trackCount, syncAutoPlayback])
}

export default useFocusMusic
