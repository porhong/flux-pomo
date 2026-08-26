import Versions from './components/Versions'
import electronLogo from './assets/electron.svg'

function App(): React.JSX.Element {
  const ipcHandle = (): void => {
    void window.api.ping()
  }

  return (
    <>
      <img alt="logo" className="logo" src={electronLogo} />
      <div className="creator">Flux Pomo</div>
      <div className="text">
        Electron + <span className="react">React</span>
        &nbsp;+ <span className="ts">TypeScript</span>
      </div>
      <p className="tip">
        Press <code>F12</code> to open DevTools in development
      </p>
      <div className="actions">
        <div className="action">
          <a href="https://electron-vite.org/" target="_blank" rel="noreferrer">
            Documentation
          </a>
        </div>
        <div className="action">
          <a
            href="#ping"
            onClick={(event) => {
              event.preventDefault()
              ipcHandle()
            }}
          >
            Send IPC
          </a>
        </div>
      </div>
      <Versions />
    </>
  )
}

export default App
