# Bodyweight Gets Its Own Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move bodyweight logging (form, chart, entry list) out of the
bottom of the Progress screen and into its own dedicated screen, reached
via a header icon next to Settings.

**Architecture:** A new `Bodyweight` screen component gets the existing
bodyweight form/chart/list verbatim. `App.tsx` gains a route and a second
header icon link (alongside Settings), with a small structural CSS change
so two header icons lay out correctly. `Progress.tsx` loses the bodyweight
section and its supporting code entirely.

**Tech Stack:** Same as the existing app — React, TypeScript, Dexie.js,
Recharts, Vitest + React Testing Library + fake-indexeddb. No new
dependencies.

## Global Constraints

- Weight unit is lbs throughout; dates are ISO strings `YYYY-MM-DD`
  throughout (existing constraints).
- This is a pure relocation: no new bodyweight features (no stats, no
  min/max, no unit toggle), no changed behavior, no new visual design.
  The only CSS change is the minimal structural fix needed to lay out two
  header icons instead of one (a flex wrapper + extending the existing
  `.settings-link` rule to also cover the new link) — not a new look, just
  making the existing look work with a second icon.
- No changes to `NavBar.test.tsx` or any App-level test — there is no
  `App.test.tsx` in this codebase, and the existing Settings header link
  isn't tested at that level either, so the new Bodyweight header link
  follows the same precedent.
- `src/db/bodyweight.ts` (`addBodyweightEntry`, `listBodyweightEntries`)
  does not change.

---

### Task 1: Create the Bodyweight screen

**Files:**
- Create: `src/screens/Bodyweight.tsx`
- Test: `src/screens/Bodyweight.test.tsx`

**Interfaces:**
- Consumes: `addBodyweightEntry`, `listBodyweightEntries`
  (`../db/bodyweight`, unchanged); `todayIso` (`../lib/dates`, unchanged).
