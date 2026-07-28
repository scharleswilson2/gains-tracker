import type { DatedProgramDay } from '../db/programs'

interface DayNavigatorProps {
  days: DatedProgramDay[]
  currentIndex: number
  onNavigate: (index: number) => void
}

export function DayNavigator({ days, currentIndex, onNavigate }: DayNavigatorProps) {
  const current = days[currentIndex]
  if (!current) return null

  return (
    <div>
      <button
        type="button"
        aria-label="Previous day"
        onClick={() => onNavigate(currentIndex - 1)}
        disabled={currentIndex <= 0}
      >
        ←
      </button>
      <div>
        <p>{current.program.name}</p>
        <h2>
          Day {current.day.dayNumber} — {current.date}
        </h2>
        <p>Week {current.week.weekNumber}</p>
      </div>
      <button
        type="button"
        aria-label="Next day"
        onClick={() => onNavigate(currentIndex + 1)}
        disabled={currentIndex >= days.length - 1}
      >
        →
      </button>
    </div>
  )
}
