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
    case 'downloading':
      return `Downloading v${status.version}… ${status.percent}%`
    case 'downloaded':
      return `v${status.version} downloaded — ready to install.`
    case 'installing':
      return `Installing v${status.version} and restarting…`
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
    case 'downloaded':
      return 'warn'
    case 'downloading':
    case 'installing':
      return 'neutral'
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
        message: error instanceof Error ? error.message : 'Could not download update'
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
        message: error instanceof Error ? error.message : 'Could not install update'
      })
      setBusy(false)
    }
    // On success the app quits; keep busy so the button stays disabled.
  }

  const tone = statusTone(status)
  const checking = busy && status.type === 'checking'
  const downloading = status.type === 'downloading'
  const installing = status.type === 'installing'

  return (
    <div className="updater">
      <div className="updater-version">
        <span className="updater-version-label">Installed version</span>
        <span className="updater-version-value">{appVersion ? `v${appVersion}` : '…'}</span>
      </div>

      <p className={`updater-status updater-status-${tone}`}>{statusLabel(status)}</p>

      {downloading ? (
        <div
          className="updater-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={status.percent}
        >
          <div className="updater-progress-bar" style={{ width: `${status.percent}%` }} />
        </div>
      ) : null}

      <p className="settings-note">
        Updates download in the background, then replace this portable app and relaunch when you
        install.
      </p>

      <div className="updater-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || downloading || installing}
          onClick={() => void check()}
        >
          {checking ? 'Checking…' : 'Check for updates'}
        </button>
        {status.type === 'available' ? (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy || downloading || installing}
            onClick={() => void download()}
          >
            {busy ? 'Downloading…' : `Download v${status.version}`}
          </button>
        ) : null}
        {status.type === 'downloaded' ? (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy || installing}
            onClick={() => void install()}
          >
            Install and restart
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default Updater
