import { NavLink } from 'react-router-dom'
import useFocusMusic from '../../hooks/useFocusMusic'
import useQuitPrompt from '../../hooks/useQuitPrompt'
import AnimatedOutlet from './AnimatedOutlet'
import QuitConfirmDialog from './QuitConfirmDialog'
import TitleBar from './TitleBar'

function AppShell(): React.JSX.Element {
  useFocusMusic()
  const quitPrompt = useQuitPrompt()

  return (
    <div className="app-shell">
      <TitleBar />
      <main className="app-main">
        <AnimatedOutlet />
      </main>
      <nav className="app-nav" aria-label="Primary">
        <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/" end>
          Timer
        </NavLink>
        <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/history">
          History
        </NavLink>
        <NavLink
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          to="/settings"
        >
          Settings
        </NavLink>
      </nav>
      <QuitConfirmDialog
        open={quitPrompt.open}
        onCancel={quitPrompt.cancel}
        onConfirm={quitPrompt.confirm}
      />
    </div>
  )
}

export default AppShell
