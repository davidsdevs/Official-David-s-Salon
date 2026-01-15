import { useEffect, useMemo, useState } from 'react'
import { getFunctions, httpsCallable } from 'firebase/functions'
import app from '../../config/firebase'
import { Card } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Download, RefreshCw, Shield, Clock, Mail } from 'lucide-react'

const toDateString = (value) => {
  if (!value) return ''
  if (value instanceof Date) return value.toLocaleString()
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString()
  }
  const seconds = value?.seconds ?? value?._seconds
  if (typeof seconds === 'number') {
    const d = new Date(seconds * 1000)
    return d.toLocaleString()
  }

  return ''
}

const formatCallableError = (e) => {
  if (!e) return 'Unknown error'
  const code = e?.code || ''
  const message = e?.message || String(e)
  const details = e?.details
  const detailsText = details == null ? '' : typeof details === 'string' ? details : JSON.stringify(details)

  if (code && detailsText) return `${code}: ${message} | ${detailsText}`
  if (code) return `${code}: ${message}`
  if (detailsText) return `${message} | ${detailsText}`
  return message
}

export default function DatabaseBackup() {
  const functionsRegion = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION
  const functions = useMemo(() => {
    return functionsRegion ? getFunctions(app, functionsRegion) : getFunctions(app)
  }, [functionsRegion])
  const getSettings = useMemo(() => httpsCallable(functions, 'getDatabaseBackupSettings'), [functions])
  const updateSettings = useMemo(() => httpsCallable(functions, 'updateDatabaseBackupSettings'), [functions])
  const runBackup = useMemo(() => httpsCallable(functions, 'runDatabaseBackup'), [functions])
  const exportBackup = useMemo(() => httpsCallable(functions, 'exportDatabaseBackup'), [functions])
  const exportBackupInline = useMemo(() => httpsCallable(functions, 'exportDatabaseBackupInline'), [functions])
  const getLatestUrl = useMemo(() => httpsCallable(functions, 'getLatestBackupUrl'), [functions])

  const connectedProjectId = app?.options?.projectId || ''

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [schedule, setSchedule] = useState('off')
  const [recipientEmail, setRecipientEmail] = useState('')

  const [backupPassword, setBackupPassword] = useState('')
  const [backupPasswordConfirm, setBackupPasswordConfirm] = useState('')

  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const passwordMismatch =
    backupPassword && backupPasswordConfirm && backupPassword !== backupPasswordConfirm
  const passwordTooShort = backupPassword && backupPassword.length < 8

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const resp = await getSettings()
      const data = resp?.data || {}
      setSchedule(String(data.schedule || 'off').toLowerCase())
      setRecipientEmail(data.recipientEmail || '')
      setStatus(data)
    } catch (e) {
      setError(formatCallableError(e) || 'Failed to load backup settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)
      await updateSettings({ schedule, recipientEmail })
      setSuccess('Settings saved')
      await load()
      setTimeout(() => setSuccess(null), 2500)
    } catch (e) {
      setError(formatCallableError(e) || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleRunNow = async () => {
    try {
      setRunning(true)
      setError(null)
      setSuccess(null)
      if (!backupPassword || passwordMismatch || passwordTooShort) {
        setError('Please enter a backup password (min 8 chars) and confirm it before running.')
        return
      }
      const resp = await runBackup({ force: true, passphrase: backupPassword })
      const result = resp?.data || {}
      setSuccess(result.status === 'success' ? 'Backup completed and emailed' : `Backup result: ${result.status}`)
      await load()
      setTimeout(() => setSuccess(null), 4000)
    } catch (e) {
      setError(formatCallableError(e) || 'Failed to run backup')
      await load()
    } finally {
      setRunning(false)
    }
  }

  const handleDownload = async () => {
    try {
      setDownloading(true)
      setError(null)
      const resp = await getLatestUrl()
      const url = resp?.data?.url
      if (!url) {
        setError('No backup available')
        return
      }
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setError(formatCallableError(e) || 'Failed to get download link')
    } finally {
      setDownloading(false)
    }
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      setError(null)
      setSuccess(null)
      if (!backupPassword || passwordMismatch || passwordTooShort) {
        setError('Please enter a backup password (min 8 chars) and confirm it before exporting.')
        return
      }
      // Prefer Storage-based export to avoid callable payload size limits.
      // Falls back to inline export if Storage isn't configured.
      try {
        const resp = await exportBackup({ passphrase: backupPassword })
        const url = resp?.data?.url
        if (url) {
          setSuccess('Export ready. Download started.')
          window.open(url, '_blank', 'noopener,noreferrer')
          await load()
          setTimeout(() => setSuccess(null), 4000)
          return
        }
      } catch (e) {
        const code = e?.code || ''
        // If Storage export is unavailable/misconfigured, fall back to inline
        if (!String(code).includes('failed-precondition')) {
          // For other errors, still try inline, but keep a note in the error banner if both fail.
        }
      }

      const resp = await exportBackupInline({ passphrase: backupPassword })
      const payload = resp?.data || {}
      if (!payload?.data || !payload?.fileName) {
        setError(payload?.status ? `Export result: ${payload.status}` : 'Failed to export database')
        return
      }

      const blob = new Blob([payload.data], { type: payload.contentType || 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = payload.fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      setSuccess('Export ready. Download started.')
      await load()
      setTimeout(() => setSuccess(null), 4000)
    } catch (e) {
      setError(formatCallableError(e) || 'Failed to export database')
      await load()
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-gray-600">Loading…</span>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Database Backup</h1>
        <p className="text-gray-600 mt-1">Export the database as encrypted JSON and email it automatically.</p>
      </div>

      <Card className="p-4">
        <div className="text-sm text-gray-700">
          <div className="font-semibold text-gray-900">Connection</div>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-gray-500">Firebase Project</div>
              <div className="font-mono text-sm text-gray-900 break-all">{connectedProjectId || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Functions Region</div>
              <div className="font-mono text-sm text-gray-900">{functionsRegion || 'us-central1 (default)'}</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            If backups keep failing, confirm you deployed Functions to this exact project and region.
          </div>
        </div>
      </Card>

      {(error || success) && (
        <Card className={`p-4 ${error ? 'border border-red-200 bg-red-50 text-red-800' : 'border border-green-200 bg-green-50 text-green-800'}`}>
          {error || success}
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-gray-700">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">Last Successful Backup</span>
          </div>
          <div className="mt-2 text-gray-900 font-semibold">
            {toDateString(status?.lastSuccessAt) || '—'}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {status?.lastSuccessPath ? `Storage: ${status.lastSuccessPath}` : ''}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-gray-700">
            <Shield className="h-4 w-4" />
            <span className="text-sm font-medium">Last Run Status</span>
          </div>
          <div className="mt-2 text-gray-900 font-semibold">
            {status?.lastRunStatus || '—'}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {toDateString(status?.lastRunAt) ? `Run at: ${toDateString(status?.lastRunAt)}` : ''}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-gray-700">
            <Mail className="h-4 w-4" />
            <span className="text-sm font-medium">Recipient</span>
          </div>
          <div className="mt-2 text-gray-900 font-semibold break-all">
            {status?.recipientEmail || '—'}
          </div>
          <div className="mt-1 text-xs text-gray-500">Encrypted attachment is sent to this email.</div>
        </Card>
      </div>

      {status?.lastErrorMessage ? (
        <Card className="p-4 border border-yellow-200 bg-yellow-50 text-yellow-900">
          <div className="text-sm font-semibold">Last Error</div>
          <div className="text-sm mt-1">{status.lastErrorMessage}</div>
          <div className="text-xs mt-1 text-yellow-800">{toDateString(status?.lastErrorAt)}</div>
        </Card>
      ) : null}

      <Card className="p-6 space-y-4">
        <div className="text-lg font-semibold text-gray-900">Backup Schedule</div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
            <select
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"
            >
              <option value="off">Off</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly (End of Month)</option>
            </select>
            <div className="text-xs text-gray-500 mt-1">Schedule is evaluated by a daily server job.</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Admin Email</label>
            <Input
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="admin@example.com"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Backup Password</label>
            <Input
              type="password"
              value={backupPassword}
              onChange={(e) => setBackupPassword(e.target.value)}
              placeholder="Minimum 8 characters"
            />
            <div className="text-xs text-gray-500 mt-1">Used to encrypt manual exports. Keep it safe; it cannot be recovered.</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
            <Input
              type="password"
              value={backupPasswordConfirm}
              onChange={(e) => setBackupPasswordConfirm(e.target.value)}
              placeholder="Re-enter password"
            />
            {passwordMismatch ? (
              <div className="text-xs text-red-600 mt-1">Passwords do not match</div>
            ) : passwordTooShort ? (
              <div className="text-xs text-red-600 mt-1">Password must be at least 8 characters</div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save Settings'}
            </Button>
            <Button variant="outline" onClick={load} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleRunNow} disabled={running} className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {running ? 'Running…' : 'Run Now'}
            </Button>
            <Button onClick={handleExport} disabled={exporting} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              {exporting ? 'Exporting…' : 'Export Database'}
            </Button>
            <Button variant="outline" onClick={handleDownload} disabled={downloading} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              {downloading ? 'Preparing…' : 'Download Latest'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
