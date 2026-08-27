import { useEffect, useState } from 'react'
import type { UpdaterStatus } from '../../../shared/ipc'

function statusLabel(status: UpdaterStatus): string {
  switch (status.type) {
    case 'idle':
      return 'Idle — checks GitHub Releases for a newer portable build.'
    case 'checking':
      return 'Checking GitHub Releases…'
    case 'available':
      return `Update available: v${status.version}. Download the new portable .exe, then replace this app.`
    case 'not-available':
      return `Up to date (v${status.version})`
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
        message: error instanceof Error ? error.message : 'Could not open download'
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="updater">
      <p className="tip">{statusLabel(status)}</p>
      <p className="settings-note">
        Portable builds update by downloading a new `.exe` from GitHub Releases (close the app,
        replace the file, relaunch).
      </p>
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
              Download update
            </a>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default Updater
