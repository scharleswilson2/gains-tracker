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
