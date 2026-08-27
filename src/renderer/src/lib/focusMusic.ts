import { useMusicStore } from '../stores/musicStore'
import { useSettingsStore } from '../stores/settingsStore'

/** True when focus music is enabled and a playlist is loaded. */
export function isFocusMusicActive(): boolean {
  const { settings } = useSettingsStore.getState()
  const { tracks } = useMusicStore.getState()
  return settings.musicEnabled && tracks.length > 0
}
