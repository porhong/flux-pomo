import { NavLink, Outlet } from 'react-router-dom'

function AppShell(): React.JSX.Element {
  return (
    <div className="app-shell">
      <main className="app-main">
        <Outlet />
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
    </div>
  )
}

export default AppShell
