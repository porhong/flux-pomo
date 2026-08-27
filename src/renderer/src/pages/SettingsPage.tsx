import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react'
import { DEFAULT_SETTINGS, type PomodoroSettings } from '../../../shared/types'
import Updater from '../components/Updater'
import { acceleratorFromKeyboardEvent, formatAcceleratorLabel } from '../lib/accelerator'
import { useSettingsStore } from '../stores/settingsStore'
import { useTimerStore } from '../stores/timerStore'

type SettingsTab = 'timer' | 'flow' | 'music' | 'shortcuts' | 'updates'

const SETTINGS_TABS: { id: SettingsTab; label: string; title: string; description: string }[] = [
  {
    id: 'timer',
    label: 'Timer',
    title: 'Timer',
    description: 'Focus and break lengths for each Pomodoro cycle.'
  },
  {
    id: 'flow',
    label: 'Flow',
    title: 'Session flow',
    description: 'Automatically continue into the next phase when a session ends.'
  },
  {
    id: 'music',
    label: 'Music',
    title: 'Focus music',
    description: 'Play a local playlist during running focus. Pauses on break and timer pause.'
  },
  {
    id: 'shortcuts',
    label: 'Shortcuts',
    title: 'Keyboard shortcuts',
    description: 'Global controls that work even when Flux Pomo is minimized.'
  },
  {
    id: 'updates',
    label: 'Updates',
    title: 'Updates',
    description: 'Check GitHub Releases for a newer portable build.'
  }
]

interface SettingsPanelProps {
  title: string
  description: string
  children: ReactNode
}

function SettingsPanel({ title, description, children }: SettingsPanelProps): React.JSX.Element {
  return (
    <section className="settings-panel panel" role="tabpanel">
      <header className="settings-section-header">
        <h2 className="settings-section-title">{title}</h2>
        <p className="settings-section-desc">{description}</p>
      </header>
      <div className="field-grid">{children}</div>
    </section>
  )
}

