import { useEffect } from 'react'
import AppLogo from './AppLogo'

interface QuitConfirmDialogProps {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
}

function QuitConfirmDialog({
  open,
  onCancel,
  onConfirm
}: QuitConfirmDialogProps): React.JSX.Element | null {
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCancel()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="confirm-overlay" role="presentation" onClick={onCancel}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="quit-dialog-title"
        aria-describedby="quit-dialog-body"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-dialog-brand">
          <AppLogo className="confirm-dialog-logo" size={28} />
        </div>
        <h2 id="quit-dialog-title" className="confirm-dialog-title">
          Quit Flux Pomo?
        </h2>
        <p id="quit-dialog-body" className="confirm-dialog-body">
          The timer will stop and the app will close completely.
        </p>
        <div className="confirm-dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" autoFocus onClick={onConfirm}>
            Quit
          </button>
        </div>
      </div>
    </div>
  )
}

export default QuitConfirmDialog
