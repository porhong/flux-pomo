import { useEffect, useState } from 'react'
import type { UpdaterStatus } from '../../../shared/ipc'

function statusLabel(status: UpdaterStatus): string {
  switch (status.type) {
    case 'idle':
      return 'Idle'
    case 'checking':
      return 'Checking for updates…'
    case 'available':
      return `Update available: v${status.version}`
    case 'not-available':
      return `Up to date (v${status.version})`
    case 'downloading':
      return `Downloading… ${status.percent.toFixed(0)}%`
    case 'downloaded':
      return `Ready to install v${status.version}`
    case 'error':
      return `Update error: ${status.message}`
    case 'skipped':
      return status.message
  }
}

function Updater(): React.JSX.Element {
  const [status, setStatus] = useState<UpdaterStatus>({ type: 'idle' })
  const [busy, setBusy] = useState(false)

  useEffect(() => window.api.updater.onStatus(setStatus), [])

  const check = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.api.updater.check()
    } finally {
      setBusy(false)
    }
  }

  const download = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.api.updater.download()
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Download failed'
      })
    } finally {
      setBusy(false)
    }
  }

  const install = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.api.updater.install()
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Install failed'
      })
      setBusy(false)
    }
  }

  return (
    <div className="updater">
      <p className="tip">{statusLabel(status)}</p>
      <div className="actions">
        <div className="action">
          <a
            href="#check-update"
            onClick={(event) => {
              event.preventDefault()
              void check()
            }}
          >
            {busy ? 'Working…' : 'Check for updates'}
          </a>
        </div>
        {status.type === 'available' ? (
          <div className="action">
            <a
              href="#download-update"
              onClick={(event) => {
                event.preventDefault()
                void download()
              }}
            >
              Download
            </a>
          </div>
        ) : null}
        {status.type === 'downloaded' ? (
          <div className="action">
            <a
              href="#install-update"
              onClick={(event) => {
                event.preventDefault()
                void install()
              }}
            >
              Restart & install
            </a>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default Updater
