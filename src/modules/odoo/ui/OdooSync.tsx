'use client'

import { useEffect, useState } from 'react'
import { ApiError, apiRequest, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { errorClass, inputClass, labelClass, noticeClass, panelClass, primaryButton } from '@/components/erp/styles'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { ODOO_ORIGIN } from '@/modules/odoo/client'

type RecordRow = { id: string; odooModel: string; externalId: string; displayName: string; applyStatus: 'staged' | 'applied' | 'skipped' }
type Board = { jobs: { id: string; recordsPulled: number; recordsApplied: number; status: string; createdAt: string }[]; records: RecordRow[] }

function Workspace() {
  const { t } = useI18n()
  const canSync = useCan(permissions.adminOdooSync)
  const [database, setDatabase] = useState('')
  const [login, setLogin] = useState('')
  const [secret, setSecret] = useState('')
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

  async function pull() {
    setBusy(true)
    setNotice(null)
    setDetail(null)
    try {
      await apiRequest('/api/v1/admin/odoo', {
        method: 'POST',
        body: { database, login, secret },
        idempotencyKey: newIdempotencyKey(),
      })
      setSecret('')
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

  const statusKey = (status: RecordRow['applyStatus']): MessageKey => (
    status === 'applied' ? 'odoo.applied' : status === 'skipped' ? 'odoo.skipped' : 'odoo.staged'
  )

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">{t('odoo.title')}</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-400">{t('odoo.lead')}</p>
      </header>
      {notice ? <p className={noticeClass}>{notice}</p> : null}
      {detail ? <p className={errorClass} role="alert">{detail}</p> : null}
      {canSync ? (
        <section className={panelClass}>
          <label className={labelClass}>{t('odoo.url')}
            <input className={inputClass} value={ODOO_ORIGIN} readOnly />
          </label>
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
          <button className={`${primaryButton} mt-4`} type="button" disabled={busy || database.trim() === '' || login.trim() === '' || secret === ''} onClick={() => void pull()}>
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
              accept=".csv,.tsv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
