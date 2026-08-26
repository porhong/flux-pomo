import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import HistoryPage from '../pages/HistoryPage'
import MiniPage from '../pages/MiniPage'
import SettingsPage from '../pages/SettingsPage'
import TimerPage from '../pages/TimerPage'

function AppRouter(): React.JSX.Element {
  return (
    <HashRouter>
      <Routes>
        <Route path="/mini" element={<MiniPage />} />
        <Route element={<AppShell />}>
          <Route index element={<TimerPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default AppRouter
