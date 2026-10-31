'use client'

import { useEffect, useRef, useState } from 'react'
import { ApiError, apiRequest, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { dangerButton, errorClass, inputClass, labelClass, noticeClass, panelClass, primaryButton } from '@/components/erp/styles'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { ODOO_COMPANY_ID, ODOO_ORIGIN, odooConsoleExtractor } from '@/modules/odoo/client'

type RecordRow = { id: string; odooModel: string; externalId: string; displayName: string; applyStatus: 'staged' | 'applied' | 'skipped' }
type Board = { jobs: { id: string; recordsPulled: number; recordsApplied: number; status: string; createdAt: string }[]; records: RecordRow[] }

function Workspace() {
  const { t } = useI18n()
  const canSync = useCan(permissions.adminOdooSync)
  const canPurge = useCan(permissions.hrEmployeeManage)
  const snippet = odooConsoleExtractor()
  const snippetRef = useRef<HTMLTextAreaElement>(null)
  const [mode, setMode] = useState<'password' | 'session'>('password')
  const [database, setDatabase] = useState('')
  const [login, setLogin] = useState('')
  const [secret, setSecret] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [copied, setCopied] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [board, setBoard] = useState<Board>({ jobs: [], records: [] })
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [detail, setDetail] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<{ data: Board }>('/api/v1/admin/odoo', { signal: controller.signal })
      .then((page) => {
        setBoard(page.data)
        setPhase('ready')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setDetail(error instanceof ApiError ? error.message : null)
        setPhase('error')
      })
    return () => controller.abort()
  }, [notice])

  async function purgeDemo() {
    if (!window.confirm(t('admin.purgeConfirm'))) return
    setBusy(true)
    setNotice(null)
    setDetail(null)
    try {
      await apiRequest('/api/v1/admin/demo-purge', { method: 'POST', body: {} })
      setNotice(t('admin.purgeDone'))
    } catch (error) {
      setDetail(error instanceof ApiError ? error.message : t(errorKey(error)))
    } finally {
      setBusy(false)
    }
  }

  async function pull() {
    setBusy(true)
    setNotice(null)
    setDetail(null)
    try {
      await apiRequest('/api/v1/admin/odoo', {
        method: 'POST',
        body: mode === 'session' ? { sessionId } : { database, login, secret },
        idempotencyKey: newIdempotencyKey(),
      })
      setSecret('')
      setSessionId('')
      setNotice(t('odoo.saved'))
    } catch (error) {
      setDetail(error instanceof ApiError ? error.message : t(errorKey(error)))
    } finally {
      setBusy(false)
    }
  }

  async function upload() {
    if (!file) return
    setBusy(true)
    setNotice(null)
    setDetail(null)
    try {
      const body = new FormData()
      body.set('file', file)
      const response = await fetch('/api/v1/admin/odoo/files', {
        method: 'POST',
        headers: { 'Idempotency-Key': newIdempotencyKey() },
        body,
      })
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null)
        const message = typeof payload === 'object' && payload !== null && 'error' in payload
          ? String((payload as { error: { message?: unknown } }).error.message ?? '')
          : t('erp.err.generic')
        throw new ApiError(response.status, 'validation_failed', message)
      }
      setFile(null)
      setNotice(t('odoo.saved'))
    } catch (error) {
      setDetail(error instanceof ApiError ? error.message : t(errorKey(error)))
    } finally {
      setBusy(false)
    }
  }

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet)
    } catch {
      snippetRef.current?.select()
      document.execCommand('copy')
    }
    setCopied(true)
  }

  const ready = mode === 'session' ? /^[A-Za-z0-9._-]{8,128}$/.test(sessionId) : database.trim() !== '' && login.trim() !== '' && secret !== ''

  const statusKey = (status: RecordRow['applyStatus']): MessageKey => (
    status === 'applied' ? 'odoo.applied' : status === 'skipped' ? 'odoo.skipped' : 'odoo.staged'
  )

  return (
    <div className="space-y-6" suppressHydrationWarning>
      <header>
        <h1 className="text-2xl font-bold text-white">{t('odoo.title')}</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-400">{t('odoo.lead')}</p>
      </header>
      {canPurge ? <button className={dangerButton} type="button" disabled={busy} onClick={() => void purgeDemo()}>{t('admin.purge')}</button> : null}
      {notice ? <p className={noticeClass}>{notice}</p> : null}
      {detail ? <p className={errorClass} role="alert">{detail}</p> : null}
      {canSync ? (
        <section className={`${panelClass} border-gold-300/40`}>
          <h2 className="text-lg font-bold text-gold-300">{t('odoo.console')}</h2>
          <p className="mt-2 text-sm text-gray-400">{t('odoo.consoleHelp')}</p>
          <textarea ref={snippetRef} className={`${inputClass} mt-3 font-mono text-xs`} dir="ltr" readOnly rows={8} value={snippet} />
          <button className={`${primaryButton} mt-4`} type="button" onClick={() => void copySnippet()}>{copied ? t('odoo.copied') : t('odoo.copy')}</button>
        </section>
      ) : null}
      {canSync ? (
        <section className={panelClass}>
          <h2 className="text-base font-semibold text-white">{t('odoo.direct')}</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className={labelClass}>{t('odoo.url')}
              <input className={inputClass} value={ODOO_ORIGIN} readOnly />
            </label>
            <label className={labelClass}>{t('odoo.company')}
              <input className={inputClass} value={String(ODOO_COMPANY_ID)} readOnly />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button className={primaryButton} type="button" onClick={() => setMode('password')}>{t('odoo.modePassword')}</button>
            <button className={primaryButton} type="button" onClick={() => setMode('session')}>{t('odoo.modeSession')}</button>
          </div>
          {mode === 'password' ? (
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label className={labelClass}>{t('odoo.database')}
                <input className={inputClass} value={database} onChange={(event) => setDatabase(event.target.value)} autoComplete="off" />
              </label>
              <label className={labelClass}>{t('odoo.login')}
                <input className={inputClass} value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="username" />
              </label>
              <label className={labelClass}>{t('odoo.secret')}
                <input className={inputClass} type="password" value={secret} onChange={(event) => setSecret(event.target.value)} autoComplete="current-password" />
              </label>
            </div>
          ) : (
            <label className={`${labelClass} mt-3`}>{t('odoo.session')}
              <input className={inputClass} type="password" value={sessionId} onChange={(event) => setSessionId(event.target.value)} autoComplete="off" />
            </label>
          )}
          <button className={`${primaryButton} mt-4`} type="button" disabled={busy || !ready} onClick={() => void pull()}>
            {busy ? t('odoo.loading') : t('odoo.pull')}
          </button>
        </section>
      ) : null}
      {canSync ? (
        <section className={panelClass}>
          <label className={labelClass}>{t('odoo.file')}
            <input
              className={inputClass}
              type="file"
              accept=".json,.csv,.tsv,.xlsx,application/json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <button className={`${primaryButton} mt-4`} type="button" disabled={busy || !file} onClick={() => void upload()}>{t('odoo.import')}</button>
        </section>
      ) : null}
      <section className={panelClass}>
        {phase === 'loading' ? <p className="text-sm text-gray-400">{t('odoo.loading')}</p> : null}
        {phase === 'error' && board.records.length === 0 ? <p className={errorClass}>{detail ?? t('erp.err.generic')}</p> : null}
        {phase === 'ready' && board.records.length === 0 ? <p className="text-sm text-gray-400">{t('odoo.empty')}</p> : null}
        {board.records.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-gray-100">
              <tbody>
                {board.records.map((row) => (
                  <tr key={row.id} className="border-t border-white/10">
                    <td className="px-2 py-2">{row.odooModel}</td>
                    <td className="px-2 py-2">{row.displayName}</td>
                    <td className="px-2 py-2">{t(statusKey(row.applyStatus))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  )
}

export default function OdooSync({ permissions: granted }: { permissions: readonly string[] }) {
  return (
    <PermissionProvider permissions={granted}>
      <Workspace />
    </PermissionProvider>
  )
}
