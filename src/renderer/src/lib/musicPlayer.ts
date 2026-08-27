import type { MusicTrack } from '../../../shared/ipc'

type PlayingListener = (playing: boolean) => void
type TrackListener = (index: number) => void

/** Wait for start SFX before music comes in. */
export const MUSIC_START_DELAY_MS = 900
export const MUSIC_FADE_IN_MS = 800
export const MUSIC_FADE_OUT_MS = 650

let audio: HTMLAudioElement | null = null
let tracks: MusicTrack[] = []
let index = 0
let volume = 0.5
let intentionalPause = false
let loadedTrackId: string | null = null
let fadeRaf: number | null = null
let fadeDelayTimer: ReturnType<typeof setTimeout> | null = null
let fadeGeneration = 0

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

function cancelFade(): void {
  fadeGeneration += 1
  if (fadeRaf != null) {
    cancelAnimationFrame(fadeRaf)
    fadeRaf = null
  }
  if (fadeDelayTimer != null) {
    clearTimeout(fadeDelayTimer)
    fadeDelayTimer = null
  }
}

function animateVolume(
  from: number,
  to: number,
  durationMs: number,
  generation: number
): Promise<void> {
  const el = ensureAudio()
  return new Promise((resolve) => {
    if (durationMs <= 0 || generation !== fadeGeneration) {
      el.volume = to
      resolve()
      return
    }

    const start = performance.now()
    const step = (now: number): void => {
      if (generation !== fadeGeneration) {
        resolve()
        return
      }

      const t = Math.min(1, (now - start) / durationMs)
      const eased = t * (2 - t)
      el.volume = from + (to - from) * eased

      if (t < 1) {
        fadeRaf = requestAnimationFrame(step)
        return
      }

      fadeRaf = null
      resolve()
    }

    fadeRaf = requestAnimationFrame(step)
  })
}

function loadCurrent(autoplay: boolean): void {
  const el = ensureAudio()
  const track = tracks[index]
  if (!track) {
    cancelFade()
    intentionalPause = true
    el.pause()
    el.removeAttribute('src')
    el.load()
    loadedTrackId = null
    intentionalPause = false
    notifyTrack()
    return
  }

  if (loadedTrackId !== track.id) {
    el.src = track.url
    loadedTrackId = track.id
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

export function isFading(): boolean {
  return fadeRaf != null || fadeDelayTimer != null
}

export function setPlaylist(nextTracks: MusicTrack[], preferIndex = 0): void {
  const nextIndex =
    nextTracks.length === 0 ? 0 : Math.min(Math.max(0, preferIndex), nextTracks.length - 1)
  const samePlaylist =
    nextTracks.length === tracks.length &&
    nextTracks.every((track, i) => track.id === tracks[i]?.id)

  if (samePlaylist && nextIndex === index) return

  tracks = nextTracks
  index = nextIndex
  const wasPlaying = isAudioPlaying()
  loadCurrent(wasPlaying)
}

export function setMusicVolume(next: number): void {
  volume = Math.min(1, Math.max(0, next))
  if (audio && !isFading()) audio.volume = volume
}

export function play(): void {
  if (tracks.length === 0) return
  cancelFade()
  const el = ensureAudio()
  const track = tracks[index]
  if (!track) return
  if (loadedTrackId !== track.id) {
    el.src = track.url
    loadedTrackId = track.id
  }
  el.volume = volume
  intentionalPause = false
  void el.play().catch(() => {
    // Autoplay may be blocked until a user gesture.
  })
}

export function pause(): void {
  cancelFade()
  if (!audio) return
  intentionalPause = true
  audio.pause()
  audio.volume = volume
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

/** Start at volume 0 during the user gesture, delay, then fade in. */
export function fadeInPlay(options?: { delayMs?: number; fadeMs?: number }): void {
  if (tracks.length === 0) return

  const delayMs = options?.delayMs ?? MUSIC_START_DELAY_MS
  const fadeMs = options?.fadeMs ?? MUSIC_FADE_IN_MS
  const generation = ++fadeGeneration

  const el = ensureAudio()
  const track = tracks[index]
  if (!track) return

  if (loadedTrackId !== track.id) {
    el.src = track.url
    loadedTrackId = track.id
  }

  el.volume = 0
  intentionalPause = false
  void el.play().catch(() => {
    // Autoplay may be blocked until a user gesture.
  })

  fadeDelayTimer = setTimeout(() => {
    fadeDelayTimer = null
    if (generation !== fadeGeneration) return
    void animateVolume(0, volume, fadeMs, generation)
  }, delayMs)
}

/** Fade out, pause, restore target volume, then run callback (e.g. pause SFX). */
export function fadeOutPause(options?: { fadeMs?: number; onComplete?: () => void }): void {
  const fadeMs = options?.fadeMs ?? MUSIC_FADE_OUT_MS
  const onComplete = options?.onComplete
  const generation = ++fadeGeneration

  if (!audio) {
    onComplete?.()
    return
  }

  const el = audio
  const startVol = el.volume

  if (!isAudioPlaying() || startVol <= 0.01) {
    pause()
    onComplete?.()
    return
  }

  void animateVolume(startVol, 0, fadeMs, generation).then(() => {
    if (generation !== fadeGeneration) return
    intentionalPause = true
    el.pause()
    el.volume = volume
    intentionalPause = false
    onComplete?.()
  })
}
