'use client'

import React from 'react'
import { DataTable, KpiCard, SectionCard, type DataTableColumn } from '@/components/ui'
import { UNAVAILABLE_DASH, formatPct, getUnavailableTooltip } from '@/lib/format'

type Match = {
  id: string
  source: string
  platform: string | null
  channel: string
  expectedCommissionBps: number
  gross: number
  commission: number
  net: number
  bankHint: string | null
  status: 'MATCHED' | 'SHORTFALL' | 'OVER_COMMISSION' | 'REVIEW'
  noteAr: string
  noteEn: string
}

type Data = {
  summary: {
    total: number
    matched: number
    shortfall: number
    overCommission: number
    review: number
    bankHint: string
  }
  matches: Match[]
}

const STATUS_STYLE: Record<Match['status'], React.CSSProperties> = {
  MATCHED: {
    color: 'var(--ds-positive)',
    backgroundColor: 'var(--ds-positive-bg)',
    borderColor: 'var(--ds-positive-border)',
  },
  SHORTFALL: {
    color: 'var(--ds-negative)',
    backgroundColor: 'var(--ds-negative-bg)',
    borderColor: 'var(--ds-negative-border)',
  },
  OVER_COMMISSION: {
    color: 'var(--ds-warning)',
    backgroundColor: 'var(--ds-warning-bg)',
    borderColor: 'var(--ds-warning-border)',
  },
  REVIEW: {
    color: 'var(--ds-text-secondary)',
    backgroundColor: 'var(--ds-bg-subtle)',
    borderColor: 'var(--ds-border-hairline)',
  },
}

function statusBadgeText(status: Match['status'], isAr: boolean): string {
  if (status === 'MATCHED') return isAr ? 'مطابق' : 'Matched'
  if (status === 'SHORTFALL') return isAr ? 'نقص إيداع' : 'Shortfall'
  if (status === 'OVER_COMMISSION') return isAr ? 'عمولة زائدة' : 'Over commission'
  return isAr ? 'مراجعة' : 'Review'
}

export function ReconciliationClient({
  initial,
  locale = 'ar',
  loading = false,
  error = false,
}: {
  initial: Data
  locale?: 'ar' | 'en'
  loading?: boolean
  error?: boolean
}) {
  const isAr = locale !== 'en'
  const resolvedLocale = isAr ? 'ar' : 'en'
  const unavailableTooltip = getUnavailableTooltip(resolvedLocale)
  const s = initial.summary

  const columns: ReadonlyArray<DataTableColumn<Match>> = [
    {
      key: 'source',
      header: isAr ? 'المصدر' : 'Source',
      accessor: (row) => row.source,
    },
    {
      key: 'platform',
      header: isAr ? 'المنصة / القناة' : 'Platform / Channel',
      render: (row) => (
        <div>
          <span className="font-semibold" style={{ color: 'var(--ds-text-primary)' }}>
            {row.platform ? (
              row.platform
            ) : (
              <span title={unavailableTooltip} aria-label={unavailableTooltip}>
                {UNAVAILABLE_DASH}
              </span>
            )}
          </span>
          <span
            dir="ltr"
            className="ds-num mt-0.5 block text-xs font-semibold tabular-nums"
            style={{ color: 'var(--ds-accent)' }}
          >
            {row.channel}
            {row.expectedCommissionBps
              ? ` · ${formatPct(row.expectedCommissionBps / 100, { locale: resolvedLocale, decimals: 0 })}`
              : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'gross',
      header: isAr ? 'إجمالي المبيعات' : 'Gross',
      format: 'kwd',
      align: 'numeric',
      accessor: (row) => row.gross,
    },
    {
      key: 'commission',
      header: isAr ? 'العمولة' : 'Commission',
      format: 'kwd',
      align: 'numeric',
      accessor: (row) => row.commission,
    },
    {
      key: 'net',
      header: isAr ? 'صافي الإيداع' : 'Net',
      format: 'kwd',
      align: 'numeric',
      accessor: (row) => row.net,
    },
    {
      key: 'status',
      header: isAr ? 'الحالة والملاحظة' : 'Status & Note',
      render: (row) => (
        <div>
          <span
            className="inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold"
            style={STATUS_STYLE[row.status]}
          >
            {statusBadgeText(row.status, isAr)}
          </span>
          <p className="mt-1 text-xs" style={{ color: 'var(--ds-text-muted)' }}>
            {isAr ? row.noteAr : row.noteEn}
          </p>
        </div>
      ),
    },
  ]

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          locale={resolvedLocale}
          label={isAr ? 'الإجمالي' : 'Total'}
          value={s.total}
          format="int"
        />
        <KpiCard
          locale={resolvedLocale}
          label={isAr ? 'مطابق' : 'Matched'}
          value={s.matched}
          format="int"
          deltaTone="positive"
        />
        <KpiCard
          locale={resolvedLocale}
          label={isAr ? 'نقص إيداع' : 'Shortfall'}
          value={s.shortfall}
          format="int"
          higherIsBetter={false}
        />
        <KpiCard
          locale={resolvedLocale}
          label={isAr ? 'عمولة زائدة' : 'Over commission'}
          value={s.overCommission}
          format="int"
          higherIsBetter={false}
        />
        <KpiCard
          locale={resolvedLocale}
          label={isAr ? 'مراجعة' : 'Review'}
          value={s.review}
          format="int"
        />
      </div>

      <SectionCard
        locale={resolvedLocale}
        title={isAr ? 'حسابات البنك المرجعية' : 'Reference Bank Accounts'}
        subtitle={
          <span dir="ltr" className="ds-num font-mono font-semibold" style={{ color: 'var(--ds-accent)' }}>
            {s.bankHint || UNAVAILABLE_DASH}
          </span>
        }
      >
        <DataTable<Match>
          locale={resolvedLocale}
          columns={columns}
          rows={initial.matches}
          rowKey={(row) => row.id}
          loading={loading}
          error={error}
          emptyTitle={
            isAr ? 'لا توجد تسويات للمطابقة بعد' : 'No settlements to reconcile yet'
          }
          emptyDescription={
            isAr
              ? 'ارفع كشوفات البنك ومنصات التوصيل عبر الرفع الذكي أعلاه لبدء المطابقة التلقائية.'
              : 'Upload bank and delivery platform statements via Smart Ingest above to begin matching.'
          }
        />
      </SectionCard>
    </div>
  )
}
