import { Suspense } from 'react'
import Link from 'next/link'
import { connection } from 'next/server'
import { requireUser } from '@/lib/erp-auth'
import { Forbidden, PageHeader, PageSkeleton } from '@/components/erp-ui'
import { StateBlock } from '@/components/ui'
import { isExcludedOdooEntity } from '@/lib/aether/period-delta'
import { prisma } from '@/lib/db'
import { getLocale, tx } from '@/lib/i18n/server'
import { can, firstAllowedHref } from '@/lib/permissions'
import { SmartFolderUploadClient } from './upload-client'

export const metadata = { title: 'Smart HR Folder Upload | AetherBI ERP' }

async function Content() {
  await connection()
  const locale = await getLocale()
  const user = await requireUser()
  if (!can(user, 'hr', 'view')) return <Forbidden href={firstAllowedHref(user)} />
  if (!can(user, 'hr', 'create') && !can(user, 'hr', 'edit') && !user.role.isAdmin) {
    return <Forbidden href={firstAllowedHref(user)} />
  }

  let employees: Array<{ id: string; name: string; code: string; department: string }>
  try {
    const rawEmployees = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, code: true, department: true },
      orderBy: { name: 'asc' },
      take: 500,
    })
    employees = rawEmployees.filter(
      (emp) => !isExcludedOdooEntity(emp.name) && !isExcludedOdooEntity(emp.department),
    )
  } catch {
    return (
      <div dir={locale === 'en' ? 'ltr' : 'rtl'} className="space-y-4 min-w-0">
        <PageHeader
          title={tx(
            locale,
            'رفع مجلد الموظفين الذكي (توزيع تلقائي)',
            'Smart HR Folder Upload (Auto-Distribute)',
          )}
          description={tx(
            locale,
            'ارفع مجلد فنتشر فودز كاملاً — النظام يطابق الموظفين ويوزّع Excel والمستندات في الخزانة الرقمية تلقائياً.',
            'Upload a full Venture Foods folder — the system matches employees and distributes Excel/docs into each digital dossier.',
          )}
        />
        <StateBlock
          state="error"
          locale={locale}
          title={tx(locale, 'تعذّر تحميل قائمة الموظفين', 'Unable to load employee list')}
          description={tx(
            locale,
            'حدث خلل مؤقت أثناء الاتصال بقاعدة البيانات. يرجى المحاولة مجدداً.',
            'A temporary issue occurred while reading employees. Please try again.',
          )}
        />
      </div>
    )
  }

  return (
    <div dir={locale === 'en' ? 'ltr' : 'rtl'} className="space-y-4 min-w-0">
      <PageHeader
        title={tx(
          locale,
          'رفع مجلد الموظفين الذكي (توزيع تلقائي)',
          'Smart HR Folder Upload (Auto-Distribute)',
        )}
        description={tx(
          locale,
          'ارفع مجلد فنتشر فودز كاملاً — النظام يطابق الموظفين ويوزّع Excel والمستندات في الخزانة الرقمية تلقائياً.',
          'Upload a full Venture Foods folder — the system matches employees and distributes Excel/docs into each digital dossier.',
        )}
      />
      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/hr"
          className="ds-focus-ring ds-surface rounded-xl px-3.5 py-2 text-xs font-semibold text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)]"
        >
          {tx(locale, 'العودة للموارد البشرية', 'Back to HR')}
        </Link>
        <Link
          href="/hr/compliance-radar"
          className="ds-focus-ring ds-surface rounded-xl px-3.5 py-2 text-xs font-semibold text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)]"
        >
          {tx(locale, 'رادار الإقامات', 'Compliance Radar')}
        </Link>
        <Link
          href="/directory"
          className="ds-focus-ring rounded-xl border border-[var(--ds-border-accent)] bg-[var(--ds-accent-soft)] px-3.5 py-2 text-xs font-semibold text-[var(--ds-text-primary)] hover:brightness-95"
        >
          {tx(locale, 'دليل الهواتف', 'Phone directory')}
        </Link>
      </div>
      <SmartFolderUploadClient employees={employees} locale={locale} />
    </div>
  )
}

export default function SmartFolderUploadPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Smart HR Upload" />}>
      <Content />
    </Suspense>
  )
}
