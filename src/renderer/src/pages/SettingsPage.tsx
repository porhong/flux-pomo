import { useEffect, useState, type ChangeEvent } from 'react'
import {
  DEFAULT_SETTINGS,
  type PomodoroSettings
} from '../../../shared/types'
import Updater from '../components/Updater'
import { acceleratorFromKeyboardEvent, formatAcceleratorLabel } from '../lib/accelerator'
import { useSettingsStore } from '../stores/settingsStore'
import { useTimerStore } from '../stores/timerStore'

function SettingsPage(): React.JSX.Element {
  const loaded = useSettingsStore((s) => s.loaded)
  const settings = useSettingsStore((s) => s.settings)
  const save = useSettingsStore((s) => s.save)
  const syncFromSettings = useTimerStore((s) => s.syncFromSettings)
  const [draft, setDraft] = useState<PomodoroSettings | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [shortcutError, setShortcutError] = useState<string | null>(null)

  const current = draft ?? settings

  useEffect(() => {
    if (!capturing) return

    const onKeyDown = (event: KeyboardEvent): void => {
      event.preventDefault()
      event.stopPropagation()

      if (event.key === 'Escape') {
        setCapturing(false)
        return
      }

      const accelerator = acceleratorFromKeyboardEvent(event)
      if (!accelerator) return

      setDraft((prev) => ({
        ...(prev ?? settings),
        toggleTimerAccelerator: accelerator
      }))
      setCapturing(false)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [capturing, settings])

  if (!loaded) {
    return (
      <div className="page">
        <p className="empty-state">Loading settings…</p>
      </div>
    )
  }

  const updateNumber =
    (key: keyof PomodoroSettings) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      const value = Number(event.target.value)
      setDraft((prev) => {
        const base = prev ?? settings
        return { ...base, [key]: Number.isFinite(value) ? value : base[key] }
      })
    }

  const onSave = async (): Promise<void> => {
    await save(current)
    setDraft(null)
    syncFromSettings()
    setSavedAt(new Date().toLocaleTimeString())
    const status = await window.api.shortcuts.status()
    setShortcutError(status.error)
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">Tune your Pomodoro rhythm.</p>
      </header>

      <div className="panel field-grid">
        <div className="field">
          <label htmlFor="focusMinutes">Focus minutes</label>
          <input
            id="focusMinutes"
            type="number"
            min={1}
            max={180}
            value={current.focusMinutes}
            onChange={updateNumber('focusMinutes')}
          />
        </div>
        <div className="field">
          <label htmlFor="shortBreakMinutes">Short break minutes</label>
          <input
            id="shortBreakMinutes"
            type="number"
            min={1}
            max={60}
            value={current.shortBreakMinutes}
            onChange={updateNumber('shortBreakMinutes')}
          />
        </div>
        <div className="field">
          <label htmlFor="longBreakMinutes">Long break minutes</label>
          <input
            id="longBreakMinutes"
            type="number"
            min={1}
            max={90}
            value={current.longBreakMinutes}
            onChange={updateNumber('longBreakMinutes')}
          />
        </div>
        <div className="field">
          <label htmlFor="sessionsUntilLongBreak">Sessions until long break</label>
          <input
            id="sessionsUntilLongBreak"
            type="number"
            min={1}
            max={12}
            value={current.sessionsUntilLongBreak}
            onChange={updateNumber('sessionsUntilLongBreak')}
          />
        </div>
        <label className="toggle-row">
          <span>Auto-start breaks</span>
          <input
            type="checkbox"
            checked={current.autoStartBreaks}
            onChange={(event) =>
              setDraft((prev) => ({
                ...(prev ?? settings),
                autoStartBreaks: event.target.checked
              }))
            }
          />
        </label>
        <label className="toggle-row">
          <span>Auto-start focus</span>
          <input
            type="checkbox"
            checked={current.autoStartFocus}
            onChange={(event) =>
              setDraft((prev) => ({
                ...(prev ?? settings),
                autoStartFocus: event.target.checked
              }))
            }
          />
        </label>
      </div>

      <div className="panel field-grid">
        <header className="page-header">
          <h2 className="page-sub" style={{ color: 'var(--snow)', fontSize: 16, fontWeight: 600 }}>
            Keyboard shortcut
          </h2>
          <p className="page-sub">Global start/pause — works even when Flux Pomo is minimized.</p>
        </header>

        <label className="toggle-row">
          <span>Enable global shortcut</span>
          <input
            type="checkbox"
            checked={current.shortcutsEnabled}
            onChange={(event) =>
              setDraft((prev) => ({
                ...(prev ?? settings),
                shortcutsEnabled: event.target.checked
              }))
            }
          />
        </label>

        <div className="field">
          <span className="field-label">Start / pause shortcut</span>
          <div className="shortcut-row">
            <button
              type="button"
              className={`shortcut-capture${capturing ? ' capturing' : ''}`}
              disabled={!current.shortcutsEnabled}
              onClick={() => setCapturing(true)}
            >
              {capturing
                ? 'Press keys… (Esc to cancel)'
                : formatAcceleratorLabel(current.toggleTimerAccelerator)}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!current.shortcutsEnabled || capturing}
              onClick={() =>
                setDraft((prev) => ({
                  ...(prev ?? settings),
                  toggleTimerAccelerator: DEFAULT_SETTINGS.toggleTimerAccelerator
                }))
              }
            >
              Reset
            </button>
          </div>
          <p className="settings-note">
            Default is Ctrl/⌘ + Shift + Space. Include at least one modifier key.
          </p>
          {shortcutError ? <p className="settings-note settings-error">{shortcutError}</p> : null}
        </div>
      </div>

      <div className="settings-actions">
        <button type="button" className="btn btn-primary" onClick={() => void onSave()}>
          Save
        </button>
      </div>
      {savedAt ? <p className="settings-note">Saved at {savedAt}</p> : null}

      <div className="panel updater-block">
        <h2 className="page-sub" style={{ marginBottom: 12, color: 'var(--snow)' }}>
          Updates
        </h2>
        <Updater />
      </div>
    </div>
  )
}

export default SettingsPage
