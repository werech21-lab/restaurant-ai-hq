'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ApiError, apiRequest, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { SectionCard } from '@/components/ui/section-card'
import { StateBlock } from '@/components/ui/state-block'
import { permissions } from '@/lib/auth/permissions'
import {
  UNAVAILABLE_DASH,
  formatInt,
  formatKwd,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { ArchiveDocument } from '@/modules/governance/client'

const categories = [
  'fuel_invoice',
  'contract',
  'knet_receipt',
  'traffic_fine',
  'delivery_waybill',
] as const
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

const inputClass =
  'ds-focus-ring mt-1.5 w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2.5 text-sm text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)]'
const labelClass = 'block text-sm font-medium text-[var(--ds-text-secondary)]'
const primaryBtnClass =
  'ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400'
const noticeClass =
  'rounded-xl border border-[var(--ds-positive-border)] bg-[var(--ds-positive-bg)] px-3.5 py-2.5 text-sm font-medium text-[var(--ds-positive)]'
const errorClass =
  'rounded-xl border border-[var(--ds-negative-border)] bg-[var(--ds-negative-bg)] px-3.5 py-2.5 text-sm font-medium text-[var(--ds-negative)]'

function statusLabel(status: string, isAr: boolean): string {
  if (!status) return UNAVAILABLE_DASH
  switch (status.toLowerCase()) {
    case 'processed':
      return isAr ? 'تمت المعالجة بنجاح' : 'Processed'
    case 'pending':
      return isAr ? 'قيد التدقيق والانتظار' : 'Pending Review'
    case 'ready':
      return isAr ? 'جاهز للاعتماد' : 'Ready'
    case 'routed':
      return isAr ? 'تم التوجيه بنجاح' : 'Routed'
    case 'archived':
      return isAr ? 'مؤرشف معتمد' : 'Archived'
    case 'ingested':
      return isAr ? 'تم الإدراج' : 'Ingested'
    case 'held':
      return isAr ? 'محتجز للمراجعة' : 'Held'
    case 'blocked':
      return isAr ? 'موقوف رقابياً' : 'Blocked'
    default:
      return status
  }
}

function moduleLabel(mod: string, isAr: boolean): string {
  if (!mod) return UNAVAILABLE_DASH
  const normalized = mod.replace(/^\/erp\//, '').toLowerCase()
  switch (normalized) {
    case 'procurement':
      return isAr ? 'المشتريات والمخازن' : 'Procurement'
    case 'accounting':
    case 'finance':
      return isAr ? 'الإدارة المالية والمحاسبة' : 'Finance & Accounting'
    case 'hr':
      return isAr ? 'الموارد البشرية' : 'Human Resources'
    case 'governance':
      return isAr ? 'الحوكمة والامتثال' : 'Governance & Compliance'
    case 'operations':
      return isAr ? 'العمليات والتشغيل' : 'Operations'
    case 'contracts':
      return isAr ? 'العقود التجارية' : 'Contracts'
    case 'delivery':
      return isAr ? 'التوصيل' : 'Delivery'
    default:
      return mod
  }
}

function UnavailableCell({ tooltip }: { tooltip: string }) {
  return (
    <span
      dir="ltr"
      title={tooltip}
      aria-label={tooltip}
      data-unavailable="true"
      className="ds-num tabular-nums"
      style={{ color: 'var(--ds-unavailable)' }}
    >
      {UNAVAILABLE_DASH}
    </span>
  )
}

function Workspace() {
  const { t, locale } = useI18n()
  const isAr = locale !== 'en'
  const fmtLocale: FormatLocale = isAr ? 'ar' : 'en'
  const unavailableTooltip = getUnavailableTooltip(fmtLocale)
  const canRoute = useCan(permissions.govArchiveRoute)

  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<MessageKey | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<ArchiveDocument[]>([])
  const [localRows, setLocalRows] = useState<LocalSmartDropRow[]>([])
  const [fileName, setFileName] = useState(isAr ? 'فاتورة-وقود.pdf' : 'fuel-invoice.pdf')
  const [category, setCategory] = useState<Category>('fuel_invoice')
  const [text, setText] = useState(isAr ? 'المبلغ 12.500 د.ك' : 'Amount 12.500 KWD')
  const [reloadTick, setReloadTick] = useState(0)

  const reload = useCallback(() => {
    setReloadTick((value) => value + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setPhase('loading')
    apiRequest<{ data: ArchiveDocument[] }>('/api/v1/governance/archive', {
      signal: controller.signal,
    })
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
  }, [reloadTick])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    setError(null)
    try {
      const saved = await apiRequest<{ data: ArchiveDocument }>('/api/v1/governance/archive', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: { fileName, documentCategory: category, text },
      })
      setNotice(`${t('gov.route')}: ${moduleLabel(saved.data.routedToModule, isAr)}`)
      reload()
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'compliance_blocked') {
        setNotice(
          isAr
            ? 'تم إيقاف توجيه المستند وفق قواعد الامتثال المفعّلة.'
            : 'Document routing blocked by active compliance rules.',
        )
      } else {
        setError(errorKey(caught))
      }
      reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-none min-w-0 space-y-5">
      <SectionCard
        title={t('hub.archive')}
        subtitle={
          isAr
            ? 'الأرشفة الضوئية وتوجيه المستندات التلقائي إلى الأقسام المختصة'
            : 'Smart document archive and automated department routing'
        }
        locale={fmtLocale}
      >
        {notice ? (
          <p className={`${noticeClass} mb-4`} role="status">
            {notice}
          </p>
        ) : null}

        {phase === 'loading' ? (
          <StateBlock state="loading" locale={fmtLocale} title={t('gov.loading')} skeletonRows={4} />
        ) : phase === 'error' && error ? (
          <StateBlock
            state={error === 'erp.err.forbidden' ? 'forbidden' : 'error'}
            locale={fmtLocale}
            title={t(error)}
            onRetry={error === 'erp.err.forbidden' ? undefined : reload}
          />
        ) : (
          <div className="space-y-5">
            {error ? (
              <p role="alert" className={errorClass}>
                {t(error)}
              </p>
            ) : null}

            {canRoute ? (
              <form
                className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-4 sm:grid-cols-2"
                onSubmit={(event) => void submit(event)}
              >
                <label className={labelClass}>
                  {t('gov.file')}
                  <input
                    className={inputClass}
                    required
                    value={fileName}
                    onChange={(event) => setFileName(event.target.value)}
                  />
                </label>
                <label className={labelClass}>
                  {t('gov.category')}
                  <select
                    className={inputClass}
                    value={category}
                    onChange={(event) => setCategory(event.target.value as Category)}
                  >
                    {categories.map((item) => (
                      <option key={item} value={item}>
                        {t(`gov.cat.${item}` as MessageKey)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={`${labelClass} sm:col-span-2`}>
                  {t('gov.text')}
                  <textarea
                    className={inputClass}
                    rows={2}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                  />
                </label>
                <div className="sm:col-span-2">
                  <button className={primaryBtnClass} type="submit" disabled={busy}>
                    {t('gov.analyze')}
                  </button>
                </div>
              </form>
            ) : null}

            {rows.length === 0 ? (
              <StateBlock state="empty" locale={fmtLocale} title={t('gov.empty')} />
            ) : (
              <div className="w-full overflow-x-auto rounded-xl border border-[var(--ds-border-hairline)]">
                <table className="w-full min-w-[600px] border-collapse text-sm">
                  <thead className="border-b border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] text-xs font-bold text-[var(--ds-text-secondary)]">
                    <tr>
                      <th className="px-3.5 py-2.5 text-start">{t('gov.file')}</th>
                      <th className="px-3.5 py-2.5 text-start">{t('gov.category')}</th>
                      <th className="px-3.5 py-2.5 text-end">{t('gov.amount')}</th>
                      <th className="px-3.5 py-2.5 text-start">{t('gov.route')}</th>
                      <th className="px-3.5 py-2.5 text-start">
                        {isAr ? 'الحالة' : 'Status'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                    {rows.map((row) => (
                      <tr key={row.id} className="hover:bg-[var(--ds-bg-hover)]">
                        <td className="px-3.5 py-2.5 font-medium text-[var(--ds-text-primary)]">
                          {row.fileName || <UnavailableCell tooltip={unavailableTooltip} />}
                        </td>
                        <td className="px-3.5 py-2.5 text-[var(--ds-text-secondary)]">
                          {t(`gov.cat.${row.documentCategory}` as MessageKey)}
                        </td>
                        <td className="px-3.5 py-2.5 text-end">
                          {Number.isSafeInteger(row.amountMinor) ? (
                            <span
                              dir="ltr"
                              className="ds-num whitespace-nowrap font-semibold tabular-nums text-[var(--ds-text-primary)]"
                            >
                              {formatKwd(row.amountMinor / 1000, fmtLocale)}
                            </span>
                          ) : (
                            <UnavailableCell tooltip={unavailableTooltip} />
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-[var(--ds-text-secondary)]">
                          {moduleLabel(row.routedToModule, isAr)}
                        </td>
                        <td className="px-3.5 py-2.5 text-[var(--ds-text-primary)]">
                          {statusLabel(row.status, isAr)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {localRows.length > 0 ? (
        <SectionCard
          title={
            <span className="flex flex-wrap items-center gap-2">
              <span>
                {isAr
                  ? 'دفتر الفرز الذكي / الحقن المحلي المباشر'
                  : 'Smart Dropzone / Local Direct Ledger'}
              </span>
              <span
                dir="ltr"
                className="ds-num rounded-full border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] px-2.5 py-0.5 text-xs font-bold tabular-nums"
              >
                {formatInt(localRows.length, fmtLocale)}
              </span>
            </span>
          }
          locale={fmtLocale}
        >
          <div className="w-full overflow-x-auto rounded-xl border border-[var(--ds-border-hairline)]">
            <table className="w-full min-w-[660px] border-collapse text-sm">
              <thead className="border-b border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] text-xs font-bold text-[var(--ds-text-secondary)]">
                <tr>
                  <th className="px-3.5 py-2.5 text-start">{t('gov.file')}</th>
                  <th className="px-3.5 py-2.5 text-start">{t('gov.department')}</th>
                  <th className="px-3.5 py-2.5 text-start">
                    {isAr ? 'الجهة' : 'Entity'}
                  </th>
                  <th className="px-3.5 py-2.5 text-end">{t('gov.amount')}</th>
                  <th className="px-3.5 py-2.5 text-start">
                    {isAr ? 'الحالة' : 'Status'}
                  </th>
                  <th className="px-3.5 py-2.5 text-start">
                    {isAr ? 'المسار' : 'Link'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                {localRows.map((row) => (
                  <tr key={row.id} className="hover:bg-[var(--ds-bg-hover)]">
                    <td className="px-3.5 py-2.5 font-medium text-[var(--ds-text-primary)]">
                      <div>{row.fileName}</div>
                      {row.source === 'local_direct_db' ? (
                        <span className="mt-1 inline-flex rounded-md border border-[var(--ds-positive-border)] bg-[var(--ds-positive-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--ds-positive)]">
                          {isAr ? 'معالجة وإدراج محلي مباشر' : 'Direct Local Ingest'}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3.5 py-2.5 text-[var(--ds-text-secondary)]">
                      {isAr ? row.departmentLabelAr : row.departmentLabelEn}
                    </td>
                    <td className="px-3.5 py-2.5 text-[var(--ds-text-secondary)]">
                      {row.entityLabel || <UnavailableCell tooltip={unavailableTooltip} />}
                    </td>
                    <td className="px-3.5 py-2.5 text-end">
                      {typeof row.amountKwd === 'number' && Number.isFinite(row.amountKwd) ? (
                        <span
                          dir="ltr"
                          className="ds-num whitespace-nowrap font-semibold tabular-nums text-[var(--ds-text-primary)]"
                        >
                          {formatKwd(row.amountKwd, fmtLocale)}
                        </span>
                      ) : (
                        <UnavailableCell tooltip={unavailableTooltip} />
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-[var(--ds-text-primary)]">
                      {statusLabel(row.status, isAr)}
                    </td>
                    <td className="px-3.5 py-2.5 text-xs">
                      <div dir="ltr" className="max-w-xs truncate font-mono text-[var(--ds-text-muted)]">
                        {row.relativePath}
                      </div>
                      <a
                        className="ds-focus-ring font-semibold text-[var(--ds-accent)] underline"
                        href={row.href}
                      >
                        {isAr ? 'فتح القسم' : 'Open dept'}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}
    </div>
  )
}

export default function ArchiveWorkspace({ permissions: held }: { permissions: readonly string[] }) {
  return (
    <PermissionProvider permissions={held}>
      <Workspace />
    </PermissionProvider>
  )
}
