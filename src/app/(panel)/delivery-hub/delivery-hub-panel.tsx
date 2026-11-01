'use client'

import { useState, useTransition } from 'react'
import { settlePlatformAction, updatePlatformAction } from '@/app/actions/delivery'
import { Alert, btnGhost, btnPrimary, cardClass, fieldClass } from '@/components/erp-ui'
import { useI18n } from '@/lib/i18n'

type PlatformSummary = {
  code: string
  nameAr: string
  nameEn: string
  commissionPercent: number
  fixedFeeKwd: number
  orderCount: number
  grossSales: number
  commissionTotal: number
  deliveryFeeTotal: number
  marketingDiscountTotal: number
  netPayout: number
}

export function DeliveryHubPanel({
  platforms,
  orders,
  brandCode,
  canEdit,
  canSettle,
}: {
  platforms: PlatformSummary[]
  orders: Array<{
    id: string
    platformCode: string
    invoiceNumber: string
    grossAmount: number
    commissionAmount: number
    netPayout: number
    createdAt: string
  }>
  brandCode: string | null
  canEdit: boolean
  canSettle: boolean
}) {
  const { locale, money } = useI18n()
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [drafts, setDrafts] = useState<Record<string, { commissionPercent: string; fixedFeeKwd: string }>>(() =>
    Object.fromEntries(
      platforms.map((p) => [p.code, { commissionPercent: String(p.commissionPercent), fixedFeeKwd: String(p.fixedFeeKwd) }]),
    ),
  )

  return (
    <div className="space-y-4">
      {error ? <Alert kind="error">{error}</Alert> : null}
      {notice ? <Alert kind="ok">{notice}</Alert> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {platforms.map((platform) => (
          <section key={platform.code} className={`${cardClass} p-5`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-gold-300">
                  {locale === 'en' ? platform.nameEn : platform.nameAr}
                </h2>
                <p className="text-xs text-mist-400" dir="ltr">
                  {platform.code}
                </p>
              </div>
              <span className="rounded-full border border-[#8cc63f]/30 bg-[#8cc63f]/10 px-2.5 py-1 text-xs font-bold text-[#8cc63f]">
                {platform.orderCount} {locale === 'en' ? 'open' : 'مفتوح'}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-mist-400">Gross Sales</dt>
                <dd className="font-bold text-mist-100">{money(platform.grossSales)}</dd>
              </div>
              <div>
                <dt className="text-mist-400">Commission</dt>
                <dd className="font-bold text-red-300">{money(platform.commissionTotal)}</dd>
              </div>
              <div>
                <dt className="text-mist-400">Delivery / Promo</dt>
                <dd className="font-semibold">
                  {money(platform.deliveryFeeTotal)} / {money(platform.marketingDiscountTotal)}
                </dd>
              </div>
              <div>
                <dt className="text-mist-400">Net Payout</dt>
                <dd className="text-lg font-black text-[#8cc63f]">{money(platform.netPayout)}</dd>
              </div>
            </dl>

            {canEdit ? (
              <div className="mt-4 flex flex-wrap items-end gap-2">
                <div>
                  <label className="mb-1 block text-xs text-mist-400">Commission %</label>
                  <input
                    className={`${fieldClass} w-24`}
                    dir="ltr"
                    value={drafts[platform.code]?.commissionPercent ?? ''}
                    onChange={(e) =>
                      setDrafts((current) => ({
                        ...current,
                        [platform.code]: {
                          commissionPercent: e.target.value,
                          fixedFeeKwd: current[platform.code]?.fixedFeeKwd ?? '0',
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-mist-400">Fixed fee KWD</label>
                  <input
                    className={`${fieldClass} w-24`}
                    dir="ltr"
                    value={drafts[platform.code]?.fixedFeeKwd ?? ''}
                    onChange={(e) =>
                      setDrafts((current) => ({
                        ...current,
                        [platform.code]: {
                          commissionPercent: current[platform.code]?.commissionPercent ?? '0',
                          fixedFeeKwd: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <button
                  type="button"
                  className={btnGhost}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const draft = drafts[platform.code]
                      const result = await updatePlatformAction({
                        code: platform.code,
                        commissionPercent: Number(draft?.commissionPercent) || 0,
                        fixedFeeKwd: Number(draft?.fixedFeeKwd) || 0,
                      })
                      if (!result.ok) setError(result.message)
                      else setNotice(locale === 'en' ? 'Platform updated' : 'تم تحديث المنصة')
                    })
                  }
                >
                  {locale === 'en' ? 'Save rates' : 'حفظ النسب'}
                </button>
              </div>
            ) : null}

            {canSettle ? (
              <button
                type="button"
                className={`${btnPrimary} mt-4 w-full`}
                disabled={pending || platform.orderCount === 0}
                onClick={() =>
                  start(async () => {
                    setError('')
                    const result = await settlePlatformAction({ platformCode: platform.code, brandCode })
                    if (!result.ok) setError(result.message)
                    else setNotice(locale === 'en' ? 'Settlement posted to accounting' : 'تم تسجيل التسوية والقيد المحاسبي')
                  })
                }
              >
                {locale === 'en'
                  ? 'Record settlement & bank reconciliation'
                  : 'تسجيل تسوية ومطابقة كشف حساب المنصة'}
              </button>
            ) : null}
          </section>
        ))}
      </div>

      <section className={`${cardClass} overflow-hidden`}>
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="font-bold text-mist-100">{locale === 'en' ? 'Open aggregator orders' : 'طلبات المنصات المفتوحة'}</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-mist-400">
              <th className="px-4 py-3 text-start">Platform</th>
              <th className="px-4 py-3 text-start">Invoice</th>
              <th className="px-4 py-3 text-start">Gross</th>
              <th className="px-4 py-3 text-start">Commission</th>
              <th className="px-4 py-3 text-start">Net</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-mist-400" colSpan={5}>
                  {locale === 'en' ? 'No open aggregator sales in this scope.' : 'لا مبيعات منصات مفتوحة في هذا النطاق.'}
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-t border-white/10">
                  <td className="px-4 py-3 font-semibold" dir="ltr">
                    {order.platformCode}
                  </td>
                  <td className="px-4 py-3" dir="ltr">
                    {order.invoiceNumber}
                  </td>
                  <td className="px-4 py-3">{money(order.grossAmount)}</td>
                  <td className="px-4 py-3 text-red-300">{money(order.commissionAmount)}</td>
                  <td className="px-4 py-3 font-bold text-[#8cc63f]">{money(order.netPayout)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
