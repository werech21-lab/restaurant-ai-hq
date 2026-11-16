'use client'

import React, { useState } from 'react'
import { Utensils } from 'lucide-react'
import { SectionCard, StateBlock } from '@/components/ui'

export function VentureRecipesHub({
  locale = 'ar',
  liveChildren,
}: {
  locale?: 'ar' | 'en'
  liveChildren?: React.ReactNode
}) {
  const isAr = locale !== 'en'
  const resolvedLocale = isAr ? 'ar' : 'en'
  const [showLocalDb, setShowLocalDb] = useState(false)

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <SectionCard
        locale={resolvedLocale}
        icon={<Utensils className="h-5 w-5" aria-hidden />}
        title={isAr ? 'الوصفات المعيارية وتكاليف الإنتاج (BOM)' : 'Standard Recipes & BOM Costing'}
        subtitle={
          isAr
            ? 'بطاقات الوصفات ونسبة تكلفة الغذاء المستهدفة'
            : 'Recipe BOM cards and target food-cost percentages'
        }
        actions={
          liveChildren ? (
            <button
              type="button"
              aria-pressed={showLocalDb}
              onClick={() => setShowLocalDb((v) => !v)}
              className="ds-surface ds-motion ds-focus-ring inline-flex min-h-10 items-center rounded-xl px-4 py-2 text-xs font-bold hover:bg-[var(--ds-bg-hover)]"
            >
              {isAr ? 'سجلات الوصفات المحلية' : 'Local Recipe Records'}
            </button>
          ) : null
        }
      >
        {showLocalDb && liveChildren ? (
          <div>{liveChildren}</div>
        ) : (
          <StateBlock
            state="unlinked"
            locale={resolvedLocale}
            title={
              isAr
                ? 'تكاليف الوصفات المعيارية (BOM) غير مربوطة بمصدر'
                : 'Recipe BOM Costing Not Connected'
            }
            description={
              isAr
                ? 'قوائم المكونات المعيارية وانحرافات الهدر المعياري غير مربوطة بصلاحية قراءة من وحدة التصنيع في Odoo حالياً، وتم حذف جميع الوصفات والأوزان الافتراضية.'
                : 'Standard BOM recipes and theoretical yield variances are not currently linked to Odoo Manufacturing (mrp.bom / mrp.bom.line), and all static sample recipes have been purged.'
            }
          />
        )}
      </SectionCard>
    </div>
  )
}
