import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getCurrentProgramWeek, listPrograms, listProgramDays, listProgramWeeks } from '../db/programs'
import { getDaySlots, groupSlotsByBlock } from '../db/programExercises'
import { ProgramSlotCard } from '../components/ProgramSlotCard'
import { SlotHeader } from '../components/SlotHeader'
import { addDays, todayIso } from '../lib/dates'

export function Program() {
  const today = todayIso()
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null)

  const programsQuery = useLiveQuery(() => listPrograms(), [])
  const programs = programsQuery ?? []

  const currentProgramWeek = useLiveQuery(() => getCurrentProgramWeek(today), [today])

  const activeProgramId = selectedProgramId ?? currentProgramWeek?.program.id ?? null
  const activeWeekNumber =
    selectedProgramId && selectedProgramId !== currentProgramWeek?.program.id
      ? 1
      : currentProgramWeek?.week.weekNumber ?? 1

  const activeWeeks = useLiveQuery(
    () => (activeProgramId ? listProgramWeeks(activeProgramId) : Promise.resolve([])),
    [activeProgramId]
  ) ?? []
  const activeWeek = activeWeeks.find((w) => w.weekNumber === activeWeekNumber)

  // Only the week whose real date range contains today is "live" — logging
  // is restricted to it. A week shown via getCurrentProgramWeek's "no
  // current program" fallback, or via browsing an old program's Week 1, is
  // historical even though it renders the same way otherwise; without this
  // check, a stale/expired program would silently accept new sets tagged
  // with a past date, with no way to undo it.
  const isLiveWeek = activeWeek ? today >= activeWeek.startDate && today <= activeWeek.endDate : false

  const days = useLiveQuery(
    () => (activeProgramId ? listProgramDays(activeProgramId) : Promise.resolve([])),
    [activeProgramId]
  ) ?? []

  const daySlots = useLiveQuery(async () => {
    if (!activeProgramId) return []
    const results = []
    for (const day of days) {
      const slots = await getDaySlots(day.id!, activeWeekNumber)
      results.push({ day, slots })
    }
    return results
  }, [days, activeWeekNumber, activeProgramId]) ?? []

  // All hooks above run unconditionally every render (Rules of Hooks). This
  // gate only affects which JSX is returned — it waits for the program list
  // specifically, since `userEvent.selectOptions` (used in tests) requires
  // the <option> to already exist and does not retry like `findByText` does.
  if (programsQuery === undefined) {
    return (
      <div>
        <h1>Program</h1>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div>
      <h1>Program</h1>

      <label htmlFor="program-select">Program</label>
      <select
        id="program-select"
        value={activeProgramId ?? ''}
        onChange={(e) => setSelectedProgramId(Number(e.target.value) || null)}
      >
        {programs.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <h2>Week {activeWeekNumber}</h2>

      {daySlots.map(({ day, slots }) => {
        // Falls back to today only in the brief window before `activeWeek`
        // resolves from its own useLiveQuery — this is purely a display
        // fallback now: `isLiveWeek` defaults to false whenever `activeWeek`
        // is unresolved, so no card can be interactive during this window
        // regardless of what date it would momentarily show.
        const dayDate = activeWeek ? addDays(activeWeek.startDate, day.dayNumber - 1) : today
        return (
          <section key={day.id}>
            <h3>
              Day {day.dayNumber} — {dayDate}
            </h3>
            {day.note && <p>{day.note}</p>}
            {groupSlotsByBlock(slots).map(([blockLabel, blockSlots]) => (
              <div key={blockLabel}>
                <h4>{blockLabel}</h4>
                {blockSlots.map((slot) =>
                  isLiveWeek ? (
                    <ProgramSlotCard
                      key={slot.programExercise.id}
                      slot={slot}
                      date={dayDate}
                      weekNumber={activeWeekNumber}
                    />
                  ) : (
                    <SlotHeader key={slot.programExercise.id} slot={slot} />
                  )
                )}
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}
