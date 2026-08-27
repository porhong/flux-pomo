import type { HistoryQuery, HistoryResult, PomodoroSettings, Session, SessionType } from './types'

/** Channel names shared by main and preload. Keep this list small and explicit. */
export const IpcChannels = {
  ping: 'app:ping',
  getVersion: 'app:get-version',
  windowMinimize: 'window:minimize',
  windowRestore: 'window:restore',
  windowClose: 'window:close',
  windowMiniIgnoreMouse: 'window:mini-ignore-mouse',
  windowMiniDragStart: 'window:mini-drag-start',
  windowMiniDragMove: 'window:mini-drag-move',
  windowMiniDragEnd: 'window:mini-drag-end',
  windowQuitPrompt: 'window:quit-prompt',
  windowQuitConfirm: 'window:quit-confirm',
  windowQuitCancel: 'window:quit-cancel',
  timerPublish: 'timer:publish',
  timerState: 'timer:state',
  timerGetState: 'timer:get-state',
  timerCommand: 'timer:command',
  updaterCheck: 'updater:check',
  updaterDownload: 'updater:download',
  updaterInstall: 'updater:install',
  updaterStatus: 'updater:status',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  shortcutsStatus: 'shortcuts:status',
  sessionsList: 'sessions:list',
  sessionsAdd: 'sessions:add',
  musicPickFolder: 'music:pick-folder',
  musicListTracks: 'music:list-tracks'
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]

export interface MusicTrack {
  id: string
  name: string
  url: string
}

export interface AppVersions {
  electron: string
  chrome: string
  node: string
}

export type TimerStatus = 'idle' | 'running' | 'paused'
export type TimerCommand = 'start' | 'pause' | 'toggle'

/** Snapshot pushed from the main renderer (owns the ticker) to the mini window. */
export interface TimerSnapshot {
  phase: SessionType
  status: TimerStatus
  remainingMs: number
  plannedMs: number
  endsAt: number | null
  focusCountInCycle: number
  sessionsUntilLongBreak: number
}

export type UpdaterStatus =
  | { type: 'idle' }
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'not-available'; version: string }
  | { type: 'error'; message: string }
  | { type: 'skipped'; message: string }

export interface UpdateCheckResult {
  updateAvailable: boolean
  version: string
  message?: string
  downloadUrl?: string
  releaseUrl?: string
}

export interface ShortcutStatus {
  enabled: boolean
  accelerator: string | null
  registered: boolean
  error: string | null
}

/** Renderer-facing API surface (exposed via contextBridge). */
export interface FluxPomoApi {
  ping: () => Promise<string>
  getVersion: () => Promise<string>
  versions: AppVersions
  window: {
    minimize: () => Promise<void>
    restore: () => Promise<void>
    close: () => Promise<void>
    setMiniIgnoreMouse: (ignore: boolean) => void
    startMiniDrag: () => void
    moveMiniDrag: () => void
    endMiniDrag: () => void
    onQuitPrompt: (listener: () => void) => () => void
    confirmQuit: () => Promise<void>
    cancelQuit: () => Promise<void>
  }
  timer: {
    publish: (snapshot: TimerSnapshot) => Promise<void>
    getState: () => Promise<TimerSnapshot | null>
    onState: (listener: (snapshot: TimerSnapshot) => void) => () => void
    command: (command: TimerCommand) => Promise<void>
    onCommand: (listener: (command: TimerCommand) => void) => () => void
  }
  updater: {
    check: () => Promise<UpdateCheckResult>
    download: () => Promise<void>
    install: () => Promise<void>
    onStatus: (listener: (status: UpdaterStatus) => void) => () => void
  }
  settings: {
    get: () => Promise<PomodoroSettings>
    set: (settings: PomodoroSettings) => Promise<PomodoroSettings>
  }
  shortcuts: {
    status: () => Promise<ShortcutStatus>
  }
  sessions: {
    list: (query: HistoryQuery) => Promise<HistoryResult>
    add: (session: Omit<Session, 'id'> & { id?: string }) => Promise<Session>
  }
  music: {
    pickFolder: () => Promise<string | null>
    listTracks: (folderPath: string) => Promise<MusicTrack[]>
  }
}

export type {
  HistoryQuery,
  HistoryResult,
  PomodoroSettings,
  Session,
  HistoryView,
  HistorySummary,
  DayAggregate,
  SessionType
} from './types'
