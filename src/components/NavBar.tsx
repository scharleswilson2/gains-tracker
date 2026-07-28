import { NavLink } from 'react-router-dom'

export function NavBar() {
  return (
    <nav className="nav-bar">
      <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
        Log
      </NavLink>
      <NavLink to="/catching" className={({ isActive }) => (isActive ? 'active' : '')}>
        Log Catching
      </NavLink>
      <NavLink to="/progress" className={({ isActive }) => (isActive ? 'active' : '')}>
        Progress
      </NavLink>
      <NavLink to="/history" className={({ isActive }) => (isActive ? 'active' : '')}>
        History
      </NavLink>
      <NavLink to="/bodyweight" className={({ isActive }) => (isActive ? 'active' : '')}>
        Bodyweight
      </NavLink>
    </nav>
  )
}
