'use client'

import { useRef, useState } from 'react'
import { ApiError, apiRequest, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { Alert, btnGhost, btnPrimary, cardClass, fieldClass, labelClass } from '@/components/erp-ui'
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
  const snippet = odooConsoleExtractor()
  const snippetRef = useRef<HTMLTextAreaElement>(null)
  const [mode, setMode] = useState<'password' | 'session'>('password')
  const [database, setDatabase] = useState('venturefoods')
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
      setOk(`تم السحب والحفظ — ${page.data.pulled} سجل · النسخة: ${page.data.backupPath}`)
      setSecret('')
      setSessionId('')
      await refreshDump()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : errorKey(caught))
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
        const payload: unknown = await response.json().catch(() => null)
        const message =
          typeof payload === 'object' && payload !== null && 'error' in payload
            ? String((payload as { error: { message?: unknown } }).error.message ?? '')
            : 'فشل الرفع'
        throw new ApiError(response.status, 'validation_failed', message)
      }
      setFile(null)
      setOk('تم استيراد الملف وترحيله إلى التخزين المؤقت / الوحدات')
      await refreshDump()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : errorKey(caught))
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

  return (
    <div className="space-y-4">
      {error ? <Alert kind="error">{error}</Alert> : null}
      {ok ? <Alert kind="ok">{ok}</Alert> : null}

      <section className={`${cardClass} p-4`}>
        <h2 className="text-lg font-bold text-mist-100">النسخة المحلية الأبدية</h2>
        <p className="mt-1 text-sm text-mist-400" dir="ltr">
          {dump.path} · {dump.exists ? `${(dump.bytes / 1024).toFixed(0)} KB` : 'غير موجودة'}
        </p>
        {dump.exportedAt ? <p className="mt-1 text-xs text-mist-500">exportedAt: {dump.exportedAt}</p> : null}
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(dump.counts).map(([model, count]) => (
            <div key={model} className="rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2">
              <p className="text-[11px] text-mist-500" dir="ltr">
                {model}
              </p>
              <p className="text-lg font-black text-[#8cc63f]">{count}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={`${cardClass} space-y-3 p-4`}>
        <h2 className="text-lg font-bold">سحب وحفظ كامل من {ODOO_ORIGIN.replace('https://', '')}</h2>
        <div className="flex gap-2">
          <button type="button" className={mode === 'password' ? btnPrimary : btnGhost} onClick={() => setMode('password')}>
            إيميل / كلمة مرور
          </button>
          <button type="button" className={mode === 'session' ? btnPrimary : btnGhost} onClick={() => setMode('session')}>
            session_id
          </button>
        </div>
        {mode === 'password' ? (
          <div className="grid gap-2 md:grid-cols-3">
            <div>
              <label className={labelClass}>قاعدة البيانات</label>
              <input className={fieldClass} value={database} onChange={(e) => setDatabase(e.target.value)} dir="ltr" />
            </div>
            <div>
              <label className={labelClass}>البريد / المستخدم</label>
              <input className={fieldClass} value={login} onChange={(e) => setLogin(e.target.value)} dir="ltr" />
            </div>
            <div>
              <label className={labelClass}>كلمة المرور / API Key</label>
              <input className={fieldClass} type="password" value={secret} onChange={(e) => setSecret(e.target.value)} dir="ltr" />
            </div>
          </div>
        ) : (
          <div>
            <label className={labelClass}>Odoo session_id</label>
            <input className={fieldClass} value={sessionId} onChange={(e) => setSessionId(e.target.value)} dir="ltr" />
          </div>
        )}
        <button type="button" className={btnPrimary} disabled={busy} onClick={() => void fullPull()}>
          {busy ? 'جارٍ السحب…' : 'سحب وحفظ كامل بيانات أودو الآن (Full Odoo Backup & Import)'}
        </button>
        {report ? (
          <p className="text-sm text-mist-300">
            pulled {report.pulled} · applied {report.applied} · staged {report.staged} · skipped {report.skipped}
          </p>
        ) : null}
      </section>

      <section className={`${cardClass} space-y-3 p-4`}>
        <h2 className="text-lg font-bold">رفع ملف Excel / CSV / JSON من أودو</h2>
        <input type="file" accept=".json,.csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button type="button" className={btnGhost} disabled={busy || !file} onClick={() => void uploadFile()}>
          استيراد الملف
        </button>
      </section>

      <section className={`${cardClass} space-y-3 p-4`}>
        <h2 className="text-lg font-bold">مقتطف المتصفح (أقصى تغطية 1000/موديل)</h2>
        <p className="text-sm text-mist-400">
          افتح جلسة مسجّلة على {ODOO_ORIGIN}، الصق المقتطف في Console، ثم ارفع الملف الناتج هنا.
        </p>
        <textarea ref={snippetRef} readOnly value={snippet} className={`${fieldClass} min-h-40 font-mono text-[11px]`} dir="ltr" />
        <button type="button" className={btnGhost} onClick={() => void copySnippet()}>
          {copied ? 'تم النسخ' : 'نسخ المقتطف'}
        </button>
      </section>
    </div>
  )
}
