import { NavLink } from 'react-router-dom'
import { CatchingIcon, HistoryIcon, LogIcon, ProgressIcon, WeightIcon } from './icons'
import './NavBar.css'

export function NavBar() {
  return (
    <nav className="nav-bar">
      <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
        <LogIcon />
        Log
      </NavLink>
      <NavLink to="/catching" className={({ isActive }) => (isActive ? 'active' : '')}>
        <CatchingIcon />
        Catching
      </NavLink>
      <NavLink to="/progress" className={({ isActive }) => (isActive ? 'active' : '')}>
        <ProgressIcon />
        Progress
      </NavLink>
      <NavLink to="/history" className={({ isActive }) => (isActive ? 'active' : '')}>
        <HistoryIcon />
        History
      </NavLink>
      <NavLink to="/bodyweight" className={({ isActive }) => (isActive ? 'active' : '')}>
        <WeightIcon />
        Weight
      </NavLink>
    </nav>
  )
}
