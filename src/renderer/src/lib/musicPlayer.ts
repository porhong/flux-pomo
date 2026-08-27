import type { MusicTrack } from '../../../shared/ipc'

type PlayingListener = (playing: boolean) => void
type TrackListener = (index: number) => void

let audio: HTMLAudioElement | null = null
let tracks: MusicTrack[] = []
let index = 0
let volume = 0.5
let intentionalPause = false

const playingListeners = new Set<PlayingListener>()
const trackListeners = new Set<TrackListener>()

function ensureAudio(): HTMLAudioElement {
  if (audio) return audio
  audio = new Audio()
  audio.preload = 'auto'
  audio.volume = volume

  audio.addEventListener('play', () => {
    for (const listener of playingListeners) listener(true)
  })
  audio.addEventListener('pause', () => {
    for (const listener of playingListeners) listener(false)
  })
  audio.addEventListener('ended', () => {
    if (intentionalPause) return
    void next(true)
  })

  return audio
}

function notifyTrack(): void {
  for (const listener of trackListeners) listener(index)
}

function loadCurrent(autoplay: boolean): void {
  const el = ensureAudio()
  const track = tracks[index]
  if (!track) {
    intentionalPause = true
    el.pause()
    el.removeAttribute('src')
    el.load()
    intentionalPause = false
    notifyTrack()
    return
  }

  if (el.src !== track.url) {
    el.src = track.url
  }
  el.volume = volume
  notifyTrack()

  if (!autoplay) return

  intentionalPause = false
  void el.play().catch(() => {
    // Autoplay may be blocked until a user gesture.
  })
}

export function onPlayingChange(listener: PlayingListener): () => void {
  playingListeners.add(listener)
  return () => {
    playingListeners.delete(listener)
  }
}

export function onTrackChange(listener: TrackListener): () => void {
  trackListeners.add(listener)
  return () => {
    trackListeners.delete(listener)
  }
}

export function getTracks(): MusicTrack[] {
  return tracks
}

export function getIndex(): number {
  return index
}

export function isAudioPlaying(): boolean {
  return Boolean(audio && !audio.paused && !audio.ended)
}

export function setPlaylist(nextTracks: MusicTrack[], preferIndex = 0): void {
  tracks = nextTracks
  index = tracks.length === 0 ? 0 : Math.min(Math.max(0, preferIndex), tracks.length - 1)
  const wasPlaying = isAudioPlaying()
  loadCurrent(wasPlaying)
}

export function setMusicVolume(next: number): void {
  volume = Math.min(1, Math.max(0, next))
  if (audio) audio.volume = volume
}

export function play(): void {
  if (tracks.length === 0) return
  const el = ensureAudio()
  const track = tracks[index]
  if (!track) return
  if (el.src !== track.url) {
    el.src = track.url
  }
  el.volume = volume
  intentionalPause = false
  void el.play().catch(() => {
    // Autoplay may be blocked until a user gesture.
  })
}

export function pause(): void {
  if (!audio) return
  intentionalPause = true
  audio.pause()
  intentionalPause = false
}

export function toggle(): void {
  if (isAudioPlaying()) {
    pause()
    return
  }
  play()
}

export async function next(autoplay = isAudioPlaying()): Promise<void> {
  if (tracks.length === 0) return
  index = (index + 1) % tracks.length
  loadCurrent(autoplay)
}

export async function prev(autoplay = isAudioPlaying()): Promise<void> {
  if (tracks.length === 0) return
  index = (index - 1 + tracks.length) % tracks.length
  loadCurrent(autoplay)
}

export function stopKeepIndex(): void {
  pause()
}
