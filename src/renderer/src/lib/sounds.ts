import sessionStartStopUrl from '@resources/sounds/Session start stop.mp3?url'
import restTimeUrl from '@resources/sounds/Rest time.mp3?url'

type SoundId = 'session' | 'rest'

const urls: Record<SoundId, string> = {
  session: sessionStartStopUrl,
  rest: restTimeUrl
}

const players = new Map<SoundId, HTMLAudioElement>()

function getPlayer(id: SoundId): HTMLAudioElement {
  let audio = players.get(id)
  if (!audio) {
    audio = new Audio(urls[id])
    audio.preload = 'auto'
    audio.volume = 0.75
    players.set(id, audio)
  }
  return audio
}

function playSound(id: SoundId): void {
  try {
    const audio = getPlayer(id)
    audio.pause()
    audio.currentTime = 0
    void audio.play().catch(() => {
      // Autoplay may be blocked until a user gesture; ignore.
    })
  } catch {
    // Audio is best-effort.
  }
}

/** Start or pause/stop session cue. */
export function playSessionStartStop(): void {
  playSound('session')
}

/** Break / rest phase beginning. */
export function playRestTime(): void {
  playSound('rest')
}
