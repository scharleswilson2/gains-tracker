import { useRef } from 'react'
import { exportAllData, importAllData } from '../lib/exportImport'

export function Settings() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleExport() {
    const json = await exportAllData()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gains-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    await importAllData(text)
  }

  return (
    <div>
      <h1>Settings</h1>
      <button type="button" onClick={handleExport}>
        Export
      </button>
      <button type="button" onClick={() => fileInputRef.current?.click()}>
        Import
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />
    </div>
  )
}