function SettingsPage(): React.JSX.Element {
  const loaded = useSettingsStore((s) => s.loaded)
  const settings = useSettingsStore((s) => s.settings)
  const save = useSettingsStore((s) => s.save)
  const syncFromSettings = useTimerStore((s) => s.syncFromSettings)
  const [draft, setDraft] = useState<PomodoroSettings | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<SettingsTab>('timer')
  const [capturing, setCapturing] = useState<'timer' | 'window' | null>(null)
  const [shortcutError, setShortcutError] = useState<string | null>(null)
  const [trackCount, setTrackCount] = useState<number | null>(null)

  const current = draft ?? settings
  const tabMeta = SETTINGS_TABS.find((tab) => tab.id === activeTab) ?? SETTINGS_TABS[0]!

  useEffect(() => {
    if (!capturing) return

    const onKeyDown = (event: KeyboardEvent): void => {
      event.preventDefault()
      event.stopPropagation()

      if (event.key === 'Escape') {
        setCapturing(null)
        return
      }

      const accelerator = acceleratorFromKeyboardEvent(event)
      if (!accelerator) return

      setDraft((prev) => ({
        ...(prev ?? settings),
        ...(capturing === 'timer'
          ? { toggleTimerAccelerator: accelerator }
          : { toggleWindowAccelerator: accelerator })
      }))
      setCapturing(null)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [capturing, settings])

  useEffect(() => {
    const folder = current.musicFolderPath
    if (!folder) {
      setTrackCount(null)
      return
    }

    let cancelled = false
    void window.api.music.listTracks(folder).then((tracks) => {
      if (!cancelled) setTrackCount(tracks.length)
    })
    return () => {
      cancelled = true
    }
  }, [current.musicFolderPath])

  if (!loaded) {
    return (
      <div className="page">
        <p className="empty-state">Loading settings…</p>
      </div>
    )
  }

  const selectTab = (tab: SettingsTab): void => {
    setCapturing(null)
    setActiveTab(tab)
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

  const patch = (partial: Partial<PomodoroSettings>): void => {
    setDraft((prev) => ({ ...(prev ?? settings), ...partial }))
  }

  const onBrowseMusicFolder = async (): Promise<void> => {
    const folder = await window.api.music.pickFolder()
    if (!folder) return
    patch({ musicFolderPath: folder, musicEnabled: true })
  }

  const onClearMusicFolder = (): void => {
    patch({ musicFolderPath: null })
    setTrackCount(null)
  }

  const onSave = async (): Promise<void> => {
    await save(current)
    setDraft(null)
    syncFromSettings()
    setSavedAt(new Date().toLocaleTimeString())
    const status = await window.api.shortcuts.status()
    setShortcutError(status.error)
  }

  const folderLabel = current.musicFolderPath
    ? current.musicFolderPath.replace(/\\/g, '/').split('/').filter(Boolean).slice(-2).join('/')
    : 'No folder selected'

  return (
    <div className="page page-settings">
      <header className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">Tune your Pomodoro rhythm.</p>
      </header>

      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        {SETTINGS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`settings-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`settings-panel-${tab.id}`}
            className={`settings-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div id={`settings-panel-${activeTab}`} aria-labelledby={`settings-tab-${activeTab}`}>
        {activeTab === 'timer' ? (
          <SettingsPanel title={tabMeta.title} description={tabMeta.description}>
            <div className="field-grid field-grid-2">
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
            </div>
          </SettingsPanel>
        ) : null}

        {activeTab === 'flow' ? (
          <SettingsPanel title={tabMeta.title} description={tabMeta.description}>
            <label className="toggle-row">
              <span>Auto-start breaks</span>
              <input
                type="checkbox"
                checked={current.autoStartBreaks}
                onChange={(event) => patch({ autoStartBreaks: event.target.checked })}
              />
            </label>
            <label className="toggle-row">
              <span>Auto-start focus</span>
              <input
                type="checkbox"
                checked={current.autoStartFocus}
                onChange={(event) => patch({ autoStartFocus: event.target.checked })}
              />
            </label>
          </SettingsPanel>
        ) : null}

        {activeTab === 'music' ? (
          <SettingsPanel title={tabMeta.title} description={tabMeta.description}>
            <label className="toggle-row">
              <span>Enable focus music</span>
              <input
                type="checkbox"
                checked={current.musicEnabled}
                onChange={(event) => patch({ musicEnabled: event.target.checked })}
              />
            </label>

            <div className="field">
              <span className="field-label">Music folder</span>
              <div className="shortcut-row">
                <button
                  type="button"
                  className="shortcut-capture"
                  onClick={() => void onBrowseMusicFolder()}
                >
                  {folderLabel}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={!current.musicFolderPath}
                  onClick={onClearMusicFolder}
                >
                  Clear
                </button>
              </div>
              <p className="settings-note">
                Supports mp3, m4a, aac, wav, ogg, flac in the folder root
                {trackCount != null ? ` · ${trackCount} track${trackCount === 1 ? '' : 's'}` : ''}.
              </p>
            </div>

            <div className="field">
              <label htmlFor="musicVolume">Volume</label>
              <input
                id="musicVolume"
                className="settings-range"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={current.musicVolume}
                onChange={(event) => patch({ musicVolume: Number(event.target.value) })}
              />
            </div>
          </SettingsPanel>
        ) : null}

        {activeTab === 'shortcuts' ? (
          <SettingsPanel title={tabMeta.title} description={tabMeta.description}>
            <label className="toggle-row">
              <span>Enable global shortcuts</span>
              <input
                type="checkbox"
                checked={current.shortcutsEnabled}
                onChange={(event) => patch({ shortcutsEnabled: event.target.checked })}
              />
            </label>

            <div className="field">
              <span className="field-label">Start / pause timer</span>
              <div className="shortcut-row">
                <button
                  type="button"
                  className={`shortcut-capture${capturing === 'timer' ? ' capturing' : ''}`}
                  disabled={!current.shortcutsEnabled}
                  onClick={() => setCapturing('timer')}
                >
                  {capturing === 'timer'
                    ? 'Press keys… (Esc to cancel)'
                    : formatAcceleratorLabel(current.toggleTimerAccelerator)}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={!current.shortcutsEnabled || capturing != null}
                  onClick={() =>
                    patch({ toggleTimerAccelerator: DEFAULT_SETTINGS.toggleTimerAccelerator })
                  }
                >
                  Reset
                </button>
              </div>
              <p className="settings-note">Default is Ctrl/⌘ + Shift + Space.</p>
            </div>

            <div className="field">
              <span className="field-label">Show full app / compact timer</span>
              <div className="shortcut-row">
                <button
                  type="button"
                  className={`shortcut-capture${capturing === 'window' ? ' capturing' : ''}`}
                  disabled={!current.shortcutsEnabled}
                  onClick={() => setCapturing('window')}
                >
                  {capturing === 'window'
                    ? 'Press keys… (Esc to cancel)'
                    : formatAcceleratorLabel(current.toggleWindowAccelerator)}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={!current.shortcutsEnabled || capturing != null}
                  onClick={() =>
                    patch({ toggleWindowAccelerator: DEFAULT_SETTINGS.toggleWindowAccelerator })
                  }
                >
                  Reset
                </button>
              </div>
              <p className="settings-note">
                Default is Ctrl/⌘ + Shift + X. Press once for the full app, again for the floating
                timer.
              </p>
              {shortcutError ? <p className="settings-note settings-error">{shortcutError}</p> : null}
            </div>
          </SettingsPanel>
        ) : null}

        {activeTab === 'updates' ? (
          <SettingsPanel title={tabMeta.title} description={tabMeta.description}>
            <Updater />
          </SettingsPanel>
        ) : null}
      </div>

      {activeTab !== 'updates' ? (
        <div className="settings-actions">
          <button type="button" className="btn btn-primary" onClick={() => void onSave()}>
            Save
          </button>
          {savedAt ? <p className="settings-note settings-saved">Saved at {savedAt}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

export default SettingsPage
