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
