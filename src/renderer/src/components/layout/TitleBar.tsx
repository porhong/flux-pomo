import AppLogo from './AppLogo'

function TitleBar(): React.JSX.Element {
  return (
    <header className="title-bar" aria-label="Window controls">
      <div className="title-bar-drag">
        <AppLogo className="title-bar-logo" size={20} />
        <span className="title-bar-brand">Flux Pomo</span>
      </div>
      <div className="title-bar-controls">
        <button
          type="button"
          className="title-bar-btn title-bar-minimize"
          aria-label="Minimize"
          onClick={() => void window.api.window.minimize()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          className="title-bar-btn title-bar-close"
          aria-label="Close"
          onClick={() => void window.api.window.close()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path
              d="M2 2l6 6M8 2L2 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </header>
  )
}

export default TitleBar
