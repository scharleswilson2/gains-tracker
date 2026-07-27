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
