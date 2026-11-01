'use client'

import { StatusBadge, cardClass } from '@/components/erp-ui'
import { useI18n } from '@/lib/i18n'

export function DocumentDetail({
  closeHref,
  title,
  number,
  partyLabel,
  party,
  dateLabel,
  status,
  totalLabel,
  paidLabel,
  dueLabel,
  discountLabel,
  printHref,
  lines,
  extra,
}: {
  closeHref: string
  title: string
  number: string
  partyLabel: string
  party: string
  dateLabel: string
  status: string
  totalLabel: string
  paidLabel: string
  dueLabel: string
  discountLabel?: string
  printHref?: string
  lines: Array<{ id: string; name: string; code: string; quantity: string; price: string; total: string }>
  extra?: React.ReactNode
}) {
  const { t } = useI18n()
  return (
    <section className={`${cardClass} mb-5 overflow-hidden`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <h2 className="text-xl font-bold text-slate-900">{number}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {partyLabel}: {party} • {dateLabel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          {printHref ? (
            <a href={printHref} className="text-sm font-semibold text-blue-700">
              {t('doc.print')}
            </a>
          ) : null}
          <a href={closeHref} className="text-sm font-semibold text-blue-700">
            {t('doc.close')}
          </a>
        </div>
      </div>
      <div className="grid gap-3 px-5 py-4 sm:grid-cols-4">
        {discountLabel ? (
          <div>
            <p className="text-xs text-slate-500">{t('receipt.discount')}</p>
            <p className="font-bold">{discountLabel}</p>
          </div>
        ) : null}
        <div>
          <p className="text-xs text-slate-500">{t('receipt.net')}</p>
          <p className="font-bold">{totalLabel}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">{t('receipt.paid')}</p>
          <p className="font-bold">{paidLabel}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">{t('receipt.due')}</p>
          <p className="font-bold text-blue-700">{dueLabel}</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-slate-200 text-slate-500">
              <th className="px-4 py-2 text-right font-semibold">{t('receipt.item')}</th>
              <th className="px-4 py-2 text-right font-semibold">{t('receipt.code')}</th>
              <th className="px-4 py-2 text-right font-semibold">{t('receipt.qty')}</th>
              <th className="px-4 py-2 text-right font-semibold">{t('receipt.price')}</th>
              <th className="px-4 py-2 text-right font-semibold">{t('receipt.lineTotal')}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-b border-slate-200 last:border-0">
                <td className="px-4 py-2 font-semibold">{line.name}</td>
                <td className="px-4 py-2" dir="ltr">
                  {line.code}
                </td>
                <td className="px-4 py-2">{line.quantity}</td>
                <td className="px-4 py-2">{line.price}</td>
                <td className="px-4 py-2">{line.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {extra}
    </section>
  )
}
