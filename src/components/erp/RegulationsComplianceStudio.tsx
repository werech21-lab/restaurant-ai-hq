'use client'

import React from 'react'
import { Building2, Flame, ShieldCheck, Users } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { type FormatLocale } from '@/lib/format'
import { KpiCard } from '@/components/ui/kpi-card'
import { UnlinkedSourceNotice } from '@/components/erp/UnlinkedSourceNotice'

export interface RegulationsComplianceStudioProps {
  locale?: FormatLocale
}

const AUTHORITIES = [
  {
    key: 'municipality',
    ar: 'بلدية الكويت — التراخيص التجارية والصحية',
    en: 'Kuwait Municipality — Commercial & Health Permits',
    icon: Building2,
  },
  {
    key: 'pafn',
    ar: 'الهيئة العامة للغذاء والتغذية (PAFN)',
    en: 'Public Authority for Food & Nutrition (PAFN)',
    icon: ShieldCheck,
  },
  {
    key: 'manpower',
    ar: 'الهيئة العامة للقوى العاملة',
    en: 'Public Authority for Manpower (PAM)',
    icon: Users,
  },
  {
    key: 'fire',
    ar: 'قوة الإطفاء العام — تراخيص السلامة',
    en: 'Kuwait Fire Force — Safety Clearances',
    icon: Flame,
  },
] as const

function RegulationsComplianceStudioBody({ locale }: { locale: FormatLocale }) {
  const isAr = locale !== 'en'
  const dir = isAr ? 'rtl' : 'ltr'

  return (
    <div
      dir={dir}
      className="mx-auto w-full max-w-[1920px] min-w-0 space-y-5 p-3.5 sm:p-5"
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {AUTHORITIES.map(({ key, ar, en, icon: Icon }) => (
          <KpiCard
            key={key}
            label={isAr ? ar : en}
            value={null}
            locale={locale}
            icon={<Icon className="h-4 w-4" aria-hidden />}
            subtitle={isAr ? 'سجل التراخيص غير مربوط' : 'Permit registry unlinked'}
          />
        ))}
      </div>

      <UnlinkedSourceNotice
        isAr={isAr}
        titleAr="سجل التراخيص والامتثال الرقابي"
        titleEn="Regulatory Licenses & Municipal Compliance Registry"
        reasonAr="سجلات تراخيص البلدية وهيئة الغذاء والقوى العاملة والإطفاء العام غير مربوطة بقاعدة بيانات الوثائق الحكومية أو سجلات أودو حالياً، لذا تم إخفاء كافة النسب والبنود الافتراضية."
        reasonEn="Municipality, PAFN, Manpower, and Fire Force permit registries are not linked to an active document or Odoo compliance table. All synthetic readiness scores have been removed."
        requiredSourceAr="مستندات أودو / سجل تراخيص البلدية وهيئة الغذاء"
        requiredSourceEn="Odoo Documents / Municipal & PAFN License Registry"
      />
    </div>
  )
}

function RegulationsComplianceStudioI18n() {
  const { locale } = useI18n()
  return <RegulationsComplianceStudioBody locale={locale === 'en' ? 'en' : 'ar'} />
}

export function RegulationsComplianceStudio({
  locale: explicitLocale,
}: RegulationsComplianceStudioProps) {
  if (explicitLocale !== undefined) {
    return <RegulationsComplianceStudioBody locale={explicitLocale} />
  }
  return <RegulationsComplianceStudioI18n />
}

export default RegulationsComplianceStudio
