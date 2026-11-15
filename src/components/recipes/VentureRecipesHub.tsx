'use client'

import React, { useState } from 'react'
import { UnlinkedSourceNotice } from '@/components/erp/UnlinkedSourceNotice'

export function VentureRecipesHub({
  locale = 'ar',
  liveChildren,
}: {
  locale?: 'ar' | 'en'
  liveChildren?: React.ReactNode
}) {
  const isAr = locale === 'ar'
  const [showLocalDb, setShowLocalDb] = useState(false)

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {isAr ? 'الوصفات المعيارية وتكاليف الإنتاج (BOM)' : 'Standard Recipes & BOM Costing'}
          </h1>
        </div>
        {liveChildren ? (
          <button
            type="button"
            onClick={() => setShowLocalDb((v) => !v)}
            className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            {isAr ? 'سجلات الوصفات المحلية' : 'Local Recipe Records'}
          </button>
        ) : null}
      </div>

      {showLocalDb && liveChildren ? (
        <div>{liveChildren}</div>
      ) : (
        <UnlinkedSourceNotice
          isAr={isAr}
          titleAr="غير مربوط بمصدر — تكاليف الوصفات المعيارية (BOM)"
          titleEn="غير مربوط بمصدر — Recipe BOM Costing"
          reasonAr="قوائم المكونات المعيارية وانحرافات الهدر المعياري غير مربوطة بصلاحية قراءة من وحدة التصنيع في Odoo حالياً، وتم حذف جميع الوصفات والأوزان الافتراضية."
          reasonEn="Standard BOM recipes and theoretical yield variances are not currently linked to Odoo Manufacturing, and all static sample recipes have been purged."
          requiredSourceAr="تفعيل صلاحية قراءة mrp.bom و mrp.bom.line لحساب تكلفة كل طبق من فواتير الموردين في Odoo 17."
          requiredSourceEn="Grant read access to mrp.bom and mrp.bom.line in Odoo 17."
        />
      )}
    </div>
  )
}
