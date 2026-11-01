'use client'

import { useEffect, useState } from 'react'
import { apiRequest, errorKey } from '@/components/erp/api'
import { OdooExtendedMeta } from '@/components/erp/OdooExtendedMeta'
import { errorClass, panelClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import type { OdooDataCenterReport } from '@/modules/odoo'

export function OdooDataCenterClient() {
  const [report, setReport] = useState<OdooDataCenterReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setBusy(true)
    setError(null)
    try {
      const result = await apiRequest<{ data: OdooDataCenterReport }>('/api/v1/admin/odoo-data-center')
      setReport(result.data)
    } catch (caught) {
      setError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  if (error && !report) return <p className={errorClass}>{error}</p>
  if (!report) return <p className="text-sm text-slate-600">جارٍ قياس سرعة الاستعلام وحساب إحصاءات Odoo…</p>

  const indexOk = report.indexes.filter((row) => row.present).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={primaryButton} disabled={busy} onClick={() => void load()}>
          إعادة القياس
        </button>
        <a className={secondaryButton} href="/erp/odoo-sync">
          فتح مزامنة Odoo
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="المنتجات" value={report.counts.products} />
        <Stat label="الفواتير" value={report.counts.invoices} />
        <Stat label="العملاء" value={report.counts.customers} />
        <Stat label="Staging Odoo" value={report.counts.staging} />
        <Stat label="القيود" value={report.counts.journals} />
        <Stat label="حركات المخزون" value={report.counts.movements} />
        <Stat label="البراندات" value={report.brands} />
        <Stat label="الفروع" value={report.branches} />
      </div>

      <section className={`${panelClass} space-y-2`}>
        <h2 className="text-base font-bold text-slate-900">سرعة الاستعلام المفهرس</h2>
        <p className="text-3xl font-black text-emerald-700">{report.querySpeedMs} ms</p>
        <p className="text-sm text-slate-600">عدّاد الجداول + عينة فواتير آخر 90 يوماً (Hot Window).</p>
      </section>

      <section className={`${panelClass} space-y-2`}>
        <h2 className="text-base font-bold text-slate-900">
          الفهارس المفعّلة ({indexOk}/{report.indexes.length})
        </h2>
        <ul className="grid gap-1 sm:grid-cols-2">
          {report.indexes.map((row) => (
            <li key={row.name} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <span className={row.present ? 'text-emerald-700' : 'text-rose-600'}>{row.present ? '✓' : '✗'}</span>{' '}
              <code className="text-xs">{row.name}</code>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${panelClass} space-y-2`}>
        <h2 className="text-base font-bold text-slate-900">تطابق حقول Odoo</h2>
        {report.fieldCoverage.length === 0 ? (
          <p className="text-sm text-slate-600">لا عينات staging بعد — اسحب من Odoo لتشغيل فحص التطابق.</p>
        ) : (
          <ul className="space-y-2">
            {report.fieldCoverage.map((row) => (
              <li key={row.model} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <p className="font-semibold">
                  {row.model} — {row.averagePercent}% ({row.samples} عينة)
                </p>
                {row.missingFields.length > 0 ? (
                  <p className="mt-1 text-xs text-amber-700">ناقص: {row.missingFields.join(', ')}</p>
                ) : (
                  <p className="mt-1 text-xs text-emerald-700">تغطية كاملة للحقول المعروفة.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {report.sampleProduct ? (
        <OdooExtendedMeta mapped={report.sampleProduct.mapped} extended={report.sampleProduct.extended} />
      ) : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className={`${panelClass} p-4`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value.toLocaleString('en-US')}</p>
    </div>
  )
}
