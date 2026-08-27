import { useMusicStore } from '../../stores/musicStore'

function PrevIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6v12M18 6l-10 6 10 6V6z" fill="currentColor" />
    </svg>
  )
}

function NextIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 6v12M6 6l10 6-10 6V6z" fill="currentColor" />
    </svg>
  )
}

function PlayIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 6v12l10-6L7 6z" fill="currentColor" />
    </svg>
  )
}

function PauseIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
    </svg>
  )
}

function MusicController(): React.JSX.Element {
  const tracks = useMusicStore((s) => s.tracks)
  const index = useMusicStore((s) => s.index)
  const isPlaying = useMusicStore((s) => s.isPlaying)
  const volume = useMusicStore((s) => s.volume)
  const emptyReason = useMusicStore((s) => s.emptyReason)
  const loading = useMusicStore((s) => s.loading)
  const play = useMusicStore((s) => s.play)
  const pause = useMusicStore((s) => s.pause)
  const next = useMusicStore((s) => s.next)
  const prev = useMusicStore((s) => s.prev)
  const setVolume = useMusicStore((s) => s.setVolume)
  const persistVolume = useMusicStore((s) => s.persistVolume)

  const hasTracks = tracks.length > 0
  const title = hasTracks ? (tracks[index]?.name ?? 'Track') : loading ? 'Loading…' : emptyReason

  return (
    <div className="music-controller" aria-label="Focus music">
      <div className="music-controller-transport">
        <button
          type="button"
          className="music-btn"
          aria-label="Previous track"
          disabled={!hasTracks}
          onClick={() => prev()}
        >
          <PrevIcon />
        </button>
        <button
          type="button"
          className="music-btn music-btn-main"
          aria-label={isPlaying ? 'Pause music' : 'Play music'}
          disabled={!hasTracks}
          onClick={() => (isPlaying ? pause() : play())}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          type="button"
          className="music-btn"
          aria-label="Next track"
          disabled={!hasTracks}
          onClick={() => next()}
        >
          <NextIcon />
        </button>
      </div>

      <p className="music-track" title={title ?? undefined}>
        {title}
      </p>

      <label className="music-volume">
        <span className="sr-only">Volume</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          disabled={!hasTracks}
          aria-label="Music volume"
          onChange={(event) => setVolume(Number(event.target.value))}
          onPointerUp={(event) => {
            void persistVolume(Number((event.target as HTMLInputElement).value))
          }}
          onKeyUp={(event) => {
            void persistVolume(Number((event.target as HTMLInputElement).value))
          }}
        />
      </label>
    </div>
  )
}

export default MusicController
