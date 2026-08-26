import { useState, type ChangeEvent } from 'react'
import type { PomodoroSettings } from '../../../shared/types'
import Updater from '../components/Updater'
import { useSettingsStore } from '../stores/settingsStore'
import { useTimerStore } from '../stores/timerStore'

function SettingsPage(): React.JSX.Element {
  const loaded = useSettingsStore((s) => s.loaded)
  const settings = useSettingsStore((s) => s.settings)
  const save = useSettingsStore((s) => s.save)
  const syncFromSettings = useTimerStore((s) => s.syncFromSettings)
  const [draft, setDraft] = useState<PomodoroSettings | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const current = draft ?? settings

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
        <div className="settings-actions">
          <button type="button" className="btn btn-primary" onClick={() => void onSave()}>
            Save
          </button>
        </div>
        {savedAt ? <p className="settings-note">Saved at {savedAt}</p> : null}
      </div>

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
