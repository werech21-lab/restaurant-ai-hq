'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, apiRequest, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { errorClass, inputClass, labelClass, noticeClass, panelClass, primaryButton } from '@/components/erp/styles'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { formatMinor } from '@/lib/money'
import type { ArchiveDocument } from '@/modules/governance/client'

const categories = ['fuel_invoice', 'contract', 'knet_receipt', 'traffic_fine', 'delivery_waybill'] as const
type Category = (typeof categories)[number]

type LocalSmartDropRow = {
  id: string
  fileName: string
  relativePath: string
  departmentLabelAr: string
  departmentLabelEn: string
  entityLabel: string | null
  amountKwd: number | null
  status: string
  source?: string
  updates: string[]
  href: string
}

function statusLabelAr(status: string) {
  if (!status) return '—'
  switch (status.toLowerCase()) {
    case 'processed': return 'تمت المعالجة بنجاح'
    case 'pending': return 'قيد التدقيق والانتظار'
    case 'ready': return 'جاهز للاعتماد'
    case 'routed': return 'تم التوجيه بنجاح'
    case 'archived': return 'مؤرشف معتمد'
    case 'ingested': return 'تم الإدراج'
    default: return status
  }
}

function moduleLabelAr(mod: string) {
  if (!mod) return '—'
  switch (mod.toLowerCase()) {
    case 'procurement': return 'المشتريات والمخازن'
    case 'accounting': return 'الإدارة المالية والمحاسبة'
    case 'hr': return 'الموارد البشرية'
    case 'governance': return 'الحوكمة والامتثال'
    case 'operations': return 'العمليات والتشغيل'
    default: return mod
  }
}

function Workspace() {
  const { t, locale } = useI18n()
  const en = locale === 'en'
  const canRoute = useCan(permissions.govArchiveRoute)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<MessageKey | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<ArchiveDocument[]>([])
  const [localRows, setLocalRows] = useState<LocalSmartDropRow[]>([])
  const [fileName, setFileName] = useState('فاتورة-وقود.pdf')
  const [category, setCategory] = useState<Category>('fuel_invoice')
  const [text, setText] = useState('المبلغ 12.500 د.ك')

  function load() {
    const controller = new AbortController()
    setPhase('loading')
    apiRequest<{ data: ArchiveDocument[] }>('/api/v1/governance/archive', { signal: controller.signal })
      .then((page) => {
        setRows(page.data)
        setError(null)
        setPhase('ready')
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(errorKey(caught))
        setPhase('error')
      })
    void fetch('/api/smart-dropzone/list?limit=200', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) return
        const payload = (await response.json()) as { data?: { rows?: LocalSmartDropRow[] } }
        setLocalRows(payload.data?.rows || [])
      })
      .catch(() => {
        /* soft-fail */
      })
    return () => controller.abort()
  }

  useEffect(() => load(), [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    try {
      const saved = await apiRequest<{ data: ArchiveDocument }>('/api/v1/governance/archive', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: { fileName, documentCategory: category, text },
      })
      setNotice(`${t('gov.route')}: ${saved.data.routedToModule}`)
      load()
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'compliance_blocked') setNotice(caught.message)
      else setError(errorKey(caught))
      load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full max-w-none space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-gray-50">{t('hub.archive')}</h1>
      </header>
      {phase === 'loading' ? <p className="text-sm text-gray-400">{t('gov.loading')}</p> : null}
      {error ? <p className={errorClass}>{t(error)}</p> : null}
      {notice ? <p className={noticeClass} role="status">{notice}</p> : null}
      {phase === 'ready' ? (
        <section className={panelClass}>
          {canRoute ? (
            <form className="mb-4 grid gap-3" onSubmit={(event) => void submit(event)}>
              <label className={labelClass}>{t('gov.file')}<input className={inputClass} required value={fileName} onChange={(event) => setFileName(event.target.value)} /></label>
              <label className={labelClass}>{t('gov.category')}
                <select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value as Category)}>
                  {categories.map((item) => <option key={item} value={item}>{t(`gov.cat.${item}` as MessageKey)}</option>)}
                </select>
              </label>
              <label className={labelClass}>{t('gov.text')}<textarea className={inputClass} value={text} onChange={(event) => setText(event.target.value)} /></label>
              <button className={primaryButton} type="submit" disabled={busy}>{t('gov.analyze')}</button>
            </form>
          ) : null}
          {rows.length === 0 ? <p className="text-sm text-gray-400">{t('gov.empty')}</p> : rows.map((row) => (
            <p key={row.id} className="border-t border-[#30363d] py-2 text-sm text-gray-100">
              {row.fileName} — {t(`gov.cat.${row.documentCategory}` as MessageKey)} — {formatMinor(row.amountMinor)} {t('currency')} — {en ? row.routedToModule : moduleLabelAr(row.routedToModule)} — {en ? row.status : statusLabelAr(row.status)}
            </p>
          ))}
        </section>
      ) : null}

      {localRows.length > 0 ? (
        <section className={panelClass}>
          <h2 className="mb-3 text-lg font-semibold text-gray-50">
            {en ? 'Smart Dropzone / Local Direct-DB ledger' : 'دفتر الفرز الذكي / الحقن المحلي المباشر'}
          </h2>
          {localRows.map((row) => (
            <div key={row.id} className="border-t border-[#30363d] py-2 text-sm text-gray-100">
              <p>
                {row.fileName} — {en ? row.departmentLabelEn : row.departmentLabelAr} —{' '}
                {row.entityLabel || '—'} —{' '}
                {row.amountKwd != null ? `${row.amountKwd.toFixed(3)} ${en ? 'KWD' : 'د.ك'}` : '—'} — {en ? row.status : statusLabelAr(row.status)}
              </p>
              {row.source === 'local_direct_db' ? (
                <span className="mt-1 inline-flex rounded-md border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                  {en
                    ? '⚡ Direct DB inject (Zero-Bandwidth Local Ingest)'
                    : '⚡ معالجة وحقن محلي مباشر وفوري'}
                </span>
              ) : null}
              <p className="text-xs text-gray-400" dir="ltr">
                {row.relativePath} · <a className="text-emerald-300 underline" href={row.href}>{en ? 'Open dept' : 'فتح القسم'}</a>
              </p>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  )
}

export default function ArchiveWorkspace({ permissions: held }: { permissions: readonly string[] }) {
  return <PermissionProvider permissions={held}><Workspace /></PermissionProvider>
}
