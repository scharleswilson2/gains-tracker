import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { findExerciseByName } from '../db/exercises'

export function ExerciseInfo({ name }: { name: string }) {
  const [expanded, setExpanded] = useState(false)
  const exercise = useLiveQuery(() => findExerciseByName(name), [name])

  return (
    <div>
      <button type="button" onClick={() => setExpanded((prev) => !prev)}>
        {name}
      </button>
      {expanded && <p>{exercise?.description || 'No description available.'}</p>}
    </div>
  )
}
