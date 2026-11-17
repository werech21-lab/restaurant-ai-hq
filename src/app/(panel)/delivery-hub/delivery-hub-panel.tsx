'use client'

import { useState, useTransition } from 'react'
import { settlePlatformAction, updatePlatformAction } from '@/app/actions/delivery'
import { Alert, btnGhost, btnPrimary } from '@/components/erp-ui'
import { DataTable, SectionCard, StateBlock, type DataTableColumn } from '@/components/ui'
import { formatInt, formatKwd } from '@/lib/format'
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

type OpenOrderRow = {
  id: string
  platformCode: string
  invoiceNumber: string
  grossAmount: number
  commissionAmount: number
  netPayout: number
  createdAt: string
}

const inputCls =
  'ds-surface-subtle ds-focus-ring min-h-10 w-24 rounded-xl px-3 py-1.5 text-sm text-[var(--ds-text-primary)]'

export function DeliveryHubPanel({
  platforms,
  orders,
  brandCode,
  canEdit,
  canSettle,
}: {
  platforms: PlatformSummary[]
  orders: OpenOrderRow[]
  brandCode: string | null
  canEdit: boolean
  canSettle: boolean
}) {
  const { locale } = useI18n()
  const isEn = locale === 'en'
  const uiLocale = isEn ? 'en' : 'ar'
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [drafts, setDrafts] = useState<Record<string, { commissionPercent: string; fixedFeeKwd: string }>>(() =>
    Object.fromEntries(
      platforms.map((p) => [p.code, { commissionPercent: String(p.commissionPercent), fixedFeeKwd: String(p.fixedFeeKwd) }]),
    ),
  )

  const orderColumns: ReadonlyArray<DataTableColumn<OpenOrderRow>> = [
    {
      key: 'platform',
      header: isEn ? 'Platform' : 'المنصة',
      render: (row) => (
        <span dir="ltr" className="ds-num font-mono font-semibold">
          {row.platformCode}
        </span>
      ),
    },
    {
      key: 'invoice',
      header: isEn ? 'Invoice' : 'الفاتورة',
      render: (row) => (
        <span dir="ltr" className="ds-num font-mono">
          {row.invoiceNumber}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: isEn ? 'Date (Kuwait)' : 'التاريخ (الكويت)',
      format: 'datetime',
      accessor: (row) => row.createdAt,
    },
    {
      key: 'gross',
      header: isEn ? 'Gross' : 'الإجمالي',
      format: 'kwd',
      align: 'numeric',
      accessor: (row) => row.grossAmount,
    },
    {
      key: 'commission',
      header: isEn ? 'Commission' : 'العمولة',
      format: 'kwd',
      align: 'numeric',
      cellClassName: 'font-semibold',
      accessor: (row) => row.commissionAmount,
    },
    {
      key: 'net',
      header: isEn ? 'Net' : 'الصافي',
      format: 'kwd',
      align: 'numeric',
      cellClassName: 'font-bold',
      accessor: (row) => row.netPayout,
    },
  ]

  return (
    <div dir={isEn ? 'ltr' : 'rtl'} className="space-y-4">
      {error ? <Alert kind="error">{error}</Alert> : null}
      {notice ? <Alert kind="ok">{notice}</Alert> : null}

      {platforms.length === 0 ? (
        <StateBlock
          state="empty"
          locale={uiLocale}
          title={isEn ? 'No active delivery platforms' : 'لا توجد منصات توصيل مفعّلة'}
          description={
            isEn
              ? 'No aggregator configurations were found for the active scope.'
              : 'لم يتم العثور على إعدادات منصات توصيل في النطاق الحالي.'
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {platforms.map((platform) => {
            const commInputId = `comm-${platform.code}`
            const feeInputId = `fee-${platform.code}`
            return (
              <SectionCard
                key={platform.code}
                locale={uiLocale}
                title={isEn ? platform.nameEn : platform.nameAr}
                subtitle={
                  <span dir="ltr" className="ds-num font-mono">
                    {platform.code}
                  </span>
                }
                actions={
                  <span
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold"
                    style={{
                      backgroundColor: 'var(--ds-accent-soft)',
                      borderColor: 'var(--ds-border-accent)',
                      color: 'var(--ds-accent)',
                    }}
                  >
                    <span dir="ltr" className="ds-num tabular-nums">
                      {formatInt(platform.orderCount, uiLocale)}
                    </span>
                    <span>{isEn ? 'open' : 'مفتوح'}</span>
                  </span>
                }
              >
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="ds-caption">{isEn ? 'Gross Sales' : 'إجمالي المبيعات'}</dt>
                    <dd dir="ltr" className="ds-num text-start font-bold tabular-nums" style={{ color: 'var(--ds-text-primary)' }}>
                      {formatKwd(platform.grossSales, { locale: uiLocale })}
                    </dd>
                  </div>
                  <div>
                    <dt className="ds-caption">{isEn ? 'Commission' : 'العمولة'}</dt>
                    <dd dir="ltr" className="ds-num text-start font-bold tabular-nums" style={{ color: 'var(--ds-negative)' }}>
                      {formatKwd(platform.commissionTotal, { locale: uiLocale })}
                    </dd>
                  </div>
                  <div>
                    <dt className="ds-caption">{isEn ? 'Delivery / Promo' : 'رسوم التوصيل / العروض'}</dt>
                    <dd dir="ltr" className="ds-num text-start font-semibold tabular-nums" style={{ color: 'var(--ds-text-secondary)' }}>
                      {formatKwd(platform.deliveryFeeTotal, { locale: uiLocale })} /{' '}
                      {formatKwd(platform.marketingDiscountTotal, { locale: uiLocale })}
                    </dd>
                  </div>
                  <div>
                    <dt className="ds-caption">{isEn ? 'Net Payout' : 'صافي المستحق'}</dt>
                    <dd dir="ltr" className="ds-num text-start text-lg font-black tabular-nums" style={{ color: 'var(--ds-positive)' }}>
                      {formatKwd(platform.netPayout, { locale: uiLocale })}
                    </dd>
                  </div>
                </dl>

                {canEdit ? (
                  <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-[var(--ds-border-hairline)] pt-4">
                    <div>
                      <label htmlFor={commInputId} className="ds-caption mb-1 block">
                        {isEn ? 'Commission %' : 'نسبة العمولة %'}
                      </label>
                      <input
                        id={commInputId}
                        className={inputCls}
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
                      <label htmlFor={feeInputId} className="ds-caption mb-1 block">
                        {isEn ? 'Fixed fee KWD' : 'رسوم ثابتة (د.ك)'}
                      </label>
                      <input
                        id={feeInputId}
                        className={inputCls}
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
                      className={`${btnGhost} ds-focus-ring min-h-10`}
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
                          else setNotice(isEn ? 'Platform updated' : 'تم تحديث المنصة')
                        })
                      }
                    >
                      {isEn ? 'Save rates' : 'حفظ النسب'}
                    </button>
                  </div>
                ) : null}

                {canSettle ? (
                  <button
                    type="button"
                    className={`${btnPrimary} ds-focus-ring mt-4 min-h-10 w-full`}
                    disabled={pending || platform.orderCount === 0}
                    onClick={() =>
                      start(async () => {
                        setError('')
                        const result = await settlePlatformAction({ platformCode: platform.code, brandCode })
                        if (!result.ok) setError(result.message)
                        else setNotice(isEn ? 'Settlement posted to accounting' : 'تم تسجيل التسوية والقيد المحاسبي')
                      })
                    }
                  >
                    {isEn
                      ? 'Record settlement & bank reconciliation'
                      : 'تسجيل تسوية ومطابقة كشف حساب المنصة'}
                  </button>
                ) : null}
              </SectionCard>
            )
          })}
        </div>
      )}

      <SectionCard
        locale={uiLocale}
        title={isEn ? 'Open aggregator orders' : 'طلبات المنصات المفتوحة'}
      >
        <DataTable<OpenOrderRow>
          locale={uiLocale}
          columns={orderColumns}
          rows={orders}
          rowKey={(row) => row.id}
          emptyTitle={isEn ? 'No open aggregator sales in this scope.' : 'لا توجد مبيعات منصات مفتوحة في هذا النطاق.'}
          emptyDescription={
            isEn
              ? 'New unsettled aggregator orders will appear here automatically.'
              : 'ستظهر طلبات منصات التوصيل المفتوحة هنا تلقائياً عند تسجيلها.'
          }
        />
      </SectionCard>
    </div>
  )
}
