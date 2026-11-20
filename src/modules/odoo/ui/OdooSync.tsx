'use client'

import { useEffect, useRef, useState } from 'react'
import { apiRequest, errorKey, isAbort, newIdempotencyKey } from '@/components/erp/api'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { dangerButton, inputClass, labelClass, noticeClass, panelClass, primaryButton } from '@/components/erp/styles'
import { StateBlock } from '@/components/ui'
import { permissions } from '@/lib/auth/permissions'
import { formatInt, formatKuwaitDateTime } from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { ODOO_COMPANY_ID, ODOO_ORIGIN, odooConsoleExtractor } from '@/modules/odoo/client'

type RecordRow = { id: string; odooModel: string; externalId: string; displayName: string; applyStatus: 'staged' | 'applied' | 'skipped' }
type Board = { jobs: { id: string; recordsPulled: number; recordsApplied: number; status: string; createdAt: string }[]; records: RecordRow[] }

function Workspace() {
  const { locale, t } = useI18n()
  const resolvedLocale: 'ar' | 'en' = locale === 'en' ? 'en' : 'ar'
  const isAr = resolvedLocale !== 'en'
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
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setPhase('loading')
    apiRequest<{ data: Board }>('/api/v1/admin/odoo', { signal: controller.signal })
      .then((page) => {
        setBoard(page.data)
        setPhase('ready')
      })
      .catch((error: unknown) => {
        if (isAbort(error) || controller.signal.aborted) return
        setDetail(t(errorKey(error)))
        setPhase('error')
      })
    return () => controller.abort()
  }, [notice, reloadCount, t])

  async function purgeDemo() {
    if (!window.confirm(t('admin.purgeConfirm'))) return
    setBusy(true)
    setNotice(null)
    setDetail(null)
    try {
      await apiRequest('/api/v1/admin/demo-purge', { method: 'POST', body: {} })
      setNotice(t('admin.purgeDone'))
    } catch (error) {
      setDetail(t(errorKey(error)))
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
      setDetail(t(errorKey(error)))
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
        setDetail(t('erp.err.validation_failed'))
        return
      }
      setFile(null)
      setNotice(t('odoo.saved'))
    } catch (error) {
      setDetail(t(errorKey(error)))
    } finally {
      setBusy(false)
    }
  }

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
    } catch {
      try {
        snippetRef.current?.select()
        document.execCommand('copy')
        setCopied(true)
      } catch {
        setDetail(isAr ? 'تعذّر النسخ التلقائي — انسخ النص يدوياً.' : 'Automatic copy failed — copy the snippet manually.')
      }
    }
  }

  const ready = mode === 'session' ? /^[A-Za-z0-9._-]{8,128}$/.test(sessionId) : database.trim() !== '' && login.trim() !== '' && secret !== ''

  const statusKey = (status: RecordRow['applyStatus']): MessageKey => (
    status === 'applied' ? 'odoo.applied' : status === 'skipped' ? 'odoo.skipped' : 'odoo.staged'
  )

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-6" suppressHydrationWarning>
      <header>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('odoo.title')}</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-gray-300">{t('odoo.lead')}</p>
      </header>
      {canPurge ? <button className={`${dangerButton} ds-focus-ring`} type="button" disabled={busy} onClick={() => void purgeDemo()}>{t('admin.purge')}</button> : null}
      {notice ? <p role="status" className={noticeClass}>{notice}</p> : null}
      {detail && phase !== 'error' ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300" role="alert">{detail}</p> : null}
      {canSync ? (
        <section className={`${panelClass} border-gold-300/40`}>
          <h2 className="text-lg font-bold text-gold-300">{t('odoo.console')}</h2>
          <p className="mt-2 text-sm text-gray-300 [overflow-wrap:anywhere]">{t('odoo.consoleHelp')}</p>
          <textarea
            ref={snippetRef}
            aria-label={t('odoo.console')}
            className={`${inputClass} mt-3 font-mono text-xs`}
            dir="ltr"
            readOnly
            rows={8}
            value={snippet}
          />
          <button className={`${primaryButton} ds-focus-ring mt-4`} type="button" onClick={() => void copySnippet()}>{copied ? t('odoo.copied') : t('odoo.copy')}</button>
        </section>
      ) : null}
      {canSync ? (
        <section className={panelClass}>
          <h2 className="text-base font-semibold text-white">{t('odoo.direct')}</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className={labelClass}>{t('odoo.url')}
              <input className={inputClass} dir="ltr" value={ODOO_ORIGIN} readOnly />
            </label>
            <label className={labelClass}>{t('odoo.company')}
              <input className={inputClass} dir="ltr" value={String(ODOO_COMPANY_ID)} readOnly />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className={`shrink-0 whitespace-nowrap ${mode === 'password' ? primaryButton : 'rounded-lg border border-[#30363d] px-4 py-2 text-sm text-gray-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50'} ds-focus-ring`}
              aria-pressed={mode === 'password'}
              type="button"
              onClick={() => setMode('password')}
            >
              {t('odoo.modePassword')}
            </button>
            <button
              className={`shrink-0 whitespace-nowrap ${mode === 'session' ? primaryButton : 'rounded-lg border border-[#30363d] px-4 py-2 text-sm text-gray-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50'} ds-focus-ring`}
              aria-pressed={mode === 'session'}
              type="button"
              onClick={() => setMode('session')}
            >
              {t('odoo.modeSession')}
            </button>
          </div>
          {mode === 'password' ? (
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label className={labelClass}>{t('odoo.database')}
                <input className={inputClass} dir="ltr" value={database} onChange={(event) => setDatabase(event.target.value)} autoComplete="off" />
              </label>
              <label className={labelClass}>{t('odoo.login')}
                <input className={inputClass} dir="ltr" value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="username" />
              </label>
              <label className={labelClass}>{t('odoo.secret')}
                <input className={inputClass} dir="ltr" type="password" value={secret} onChange={(event) => setSecret(event.target.value)} autoComplete="current-password" />
              </label>
            </div>
          ) : (
            <label className={`${labelClass} mt-3 block`}>{t('odoo.session')}
              <input className={inputClass} dir="ltr" type="password" value={sessionId} onChange={(event) => setSessionId(event.target.value)} autoComplete="off" />
            </label>
          )}
          <button className={`${primaryButton} ds-focus-ring mt-4`} type="button" disabled={busy || !ready} onClick={() => void pull()}>
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
          <button className={`${primaryButton} ds-focus-ring mt-4`} type="button" disabled={busy || !file} onClick={() => void upload()}>{t('odoo.import')}</button>
        </section>
      ) : null}
      <section className={`${panelClass} space-y-4`}>
        {phase === 'loading' ? <StateBlock state="loading" locale={resolvedLocale} compact title={t('odoo.loading')} /> : null}
        {phase === 'error' && board.records.length === 0 ? (
          <StateBlock
            state="error"
            locale={resolvedLocale}
            description={detail ?? t('erp.err.generic')}
            onRetry={() => setReloadCount((c) => c + 1)}
            retryLabel={t('erp.retry')}
            compact
          />
        ) : null}
        {phase === 'ready' && board.records.length === 0 && board.jobs.length === 0 ? (
          <StateBlock state="empty" locale={resolvedLocale} title={t('odoo.empty')} compact />
        ) : null}
        {board.jobs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[440px] text-sm text-gray-100">
              <thead className="text-xs text-gray-300">
                <tr className="border-b border-white/10">
                  <th className="px-2 py-2 text-start">{isAr ? 'توقيت السحب (الكويت)' : 'Synced At (Kuwait)'}</th>
                  <th className="px-2 py-2 text-end">{isAr ? 'المسحوب' : 'Pulled'}</th>
                  <th className="px-2 py-2 text-end">{isAr ? 'المُرحّل' : 'Applied'}</th>
                  <th className="px-2 py-2 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                {board.jobs.slice(0, 5).map((job) => (
                  <tr key={job.id} className="border-t border-white/10">
                    <td dir="ltr" className="whitespace-nowrap px-2 py-2 tabular-nums">{formatKuwaitDateTime(job.createdAt, resolvedLocale)}</td>
                    <td dir="ltr" className="whitespace-nowrap px-2 py-2 text-end tabular-nums">{formatInt(job.recordsPulled, resolvedLocale)}</td>
                    <td dir="ltr" className="whitespace-nowrap px-2 py-2 text-end tabular-nums">{formatInt(job.recordsApplied, resolvedLocale)}</td>
                    <td className="whitespace-nowrap px-2 py-2">{job.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {board.records.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm text-gray-100">
              <thead className="text-xs text-gray-300">
                <tr className="border-b border-white/10">
                  <th className="px-2 py-2 text-start">{isAr ? 'النموذج' : 'Model'}</th>
                  <th className="px-2 py-2 text-start">{isAr ? 'السجل' : 'Record'}</th>
                  <th className="px-2 py-2 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                {board.records.map((row) => (
                  <tr key={row.id} className="border-t border-white/10">
                    <td dir="ltr" className="px-2 py-2 font-mono text-xs">{row.odooModel}</td>
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
