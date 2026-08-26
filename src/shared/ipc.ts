import type { HistoryQuery, HistoryResult, PomodoroSettings, Session } from './types'

/** Channel names shared by main and preload. Keep this list small and explicit. */
export const IpcChannels = {
  ping: 'app:ping',
  updaterCheck: 'updater:check',
  updaterDownload: 'updater:download',
  updaterInstall: 'updater:install',
  updaterStatus: 'updater:status',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  sessionsList: 'sessions:list',
  sessionsAdd: 'sessions:add'
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]

export interface AppVersions {
  electron: string
  chrome: string
  node: string
}

export type UpdaterStatus =
  | { type: 'idle' }
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'not-available'; version: string }
  | {
      type: 'downloading'
      percent: number
      bytesPerSecond: number
      transferred: number
      total: number
    }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }
  | { type: 'skipped'; message: string }

export interface UpdateCheckResult {
  updateAvailable: boolean
  version: string
  message?: string
}

/** Renderer-facing API surface (exposed via contextBridge). */
export interface FluxPomoApi {
  ping: () => Promise<string>
  versions: AppVersions
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
  sessions: {
    list: (query: HistoryQuery) => Promise<HistoryResult>
    add: (session: Omit<Session, 'id'> & { id?: string }) => Promise<Session>
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