- Produces: `Bodyweight` — a screen component with a bodyweight (lbs)
  input, a "Log Bodyweight" button, a line chart of weight over time, and
  a list of past entries. Consumed by Task 2 (`App.tsx`'s new route).

- [ ] **Step 1: Write the failing test**

`src/screens/Bodyweight.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Bodyweight } from './Bodyweight'

describe('Bodyweight', () => {
  it('logs an entry and shows it in the list', async () => {
    const user = userEvent.setup()

    render(<Bodyweight />)

    await user.type(screen.getByLabelText(/bodyweight/i), '190')
    await user.click(screen.getByRole('button', { name: /log bodyweight/i }))

    expect(await screen.findByText(/190/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/Bodyweight.test.tsx`
Expected: FAIL — cannot find module `./Bodyweight`

- [ ] **Step 3: Implement the Bodyweight screen**

`src/screens/Bodyweight.tsx`:
```tsx
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { addBodyweightEntry, listBodyweightEntries } from '../db/bodyweight'
import { todayIso } from '../lib/dates'

export function Bodyweight() {
  const [bodyweightInput, setBodyweightInput] = useState('')

  const bodyweightEntries = useLiveQuery(() => listBodyweightEntries(), []) ?? []

  async function logBodyweight() {
    if (!bodyweightInput) return
    await addBodyweightEntry(todayIso(), Number(bodyweightInput))
    setBodyweightInput('')
  }

  return (
    <div>
      <h1>Bodyweight</h1>
      <label htmlFor="bodyweight-input">Bodyweight (lbs)</label>
      <input
        id="bodyweight-input"
        type="number"
        value={bodyweightInput}
        onChange={(e) => setBodyweightInput(e.target.value)}
      />
      <button type="button" onClick={logBodyweight}>
        Log Bodyweight
      </button>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={bodyweightEntries}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis domain={['dataMin - 5', 'dataMax + 5']} />
          <Tooltip />
          <Line type="monotone" dataKey="weightLbs" stroke="#0891b2" />
        </LineChart>
      </ResponsiveContainer>
      <ul>
        {bodyweightEntries.map((b) => (
          <li key={b.id}>
            {b.date}: {b.weightLbs}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/screens/Bodyweight.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add src/screens/Bodyweight.tsx src/screens/Bodyweight.test.tsx
git commit -m "Add dedicated Bodyweight screen"
```

---

### Task 2: Wire up the route and header link

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: `Bodyweight` (`./screens/Bodyweight`, Task 1).
- Produces: route `/bodyweight` → `Bodyweight` screen; a second header
  icon link (⚖, aria-label "Bodyweight") next to the existing Settings
  gear, both now inside a `.header-links` flex wrapper so they lay out
  side by side instead of one of them landing in the header's
  `justify-content: space-between` center slot.

No automated test for this task (per Global Constraints — there is no
App-level test in this codebase, and Settings' equivalent header link
isn't tested at this level either). Verify with a type-check, lint, and
build instead.

- [ ] **Step 1: Update App.tsx**

Replace `src/App.tsx` in full:
```tsx
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
```

- [ ] **Step 2: Update App.css**

In `src/App.css`, replace:
```css
.settings-link {
  font-size: 1.25rem;
  text-decoration: none;
  color: inherit;
}
```
with:
```css
.header-links {
  display: flex;
  gap: 0.75rem;
}

.settings-link,
.bodyweight-link {
  font-size: 1.25rem;
  text-decoration: none;
  color: inherit;
}
```

- [ ] **Step 3: Run the full suite and verify the build**

Run: `npm test` — expected: all pass (Bodyweight's own test plus every
pre-existing test — nothing here touches other screens yet).
Run: `npx tsc -b` — expected: clean.
Run: `npm run lint` — expected: clean.
Run: `npm run build` — expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/App.css
git commit -m "Add Bodyweight route and header link"
```

---

### Task 3: Remove bodyweight logging from Progress

**Files:**
- Modify: `src/screens/Progress.tsx`
- Modify: `src/screens/Progress.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: the same `Progress` export, with all bodyweight-related state,
  imports, and UI removed. Bodyweight logging now exists only on the new
  `Bodyweight` screen (Task 1).

This task is a removal, not new behavior, so it doesn't follow the usual
RED→GREEN shape — there's no failing state to start from. Instead: update
the test first (it should still pass, since you haven't touched the
implementation yet), then remove the implementation, then confirm nothing
else broke.

- [ ] **Step 1: Update Progress.test.tsx**

In `src/screens/Progress.test.tsx`, replace the first test:
```tsx
  it('shows PRs for a selected exercise and lets me log bodyweight', async () => {
    const user = userEvent.setup()

    const exerciseId = await addExercise('Back Squat')
    const session1 = await getOrCreateSessionForDate('2026-07-10')
    const entry1 = await getOrCreateExerciseEntry(session1, exerciseId)
    await addSet(entry1, 225, 5)
    const session2 = await getOrCreateSessionForDate('2026-07-17')
    const entry2 = await getOrCreateExerciseEntry(session2, exerciseId)
    await addSet(entry2, 235, 5)

    render(<Progress />)

    await user.selectOptions(await screen.findByLabelText(/select exercise/i), 'Back Squat')

    expect(await screen.findByText(/235 x 5/)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/bodyweight/i), '190')
    await user.click(screen.getByRole('button', { name: /log bodyweight/i }))

    expect(await screen.findByText(/190/)).toBeInTheDocument()
  })
```
with:
```tsx
  it('shows PRs for a selected exercise', async () => {
    const user = userEvent.setup()

    const exerciseId = await addExercise('Back Squat')
    const session1 = await getOrCreateSessionForDate('2026-07-10')
    const entry1 = await getOrCreateExerciseEntry(session1, exerciseId)
    await addSet(entry1, 225, 5)
    const session2 = await getOrCreateSessionForDate('2026-07-17')
    const entry2 = await getOrCreateExerciseEntry(session2, exerciseId)
    await addSet(entry2, 235, 5)

    render(<Progress />)

    await user.selectOptions(await screen.findByLabelText(/select exercise/i), 'Back Squat')

    expect(await screen.findByText(/235 x 5/)).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run test to verify it still passes**

Run: `npx vitest run src/screens/Progress.test.tsx`
Expected: PASS (all 4 tests) — the implementation hasn't changed yet, and
the removed assertions were about code you haven't touched.

- [ ] **Step 3: Remove the bodyweight imports from Progress.tsx**

In `src/screens/Progress.tsx`, remove these two lines from the import
block (keep every other import as-is):
```tsx
import { addBodyweightEntry, listBodyweightEntries } from '../db/bodyweight'
import { todayIso } from '../lib/dates'
```

- [ ] **Step 4: Remove the bodyweight state, query, and handler**

In `src/screens/Progress.tsx`, remove this line from inside the `Progress`
function body (near the other `useState` calls):
```tsx
  const [bodyweightInput, setBodyweightInput] = useState('')
```

Remove this line (near the other `useLiveQuery` calls):
```tsx
  const bodyweightEntries = useLiveQuery(() => listBodyweightEntries(), []) ?? []
```

Remove this function (it sits just before the `return` statement):
```tsx
  async function logBodyweight() {
    if (!bodyweightInput) return
    await addBodyweightEntry(todayIso(), Number(bodyweightInput))
    setBodyweightInput('')
  }
```

- [ ] **Step 5: Remove the Bodyweight section from the JSX**

In `src/screens/Progress.tsx`, remove this entire `<section>` (it's the
last section in the returned JSX, right before the closing `</div>`):
```tsx
      <section>
        <h2>Bodyweight</h2>
        <label htmlFor="bodyweight-input">Bodyweight (lbs)</label>
        <input
          id="bodyweight-input"
          type="number"
          value={bodyweightInput}
          onChange={(e) => setBodyweightInput(e.target.value)}
        />
        <button type="button" onClick={logBodyweight}>
          Log Bodyweight
        </button>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={bodyweightEntries}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis domain={['dataMin - 5', 'dataMax + 5']} />
            <Tooltip />
            <Line type="monotone" dataKey="weightLbs" stroke="#0891b2" />
          </LineChart>
        </ResponsiveContainer>
        <ul>
          {bodyweightEntries.map((b) => (
            <li key={b.id}>
              {b.date}: {b.weightLbs}
            </li>
          ))}
        </ul>
      </section>
```

- [ ] **Step 6: Run test to verify it still passes**

Run: `npx vitest run src/screens/Progress.test.tsx`
Expected: PASS (all 4 tests)

- [ ] **Step 7: Run the full suite and verify the build**

Run: `npm test` — expected: all pass, no regressions (History's own
"Bodyweight: X lbs" row reads `db.bodyweightEntries` directly and doesn't
depend on anything in `Progress.tsx`, so it's unaffected).
Run: `npx tsc -b` — expected: clean.
Run: `npm run lint` — expected: clean.
Run: `npm run build` — expected: succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/screens/Progress.tsx src/screens/Progress.test.tsx
git commit -m "Remove bodyweight logging from Progress"
```
