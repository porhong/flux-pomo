import { useEffect, useState } from 'react'
import type { UpdaterStatus } from '../../../shared/ipc'

function statusLabel(status: UpdaterStatus): string {
  switch (status.type) {
    case 'idle':
      return 'Ready to check for a newer portable build.'
    case 'checking':
      return 'Checking GitHub Releases…'
    case 'available':
      return `Update available: v${status.version}`
    case 'not-available':
      return 'You’re on the latest version.'
    case 'error':
      return status.message
    case 'skipped':
      return status.message
  }
}

function statusTone(status: UpdaterStatus): 'neutral' | 'ok' | 'warn' | 'error' {
  switch (status.type) {
    case 'available':
      return 'warn'
    case 'not-available':
      return 'ok'
    case 'error':
      return 'error'
    default:
      return 'neutral'
  }
}

function Updater(): React.JSX.Element {
  const [status, setStatus] = useState<UpdaterStatus>({ type: 'idle' })
  const [appVersion, setAppVersion] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => window.api.updater.onStatus(setStatus), [])

  useEffect(() => {
    void window.api.getVersion().then(setAppVersion)
  }, [])

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

  const tone = statusTone(status)

  return (
    <div className="updater">
      <div className="updater-version">
        <span className="updater-version-label">Installed version</span>
        <span className="updater-version-value">{appVersion ? `v${appVersion}` : '…'}</span>
      </div>

      <p className={`updater-status updater-status-${tone}`}>{statusLabel(status)}</p>

      <p className="settings-note">
        Portable builds update by downloading a new `.exe` from GitHub Releases (close the app,
        replace the file, relaunch).
      </p>

      <div className="updater-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => void check()}
        >
          {busy && status.type === 'checking' ? 'Checking…' : 'Check for updates'}
        </button>
        {status.type === 'available' ? (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => void download()}
          >
            Download v{status.version}
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default Updater
