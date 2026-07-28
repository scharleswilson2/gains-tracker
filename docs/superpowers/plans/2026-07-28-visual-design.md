# Visual Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the app-wide visual design system from `docs/superpowers/specs/2026-07-28-visual-design-design.md` — color tokens with dark-mode support, the compact per-set row layout, an icon+label nav bar, and consistent input/button/card styling — to every screen in the app.

**Architecture:** One shared token/primitive layer in `src/index.css` (CSS custom properties + a handful of base classes: `.field`, `.btn`, `.btn-primary`, `.btn-ghost`, `.pill`, `.pill-selected`, `.status-badge`, `.pr-badge`). Every component/screen keeps its existing one-file-per-unit convention, gets its own new `.css` file, and consumes the shared tokens/classes — no CSS framework, no CSS-in-JS, no build tooling changes.

**Tech Stack:** React + Vite + TypeScript, plain CSS with custom properties, Recharts (recolored via `var(--color-*)` in its `stroke`/`fill` props), Vitest + Testing Library (existing suite, unchanged behaviorally except where noted).

## Global Constraints

- No manual light/dark toggle — theme follows `prefers-color-scheme` only (spec, "Explicitly out of scope").
- No custom web fonts — keep the existing `system-ui, sans-serif` stack.
- No motion/animation system.
- No icon library dependency — nav icons are hand-authored inline SVG components.
- Chart library stays Recharts — series are recolored via CSS variables in `stroke`/`fill`, no chart redesign.
- **No new automated tests for pure visual/layout changes** (spec, "Testing approach") — this plan's tasks are almost all "restyle, then confirm the existing suite still passes," not TDD in the usual sense. The one exception is Task 3 (NavBar), where the visible label text itself changes, which is a genuine behavior change with its own test update.
- The existing suite currently stands at **219 passing tests across 29 files** — every task's verification step re-runs `npx vitest run` and expects that same count unless the task's own description says otherwise.
- Every existing test in the suite queries by ARIA role, label text, or visible text content — never by CSS class or computed style — so adding `className` attributes and new `.css` files must never require touching a test file, with the single exception noted above.
- Never change existing user-facing copy, `id`/`htmlFor` pairs, `aria-label` values, or button/label text while restyling — those are load-bearing for the current test suite. Every task below is additive (new `className`/new files) on top of unchanged markup and text.

---

### Task 1: Design tokens and shared primitives

**Files:**
- Modify: `src/index.css`

**Interfaces:**
- Consumes: nothing.
- Produces: CSS custom properties (`--color-bg`, `--color-surface`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-accent-contrast`, `--color-pr-bg`, `--color-pr-text`, `--color-chart-secondary`, `--radius-sm`, `--radius-md`, `--space-1` through `--space-4`) and shared classes (`.field`, `.btn`, `.btn-primary`, `.btn-ghost`, `.pill`, `.pill-selected`, `.status-badge`, `.pr-badge`) that every later task's CSS/JSX relies on.

- [ ] **Step 1: Replace `src/index.css` with the token set and shared primitives**

```css
:root {
  --color-bg: #ffffff;
  --color-surface: #fafafa;
  --color-border: #e5e5e5;
  --color-text: #111111;
  --color-text-muted: #888888;
  --color-accent: #16a34a;
  --color-accent-contrast: #ffffff;
  --color-pr-bg: #fff7e6;
  --color-pr-text: #b45309;
  --color-chart-secondary: #2563eb;
  --radius-sm: 6px;
  --radius-md: 10px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #18181b;
    --color-surface: #202023;
    --color-border: #2a2a2e;
    --color-text: #eeeeee;
    --color-text-muted: #999999;
    --color-accent: #4ade80;
    --color-accent-contrast: #0b1f12;
    --color-pr-bg: #3a2c12;
    --color-pr-text: #fbbf24;
    --color-chart-secondary: #60a5fa;
  }
}

body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: system-ui, sans-serif;
}

.field {
  width: 100%;
  box-sizing: border-box;
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.9rem;
}

.btn {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.9rem;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  border-color: transparent;
}

.btn-ghost {
  background: transparent;
  border: 1px dashed var(--color-border);
  color: var(--color-text-muted);
}

.pill {
  display: inline-block;
  padding: 2px var(--space-2);
  border-radius: 999px;
  background: var(--color-border);
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.pill-selected {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}

.status-badge {
  display: inline-block;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: 0.8rem;
}

.pr-badge {
  display: inline-block;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--color-pr-bg);
  color: var(--color-pr-text);
  font-size: 0.8rem;
  font-weight: 700;
}
```

- [ ] **Step 2: Run the full test suite to confirm this pure-CSS change doesn't break anything**

Run: `npx vitest run`
Expected: `Test Files  29 passed (29)`, `Tests  219 passed (219)` — identical to before this change, since no component/test file was touched.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "Add design tokens and shared primitives for the visual design system"
```

---

### Task 2: App shell restyle

**Files:**
- Modify: `src/App.css`

**Interfaces:**
- Consumes: tokens from Task 1 (`--color-surface`, `--color-border`, `--color-text`, `--color-text-muted`, `--space-3`, `--space-4`).
- Produces: nothing new consumed by later tasks (the `.nav-bar` rules in this file are superseded in Task 3, not built upon).

- [ ] **Step 1: Replace `src/App.css` with the retokenized version (nav-bar rules untouched for now — Task 3 migrates them)**

```css
* {
  box-sizing: border-box;
}

.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--color-bg);
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.app-title {
  font-weight: 600;
  color: var(--color-text);
}

.header-links {
  display: flex;
  gap: var(--space-3);
}

.settings-link {
  font-size: 1.25rem;
  text-decoration: none;
  color: var(--color-text-muted);
}

.app-content {
  flex: 1;
  padding: var(--space-4);
  padding-bottom: 4.5rem;
}

.nav-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
  padding: 0.75rem 0;
  background: white;
  border-top: 1px solid #ddd;
}

.nav-bar a {
  text-decoration: none;
  color: #666;
  font-size: 0.85rem;
}

.nav-bar a.active {
  color: #111;
  font-weight: 600;
}
```

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: `Test Files  29 passed (29)`, `Tests  219 passed (219)`.

- [ ] **Step 3: Commit**

```bash
git add src/App.css
git commit -m "Retheme the app shell header/content with design tokens"
```

---

### Task 3: Nav bar icons and restyle

This is the one task in the plan with an actual behavior change (shortened, visible nav labels), so it follows the normal write-test-first flow.

**Files:**
- Create: `src/components/icons.tsx`
- Create: `src/components/NavBar.css`
- Modify: `src/components/NavBar.tsx`
- Modify: `src/components/NavBar.test.tsx`
- Modify: `src/App.css` (remove the `.nav-bar` rules, now superseded by `NavBar.css`)

**Interfaces:**
- Consumes: tokens from Task 1 (`--color-surface`, `--color-border`, `--color-text-muted`, `--color-accent`, `--space-2`).
- Produces: `LogIcon`, `CatchingIcon`, `ProgressIcon`, `HistoryIcon`, `WeightIcon` components from `src/components/icons.tsx` — exported as `({ className }?: { className?: string }) => JSX.Element`. Nothing else in this plan imports them besides `NavBar.tsx`.

- [ ] **Step 1: Update `NavBar.test.tsx` to expect the shortened labels**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NavBar } from './NavBar'

describe('NavBar', () => {
  it('renders links to all five primary screens', () => {
    render(
      <MemoryRouter>
        <NavBar />
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: /^log$/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /^catching$/i })).toHaveAttribute('href', '/catching')
    expect(screen.getByRole('link', { name: /^progress$/i })).toHaveAttribute('href', '/progress')
    expect(screen.getByRole('link', { name: /^history$/i })).toHaveAttribute('href', '/history')
    expect(screen.getByRole('link', { name: /^weight$/i })).toHaveAttribute('href', '/bodyweight')
  })
})
```

- [ ] **Step 2: Run it to verify it fails against the current `NavBar.tsx`**

Run: `npx vitest run src/components/NavBar.test.tsx`
Expected: FAIL — `/^catching$/i` and `/^weight$/i` won't match today's "Log Catching" / "Bodyweight" link names.

- [ ] **Step 3: Create `src/components/icons.tsx`**

```tsx
interface IconProps {
  className?: string
}

export function LogIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="4" y1="12" x2="20" y2="12" />
      <rect x="1" y="9" width="3" height="6" rx="1" />
      <rect x="20" y="9" width="3" height="6" rx="1" />
    </svg>
  )
}

export function CatchingIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M7 5.5c1.8 2 1.8 11 0 13" />
      <path d="M17 5.5c-1.8 2-1.8 11 0 13" />
    </svg>
  )
}

export function ProgressIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 17 9 11 13 15 21 6" />
      <polyline points="15 6 21 6 21 12" />
    </svg>
  )
}

export function HistoryIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 16 14" />
    </svg>
  )
}

