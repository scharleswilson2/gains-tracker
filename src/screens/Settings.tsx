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
