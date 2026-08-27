import { create } from 'zustand'
import type { MusicTrack } from '../../../shared/ipc'
import { playPause, playRestTime } from '../lib/sounds'
import {
  fadeInPlay,
  fadeOutPause,
  getIndex,
  getTracks,
  isAudioPlaying,
  isFading,
  next as playerNext,
  onPlayingChange,
  onTrackChange,
  pause as playerPause,
  play as playerPlay,
  prev as playerPrev,
  setMusicVolume,
  setPlaylist,
  stopKeepIndex,
  toggle as playerToggle
} from '../lib/musicPlayer'

export type MusicStopSfx = 'pause' | 'rest'

interface MusicState {
  tracks: MusicTrack[]
  index: number
  isPlaying: boolean
  volume: number
  loading: boolean
  emptyReason: string | null
  loadedFolderPath: string | null
  bindPlayerEvents: () => () => void
  loadFromFolder: (folderPath: string | null, enabled: boolean) => Promise<void>
  play: () => void
  pause: () => void
  toggle: () => void
  next: () => void
  prev: () => void
  setVolume: (volume: number) => void
  persistVolume: (volume: number) => Promise<void>
  syncAutoPlayback: (shouldPlay: boolean, stopSfx?: MusicStopSfx | null) => void
}

export const useMusicStore = create<MusicState>((set, get) => ({
  tracks: [],
  index: 0,
  isPlaying: false,
  volume: 0.5,
  loading: false,
  emptyReason: 'Choose a folder in Settings',
  loadedFolderPath: null,

  bindPlayerEvents: () => {
    set({
      tracks: getTracks(),
      index: getIndex(),
      isPlaying: isAudioPlaying()
    })
    const offPlaying = onPlayingChange((playing) => {
      set({ isPlaying: playing })
    })
    const offTrack = onTrackChange((index) => {
      set({ index, tracks: getTracks() })
    })
    return () => {
      offPlaying()
      offTrack()
    }
  },

  loadFromFolder: async (folderPath, enabled) => {
    if (!enabled) {
      playerPause()
      setPlaylist([])
      set({
        tracks: [],
        index: 0,
        isPlaying: false,
        loading: false,
        loadedFolderPath: null,
        emptyReason: 'Focus music is off'
      })
      return
    }

    if (!folderPath) {
      playerPause()
      setPlaylist([])
      set({
        tracks: [],
        index: 0,
        isPlaying: false,
        loading: false,
        loadedFolderPath: null,
        emptyReason: 'Choose a folder in Settings'
      })
      return
    }

    const { loadedFolderPath, tracks: existingTracks } = get()
    if (folderPath === loadedFolderPath && existingTracks.length > 0) {
      set({
        loading: false,
        emptyReason: null,
        index: getIndex(),
        tracks: getTracks(),
        isPlaying: isAudioPlaying()
      })
      return
    }

    set({ loading: true })
    try {
      const tracks = await window.api.music.listTracks(folderPath)
      const keepIndex = get().index
      setPlaylist(tracks, keepIndex)
      set({
        tracks,
        index: getIndex(),
        isPlaying: isAudioPlaying(),
        loading: false,
        loadedFolderPath: folderPath,
        emptyReason: tracks.length === 0 ? 'No audio files in this folder' : null
      })
    } catch {
      setPlaylist([])
      set({
        tracks: [],
        index: 0,
        isPlaying: false,
        loading: false,
        loadedFolderPath: null,
        emptyReason: 'Could not read music folder'
      })
    }
  },

  play: () => {
    playerPlay()
    set({ isPlaying: isAudioPlaying() })
  },

  pause: () => {
    playerPause()
    set({ isPlaying: false })
  },

  toggle: () => {
    playerToggle()
    set({ isPlaying: isAudioPlaying() })
  },

  next: () => {
    void playerNext()
    set({ index: getIndex(), tracks: getTracks(), isPlaying: isAudioPlaying() })
  },

  prev: () => {
    void playerPrev()
    set({ index: getIndex(), tracks: getTracks(), isPlaying: isAudioPlaying() })
  },

  setVolume: (volume) => {
    const next = Math.min(1, Math.max(0, volume))
    setMusicVolume(next)
    set({ volume: next })
  },

  persistVolume: async (volume) => {
    const next = Math.min(1, Math.max(0, volume))
    get().setVolume(next)
    const { useSettingsStore } = await import('./settingsStore')
    const settings = useSettingsStore.getState().settings
    if (Math.abs(settings.musicVolume - next) < 0.005) return
    await useSettingsStore.getState().save({ ...settings, musicVolume: next })
  },

  syncAutoPlayback: (shouldPlay, stopSfx = null) => {
    const { tracks } = get()
    if (tracks.length === 0) {
      stopKeepIndex()
      set({ isPlaying: false })
      return
    }

    if (shouldPlay) {
      if (isAudioPlaying() && !isFading()) {
        set({ isPlaying: true })
        return
      }
      fadeInPlay()
      set({ isPlaying: true })
      return
    }

    const playStopSfx = (): void => {
      if (stopSfx === 'pause') playPause()
      if (stopSfx === 'rest') playRestTime()
    }

    if (isAudioPlaying() || isFading()) {
      fadeOutPause({
        onComplete: () => {
          set({ isPlaying: false })
          playStopSfx()
        }
      })
      return
    }

    stopKeepIndex()
    set({ isPlaying: false })
    playStopSfx()
  }
}))
