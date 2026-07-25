import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ensureJulyProgramSeeded } from './db/seedJulyProgram'

function renderApp() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

ensureJulyProgramSeeded()
  .then(renderApp)
  .catch((error) => {
    console.error('Failed to seed program data:', error)
    renderApp()
  })
