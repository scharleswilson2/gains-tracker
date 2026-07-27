import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { NavBar } from './components/NavBar'
import { LogLift } from './screens/LogLift'
import { LogCatching } from './screens/LogCatching'
import { Program } from './screens/Program'
import { Progress } from './screens/Progress'
import { History } from './screens/History'
import { Bodyweight } from './screens/Bodyweight'
import { Settings } from './screens/Settings'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="app-header">
          <span className="app-title">Gains Tracker</span>
          <div className="header-links">
            <Link to="/bodyweight" aria-label="Bodyweight" className="bodyweight-link">
              ⚖
            </Link>
            <Link to="/settings" aria-label="Settings" className="settings-link">
              ⚙
            </Link>
          </div>
        </header>
        <main className="app-content">
          <Routes>
            <Route path="/" element={<LogLift />} />
            <Route path="/catching" element={<LogCatching />} />
            <Route path="/program" element={<Program />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/history" element={<History />} />
            <Route path="/bodyweight" element={<Bodyweight />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
        <NavBar />
      </div>
    </BrowserRouter>
  )
}
