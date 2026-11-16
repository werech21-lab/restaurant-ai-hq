'use client'

import React from 'react'
import Link from 'next/link'
import { ChefHat } from 'lucide-react'
import { SectionCard, StateBlock } from '@/components/ui'

export function VentureKdsHub({
  locale = 'ar',
}: {
  locale?: 'ar' | 'en'
}) {
  const isAr = locale !== 'en'
  const resolvedLocale = isAr ? 'ar' : 'en'

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      data-unlinked-source="true"
      className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6"
    >
      <SectionCard
        locale={resolvedLocale}
        icon={<ChefHat className="h-5 w-5" aria-hidden />}
        title={isAr ? 'شاشات المطبخ وتجهيز الطلبات (KDS)' : 'Kitchen Display System (KDS)'}
        subtitle={
          isAr
            ? 'محطات التحضير الفورية ومراقبة زمن تجهيز الطلبات في الفروع'
            : 'Real-time kitchen prep stations and ticket readiness monitoring across branches'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/erp/prep-sla"
              className="ds-motion ds-focus-ring inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-emerald-500"
            >
              {isAr ? 'شاشة زمن التحضير' : 'Open Prep SLA'}
            </Link>
            <Link
              href="/central-kitchen"
              className="ds-surface ds-motion ds-focus-ring inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-[var(--ds-bg-hover)]"
            >
              {isAr ? 'المطبخ المركزي' : 'Central Kitchen'}
            </Link>
          </div>
        }
      >
        <StateBlock
          state="unlinked"
          locale={resolvedLocale}
          title={
            isAr
              ? 'شاشة تذاكر المطبخ (KDS) غير مربوطة بمصدر حالياً'
              : 'Kitchen Display System (KDS) Not Connected'
          }
          description={
            isAr
              ? 'شاشات المطبخ وسجلات طوابع التحضير الفورية غير مربوطة بمصدر بيانات فعلي في Odoo 17 حالياً، وتم إزالة جميع التذاكر والأوقات الافتراضية. يلزم ربط شاشات المطبخ (pos_preparation_display) في Odoo 17.'
              : 'Kitchen display screens and station prep timestamps are not currently linked to Odoo 17, and all sample tickets have been removed. Connect Odoo 17 pos_preparation_display to capture order start and ready timestamps.'
          }
        />
      </SectionCard>
    </div>
  )
}
