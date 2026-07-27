# Bodyweight Gets Its Own Section — Design Spec

Date: 2026-07-27

## Purpose

Bodyweight logging (a form, a line chart of weight over time, and a list of
past entries) currently lives as the fourth of four stacked sections on the
Progress screen, after Lift Progress, Pop Time, and Blocking/Framing —
buried at the bottom of a long, unrelated page. This is the second of three
sub-projects scoped out of a larger design/UX ask (the first, Program tab
logging + last-week progress, is already merged; a full visual design pass
is still pending as a separate spec). This spec gives bodyweight logging its
own clearly separate, easy-to-find screen.

This is a pure relocation, not a redesign: no new bodyweight features, no
changed behavior, no visual styling changes (that's the separate, pending
design-system spec). The form, chart, and list move as-is.

## Navigation

A new screen at route `/bodyweight`, reached via a second icon link in the
app header, next to the existing Settings gear — not a bottom-nav tab. The
bottom nav is already at five items (Log Lift / Log Catching / Program /
Progress / History); Settings already established the precedent that a
less-frequently-visited screen belongs in the header, not the bottom nav.
The new link uses a scale emoji (⚖) as its icon, mirroring the gear link's
exact markup (`<Link to="/bodyweight" aria-label="Bodyweight"
className="bodyweight-link">⚖</Link>`, alongside the existing
`<Link to="/settings" aria-label="Settings" className="settings-link">⚙</Link>`).

## Screens & data

- **New `src/screens/Bodyweight.tsx`** — the bodyweight `<section>`
  currently in `Progress.tsx` (lines 228-256: the "Bodyweight (lbs)" input,
  "Log Bodyweight" button, `LineChart` of `weightLbs` over `date`, and the
  `<ul>` of past entries), moved verbatim into its own screen component,
  under its own `<h1>Bodyweight</h1>` instead of an `<h2>` section heading.
  Consumes `addBodyweightEntry`/`listBodyweightEntries`
  (`../db/bodyweight`, unchanged) and `todayIso` (`../lib/dates`,
  unchanged) exactly as `Progress.tsx` does today.
- **`src/db/bodyweight.ts`** — no changes. `addBodyweightEntry` (upsert by
  date) and `listBodyweightEntries` (ascending by date) are reused as-is.
- **`src/screens/Progress.tsx`** — the Bodyweight section, and its
  supporting state/imports (`bodyweightInput` state, `addBodyweightEntry`/
  `listBodyweightEntries` imports, the `bodyweightEntries` live query, the
  `logBodyweight` handler), are removed entirely. No teaser, summary, or
  link back to the Bodyweight screen is left in Progress — Progress goes
  back to being purely about lift and catching progress. `todayIso` stays
  imported in `Progress.tsx` only if something else there still uses it
  (it doesn't, per the current file — so that import is removed too, since
  its only use was `logBodyweight`).
- **`src/App.tsx`** — new import and route: `<Route path="/bodyweight"
  element={<Bodyweight />} />`, plus the new header `<Link>` described
  above.

## Testing

Following the existing TDD patterns in this codebase (Vitest + RTL +
fake-indexeddb):

- **`src/screens/Bodyweight.test.tsx`** (new) — covers what the bodyweight
  assertions in `Progress.test.tsx` covered today: logging an entry via the
  form and seeing it appear in the list. Moved, not duplicated.
- **`src/screens/Progress.test.tsx`** — the existing test "shows PRs for a
  selected exercise and lets me log bodyweight" (lines 9-27+) has its
  bodyweight-specific arrangement/assertions (typing into the bodyweight
  input, clicking "Log Bodyweight") removed, since that behavior no longer
  exists on this screen. Whatever of that test exercises PR display for a
  selected exercise stays.
- **No changes to `NavBar.test.tsx` or any App-level test.** The header
  icon isn't a `NavBar` link, and there is no `App.test.tsx` in this
  codebase — confirmed by checking how the existing Settings header link
  is tested today: it isn't, at the app-shell level. `Settings.test.tsx`
  only tests the `Settings` screen component in isolation, so `Bodyweight`
  gets the same treatment via `Bodyweight.test.tsx` and nothing more.

## Out of scope

No new bodyweight features (e.g. stats, min/max, unit toggle), no visual/
styling changes, no bottom-nav changes. Purely: new screen, new route, new
header link, old section removed from Progress.