export function WeightIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="12" cy="13" r="4" />
      <line x1="12" y1="13" x2="14" y2="10.5" />
    </svg>
  )
}
```

- [ ] **Step 4: Create `src/components/NavBar.css`**

```css
.nav-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
  padding: var(--space-2) 0;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
}

.nav-bar a {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  text-decoration: none;
  color: var(--color-text-muted);
  font-size: 0.7rem;
}

.nav-bar a.active {
  color: var(--color-accent);
  font-weight: 700;
}
```

- [ ] **Step 5: Rewrite `src/components/NavBar.tsx`**

```tsx
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
```

- [ ] **Step 6: Remove the now-superseded `.nav-bar` rules from `src/App.css`**

Delete this block from `src/App.css` (it moved to `NavBar.css` in Step 4):

```css
.nav-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
  padding: 0.75rem 0;
  background: white;
  border-top: 1px solid #ddd;
}

.nav-bar a {
  text-decoration: none;
  color: #666;
  font-size: 0.85rem;
}

.nav-bar a.active {
  color: #111;
  font-weight: 600;
}
```

`src/App.css` should now end at the `.app-content` rule from Task 2.

- [ ] **Step 7: Run the NavBar test to verify it now passes**

Run: `npx vitest run src/components/NavBar.test.tsx`
Expected: PASS.

- [ ] **Step 8: Run the full test suite**

Run: `npx vitest run`
Expected: `Test Files  29 passed (29)`, `Tests  219 passed (219)`.

- [ ] **Step 9: Commit**

```bash
git add src/components/icons.tsx src/components/NavBar.css src/components/NavBar.tsx src/components/NavBar.test.tsx src/App.css
git commit -m "Add icon+label nav bar with shortened labels"
```

---

### Task 4: DayNavigator restyle

**Files:**
- Create: `src/components/DayNavigator.css`
- Modify: `src/components/DayNavigator.tsx`

**Interfaces:**
- Consumes: tokens from Task 1 (`--space-1`, `--space-3`, `--space-4`, `--radius-sm`, `--color-border`, `--color-surface`, `--color-text`, `--color-text-muted`).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Create `src/components/DayNavigator.css`**

```css
.day-navigator {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.day-navigator-arrow {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 1rem;
  cursor: pointer;
  flex-shrink: 0;
}

.day-navigator-arrow:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.day-navigator-label {
  flex: 1;
  text-align: center;
}

.day-navigator-program {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.day-navigator-day {
  margin: var(--space-1) 0;
  font-size: 1.1rem;
}

.day-navigator-week {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}
```

- [ ] **Step 2: Update `src/components/DayNavigator.tsx`**

```tsx
import type { DatedProgramDay } from '../db/programs'
import './DayNavigator.css'

interface DayNavigatorProps {
  days: DatedProgramDay[]
  currentIndex: number
  onNavigate: (index: number) => void
}

export function DayNavigator({ days, currentIndex, onNavigate }: DayNavigatorProps) {
  const current = days[currentIndex]
  if (!current) return null

  return (
    <div className="day-navigator">
      <button
        type="button"
        className="day-navigator-arrow"
        aria-label="Previous day"
        onClick={() => onNavigate(currentIndex - 1)}
        disabled={currentIndex <= 0}
      >
        ←
      </button>
      <div className="day-navigator-label">
        <p className="day-navigator-program">{current.program.name}</p>
        <h2 className="day-navigator-day">
          Day {current.day.dayNumber} — {current.date}
        </h2>
        <p className="day-navigator-week">Week {current.week.weekNumber}</p>
      </div>
      <button
        type="button"
        className="day-navigator-arrow"
        aria-label="Next day"
        onClick={() => onNavigate(currentIndex + 1)}
        disabled={currentIndex >= days.length - 1}
      >
        →
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: `Test Files  29 passed (29)`, `Tests  219 passed (219)`.

- [ ] **Step 4: Commit**

```bash
git add src/components/DayNavigator.css src/components/DayNavigator.tsx
git commit -m "Restyle DayNavigator with tappable arrow buttons"
```

---

### Task 5: SlotHeader and ExerciseInfo restyle

**Files:**
- Create: `src/components/SlotHeader.css`
- Create: `src/components/ExerciseInfo.css`
- Modify: `src/components/SlotHeader.tsx`
- Modify: `src/components/ExerciseInfo.tsx`

**Interfaces:**
- Consumes: tokens from Task 1 (`--space-1`, `--space-2`, `--space-3`, `--color-text`, `--color-text-muted`).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Create `src/components/SlotHeader.css`**

```css
.slot-header {
  margin-bottom: var(--space-2);
}

.slot-header-meta {
  display: flex;
  gap: var(--space-3);
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.slot-header-targets {
  margin: var(--space-1) 0 0;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}
```

- [ ] **Step 2: Create `src/components/ExerciseInfo.css`**

```css
.exercise-info-name {
  background: none;
  border: none;
  padding: 0;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
}

.exercise-info-description {
  margin: var(--space-1) 0 0;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}
```

- [ ] **Step 3: Update `src/components/ExerciseInfo.tsx`**

```tsx
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { findExerciseByName } from '../db/exercises'
import './ExerciseInfo.css'

export function ExerciseInfo({ name }: { name: string }) {
  const [expanded, setExpanded] = useState(false)
  const exercise = useLiveQuery(() => findExerciseByName(name), [name])

  return (
    <div className="exercise-info">
      <button type="button" className="exercise-info-name" onClick={() => setExpanded((prev) => !prev)}>
        {name}
      </button>
      {expanded && (
        <p className="exercise-info-description">{exercise?.description || 'No description available.'}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Update `src/components/SlotHeader.tsx`**

```tsx
import type { ResolvedSlot } from '../db/programExercises'
import { ExerciseInfo } from './ExerciseInfo'
import './SlotHeader.css'

function targetSummary(slot: ResolvedSlot): string {
  const { prescription } = slot
  if (!prescription) return ''
  if (prescription.isTest) return 'TEST'
  const parts: string[] = []
  if (prescription.warmupTargets.length > 0)
    parts.push(`Warmup: ${prescription.warmupTargets.join(', ')}`)
  if (prescription.workingTargets.length > 0)
    parts.push(`Working: ${prescription.workingTargets.join(', ')}`)
  return parts.join(' | ')
}

/**
 * The prescription header shared by the Log Lift program-day cards
 * (`ProgramSlotCard`) and the Program tab's schedule view: exercise name (with
 * its glossary affordance), tempo, RIR, and the warmup/working target summary
 * — plus an "(each side)" marker for per-side prescriptions.
 */
export function SlotHeader({ slot }: { slot: ResolvedSlot }) {
  const { programExercise, prescription } = slot

  return (
    <div className="slot-header">
      <ExerciseInfo name={slot.exerciseName} />
      <div className="slot-header-meta">
        {programExercise.tempo && <span>Tempo: {programExercise.tempo}</span>}
        {prescription?.rir && <span>RIR: {prescription.rir}</span>}
      </div>
      <p className="slot-header-targets">
        {targetSummary(slot)}
        {programExercise.eachSide && <span> (each side)</span>}
      </p>
    </div>
  )
}
```

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: `Test Files  29 passed (29)`, `Tests  219 passed (219)`.

- [ ] **Step 6: Commit**

```bash
git add src/components/SlotHeader.css src/components/ExerciseInfo.css src/components/SlotHeader.tsx src/components/ExerciseInfo.tsx
git commit -m "Restyle SlotHeader and ExerciseInfo"
```

---

### Task 6: ProgramSlotCard restyle (card, compact-table set rows, PR badge)

The core interaction surface. Adds `className` attributes throughout `ProgramSlotCard.tsx` without changing any label text, `id`/`htmlFor` pairs, button names, or logic — every existing assertion in `ProgramSlotCard.test.tsx` keeps matching by role/label/text exactly as before.

**Files:**
- Create: `src/components/ProgramSlotCard.css`
- Modify: `src/components/ProgramSlotCard.tsx`

**Interfaces:**
- Consumes: tokens and primitives from Task 1 (`.field`, `.btn`, `.btn-primary`, `.btn-ghost`, `.pill`, `.pill-selected`, `.status-badge`, `.pr-badge`, plus raw tokens).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Create `src/components/ProgramSlotCard.css`**

```css
.program-slot-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  margin-bottom: var(--space-3);
}

.program-slot-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-2);
}

.slot-form {
  margin-top: var(--space-2);
}

.slot-form-last-week {
  margin: 0 0 var(--space-2);
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.set-row-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.set-row {
  display: grid;
  grid-template-columns: 24px 1fr 1fr 32px;
  gap: var(--space-2);
  align-items: end;
}

.set-row-number {
  align-self: center;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.set-row-fields {
  display: contents;
}

.set-row-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.set-row-field label {
  font-size: 0.7rem;
  color: var(--color-text-muted);
}

.set-row-status {
  align-self: center;
  text-align: center;
  color: var(--color-text-muted);
}

.set-row[data-status='logged'] .set-row-status {
  color: var(--color-accent);
}

.set-row-save {
  grid-column: 1 / -1;
  justify-self: start;
}

.set-row-pr {
  grid-column: 1 / -1;
}

.set-row-add {
  width: 100%;
  margin-top: var(--space-1);
}

.set-row-checkbox-label {
  grid-column: 2 / 4;
  align-self: center;
  font-size: 0.85rem;
}

.set-row-checkbox {
  grid-column: 4;
  justify-self: center;
  align-self: center;
  width: 20px;
  height: 20px;
}

.category-picker {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: var(--space-2) 0;
}

.category-pill {
  border: 1px solid var(--color-border);
}

.category-pill:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.category-detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
```

- [ ] **Step 2: Replace `src/components/ProgramSlotCard.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { ResolvedSlot } from '../db/programExercises'
import { SlotHeader } from './SlotHeader'
import { logWeightSet } from '../lib/logWeightSet'
import { getLastWeekWeightResult, getSetsForExerciseOnDate, getWorkingSetCountForSlotWeek, updateSet } from '../db/workouts'
import type { SetRecord } from '../db/schema'
import {
  appendProgramLogValue,
  getLastWeekCategoryValue,
  getLastWeekSimpleValue,
  getProgramLogEntriesForDate,
  logCategoryChoice,
  removeLastProgramLogValue,
} from '../db/programLogEntries'
import { compareSimpleValues, compareWeightSets } from '../lib/compareProgress'
import type { ProgressBadge } from '../lib/compareProgress'
import './ProgramSlotCard.css'

interface ProgramSlotCardProps {
  slot: ResolvedSlot
  date: string
  weekNumber: number
}

const BADGE_LABEL: Record<ProgressBadge, string> = {
  beat: 'Beat last week!',
  matched: 'Matched last week',
  'fell-short': 'Fell short of last week',
}

export function ProgramSlotCard({ slot, date, weekNumber }: ProgramSlotCardProps) {
  const { programExercise } = slot

  return (
    <div className="program-slot-card">
      <div className="program-slot-card-header">
        <SlotHeader slot={slot} />
        {programExercise.blockLabel && <span className="pill">{programExercise.blockLabel}</span>}
      </div>

      {programExercise.measureType === 'weight' && (
        <WeightSlotForm slot={slot} date={date} weekNumber={weekNumber} />
      )}
      {programExercise.measureType === 'category_choice' && (
        <CategoryChoiceSlotForm slot={slot} date={date} weekNumber={weekNumber} />
      )}
      {(programExercise.measureType === 'bodyweight_reps' ||
        programExercise.measureType === 'time' ||
        programExercise.measureType === 'distance') && (
        <SimpleValueSlotForm slot={slot} date={date} weekNumber={weekNumber} />
      )}
    </div>
  )
}

interface SetRow {
  key: string
  isWarmup: boolean
  targetReps: number
  set: SetRecord | null
  // Whether this row is the next one that logging a new set will actually
  // land on — a row's set is attributed by insertion order (see
  // getSetsForExerciseOnDate), not by which row's button was clicked, so
  // any not-yet-logged row other than the next one must not offer to log:
  // doing so would silently fill an earlier row instead. Already-logged
  // rows are always independently editable regardless of this flag.
  canLog: boolean
}

function WeightSlotForm({ slot, date, weekNumber }: ProgramSlotCardProps) {
  const [extraSlotCount, setExtraSlotCount] = useState(0)
  const exerciseId = slot.programExercise.exerciseId
  const programExerciseId = slot.programExercise.id!
  const warmupTargets = slot.prescription?.warmupTargets ?? []
  const workingTargets = slot.prescription?.workingTargets ?? []
  const targetReps = workingTargets.length > 0 ? workingTargets[workingTargets.length - 1] : null
  const targetSetCount = workingTargets.length

  const loggedSets = useLiveQuery(
    () => getSetsForExerciseOnDate(exerciseId, date, programExerciseId),
    [exerciseId, date, programExerciseId]
  ) ?? { warmup: [], working: [] }

  const thisWeekSetCount = useLiveQuery(
    () => getWorkingSetCountForSlotWeek(exerciseId, programExerciseId, weekNumber),
    [exerciseId, programExerciseId, weekNumber]
  ) ?? 0
  const hasCompletedPrescribedSets = targetSetCount > 0 && thisWeekSetCount >= targetSetCount

  const thisWeekResult = useLiveQuery(
    () => getLastWeekWeightResult(exerciseId, programExerciseId, weekNumber),
    [exerciseId, programExerciseId, weekNumber]
  )
  const lastWeekResult = useLiveQuery(
    () => getLastWeekWeightResult(exerciseId, programExerciseId, weekNumber - 1),
    [exerciseId, programExerciseId, weekNumber]
  )
  const progressBadge =
    hasCompletedPrescribedSets && thisWeekResult && lastWeekResult
      ? compareWeightSets(thisWeekResult, lastWeekResult, targetReps)
      : null

  const warmupRows: SetRow[] = warmupTargets.map((target, i) => ({
    key: `warmup-${i}`,
    isWarmup: true,
    targetReps: target,
    set: loggedSets.warmup[i] ?? null,
    canLog: i === loggedSets.warmup.length,
  }))
  const workingRows: SetRow[] = workingTargets.map((target, i) => ({
    key: `working-${i}`,
    isWarmup: false,
    targetReps: target,
    set: loggedSets.working[i] ?? null,
    canLog: i === loggedSets.working.length,
  }))
  const loggedExtras = loggedSets.working.slice(workingTargets.length)
  const extraRows: SetRow[] = loggedExtras.map((set, i) => ({
    key: `extra-${i}`,
    isWarmup: false,
    targetReps: set.reps,
    set,
    canLog: true, // already logged — Update is always available regardless of canLog
  }))
  // `extraSlotCount` only ever grows (clicking "+ Add extra set" bumps it,
  // nothing decrements it), so how many *pending* (not-yet-logged) extra
  // rows to render is purely derived from how far ahead of the logged data
  // it currently is — the pending row disappears exactly when the live
  // query catches up and the real row lands in `extraRows`, with no
  // imperative "hide it now" step that could race ahead of that data.
  const pendingCount = Math.max(0, extraSlotCount - extraRows.length)
  const pendingRows: SetRow[] = Array.from({ length: pendingCount }, (_, i) => ({
    key: `extra-${extraRows.length + i}`,
    isWarmup: false,
    targetReps: workingTargets[workingTargets.length - 1] ?? 0,
    set: null,
    // Only the first pending row is ever the immediate next working-stream
    // slot — the "+ Add extra set" gate (below) keeps more than one pending
    // row from existing at once in practice, but this stays correct even if
    // that ever changes.
    canLog: workingTargets.length + extraRows.length + i === loggedSets.working.length,
  }))

  const rows = [...warmupRows, ...workingRows, ...extraRows, ...pendingRows]

  return (
    <div className="slot-form">
      {lastWeekResult && (
        <p className="slot-form-last-week">
          Last week: {lastWeekResult.weightLbs} lbs x {lastWeekResult.reps}
        </p>
      )}
      <div className="set-row-grid">
        {rows.map((row, i) => {
          const rowNumber = row.isWarmup ? i + 1 : i + 1 - warmupRows.length
          const rowLabel = row.isWarmup ? `Warmup ${rowNumber}` : `Set ${rowNumber}`
          return (
            <WeightRow
              key={row.key}
              row={row}
              rowLabel={rowLabel}
              rowNumber={rowNumber}
              slot={slot}
              date={date}
              weekNumber={weekNumber}
            />
          )
        })}
      </div>
      {/* A row's set is attributed by insertion order (getSetsForExerciseOnDate's
          contract), not by which row's button the user clicked — so an extra set
          logged before the prescribed rows are done would land on an earlier,
          untouched row instead of at the end. Gating this on the prescription
          being complete keeps every new save unambiguously "the next row." */}
      {pendingCount === 0 && loggedSets.working.length >= workingTargets.length && (
        <button
          type="button"
          className="btn btn-ghost set-row-add"
          onClick={() => setExtraSlotCount((c) => c + 1)}
        >
          + Add extra set
        </button>
      )}
      {progressBadge && (
        <p role="status" className="status-badge">
          {BADGE_LABEL[progressBadge]}
        </p>
      )}
    </div>
  )
}

function WeightRow({
  row,
  rowLabel,
  rowNumber,
  slot,
  date,
  weekNumber,
}: {
  row: SetRow
  rowLabel: string
  rowNumber: number
  slot: ResolvedSlot
  date: string
  weekNumber: number
}) {
  const [weight, setWeight] = useState(row.set ? String(row.set.weightLbs) : '')
  const [reps, setReps] = useState(row.set ? String(row.set.reps) : String(row.targetReps))
  const [prMessage, setPrMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const weightId = `weight-${slot.programExercise.id}-${row.key}`
  const repsId = `reps-${slot.programExercise.id}-${row.key}`

  // The row's key is stable (it never changes based on row.set), so this
  // component instance survives the transition from "not yet logged" to
  // "logged" — including when `row.set` first arrives asynchronously from
  // the live query on initial mount (a pre-existing set loaded from a prior
  // session). Sync the displayed values from row.set whenever its identity
  // changes, without touching prMessage — a remount-on-set-arrival approach
  // would instead wipe the just-set "PR!" message the instant handleSave's
  // own live-query refresh lands, before it ever painted.
  useEffect(() => {
    if (row.set) {
      setWeight(String(row.set.weightLbs))
      setReps(String(row.set.reps))
    }
  }, [row.set?.id])

  async function handleSave() {
    if (isSubmitting || (!row.set && !row.canLog)) return
    const weightLbs = Number(weight)
    const repsNum = Number(reps)
    if (!(weightLbs > 0) || !Number.isInteger(repsNum) || repsNum <= 0) return

    setIsSubmitting(true)
    try {
      if (row.set) {
        await updateSet(row.set.id!, { weightLbs, reps: repsNum })
        setPrMessage(null)
      } else {
        const pr = await logWeightSet({
          exerciseId: slot.programExercise.exerciseId,
          date,
          weightLbs,
          reps: repsNum,
          isWarmup: row.isWarmup,
          programExerciseId: slot.programExercise.id,
          weekNumber,
        })
        setPrMessage(!row.isWarmup && (pr.isWeightPr || pr.isEstimated1RmPr) ? 'PR!' : null)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const status: 'logged' | 'open' = row.set ? 'logged' : 'open'

  return (
    <div className="set-row" data-status={status}>
      <span className="set-row-number">{rowNumber}</span>
      <div className="set-row-fields">
        <div className="set-row-field">
          <label htmlFor={weightId}>Weight (lbs) — {rowLabel}</label>
          <input
            id={weightId}
            className="field"
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
        <div className="set-row-field">
          <label htmlFor={repsId}>Reps — {rowLabel}</label>
          <input
            id={repsId}
            className="field"
            type="number"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
          />
        </div>
      </div>
      <span className="set-row-status" aria-hidden="true">
        {row.set ? '✓' : '○'}
      </span>
      <button
        type="button"
        className="btn btn-primary set-row-save"
        onClick={handleSave}
        disabled={isSubmitting || (!row.set && !row.canLog)}
      >
        {row.set ? 'Update' : 'Log set'}
      </button>
      {prMessage && (
        <p role="status" className="pr-badge set-row-pr">
          ★ {prMessage}
        </p>
      )}
    </div>
  )
}

function SimpleValueSlotForm({ slot, date, weekNumber }: ProgramSlotCardProps) {
  const [extraRowRequestCount, setExtraRowRequestCount] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const programExerciseId = slot.programExercise.id!
  const workingTargets = slot.prescription?.workingTargets ?? []

  const entries = useLiveQuery(
    () => getProgramLogEntriesForDate(programExerciseId, date),
    [programExerciseId, date]
  ) ?? []
  const loggedValues = entries.find((e) => e.chosenCategory === undefined)?.values ?? []

  const lastWeekValue = useLiveQuery(
    () => getLastWeekSimpleValue(programExerciseId, weekNumber - 1),
    [programExerciseId, weekNumber]
  )
  const thisWeekLastValue = loggedValues.length > 0 ? loggedValues[loggedValues.length - 1] : undefined
  const progressBadge =
    thisWeekLastValue !== undefined ? compareSimpleValues(thisWeekLastValue, lastWeekValue) : null

  const lastTarget = workingTargets[workingTargets.length - 1] ?? 0
  const loggedExtraCount = Math.max(0, loggedValues.length - workingTargets.length)
  // `extraRowRequestCount` only ever grows (clicking "+ Add extra set" bumps
  // it, nothing decrements it), so how many extra rows to render is purely
  // derived from how far ahead of the logged data it currently is — mirrors
  // WeightSlotForm's `extraSlotCount`/`pendingCount` pattern. An earlier
  // version reset a `showExtraRow` boolean back to false imperatively right
  // after the append promise resolved; that reset landed in a render before
  // the live query's own async refresh had caught up, so the extra row's
  // count dropped to zero and back up again, unmounting and remounting the
  // checkbox with a fresh DOM node mid-interaction. Deriving purely from
  // `loggedValues` (via `Math.max`) means the row's presence and its
  // checked state always move together on the same render, so there is no
  // such gap.
  const extraRowCount = Math.max(extraRowRequestCount, loggedExtraCount)
  const pendingExtraCount = Math.max(0, extraRowRequestCount - loggedExtraCount)

  // `isSubmitting` guards against a rapid double-fire on the same checkbox
  // (two change events landing before the first write's live-query refresh
  // updates `loggedValues`) — without it, both events see the same stale
  // `loggedValues.length` and pass the index guard, silently double-logging
  // a set and checking the row after it. Mirrors WeightRow's identical
  // `isSubmitting` guard on its save button in this same file.
  async function handleCheck(rowIndex: number, targetValue: number) {
    if (isSubmitting || rowIndex !== loggedValues.length) return
    setIsSubmitting(true)
    try {
      await appendProgramLogValue(programExerciseId, date, weekNumber, targetValue)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleUncheck(rowIndex: number) {
    if (isSubmitting || rowIndex !== loggedValues.length - 1) return
    setIsSubmitting(true)
    try {
      await removeLastProgramLogValue(programExerciseId, date, weekNumber)
    } finally {
      setIsSubmitting(false)
    }
  }

  const rows = [
    ...workingTargets.map((target, i) => ({ index: i, target })),
    ...Array.from({ length: extraRowCount }, (_, i) => ({
      index: workingTargets.length + i,
      target: lastTarget,
    })),
  ]

  return (
    <div className="slot-form">
      {lastWeekValue !== undefined && <p className="slot-form-last-week">Last week: {lastWeekValue}</p>}
      <div className="set-row-grid">
        {rows.map((row) => {
          const checked = row.index < loggedValues.length
          // Only the next open row can be checked, and only the most-recently-
          // checked row can be unchecked — any other checked row is clickable
          // in the DOM by default (its own handler just no-ops), which reads
          // as an affordance it won't honor. Disable it explicitly instead.
          const disabled =
            isSubmitting ||
            (checked ? row.index !== loggedValues.length - 1 : row.index !== loggedValues.length)
          const checkboxId = `set-${programExerciseId}-${row.index}`
          return (
            <div key={row.index} className="set-row" data-status={checked ? 'logged' : 'open'}>
              <span className="set-row-number">{row.index + 1}</span>
              <label htmlFor={checkboxId} className="set-row-checkbox-label">
                Set {row.index + 1} (target {row.target})
              </label>
              <input
                id={checkboxId}
                className="set-row-checkbox"
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(e) =>
                  e.target.checked ? handleCheck(row.index, row.target) : handleUncheck(row.index)
                }
              />
            </div>
          )
        })}
      </div>
      {/* No working targets at all (e.g. no prescription for this week) means
          there's no target value to log an extra row with — lastTarget would
          fall back to 0, which the checkbox would then log verbatim. */}
      {pendingExtraCount === 0 && lastTarget > 0 && (
        <button
          type="button"
          className="btn btn-ghost set-row-add"
          onClick={() => setExtraRowRequestCount((c) => c + 1)}
        >
          + Add extra set
        </button>
      )}
      {progressBadge && (
        <p role="status" className="status-badge">
          {BADGE_LABEL[progressBadge]}
        </p>
      )}
    </div>
  )
}

function CategoryChoiceSlotForm({ slot, date, weekNumber }: ProgramSlotCardProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedExercise, setSelectedExercise] = useState('')
  const [value, setValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [rejectedByCap, setRejectedByCap] = useState(false)
  const programExerciseId = slot.programExercise.id!
  const categoryOptions = slot.programExercise.categoryOptions ?? []

  const entries = useLiveQuery(
    () => getProgramLogEntriesForDate(programExerciseId, date),
    [programExerciseId, date]
  ) ?? []
  const loggedCategories = entries.map((e) => e.chosenCategory).filter(Boolean)
  const categoriesToPick = slot.programExercise.categoriesToPick ?? categoryOptions.length
  // Display-only hint. The cap itself is enforced atomically inside
  // `logCategoryChoice`, so a stale snapshot here can never let an extra
  // category through; `rejectedByCap` surfaces a write the DB turned away.
  const capReached = loggedCategories.length >= categoriesToPick

  const lastWeekCategoryValue = useLiveQuery(
    () =>
      selectedCategory
        ? getLastWeekCategoryValue(programExerciseId, weekNumber - 1, selectedCategory)
        : Promise.resolve(undefined),
    [programExerciseId, weekNumber, selectedCategory]
  )
  const thisWeekEntry = selectedCategory
    ? entries.find((e) => e.chosenCategory === selectedCategory)
    : undefined
  const thisWeekValue =
    thisWeekEntry && thisWeekEntry.values.length > 0
      ? thisWeekEntry.values[thisWeekEntry.values.length - 1]
      : undefined
  const progressBadge =
    thisWeekValue !== undefined ? compareSimpleValues(thisWeekValue, lastWeekCategoryValue) : null

  async function handleSave() {
    if (isSubmitting) return
    const numValue = Number(value)
    if (!selectedCategory || !selectedExercise || !Number.isFinite(numValue) || numValue <= 0) return
    setIsSubmitting(true)
    try {
      const result = await logCategoryChoice({
        programExerciseId,
        date,
        weekNumber,
        value: numValue,
        chosenCategory: selectedCategory,
        chosenExercise: selectedExercise,
        categoriesToPick,
      })
      setRejectedByCap(!result.ok)
      if (result.ok) setValue('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="slot-form">
      <p className="slot-form-last-week">
        Logged today: {loggedCategories.length > 0 ? loggedCategories.join(', ') : 'none'}
      </p>
      {(capReached || rejectedByCap) && (
        <p className="status-badge">
          You've logged {categoriesToPick} categories today — the max for this exercise
        </p>
      )}
      <div className="category-picker">
        {categoryOptions.map((category) => {
          const alreadyLogged = loggedCategories.includes(category.categoryLabel)
          const disabled = capReached && !alreadyLogged
          const selected = selectedCategory === category.categoryLabel
          return (
            <button
              key={category.categoryLabel}
              type="button"
              className={`pill category-pill${selected ? ' pill-selected' : ''}`}
              disabled={disabled}
              onClick={() => {
                setSelectedCategory(category.categoryLabel)
                setSelectedExercise('')
              }}
            >
              {category.categoryLabel}
            </button>
          )
        })}
      </div>
      {selectedCategory && (
        <div className="category-detail">
          {lastWeekCategoryValue !== undefined && (
            <p className="slot-form-last-week">
              Last week ({selectedCategory}): {lastWeekCategoryValue}
            </p>
          )}
          <label htmlFor={`exercise-${programExerciseId}`}>Exercise</label>
          <select
            id={`exercise-${programExerciseId}`}
            className="field"
            value={selectedExercise}
            onChange={(e) => setSelectedExercise(e.target.value)}
          >
            <option value="" disabled>
              Choose...
            </option>
            {categoryOptions
              .find((c) => c.categoryLabel === selectedCategory)
              ?.exercises.map((ex) => (
                <option key={ex} value={ex}>
                  {ex}
                </option>
              ))}
          </select>
          <label htmlFor={`value-${programExerciseId}`}>Value</label>
          <input
            id={`value-${programExerciseId}`}
            className="field"
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={isSubmitting}>
            Save
          </button>
          {progressBadge && (
            <p role="status" className="status-badge">
              {BADGE_LABEL[progressBadge]}
            </p>
          )}
          {loggedCategories.includes(selectedCategory) && <p>{selectedCategory} logged</p>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run `ProgramSlotCard.test.tsx` specifically first**

Run: `npx vitest run src/components/ProgramSlotCard.test.tsx`
Expected: PASS — every existing assertion targets a label, role, or text string that this step left untouched.

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: `Test Files  29 passed (29)`, `Tests  219 passed (219)`.

- [ ] **Step 5: Commit**

```bash
git add src/components/ProgramSlotCard.css src/components/ProgramSlotCard.tsx
git commit -m "Restyle ProgramSlotCard with the compact-table set-row layout"
```

---

### Task 7: LogLift screen restyle

**Files:**
- Create: `src/screens/LogLift.css`
- Modify: `src/screens/LogLift.tsx`

**Interfaces:**
- Consumes: tokens/primitives from Task 1 (`.field`, `.btn`, `.btn-primary`, `.pr-badge`) plus `DayNavigator`/`ProgramSlotCard`/`SlotHeader` from Tasks 4–6.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Create `src/screens/LogLift.css`**

```css
.log-lift-day-note {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.log-lift-block {
  margin-bottom: var(--space-4);
}

.log-lift-block-label {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
}

.log-lift-divider {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: var(--space-4) 0;
}

.log-lift-freeform-search {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.log-lift-matches {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.log-lift-freeform-entry {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.log-lift-last-time {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.log-lift-bodyweight-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.log-lift-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.log-lift-today-sets {
  padding-left: var(--space-4);
  color: var(--color-text-muted);
  font-size: 0.85rem;
}
```

- [ ] **Step 2: Replace `src/screens/LogLift.tsx`**

```tsx
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addExercise, listExercises } from '../db/exercises'
import { getExerciseHistory, getLastSessionSets } from '../db/workouts'
import { findDefaultDayIndex, listAllProgramDaysChronological } from '../db/programs'
import { getDaySlots, groupSlotsByBlock } from '../db/programExercises'
import { ProgramSlotCard } from '../components/ProgramSlotCard'
import { SlotHeader } from '../components/SlotHeader'
import { DayNavigator } from '../components/DayNavigator'
import { logWeightSet } from '../lib/logWeightSet'
import { todayIso } from '../lib/dates'
import './LogLift.css'

export function LogLift() {
  const today = todayIso()
  const [dayIndex, setDayIndex] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null)
  const [selectedExerciseName, setSelectedExerciseName] = useState('')
  const [isBodyweight, setIsBodyweight] = useState(false)
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [prMessage, setPrMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const allDaysQuery = useLiveQuery(() => listAllProgramDaysChronological(), [])
  const allDays = allDaysQuery ?? []
  const currentIndex = dayIndex ?? findDefaultDayIndex(allDays, today)
  const activeEntry = currentIndex >= 0 ? allDays[currentIndex] ?? null : null

  const slots = useLiveQuery(
    () =>
      activeEntry ? getDaySlots(activeEntry.day.id!, activeEntry.week.weekNumber) : Promise.resolve([]),
    [activeEntry]
  ) ?? []

  const isLiveWeek = activeEntry
    ? today >= activeEntry.week.startDate && today <= activeEntry.week.endDate
    : false

  const allExercises = useLiveQuery(() => listExercises(), []) ?? []
  const matches =
    query.length > 0
      ? allExercises.filter((e) => e.name.toLowerCase().includes(query.toLowerCase()))
      : []

  const lastSets = useLiveQuery(
    () => (selectedExerciseId ? getLastSessionSets(selectedExerciseId, today) : Promise.resolve([])),
    [selectedExerciseId, today]
  )

  const todaySets = useLiveQuery(async () => {
    if (!selectedExerciseId) return []
    const history = await getExerciseHistory(selectedExerciseId)
    return history.find((h) => h.date === today)?.sets ?? []
  }, [selectedExerciseId, today])

  async function selectExercise(name: string) {
    const id = await addExercise(name)
    setSelectedExerciseId(id)
    setSelectedExerciseName(name)
    setQuery('')
    setPrMessage(null)
    setIsBodyweight(false)
  }

  async function handleAddSet() {
    if (!selectedExerciseId || isSubmitting) return
    const repsNum = Number(reps)
    if (!Number.isInteger(repsNum) || repsNum <= 0) return
    const weightLbs = isBodyweight ? 0 : Number(weight)
    if (!isBodyweight && !(weightLbs > 0)) return

    setIsSubmitting(true)
    try {
      const pr = await logWeightSet({
        exerciseId: selectedExerciseId,
        date: today,
        weightLbs,
        reps: repsNum,
      })

      setWeight('')
      setReps('')
      setPrMessage(pr.isWeightPr || pr.isEstimated1RmPr ? 'PR!' : null)
    } finally {
      setIsSubmitting(false)
    }
  }

  // `allDaysQuery === undefined` means the live query hasn't resolved yet.
  // Waiting for it (rather than rendering with an empty `allDays` fallback)
  // matches Program.tsx's old loading gate and keeps DayNavigator from
  // briefly flashing "no days" before the real list arrives.
  if (allDaysQuery === undefined) {
    return (
      <div>
        <h1>Log</h1>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="log-lift">
      <h1>Log</h1>

      <DayNavigator days={allDays} currentIndex={currentIndex} onNavigate={setDayIndex} />

      {activeEntry && (
        <section>
          {activeEntry.day.note && <p className="log-lift-day-note">{activeEntry.day.note}</p>}
          {groupSlotsByBlock(slots).map(([blockLabel, blockSlots]) => (
            <div key={blockLabel} className="log-lift-block">
              <h3 className="log-lift-block-label">{blockLabel}</h3>
              {blockSlots.map((slot) =>
                isLiveWeek ? (
                  <ProgramSlotCard
                    key={slot.programExercise.id}
                    slot={slot}
                    date={activeEntry.date}
                    weekNumber={activeEntry.week.weekNumber}
                  />
                ) : (
                  <SlotHeader key={slot.programExercise.id} slot={slot} />
                )
              )}
            </div>
          ))}
        </section>
      )}

      <hr className="log-lift-divider" />
      <h2>Log something else</h2>

      <div className="log-lift-freeform-search">
        <label htmlFor="exercise-input">Exercise</label>
        <input
          id="exercise-input"
          className="field"
          value={selectedExerciseName || query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelectedExerciseName('')
            setSelectedExerciseId(null)
          }}
          placeholder="Type to search or add an exercise"
        />
        <ul className="log-lift-matches">
          {matches.map((m) => (
            <li key={m.id}>
              <button type="button" className="btn" onClick={() => selectExercise(m.name)}>
                {m.name}
              </button>
            </li>
          ))}
          {query.length > 0 && !matches.some((m) => m.name.toLowerCase() === query.toLowerCase()) && (
            <li>
              <button type="button" className="btn" onClick={() => selectExercise(query)}>
                Add "{query}"
              </button>
            </li>
          )}
        </ul>
      </div>

      {selectedExerciseId && (
        <div className="log-lift-freeform-entry">
          <h2>{selectedExerciseName}</h2>

          {lastSets && lastSets.length > 0 && (
            <p className="log-lift-last-time">
              Last time: {lastSets.map((s) => `${s.weightLbs} x ${s.reps}`).join(', ')}
            </p>
          )}

          <div className="log-lift-bodyweight-toggle">
            <label htmlFor="bodyweight-toggle">No weight (bodyweight)</label>
            <input
              id="bodyweight-toggle"
              type="checkbox"
              checked={isBodyweight}
              onChange={(e) => setIsBodyweight(e.target.checked)}
            />
          </div>

          {!isBodyweight && (
            <div className="log-lift-field">
              <label htmlFor="weight-input">Weight (lbs)</label>
              <input
                id="weight-input"
                className="field"
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
          )}
          <div className="log-lift-field">
            <label htmlFor="reps-input">Reps</label>
            <input
              id="reps-input"
              className="field"
              type="number"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
            />
          </div>
          <button type="button" className="btn btn-primary" onClick={handleAddSet} disabled={isSubmitting}>
            Add Set
          </button>

          {prMessage && (
            <p role="status" className="pr-badge">
              ★ {prMessage}
            </p>
          )}

          <h3>Today's sets</h3>
          <ul className="log-lift-today-sets">
            {(todaySets ?? []).map((s, i) => (
              <li key={i}>
                {s.weightLbs} x {s.reps}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: `Test Files  29 passed (29)`, `Tests  219 passed (219)`.

- [ ] **Step 4: Commit**

```bash
git add src/screens/LogLift.css src/screens/LogLift.tsx
git commit -m "Restyle the LogLift screen"
```

---

### Task 8: Progress screen restyle

Recolors every Recharts series via CSS variables. The Lift Progress line/volume bar use `var(--color-accent)` (single series each); Pop Time and Blocking/Framing each have two series, so the second series in each uses the new `--color-chart-secondary` token from Task 1 to stay visually distinct from the first.

**Files:**
- Create: `src/screens/Progress.css`
- Modify: `src/screens/Progress.tsx`

**Interfaces:**
- Consumes: tokens from Task 1 (`--color-accent`, `--color-chart-secondary`, `--color-border`, `--color-text-muted`, `.field`, `.pill`, `.pill-selected`).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Create `src/screens/Progress.css`**

```css
.progress-section {
  margin-bottom: var(--space-4);
}

.progress-metric-toggle {
  display: flex;
  gap: var(--space-2);
  margin: var(--space-2) 0;
}

.progress-list {
  padding-left: var(--space-4);
  color: var(--color-text-muted);
  font-size: 0.85rem;
}
```

- [ ] **Step 2: Replace `src/screens/Progress.tsx`**

```tsx
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CartesianGrid,
  Line,
  LineChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { db } from '../db/schema'
import { listExercisesWithHistory } from '../db/exercises'
import { flattenHistorySets, getWorkingSetHistory } from '../db/workouts'
import { estimateOneRepMax } from '../lib/oneRepMax'
import { detectPr } from '../lib/prDetection'
import { popTimeStats, successRate } from '../db/catching'
import './Progress.css'

export function Progress() {
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null)
  const [metric, setMetric] = useState<'weight' | 'estimated1rm'>('weight')

  const exercisesQuery = useLiveQuery(() => listExercisesWithHistory(), [])
  const exercises = exercisesQuery ?? []

  const history = useLiveQuery(
    () => (selectedExerciseId ? getWorkingSetHistory(selectedExerciseId) : Promise.resolve([])),
    [selectedExerciseId]
  ) ?? []

  const chartData = history.map((h) => {
    const topSet = h.sets.reduce(
      (best, s) => (s.weightLbs > (best?.weightLbs ?? 0) ? s : best),
      h.sets[0]
    )
    const volume = h.sets.reduce((sum, s) => sum + s.weightLbs * s.reps, 0)
    return {
      date: h.date,
      weight: topSet?.weightLbs ?? 0,
      estimated1rm: topSet ? Math.round(estimateOneRepMax(topSet.weightLbs, topSet.reps)) : 0,
      volume,
    }
  })

  const prSets: { date: string; weightLbs: number; reps: number }[] = []
  history.forEach((h, i) => {
    const priorSets = flattenHistorySets(history.slice(0, i))
    h.sets.forEach((s) => {
      const pr = detectPr(s, priorSets)
      if (pr.isWeightPr || pr.isEstimated1RmPr) {
        prSets.push({ date: h.date, weightLbs: s.weightLbs, reps: s.reps })
      }
      priorSets.push(s)
    })
  })

  const catchingSessions = useLiveQuery(() => db.catchingSessions.orderBy('date').toArray(), []) ?? []
  const popTimeChartData = useLiveQuery(async () => {
    const rows = []
    for (const session of catchingSessions) {
      const reps = await db.popTimeReps.where('catchingSessionId').equals(session.id!).toArray()
      const stats = popTimeStats(reps)
      if (stats.best !== null) {
        rows.push({ date: session.date, best: stats.best, average: stats.average })
      }
    }
    return rows
  }, [catchingSessions]) ?? []

  const drillChartData = useLiveQuery(async () => {
    const rows = []
    for (const session of catchingSessions) {
      const blocking = await db.blockingDrills.where('catchingSessionId').equals(session.id!).toArray()
      const framing = await db.framingDrills.where('catchingSessionId').equals(session.id!).toArray()
      const blockingReps = blocking.reduce((s, d) => s + d.repCount, 0)
      const blockingSuccesses = blocking.reduce((s, d) => s + d.successCount, 0)
      const framingReps = framing.reduce((s, d) => s + d.repCount, 0)
      const framingSuccesses = framing.reduce((s, d) => s + d.successCount, 0)
      if (blockingReps === 0 && framingReps === 0) {
        continue
      }
      rows.push({
        date: session.date,
        blockingRate: successRate(blockingReps, blockingSuccesses),
        framingRate: successRate(framingReps, framingSuccesses),
      })
    }
    return rows
  }, [catchingSessions]) ?? []

  // All hooks above run unconditionally every render (Rules of Hooks). This
  // gate only affects which JSX is returned — it waits for the exercise list
  // specifically, since `userEvent.selectOptions` (used in tests, and
  // functionally identical to a real user picking an option) requires the
  // <option> to already exist; unlike `findByText`, it does not retry.
  if (exercisesQuery === undefined) {
    return (
      <div>
        <h1>Progress</h1>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="progress-screen">
      <h1>Progress</h1>

      <section className="progress-section">
        <h2>Lift Progress</h2>
        <label htmlFor="exercise-select">Select exercise</label>
        <select
          id="exercise-select"
          className="field"
          onChange={(e) => setSelectedExerciseId(Number(e.target.value) || null)}
          defaultValue=""
        >
          <option value="" disabled>
            Choose...
          </option>
          {exercises.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>

        {selectedExerciseId && (
          <>
            <div className="progress-metric-toggle">
              <button
                type="button"
                className={`pill${metric === 'weight' ? ' pill-selected' : ''}`}
                onClick={() => setMetric('weight')}
              >
                Top Weight
              </button>
              <button
                type="button"
                className={`pill${metric === 'estimated1rm' ? ' pill-selected' : ''}`}
                onClick={() => setMetric('estimated1rm')}
              >
                Est. 1RM
              </button>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" stroke="var(--color-text-muted)" />
                <YAxis stroke="var(--color-text-muted)" />
                <Tooltip />
                <Line type="monotone" dataKey={metric} stroke="var(--color-accent)" />
              </LineChart>
            </ResponsiveContainer>

            <h3>Volume</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" stroke="var(--color-text-muted)" />
                <YAxis stroke="var(--color-text-muted)" />
                <Tooltip />
                <Bar dataKey="volume" fill="var(--color-accent)" />
              </BarChart>
            </ResponsiveContainer>

            <h3>PRs</h3>
            <ul className="progress-list">
              {prSets.map((pr, i) => (
                <li key={i}>
                  {pr.date}: {pr.weightLbs} x {pr.reps}
                </li>
              ))}
            </ul>

            <h3>Sessions</h3>
            <ul className="progress-list">
              {history.map((h) => {
                const topSet = h.sets.reduce(
                  (best, s) => (s.weightLbs > (best?.weightLbs ?? 0) ? s : best),
                  h.sets[0]
                )
                return (
                  <li key={h.date}>
                    {h.date}
                    {h.weekNumber ? ` (Wk ${h.weekNumber})` : ''} — top set: {topSet?.weightLbs} lbs x{' '}
                    {topSet?.reps} reps
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>

      <section className="progress-section">
        <h2>Pop Time</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={popTimeChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" stroke="var(--color-text-muted)" />
            <YAxis stroke="var(--color-text-muted)" />
            <Tooltip />
            <Line type="monotone" dataKey="best" stroke="var(--color-accent)" />
            <Line type="monotone" dataKey="average" stroke="var(--color-chart-secondary)" />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="progress-section">
        <h2>Blocking / Framing Success Rate</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={drillChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" stroke="var(--color-text-muted)" />
            <YAxis stroke="var(--color-text-muted)" />
            <Tooltip />
            <Bar dataKey="blockingRate" fill="var(--color-accent)" />
            <Bar dataKey="framingRate" fill="var(--color-chart-secondary)" />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: `Test Files  29 passed (29)`, `Tests  219 passed (219)`.

- [ ] **Step 4: Commit**

```bash
git add src/screens/Progress.css src/screens/Progress.tsx
git commit -m "Restyle the Progress screen and recolor charts"
```

---

### Task 9: Bodyweight screen restyle

**Files:**
- Create: `src/screens/Bodyweight.css`
- Modify: `src/screens/Bodyweight.tsx`

**Interfaces:**
- Consumes: tokens/primitives from Task 1 (`.field`, `.btn-primary`, `--color-accent`, `--color-border`, `--color-text-muted`).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Create `src/screens/Bodyweight.css`**

```css
.bodyweight-entry {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-width: 240px;
  margin-bottom: var(--space-3);
}

.bodyweight-empty {
  color: var(--color-text-muted);
}

.bodyweight-list {
  padding-left: var(--space-4);
  color: var(--color-text-muted);
  font-size: 0.85rem;
}
```

- [ ] **Step 2: Replace `src/screens/Bodyweight.tsx`**

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
import './Bodyweight.css'

export function Bodyweight() {
  const [bodyweightInput, setBodyweightInput] = useState('')

  const bodyweightEntries = useLiveQuery(() => listBodyweightEntries(), []) ?? []

  async function logBodyweight() {
    if (!bodyweightInput || Number(bodyweightInput) <= 0) return
    await addBodyweightEntry(todayIso(), Number(bodyweightInput))
    setBodyweightInput('')
  }

  return (
    <div className="bodyweight-screen">
      <h1>Bodyweight</h1>
      <div className="bodyweight-entry">
        <label htmlFor="bodyweight-input">Bodyweight (lbs)</label>
        <input
          id="bodyweight-input"
          className="field"
          type="number"
          min="0"
          value={bodyweightInput}
          onChange={(e) => setBodyweightInput(e.target.value)}
        />
        <button type="button" className="btn btn-primary" onClick={logBodyweight}>
          Log Bodyweight
        </button>
      </div>
      {bodyweightEntries.length === 0 ? (
        <p className="bodyweight-empty">No entries yet</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={bodyweightEntries}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" stroke="var(--color-text-muted)" />
              <YAxis domain={['dataMin - 5', 'dataMax + 5']} stroke="var(--color-text-muted)" />
              <Tooltip />
              <Line type="monotone" dataKey="weightLbs" stroke="var(--color-accent)" />
            </LineChart>
          </ResponsiveContainer>
          <ul className="bodyweight-list">
            {bodyweightEntries.map((b) => (
              <li key={b.id}>
                {b.date}: {b.weightLbs}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: `Test Files  29 passed (29)`, `Tests  219 passed (219)`.

- [ ] **Step 4: Commit**

```bash
git add src/screens/Bodyweight.css src/screens/Bodyweight.tsx
git commit -m "Restyle the Bodyweight screen"
```

---

### Task 10: LogCatching screen restyle

**Files:**
- Create: `src/screens/LogCatching.css`
- Modify: `src/screens/LogCatching.tsx`

**Interfaces:**
- Consumes: tokens/primitives from Task 1 (`.field`, `.btn-primary`, `--color-text-muted`).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Create `src/screens/LogCatching.css`**

```css
.log-catching-section {
  margin-bottom: var(--space-4);
}

.log-catching-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: var(--space-2);
  max-width: 240px;
}

.log-catching-stats {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.log-catching-list {
  padding-left: var(--space-4);
  color: var(--color-text-muted);
  font-size: 0.85rem;
}
```

- [ ] **Step 2: Replace `src/screens/LogCatching.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  addPopTimeRep,
  getOrCreateCatchingSessionForDate,
  getPopTimeReps,
  popTimeStats,
  recordBlockingDrill,
  recordFramingDrill,
} from '../db/catching'
import { todayIso } from '../lib/dates'
import './LogCatching.css'

export function LogCatching() {
  const today = todayIso()
  const [popTimeInput, setPopTimeInput] = useState('')
  const [blockingReps, setBlockingReps] = useState('')
  const [blockingSuccesses, setBlockingSuccesses] = useState('')
  const [framingReps, setFramingReps] = useState('')
  const [framingSuccesses, setFramingSuccesses] = useState('')
  const [savedBlocking, setSavedBlocking] = useState<{ reps: number; successes: number }[]>([])
  const [savedFraming, setSavedFraming] = useState<{ reps: number; successes: number }[]>([])

  // Deliberately NOT a useLiveQuery: getOrCreateCatchingSessionForDate performs
  // a write (db.catchingSessions.add) when no session exists yet for today, and
  // Dexie's useLiveQuery runs its querier inside a read-only transaction — a
  // write there throws "ReadOnlyError: Readwrite transaction in liveQuery
  // context". A plain useState + useEffect one-time fetch-or-create avoids that
  // while preserving the same shape other consumers rely on: sessionId starts
  // `undefined` and only flips to a real id once the async lookup/creation
  // resolves, so the loading gate below still protects "Add Rep" from being
  // clickable before a session exists.
  const [sessionId, setSessionId] = useState<number | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    getOrCreateCatchingSessionForDate(today).then((id) => {
      if (!cancelled) setSessionId(id)
    })
    return () => {
      cancelled = true
    }
  }, [today])
  const reps = useLiveQuery(
    () => (sessionId ? getPopTimeReps(sessionId) : Promise.resolve([])),
    [sessionId]
  ) ?? []
  const stats = popTimeStats(reps)

  if (sessionId === undefined) {
    return (
      <div>
        <h1>Log Catching</h1>
        <p>Loading...</p>
      </div>
    )
  }

  async function addRep() {
    if (!sessionId || !popTimeInput) return
    await addPopTimeRep(sessionId, Number(popTimeInput))
    setPopTimeInput('')
  }

  async function saveBlocking() {
    if (!sessionId) return
    const repCount = Number(blockingReps)
    const successCount = Number(blockingSuccesses)
    if (
      !Number.isInteger(repCount) ||
      repCount <= 0 ||
      !Number.isInteger(successCount) ||
      successCount < 0 ||
      successCount > repCount
    ) {
      return
    }
    await recordBlockingDrill(sessionId, repCount, successCount)
    setSavedBlocking((prev) => [...prev, { reps: repCount, successes: successCount }])
    setBlockingReps('')
    setBlockingSuccesses('')
  }

  async function saveFraming() {
    if (!sessionId) return
    const repCount = Number(framingReps)
    const successCount = Number(framingSuccesses)
    if (
      !Number.isInteger(repCount) ||
      repCount <= 0 ||
      !Number.isInteger(successCount) ||
      successCount < 0 ||
      successCount > repCount
    ) {
      return
    }
    await recordFramingDrill(sessionId, repCount, successCount)
    setSavedFraming((prev) => [...prev, { reps: repCount, successes: successCount }])
    setFramingReps('')
    setFramingSuccesses('')
  }

  return (
    <div className="log-catching">
      <h1>Log Catching</h1>

      <section className="log-catching-section">
        <h2>Pop Time</h2>
        <div className="log-catching-field">
          <label htmlFor="pop-time-input">Pop time (seconds)</label>
          <input
            id="pop-time-input"
            className="field"
            type="number"
            step="0.01"
            value={popTimeInput}
            onChange={(e) => setPopTimeInput(e.target.value)}
          />
        </div>
        <button type="button" className="btn btn-primary" onClick={addRep}>
          Add Rep
        </button>
        {stats.best !== null && (
          <p className="log-catching-stats">
            Best: {stats.best.toFixed(2)} | Average: {stats.average!.toFixed(2)}
          </p>
        )}
        <ul className="log-catching-list">
          {reps.map((r) => (
            <li key={r.id}>{r.seconds.toFixed(2)}s</li>
          ))}
        </ul>
      </section>

      <section className="log-catching-section">
        <h2>Blocking</h2>
        <div className="log-catching-field">
          <label htmlFor="blocking-reps">Blocking reps</label>
          <input
            id="blocking-reps"
            className="field"
            type="number"
            value={blockingReps}
            onChange={(e) => setBlockingReps(e.target.value)}
          />
        </div>
        <div className="log-catching-field">
          <label htmlFor="blocking-successes">Blocking successes</label>
          <input
            id="blocking-successes"
            className="field"
            type="number"
            value={blockingSuccesses}
            onChange={(e) => setBlockingSuccesses(e.target.value)}
          />
        </div>
        <button type="button" className="btn btn-primary" onClick={saveBlocking}>
          Save Blocking
        </button>
        <ul className="log-catching-list">
          {savedBlocking.map((b, i) => (
            <li key={i}>
              {b.reps} reps, {b.successes} successful
            </li>
          ))}
        </ul>
      </section>

      <section className="log-catching-section">
        <h2>Framing</h2>
        <div className="log-catching-field">
          <label htmlFor="framing-reps">Framing reps</label>
          <input
            id="framing-reps"
            className="field"
            type="number"
            value={framingReps}
            onChange={(e) => setFramingReps(e.target.value)}
          />
        </div>
        <div className="log-catching-field">
          <label htmlFor="framing-successes">Framing successes</label>
          <input
            id="framing-successes"
            className="field"
            type="number"
            value={framingSuccesses}
            onChange={(e) => setFramingSuccesses(e.target.value)}
          />
        </div>
        <button type="button" className="btn btn-primary" onClick={saveFraming}>
          Save Framing
        </button>
        <ul className="log-catching-list">
          {savedFraming.map((f, i) => (
            <li key={i}>
              {f.reps} reps, {f.successes} successful
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: `Test Files  29 passed (29)`, `Tests  219 passed (219)`.

- [ ] **Step 4: Commit**

```bash
git add src/screens/LogCatching.css src/screens/LogCatching.tsx
git commit -m "Restyle the LogCatching screen"
```

---

### Task 11: History screen restyle

**Files:**
- Create: `src/screens/History.css`
- Modify: `src/screens/History.tsx`

**Interfaces:**
- Consumes: tokens from Task 1 (`--color-border`, `--space-2`).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Create `src/screens/History.css`**

```css
.history-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.history-row {
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.9rem;
}

.history-row:last-child {
  border-bottom: none;
}
```

- [ ] **Step 2: Replace `src/screens/History.tsx`**

```tsx
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import './History.css'

interface HistoryRow {
  date: string
  label: string
  key: string
}

export function History() {
  const rows = useLiveQuery(async (): Promise<HistoryRow[]> => {
    const [lifts, catching, bodyweight, programLogEntries] = await Promise.all([
      db.workoutSessions.toArray(),
      db.catchingSessions.toArray(),
      db.bodyweightEntries.toArray(),
      db.programLogEntries.toArray(),
    ])

    // Two bulk lookups instead of two sequential gets per row: program-log
    // history grows without bound, so a per-row round trip would keep getting
    // slower on every re-run of this live query.
    const slotIds = [...new Set(programLogEntries.map((e) => e.programExerciseId))]
    const slots = await db.programExercises.bulkGet(slotIds)
    const slotsById = new Map(slotIds.map((id, i) => [id, slots[i]]))

    const exerciseIds = [
      ...new Set(slots.filter((s) => s !== undefined).map((s) => s.exerciseId)),
    ]
    const exercises = await db.exercises.bulkGet(exerciseIds)
    const exercisesById = new Map(exerciseIds.map((id, i) => [id, exercises[i]]))

    const programLogRows: HistoryRow[] = []
    for (const entry of programLogEntries) {
      const slot = slotsById.get(entry.programExerciseId)
      const exercise = slot ? exercisesById.get(slot.exerciseId) : undefined
      const name = exercise?.name ?? 'Unknown Exercise'
      const label = entry.chosenExercise
        ? `${name} (${entry.chosenCategory}): ${entry.chosenExercise} — ${entry.values.join(', ')}`
        : `${name}: ${entry.values.length} set${entry.values.length === 1 ? '' : 's'} logged`
      programLogRows.push({ date: entry.date, label, key: `program-${entry.id}` })
    }

    const combined: HistoryRow[] = [
      ...lifts.map((s) => ({ date: s.date, label: 'Lift session', key: `lift-${s.id}` })),
      ...catching.map((s) => ({ date: s.date, label: 'Catching session', key: `catching-${s.id}` })),
      ...bodyweight.map((b) => ({
        date: b.date,
        label: `Bodyweight: ${b.weightLbs} lbs`,
        key: `bw-${b.id}`,
      })),
      ...programLogRows,
    ]

    combined.sort((a, b) => b.date.localeCompare(a.date))
    return combined
  }, []) ?? []

  return (
    <div className="history-screen">
      <h1>History</h1>
      <ul className="history-list">
        {rows.map((row) => (
          <li key={row.key} className="history-row">
            {row.date} — {row.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: `Test Files  29 passed (29)`, `Tests  219 passed (219)`.

- [ ] **Step 4: Commit**

```bash
git add src/screens/History.css src/screens/History.tsx
git commit -m "Restyle the History screen"
```

---

### Task 12: Settings screen restyle

**Files:**
- Create: `src/screens/Settings.css`
- Modify: `src/screens/Settings.tsx`

**Interfaces:**
- Consumes: tokens/primitives from Task 1 (`.btn`, `.btn-primary`, `--color-text`, `--space-2`, `--space-3`).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Create `src/screens/Settings.css`**

```css
.settings-actions {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.settings-error {
  color: var(--color-text);
  font-weight: 600;
}
```

- [ ] **Step 2: Replace `src/screens/Settings.tsx`**

```tsx
import { useRef, useState } from 'react'
import { exportAllData, importAllData } from '../lib/exportImport'
import { todayIso } from '../lib/dates'
import './Settings.css'

export function Settings() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)

  async function handleExport() {
    const json = await exportAllData()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gains-tracker-backup-${todayIso()}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Deferred so the click/navigation has a chance to pick up the blob URL
    // before it's revoked, for broader browser compatibility.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const confirmed = confirm(
      'Importing will replace all current data. Continue?'
    )
    if (!confirmed) {
      e.target.value = ''
      return
    }

    setImportError(null)
    try {
      const text = await file.text()
      await importAllData(text)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Unknown error.')
    } finally {
      e.target.value = ''
    }
  }

  return (
    <div className="settings-screen">
      <h1>Settings</h1>
      <div className="settings-actions">
        <button type="button" className="btn btn-primary" onClick={handleExport}>
          Export
        </button>
        <button type="button" className="btn" onClick={() => fileInputRef.current?.click()}>
          Import
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />
      {importError && <p className="settings-error">Import failed: {importError}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: `Test Files  29 passed (29)`, `Tests  219 passed (219)`.

- [ ] **Step 4: Commit**

```bash
git add src/screens/Settings.css src/screens/Settings.tsx
git commit -m "Restyle the Settings screen"
```

---

### Task 13: Manual verification pass

The spec calls for a manual check across every screen in both light and dark mode since this plan intentionally adds no automated visual tests.

**Files:** none (verification only).

- [ ] **Step 1: Run the dev server**

Run: `npm run dev`

- [ ] **Step 2: With the browser/OS in light mode, visit each of the 8 surfaces and confirm the design system reads correctly**

Check: app shell/header, `Log` (both a live-week day with `ProgramSlotCard`s and a non-live/historical day showing `SlotHeader`-only), `Log Catching`, `Progress` (with an exercise selected, to see both charts), `History`, `Bodyweight`, `Settings`, and the bottom nav (icon + label, active state) at a 375px-wide viewport.

- [ ] **Step 3: Switch the browser/OS to dark mode and repeat Step 2**

Check the same 8 surfaces — confirm text stays legible against the dark backgrounds, the PR badge (amber) stays visually distinct from the accent-green active/primary states, and chart lines/bars remain readable.

- [ ] **Step 4: Run the full test suite one final time**

Run: `npx vitest run`
Expected: `Test Files  29 passed (29)`, `Tests  219 passed (219)`.

- [ ] **Step 5: Run typecheck and lint**

Run: `npm run build`
Expected: `tsc -b` and the Vite build both succeed with no new errors.

Run: `npm run lint`
Expected: no new warnings beyond the pre-existing `react-hooks(exhaustive-deps)` warning on `ProgramSlotCard.tsx`'s `useEffect` (already present before this plan, tracked separately — not introduced by this work).
