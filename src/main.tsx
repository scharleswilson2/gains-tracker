import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ensureJulyProgramSeeded } from './db/seedJulyProgram'
import { seedExerciseGlossary } from './db/exerciseGlossary'

function renderApp() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

// Runs on every startup (cheap, idempotent per-exercise) so that exercises
// added later — via free-form logging or a data Import — get backfilled
// with their glossary description. Must run before ensureJulyProgramSeeded,
// which depends on these exercises already existing.
seedExerciseGlossary()
  .then(() => ensureJulyProgramSeeded())
  .then(renderApp)
  .catch((error) => {
    console.error('Failed to seed program data:', error)
    renderApp()
  })
