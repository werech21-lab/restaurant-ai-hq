'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { OdooExtendedMeta } from '@/components/erp/OdooExtendedMeta'
import { primaryButton } from '@/components/erp/styles'
import { KpiCard, SectionCard, StateBlock } from '@/components/ui'
import { formatInt, formatPct } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import type { OdooDataCenterReport } from '@/modules/odoo/client'

export function OdooDataCenterClient() {
  const { locale, t } = useI18n()
  const resolvedLocale: 'ar' | 'en' = locale === 'en' ? 'en' : 'ar'
  const isAr = resolvedLocale !== 'en'
  const [report, setReport] = useState<OdooDataCenterReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (signal?: AbortSignal) => {
    setBusy(true)
    setError(null)
    try {
      const result = await apiRequest<{ data: OdooDataCenterReport }>('/api/v1/admin/odoo-data-center', { signal })
      setReport(result.data)
    } catch (caught) {
      if (isAbort(caught)) return
      setError(t(errorKey(caught)))
    } finally {
      setBusy(false)
    }
  }, [t])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  if (error && !report) {
    return (
      <StateBlock
        state="error"
        locale={resolvedLocale}
        description={error}
        onRetry={() => void load()}
        retryLabel={t('erp.retry')}
      />
    )
  }

  if (!report) {
    return (
      <StateBlock
        state="loading"
        locale={resolvedLocale}
        skeletonRows={5}
        title={isAr ? 'جارٍ قياس سرعة الاستعلام وحساب إحصاءات Odoo…' : 'Measuring query latency and computing Odoo statistics…'}
      />
    )
  }

  const indexOk = report.indexes.filter((row) => row.present).length

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-4">
      {error ? (
        <StateBlock
          state="error"
          locale={resolvedLocale}
          description={error}
          onRetry={() => void load()}
          retryLabel={t('erp.retry')}
          compact
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="button" className={`${primaryButton} ds-focus-ring`} disabled={busy} onClick={() => void load()}>
          {busy ? (isAr ? 'جارٍ القياس…' : 'Measuring…') : isAr ? 'إعادة القياس' : 'Re-measure'}
        </button>
        <Link
          className="ds-focus-ring inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-[#30363d] dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/5"
          href="/erp/odoo-sync"
        >
          {isAr ? 'فتح مزامنة Odoo' : 'Open Odoo Sync'}
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={isAr ? 'المنتجات' : 'Products'} value={report.counts.products} format="int" locale={resolvedLocale} />
        <KpiCard label={isAr ? 'الفواتير' : 'Invoices'} value={report.counts.invoices} format="int" locale={resolvedLocale} />
        <KpiCard label={isAr ? 'العملاء' : 'Customers'} value={report.counts.customers} format="int" locale={resolvedLocale} />
        <KpiCard label="Staging Odoo" value={report.counts.staging} format="int" locale={resolvedLocale} />
        <KpiCard label={isAr ? 'القيود' : 'Journals'} value={report.counts.journals} format="int" locale={resolvedLocale} />
        <KpiCard label={isAr ? 'حركات المخزون' : 'Stock Movements'} value={report.counts.movements} format="int" locale={resolvedLocale} />
        <KpiCard label={isAr ? 'البراندات' : 'Brands'} value={report.brands} format="int" locale={resolvedLocale} />
        <KpiCard label={isAr ? 'الفروع' : 'Branches'} value={report.branches} format="int" locale={resolvedLocale} />
      </div>

      <SectionCard
        title={isAr ? 'سرعة الاستعلام المفهرس' : 'Indexed Query Speed'}
        subtitle={
          isAr
            ? 'عدّاد الجداول + عينة فواتير آخر 90 يوماً (Hot Window).'
            : 'Table counters + 90-day hot window invoice sample.'
        }
        locale={resolvedLocale}
      >
        <p dir="ltr" className="ds-num text-3xl font-black tabular-nums text-emerald-700 dark:text-emerald-400">
          {formatInt(report.querySpeedMs, resolvedLocale)} ms
        </p>
      </SectionCard>

      <SectionCard
        title={
          isAr
            ? `الفهارس المفعّلة (${formatInt(indexOk, resolvedLocale)}/${formatInt(report.indexes.length, resolvedLocale)})`
            : `Active Indexes (${formatInt(indexOk, resolvedLocale)}/${formatInt(report.indexes.length, resolvedLocale)})`
        }
        locale={resolvedLocale}
      >
        <ul className="grid gap-2 sm:grid-cols-2">
          {report.indexes.map((row) => (
            <li
              key={row.name}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:text-slate-100"
            >
              <span className={row.present ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                {row.present ? '✓' : '✗'}
              </span>{' '}
              <code dir="ltr" className="text-xs font-mono">
                {row.name}
              </code>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        title={isAr ? 'تطابق حقول Odoo' : 'Odoo Field Coverage'}
        locale={resolvedLocale}
      >
        {report.fieldCoverage.length === 0 ? (
          <StateBlock
            state="empty"
            locale={resolvedLocale}
            compact
            title={isAr ? 'لا عينات staging بعد' : 'No staging samples yet'}
            description={
              isAr
                ? 'اسحب من Odoo لتشغيل فحص التطابق.'
                : 'Run an Odoo sync to inspect field coverage.'
            }
          />
        ) : (
          <ul className="space-y-2">
            {report.fieldCoverage.map((row) => (
              <li
                key={row.model}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:text-slate-100"
              >
                <p className="font-semibold">
                  <span dir="ltr" className="font-mono">{row.model}</span> —{' '}
                  <span dir="ltr" className="ds-num tabular-nums">{formatPct(row.averagePercent, resolvedLocale)}</span>{' '}
                  ({formatInt(row.samples, resolvedLocale)} {isAr ? 'عينة' : 'samples'})
                </p>
                {row.missingFields.length > 0 ? (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                    {isAr ? 'ناقص: ' : 'Missing: '}
                    {row.missingFields.join(', ')}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                    {isAr ? 'تغطية كاملة للحقول المعروفة.' : 'Complete coverage for known fields.'}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {report.sampleProduct ? (
        <OdooExtendedMeta mapped={report.sampleProduct.mapped} extended={report.sampleProduct.extended} />
      ) : null}
    </div>
  )
}
