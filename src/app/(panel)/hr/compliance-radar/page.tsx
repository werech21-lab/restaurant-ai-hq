import { Suspense } from 'react'
import { connection } from 'next/server'
import { requireUser } from '@/lib/erp-auth'
import { Forbidden, PageHeader, PageSkeleton } from '@/components/erp-ui'
import { getLocale, tx } from '@/lib/i18n/server'
import { can, firstAllowedHref } from '@/lib/permissions'
import { buildComplianceRadar, ensureComplianceBaselines } from '@/services/hr-compliance.service'
import { ComplianceRadarClient } from './radar-client'

export const metadata = { title: 'Kuwait Compliance Expiry Radar | AetherBI HR' }

async function Content() {
  await connection()
  const locale = await getLocale()
  const user = await requireUser()
  if (!can(user, 'hr', 'view')) return <Forbidden href={firstAllowedHref(user)} />
  await ensureComplianceBaselines()
  const radar = await buildComplianceRadar()

  return (
    <div className="space-y-4">
      <PageHeader
        title={tx(locale, 'رادار انتهاء الإقامات والبطاقات (Kuwait Compliance)', 'Kuwait Compliance Expiry Radar')}
        description={tx(
          locale,
          'تتبع البطاقة المدنية، إذن العمل، كرت البلدية، الجواز، ورخص القيادة لطاقم فنتشر فودز — تنبيهات PAM والبلدية.',
          'Track Civil ID, work permit, municipality health card, passport, and driving licenses — PAM & Municipality alerts.',
        )}
      />
      <div className="flex flex-wrap gap-2 text-sm">
        <a href="/hr" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold">
          {tx(locale, 'الموارد البشرية', 'HR')}
        </a>
        <a href="/hr/smart-folder-upload" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-800">
          {tx(locale, 'رفع المجلد الذكي', 'Smart folder upload')}
        </a>
      </div>
      <ComplianceRadarClient initial={radar} locale={locale} />
    </div>
  )
}

export default function ComplianceRadarPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Compliance Radar" />}>
      <Content />
    </Suspense>
  )
}
