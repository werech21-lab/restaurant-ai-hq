'use client'

import { useRef, useState } from 'react'
import { apiRequest, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { Alert, btnGhost, btnPrimary } from '@/components/erp-ui'
import { SectionCard } from '@/components/ui'
import { formatInt, formatKuwaitDateTime } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { ODOO_ORIGIN, odooConsoleExtractor } from '@/modules/odoo/client'

type DumpSummary = {
  path: string
  exists: boolean
  bytes: number
  counts: Record<string, number>
  exportedAt: string | null
}

type LiveReport = {
  origin: string
  backupPath: string
  counts: Record<string, number>
  pulled: number
  applied: number
  staged: number
  skipped: number
  exportedAt: string
}

export function OdooSyncPanel({ initialDump }: { initialDump: DumpSummary }) {
  const { locale, t } = useI18n()
  const resolvedLocale: 'ar' | 'en' = locale === 'en' ? 'en' : 'ar'
  const isAr = resolvedLocale !== 'en'
  const snippet = odooConsoleExtractor()
  const snippetRef = useRef<HTMLTextAreaElement>(null)
  const [mode, setMode] = useState<'password' | 'session'>('password')
  const [database, setDatabase] = useState('')
  const [login, setLogin] = useState('')
  const [secret, setSecret] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dump, setDump] = useState(initialDump)
  const [report, setReport] = useState<LiveReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [copied, setCopied] = useState(false)

  async function refreshDump() {
    try {
      const page = await apiRequest<{ data: DumpSummary }>('/api/v1/admin/odoo/live-extract')
      setDump(page.data)
    } catch {
      /* panel user may lack ERP IAM — keep SSR dump */
    }
  }

  async function fullPull() {
    setBusy(true)
    setError('')
    setOk('')
    setReport(null)
    try {
      const body =
        mode === 'session'
          ? { sessionId }
          : { database, login, secret }
      const page = await apiRequest<{ data: LiveReport }>('/api/v1/admin/odoo/live-extract', {
        method: 'POST',
        body,
        idempotencyKey: newIdempotencyKey(),
      })
      setReport(page.data)
      setOk(
        isAr
          ? `تم السحب والحفظ بنجاح — ${formatInt(page.data.pulled, resolvedLocale)} سجل`
          : `Live extraction & snapshot saved — ${formatInt(page.data.pulled, resolvedLocale)} records`,
      )
      setSecret('')
      setSessionId('')
      await refreshDump()
    } catch (caught) {
      setError(t(errorKey(caught)))
    } finally {
      setBusy(false)
    }
  }

  async function uploadFile() {
    if (!file) return
    setBusy(true)
    setError('')
    setOk('')
    try {
      const body = new FormData()
      body.set('file', file)
      const response = await fetch('/api/v1/admin/odoo/files', {
        method: 'POST',
        headers: { 'Idempotency-Key': newIdempotencyKey() },
        body,
      })
      if (!response.ok) {
        setError(t('erp.err.validation_failed'))
        return
      }
      setFile(null)
      setOk(
        isAr
          ? 'تم استيراد الملف وترحيله إلى التخزين المؤقت / الوحدات'
          : 'File imported and staged into ERP modules',
      )
      await refreshDump()
    } catch (caught) {
      setError(t(errorKey(caught)))
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
        setError(isAr ? 'تعذّر النسخ التلقائي — انسخ النص يدوياً.' : 'Automatic copy failed — copy the snippet manually.')
      }
    }
  }

  const inputCls =
    'ds-focus-ring w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-ink-950 dark:text-mist-100'
  const labelCls = 'mb-1 block text-xs font-semibold text-slate-700 dark:text-mist-300'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-4">
      {error ? <Alert kind="error">{error}</Alert> : null}
      {ok ? <Alert kind="ok">{ok}</Alert> : null}

      <SectionCard
        title={isAr ? 'النسخة المحلية المحفوظة' : 'Stored Local Snapshot'}
        subtitle={
          dump.exists
            ? isAr
              ? `الحجم: ${formatInt(Math.round(dump.bytes / 1024), resolvedLocale)} KB`
              : `Size: ${formatInt(Math.round(dump.bytes / 1024), resolvedLocale)} KB`
            : isAr
              ? 'لا توجد نسخة محلية محفوظة بعد'
              : 'No local snapshot saved yet'
        }
        locale={resolvedLocale}
        headerDivider
      >
        {dump.exportedAt ? (
          <p className="mb-3 text-xs text-slate-600 dark:text-slate-300">
            {isAr ? 'آخر تصدير (توقيت الكويت): ' : 'Last export (Kuwait): '}
            <span dir="ltr" className="ds-num font-semibold tabular-nums">
              {formatKuwaitDateTime(dump.exportedAt, resolvedLocale)}
            </span>
          </p>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(dump.counts).map(([model, count]) => (
            <div
              key={model}
              className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-white/10 dark:bg-ink-950/60"
            >
              <p className="text-xs font-mono text-slate-600 dark:text-slate-300" dir="ltr">
                {model}
              </p>
              <p dir="ltr" className="ds-num text-lg font-black tabular-nums text-emerald-700 dark:text-[#8cc63f]">
                {formatInt(count, resolvedLocale)}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title={isAr ? 'سحب وحفظ كامل من Odoo 17' : 'Full Live Pull from Odoo 17'}
        locale={resolvedLocale}
        headerDivider
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={mode === 'password'}
              className={`${mode === 'password' ? btnPrimary : btnGhost} ds-focus-ring`}
              onClick={() => setMode('password')}
            >
              {isAr ? 'إيميل / كلمة مرور' : 'Email / Password'}
            </button>
            <button
              type="button"
              aria-pressed={mode === 'session'}
              className={`${mode === 'session' ? btnPrimary : btnGhost} ds-focus-ring`}
              onClick={() => setMode('session')}
            >
              {isAr ? 'معرّف الجلسة (session_id)' : 'Session ID'}
            </button>
          </div>
          {mode === 'password' ? (
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className={labelCls}>{isAr ? 'قاعدة البيانات' : 'Database'}</label>
                <input
                  className={inputCls}
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  autoComplete="off"
                  dir="ltr"
                />
              </div>
              <div>
                <label className={labelCls}>{isAr ? 'البريد / المستخدم' : 'Email / Username'}</label>
                <input
                  className={inputCls}
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  autoComplete="username"
                  dir="ltr"
                />
              </div>
              <div>
                <label className={labelCls}>{isAr ? 'كلمة المرور / API Key' : 'Password / API Key'}</label>
                <input
                  className={inputCls}
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  autoComplete="current-password"
                  dir="ltr"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className={labelCls}>{isAr ? 'معرّف جلسة أودو (session_id)' : 'Odoo session_id'}</label>
              <input
                className={inputCls}
                type="password"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                autoComplete="off"
                dir="ltr"
              />
            </div>
          )}
          <button
            type="button"
            className={`${btnPrimary} ds-focus-ring`}
            disabled={busy}
            onClick={() => void fullPull()}
          >
            {busy
              ? isAr
                ? 'جارٍ السحب…'
                : 'Pulling…'
              : isAr
                ? 'سحب وحفظ كامل بيانات أودو الآن'
                : 'Pull & Back Up Full Odoo Data'}
          </button>
          {report ? (
            <p className="text-sm text-slate-700 dark:text-mist-300 tabular-nums">
              {isAr
                ? `المسحوب ${formatInt(report.pulled, resolvedLocale)} · المُطبّق ${formatInt(report.applied, resolvedLocale)} · الموقوف ${formatInt(report.staged, resolvedLocale)} · المتخطّى ${formatInt(report.skipped, resolvedLocale)}`
                : `Pulled ${formatInt(report.pulled, resolvedLocale)} · Applied ${formatInt(report.applied, resolvedLocale)} · Staged ${formatInt(report.staged, resolvedLocale)} · Skipped ${formatInt(report.skipped, resolvedLocale)}`}
            </p>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title={isAr ? 'رفع ملف Excel / CSV / JSON من أودو' : 'Upload Excel / CSV / JSON Export'}
        locale={resolvedLocale}
        headerDivider
      >
        <div className="space-y-3">
          <input
            type="file"
            aria-label={isAr ? 'اختر ملف تصدير Odoo' : 'Choose Odoo export file'}
            accept=".json,.csv,.xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-slate-700 dark:text-slate-200"
          />
          <div>
            <button
              type="button"
              className={`${btnGhost} ds-focus-ring`}
              disabled={busy || !file}
              onClick={() => void uploadFile()}
            >
              {isAr ? 'استيراد الملف' : 'Import File'}
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title={isAr ? 'مقتطف المتصفح (أقصى تغطية 1000/موديل)' : 'Browser Extractor Snippet (1,000/model)'}
        subtitle={
          isAr
            ? `افتح جلسة مسجّلة على ${ODOO_ORIGIN}، الصق المقتطف في Console، ثم ارفع الملف الناتج هنا.`
            : `Open an authenticated session at ${ODOO_ORIGIN}, paste this snippet in Console, and upload the downloaded file here.`
        }
        locale={resolvedLocale}
        headerDivider
      >
        <div className="space-y-3">
          <textarea
            ref={snippetRef}
            aria-label={isAr ? 'مقتطف استخراج بيانات Odoo' : 'Odoo browser extractor snippet'}
            readOnly
            value={snippet}
            className={`${inputCls} min-h-40 font-mono text-xs`}
            dir="ltr"
          />
          <button type="button" className={`${btnGhost} ds-focus-ring`} onClick={() => void copySnippet()}>
            {copied ? (isAr ? 'تم النسخ' : 'Copied') : isAr ? 'نسخ المقتطف' : 'Copy Snippet'}
          </button>
        </div>
      </SectionCard>
    </div>
  )
}
