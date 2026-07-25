import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { NavBar } from './components/NavBar'
import { LogLift } from './screens/LogLift'
import { LogCatching } from './screens/LogCatching'
import { Progress } from './screens/Progress'
import { History } from './screens/History'
import { Settings } from './screens/Settings'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="app-header">
          <span className="app-title">Gains Tracker</span>
          <Link to="/settings" aria-label="Settings" className="settings-link">
            ⚙
          </Link>
        </header>
        <main className="app-content">
          <Routes>
            <Route path="/" element={<LogLift />} />
            <Route path="/catching" element={<LogCatching />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
        <NavBar />
      </div>
    </BrowserRouter>
  )
}
