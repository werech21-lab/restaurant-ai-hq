'use client'

import { useState } from 'react'
import { panelClass, secondaryButton } from '@/components/erp/styles'
import type { MappedField } from '@/lib/odoo-mapper'

function ValueCell({ value }: { value: MappedField['value'] }) {
  if (value === null) return <span className="text-gray-500">—</span>
  if (typeof value === 'boolean') return <span>{value ? 'نعم' : 'لا'}</span>
  return <span dir="auto">{String(value)}</span>
}

/** Shows core mapped Odoo fields plus every leftover key so no historical detail is lost. */
export function OdooExtendedMeta({
  title = 'التفاصيل الكاملة للسجل (Odoo Extended Metadata)',
  mapped,
  extended,
}: {
  title?: string
  mapped: MappedField[]
  extended: MappedField[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`${panelClass} space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <button type="button" className={secondaryButton} onClick={() => setOpen((value) => !value)}>
          {open ? 'إخفاء' : 'عرض البيانات الممتدة'}
        </button>
      </div>
      {mapped.length > 0 ? (
        <dl className="grid gap-2 sm:grid-cols-2">
          {mapped.map((row) => (
            <div key={row.key} className="rounded-lg border border-[#30363d] bg-[#09110E]/20 px-3 py-2 text-sm">
              <dt className="text-xs text-gray-400">
                {row.labelAr} · {row.labelEn}
              </dt>
              <dd className="mt-1 text-gray-100">
                <ValueCell value={row.value} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {open ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-gray-400">
              <tr>
                <th className="px-2 py-1 text-start">الحقل</th>
                <th className="px-2 py-1 text-start">العربية</th>
                <th className="px-2 py-1 text-start">English</th>
                <th className="px-2 py-1 text-start">القيمة</th>
              </tr>
            </thead>
            <tbody>
              {extended.map((row) => (
                <tr key={row.key} className="border-t border-[#30363d]">
                  <td className="px-2 py-1 font-mono text-xs text-gold-300">{row.key}</td>
                  <td className="px-2 py-1">{row.labelAr}</td>
                  <td className="px-2 py-1">{row.labelEn}</td>
                  <td className="px-2 py-1">
                    <ValueCell value={row.value} />
                  </td>
                </tr>
              ))}
              {extended.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-2 py-3 text-gray-500">
                    لا توجد حقول إضافية خارج المطابقة الأساسية — التغطية كاملة لهذا السجل.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-gray-500">{extended.length} حقل Odoo إضافي محفوظ في الأرشيف.</p>
      )}
    </div>
  )
}
