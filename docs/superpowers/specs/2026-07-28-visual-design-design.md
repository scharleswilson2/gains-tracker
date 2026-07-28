# Visual Design System — Design

## Overview

The app has functioned since 2026-07-24 with essentially no visual styling —
every screen renders plain semantic HTML; `App.css` covers only the app
shell and bottom nav bar (58 lines total, no color system, no dark mode, no
card/button/input styling anywhere). The 2026-07-27 consolidated day-log spec
explicitly deferred all visual work to this follow-up.

This spec covers the whole app, not just the day-log screens: `LogLift`
(program slots + free-form logging), `LogCatching`, `Progress`, `History`,
`Bodyweight`, `Settings`, the app shell/header, and the bottom `NavBar`.

Aesthetic direction: **minimal utilitarian** — neutral grays, one accent
color, no decoration, optimized for fast one-handed glances mid-workout.
Dark mode is in scope, following OS/browser preference only (no manual
toggle) — this is a phone-home-screen PWA that gets used in dim gyms as
readily as daylight.

## Design tokens

CSS custom properties defined once in `src/index.css`, consumed by every
other stylesheet. Light values in `:root`; dark values override the same
names inside `@media (prefers-color-scheme: dark)`, so no component ever
branches on theme itself.

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
  }
}
```

The PR badge (`--color-pr-bg`/`--color-pr-text`, amber) is intentionally
**not** the accent color — an all-green UI would put a green PR badge next
to the green active-nav-item/button color and blur which one means what.
Amber stays visually distinct from the accent in both themes.

Every screen/component keeps its own `.css` file, matching today's per-file
convention — the only structural change is that rules reference
`var(--color-*)` / `var(--space-*)` / `var(--radius-*)` instead of hardcoded
values, so retheming (or a future accent change) never means hunting
through every file.

Typography stays the existing `system-ui, sans-serif` stack — no web font
load, no FOUC risk, consistent with "minimal utilitarian" and the app's
local-only/offline-friendly PWA nature.

## Component/screen changes

- **App shell** (`App.css`): header background `--color-surface`, border
  `--color-border`; content area padding `--space-4`. Body background/text
  switch via tokens automatically — no explicit dark-mode code path needed
  outside `index.css`.

- **NavBar**: icon + label per item, replacing today's plain text links.
  Icons are small hand-drawn inline SVGs (~20px, `stroke="currentColor"`),
  not emoji — emoji renders inconsistently across OS/browser and would
  clash with a deliberately minimal, designed-looking system. One icon
  component per nav item, five total:
  - `Log` — barbell glyph
  - `Catching` — baseball glyph (stitched-seam circle — this is a baseball
    catcher's app, not softball)
  - `Progress` — simple up-trend line/chart glyph
  - `History` — clock glyph
  - `Weight` — scale glyph

  Labels shorten to fit five items at 375px width without wrapping: `Log`,
  `Catching`, `Progress`, `History`, `Weight`. Icon+label stack vertically
  per item; active item (icon + label) colored `--color-accent` and bold,
  inactive items `--color-text-muted`.

- **DayNavigator**: prev/next arrows become tappable `--radius-sm` squares
  with a `--color-surface` background — bigger hit target than today's bare
  `←`/`→` text glyphs. Day/week label centered between them; program
  name/week number rendered as muted secondary text.

- **ProgramSlotCard**: card container = `--color-surface` fill,
  `--radius-md` corners, `--color-border` outline. Block label (`A`/`B`/`C`/
  `Speed`) renders as a small pill chip (`--color-border` background, muted
  text). Per-set rows use the **compact table layout**: a
  `24px 1fr 1fr 32px` grid — set number, weight input, reps input, status
  glyph (accent-green checkmark when logged, muted empty circle when not).
  This applies to both `WeightSlotForm` (weight+reps inputs) and
  `SimpleValueSlotForm` (checkbox in the glyph column instead of two
  inputs). The "+ Add extra set" control renders as a dashed-border ghost
  row in the same grid, so it reads as "one more of these" rather than a
  visually distinct button.

- **PR badge**: small pill, `--color-pr-bg`/`--color-pr-text`, prefixed
  with a `★` glyph — e.g. "★ PR!" — placed inline next to the row it
  applies to.

- **Free-form logging section** (bottom of `LogLift`): reuses the same
  input/button styling as program slots (shared base input/button rules),
  so ad hoc logging doesn't look like a bolted-on separate app.

- **Progress**: Recharts `Line`/`Bar` series recolored to `--color-accent`
  for the primary line, `--color-text-muted` for grid lines and axis text.
  Exercise picker and the weight/estimated-1RM metric toggle become pill
  buttons (`--radius-sm`, `--color-surface`/`--color-accent` for
  selected/unselected) instead of raw browser `<select>`/radio styling.

- **Bodyweight**: same input+button treatment as `LogLift`'s free-form
  section; chart recolored identically to `Progress`.

- **LogCatching**: same input+button treatment as above for its three
  quick-add blocks (pop time, blocking, framing).

- **History**: list rows get `--color-border` bottom dividers and
  `--space-2`/`--space-3` padding, replacing default `<ul>`/`<li>` browser
  spacing. Rows stay plain text (no card wrapper) — this list is unbounded
  and a card per row would get heavy fast.

- **Settings**: Export/Import buttons use the same button styling as
  elsewhere (primary = accent-filled). The import confirmation stays the
  existing native `confirm()` dialog — building a custom confirm modal is
  out of scope for this pass.

## Testing approach

- No new automated tests for pure visual/layout changes — matches the
  original spec's stated philosophy (data-layer bugs would silently
  corrupt training data and are worth testing; UI layout is not).
- The existing 427-test suite must continue passing unchanged: all
  existing queries target roles/labels/text content, not CSS classes or
  computed styles, so restyling shouldn't require touching test files. If
  any test turns out to depend on incidental DOM structure (e.g. exact
  wrapper nesting), fix the test to query by role/label instead of
  reverting the markup change.
- Manual verification pass across all 8 screens (`LogLift`, `LogCatching`,
  `Progress`, `History`, `Bodyweight`, `Settings`, plus the app shell and
  nav bar) in both light and dark mode (toggle OS/browser color scheme)
  before considering this done.

## Explicitly out of scope

- Manual light/dark toggle — system preference only.
- Custom web fonts — keep the `system-ui` stack.
- Motion/animation system.
- Any icon library dependency — icons are hand-authored inline SVGs.
- Chart library change — Recharts stays, only recolored.
- A custom confirm/modal component for Settings' import flow.
- Any change to app behavior, data model, or routing — this is a pure
  restyle of what `2026-07-27-consolidated-day-log.md` and prior specs
  already built.
