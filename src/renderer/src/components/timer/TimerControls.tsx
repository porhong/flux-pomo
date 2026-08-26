interface TimerControlsProps {
  onReset: () => void
  onSkip: () => void
}

function TimerControls({ onReset, onSkip }: TimerControlsProps): React.JSX.Element {
  return (
    <div className="controls">
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
