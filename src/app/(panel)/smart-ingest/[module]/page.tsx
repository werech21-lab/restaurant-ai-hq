import { Suspense } from 'react'
import Link from 'next/link'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/erp-auth'
import { Forbidden, PageHeader, PageSkeleton } from '@/components/erp-ui'
import { SmartDepartmentFolderUpload } from '@/components/SmartDepartmentFolderUpload'
import { routeTitle } from '@/lib/aether/route-titles'
import { getLocale, tx } from '@/lib/i18n/server'
import { can, firstAllowedHref } from '@/lib/permissions'
import { isSmartIngestModule, permissionModulesFor, SMART_INGEST_META } from '@/lib/smart-ingest-modules'

export const metadata = { title: 'Smart Department Folder Upload | AetherBI' }

const EXTRA_ROUTE_LABELS: Record<string, { ar: string; en: string }> = {
  '/erp/governance': { ar: 'الحوكمة والامتثال', en: 'Governance & Compliance' },
  '/erp/compliance': { ar: 'التشريعات والتراخيص', en: 'Compliance & Licensing' },
  '/erp/sales-crm': { ar: 'المبيعات والعملاء', en: 'Sales & CRM' },
  '/erp/projects': { ar: 'المشاريع والفعاليات', en: 'Projects & Events' },
  '/stock-count': { ar: 'الجرد والهدر', en: 'Stock Count & Waste' },
  '/central-kitchen': { ar: 'المطبخ المركزي', en: 'Central Kitchen' },
  '/delivery-hub': { ar: 'منصات التوصيل', en: 'Delivery Platforms' },
}

function resolveLaunchLabel(href: string, locale: 'ar' | 'en'): string {
  const title = routeTitle(href)
  if (title) return locale === 'en' ? title.en : title.ar
  const extra = EXTRA_ROUTE_LABELS[href]
  if (extra) return locale === 'en' ? extra.en : extra.ar
  return href
}

async function Content({ moduleParam }: { moduleParam: string }) {
  await connection()
  if (!isSmartIngestModule(moduleParam)) notFound()
  const meta = SMART_INGEST_META[moduleParam]
  const locale = await getLocale()
  const user = await requireUser()
  const mods = permissionModulesFor(meta)
  if (!mods.some((m) => can(user, m, 'view')) && !user.role.isAdmin) {
    return <Forbidden href={firstAllowedHref(user)} />
  }
  if (!mods.some((m) => can(user, m, 'create') || can(user, m, 'edit')) && !user.role.isAdmin) {
    return <Forbidden href={firstAllowedHref(user)} />
  }

  return (
    <div dir={locale === 'en' ? 'ltr' : 'rtl'} className="space-y-4 min-w-0">
      <PageHeader
        title={locale === 'en' ? meta.titleEn : meta.titleAr}
        description={locale === 'en' ? meta.descEn : meta.descAr}
      />
      <div className="flex flex-wrap gap-2 text-sm">
        {meta.launchHrefs.map((href) => (
          <Link
            key={href}
            href={href}
            className="ds-focus-ring ds-surface rounded-xl px-3.5 py-2 text-xs font-semibold text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)]"
          >
            {resolveLaunchLabel(href, locale)}
          </Link>
        ))}
        <Link
          href="/hr/smart-folder-upload"
          className="ds-focus-ring rounded-xl border border-[var(--ds-border-accent)] bg-[var(--ds-accent-soft)] px-3.5 py-2 text-xs font-semibold text-[var(--ds-text-primary)] hover:brightness-95"
        >
          {tx(locale, 'رفع HR الذكي', 'HR smart upload')}
        </Link>
      </div>
      <SmartDepartmentFolderUpload module={moduleParam} locale={locale} />
    </div>
  )
}

export default async function SmartIngestModulePage({
  params,
}: {
  params: Promise<{ module: string }>
}) {
  const { module: moduleParam } = await params
  return (
    <Suspense fallback={<PageSkeleton title="Smart ingest" />}>
      <Content moduleParam={moduleParam} />
    </Suspense>
  )
}
