import { Suspense } from 'react'
import Link from 'next/link'
import { connection } from 'next/server'
import { requireUser } from '@/lib/erp-auth'
import { Forbidden, PageHeader, PageSkeleton } from '@/components/erp-ui'
import { StateBlock } from '@/components/ui'
import { isExcludedOdooEntity } from '@/lib/aether/period-delta'
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

  let rawRadar: Awaited<ReturnType<typeof buildComplianceRadar>>
  try {
    await ensureComplianceBaselines()
    rawRadar = await buildComplianceRadar()
  } catch {
    return (
      <div dir={locale === 'en' ? 'ltr' : 'rtl'} className="space-y-4 min-w-0">
        <PageHeader
          title={tx(locale, 'رادار انتهاء الإقامات والبطاقات — الامتثال الكويتي', 'Kuwait Compliance Expiry Radar')}
          description={tx(
            locale,
            'تتبع البطاقة المدنية، إذن العمل، كرت البلدية، الجواز، ورخص القيادة لطاقم فنتشر فودز — تنبيهات PAM والبلدية.',
            'Track Civil ID, work permit, municipality health card, passport, and driving licenses — PAM & Municipality alerts.',
          )}
        />
        <StateBlock
          state="error"
          locale={locale}
          title={tx(locale, 'تعذّر تحميل رادار الامتثال حالياً', 'Unable to load compliance radar right now')}
          description={tx(
            locale,
            'حدث خلل مؤقت أثناء قراءة تواريخ الوثائق. يرجى إعادة المحاولة.',
            'A temporary issue occurred while reading compliance records. Please try again.',
          )}
        />
      </div>
    )
  }

  const keepItem = <T extends { name: string; department?: string }>(item: T) =>
    !isExcludedOdooEntity(item.name) && !isExcludedOdooEntity(item.department)

  const filteredGroups = {
    expired: rawRadar.groups.expired.filter(keepItem),
    d30: rawRadar.groups.d30.filter(keepItem),
    d60: rawRadar.groups.d60.filter(keepItem),
    valid: rawRadar.groups.valid.filter(keepItem),
    missing: rawRadar.groups.missing.filter(keepItem),
    unknown: (rawRadar.groups.unknown ?? []).filter(keepItem),
  }

  const employeeIds = new Set(
    [
      ...filteredGroups.expired,
      ...filteredGroups.d30,
      ...filteredGroups.d60,
      ...filteredGroups.valid,
      ...filteredGroups.missing,
      ...filteredGroups.unknown,
    ].map((i) => i.employeeId),
  )

  const radar = {
    ...rawRadar,
    groups: filteredGroups,
    totals: {
      employees: employeeIds.size,
      expired: filteredGroups.expired.length,
      d30: filteredGroups.d30.length,
      d60: filteredGroups.d60.length,
      valid: filteredGroups.valid.length,
      missing: filteredGroups.missing.length,
      unknown: filteredGroups.unknown.length,
    },
  }

  return (
    <div dir={locale === 'en' ? 'ltr' : 'rtl'} className="space-y-4 min-w-0">
      <PageHeader
        title={tx(locale, 'رادار انتهاء الإقامات والبطاقات — الامتثال الكويتي', 'Kuwait Compliance Expiry Radar')}
        description={tx(
          locale,
          'تتبع البطاقة المدنية، إذن العمل، كرت البلدية، الجواز، ورخص القيادة لطاقم فنتشر فودز — تنبيهات PAM والبلدية.',
          'Track Civil ID, work permit, municipality health card, passport, and driving licenses — PAM & Municipality alerts.',
        )}
      />
      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/hr"
          className="ds-focus-ring ds-surface rounded-xl px-3.5 py-2 text-xs font-semibold text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)]"
        >
          {tx(locale, 'الموارد البشرية', 'HR')}
        </Link>
        <Link
          href="/hr/smart-folder-upload"
          className="ds-focus-ring rounded-xl border border-[var(--ds-border-accent)] bg-[var(--ds-accent-soft)] px-3.5 py-2 text-xs font-semibold text-[var(--ds-text-primary)] hover:brightness-95"
        >
          {tx(locale, 'رفع المجلد الذكي', 'Smart folder upload')}
        </Link>
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
