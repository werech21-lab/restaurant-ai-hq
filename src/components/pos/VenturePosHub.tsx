'use client'

import React from 'react'
import Link from 'next/link'
import { CreditCard } from 'lucide-react'
import { SectionCard, StateBlock } from '@/components/ui'

export interface VenturePosHubProps {
  locale?: 'ar' | 'en'
  liveChildren?: React.ReactNode
}

export function VenturePosHub({ locale = 'ar', liveChildren }: VenturePosHubProps) {
  const isAr = locale !== 'en'
  const resolvedLocale = isAr ? 'ar' : 'en'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <SectionCard
        locale={resolvedLocale}
        icon={<CreditCard className="h-5 w-5" aria-hidden />}
        title={isAr ? 'نقطة البيع التفاعلية (POS Terminal)' : 'Interactive POS Terminal'}
        subtitle={
          isAr
            ? 'جلسات الكاشير وإيصالات الفروع السبعة في نظام Odoo POS (دقة 3 خانات عشرية د.ك)'
            : 'Cashier sessions and 3-decimal KWD receipts across the 7 operating Odoo POS branches'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/erp"
              className="ds-motion ds-focus-ring inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-emerald-500"
            >
              {isAr ? 'ملخص المبيعات' : 'Executive Summary'}
            </Link>
            <Link
              href="/sales"
              className="ds-surface ds-motion ds-focus-ring inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-[var(--ds-bg-hover)]"
            >
              {isAr ? 'فواتير المبيعات' : 'Sales Invoices'}
            </Link>
          </div>
        }
      >
        {liveChildren ? (
          liveChildren
        ) : (
          <StateBlock
            state="unlinked"
            locale={resolvedLocale}
            title={
              isAr
                ? 'شاشة الكاشير المباشرة غير مربوطة حالياً'
                : 'POS Terminal Not Connected'
            }
            description={
              isAr
                ? 'يتم تشغيل جلسات الكاشير وإصدار الفواتير مباشرة داخل نظام Odoo POS في الفروع السبعة؛ هذه الشاشة غير مربوطة بإنشاء جلسات بيع مباشرة.'
                : 'Cashier sessions and receipt issuance run directly inside Odoo POS across the 7 operating branches; this screen is not wired for direct POS order entry.'
            }
          />
        )}
      </SectionCard>
    </div>
  )
}

export default VenturePosHub
