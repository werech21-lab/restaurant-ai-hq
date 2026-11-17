'use client'

import Link from 'next/link'
import React from 'react'
import { BellRing, ShieldCheck, Workflow } from 'lucide-react'
import { PageHeader } from '@/components/erp-ui'
import { UnlinkedSourceNotice } from '@/components/erp/UnlinkedSourceNotice'
import { SectionCard } from '@/components/ui'
import type { FormatLocale } from '@/lib/format'
import { useI18n } from '@/lib/i18n'

export interface VentureAutomationHubProps {
  locale?: FormatLocale
}

function VentureAutomationHubBody({ locale }: { locale: FormatLocale }) {
  const isAr = locale !== 'en'
  const dir = isAr ? 'rtl' : 'ltr'
  const label = (ar: string, en: string) => (isAr ? ar : en)

  return (
    <div dir={dir} className="w-full max-w-none space-y-5">
      <PageHeader
        title={label('قواعد الأتمتة والتنبيهات الآلية', 'Operational Automations & Alert Rules')}
        description={label(
          'مراقبة قواعد التشغيل الآلية وتوجيه التنبيهات التنفيذية إلى مسارات الحوكمة المعتمدة في فنتشر فودز.',
          'Operational rule governance and authorized alert routing for Venture Foods.',
        )}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/erp/governance"
              className="ds-focus-ring inline-flex items-center gap-2 rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--ds-text-primary)] transition hover:border-emerald-500/45"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <span>{label('مركز الحوكمة والرقابة', 'Governance Desk')}</span>
            </Link>
            <Link
              href="/settings/notifications"
              className="ds-focus-ring inline-flex items-center gap-2 rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--ds-text-primary)] transition hover:border-emerald-500/45"
            >
              <BellRing className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <span>{label('إعدادات الإشعارات', 'Notification Settings')}</span>
            </Link>
          </div>
        }
      />

      <SectionCard
        title={label('حالة محرك الأتمتة التشغيلي', 'Automation Engine Status')}
        subtitle={label(
          'تم إيقاف القواعد التجريبية الثابتة حفاظاً على دقة التنبيهات التشغيلية والمالية.',
          'Static placeholder automation rules have been disabled to guarantee live-source accuracy.',
        )}
        icon={<Workflow className="h-4 w-4" aria-hidden />}
        locale={locale}
        headerDivider
      >
        <UnlinkedSourceNotice
          isAr={isAr}
          titleAr="غير مربوط بمصدر — محرك قواعد الأتمتة القديم"
          titleEn="Unlinked from Source — Legacy Automation Rules"
          reasonAr="تم حذف جميع قواعد التنبيه الافتراضية الثابتة من هذه الشاشة. تنبيهات تجاوز السقوف الفعلية من Odoo 17 تعمل حصرياً عبر /api/erp/governance."
          reasonEn="All static placeholder automation rules have been removed. Threshold breaches from Odoo 17 are evaluated strictly via /api/erp/governance."
          requiredSourceAr="ربط إجراءات base.automation في Odoo 17 أو استخدام قواعد /api/erp/governance."
          requiredSourceEn="Link Odoo 17 base.automation or use /api/erp/governance thresholds."
        />
      </SectionCard>
    </div>
  )
}

function VentureAutomationHubI18n() {
  const { locale } = useI18n()
  return <VentureAutomationHubBody locale={locale === 'en' ? 'en' : 'ar'} />
}

export function VentureAutomationHub({ locale }: VentureAutomationHubProps) {
  if (locale !== undefined) {
    return <VentureAutomationHubBody locale={locale} />
  }
  return <VentureAutomationHubI18n />
}
