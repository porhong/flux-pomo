interface TimerControlsProps {
  status: 'idle' | 'running' | 'paused'
  onStart: () => void
  onPause: () => void
  onReset: () => void
  onSkip: () => void
}

function TimerControls({
  status,
  onStart,
  onPause,
  onReset,
  onSkip
}: TimerControlsProps): React.JSX.Element {
  return (
    <div className="controls">
      {status === 'running' ? (
        <button type="button" className="btn btn-primary" onClick={onPause}>
          Pause
        </button>
      ) : (
        <button type="button" className="btn btn-primary" onClick={onStart}>
          {status === 'paused' ? 'Resume' : 'Start'}
        </button>
      )}
      <button type="button" className="btn btn-ghost" onClick={onReset}>
        Reset
      </button>
      <button type="button" className="btn btn-ghost" onClick={onSkip}>
        Skip
      </button>
    </div>
  )
}

export default TimerControls
