import type { Metadata } from 'next'
import { readSessionPermissions, requirePageUser } from '@/lib/auth/context'
import { getLocale, tx } from '@/lib/i18n/server'
import ArchiveWorkspace from '@/modules/governance/ui/ArchiveWorkspace'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return {
    title: tx(
      locale,
      'أرشيف المستندات والوثائق والتعرف الضوئي | شركة فنتشر فودز ذ.م.م.',
      'Document Archive & OCR Routing | Venture Foods W.L.L.',
    ),
    description: tx(
      locale,
      'الأرشيف الإلكتروني الذكي للوثائق والعقود والفواتير مع استخراج النصوص التلقائي لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
      'Smart electronic archive for documents, contracts, and invoices with automated routing for Venture Foods W.L.L.',
    ),
  }
}

export default async function ArchivePage() {
  await requirePageUser('/erp/archive')
  const permissions = await readSessionPermissions()
  return (
    <div className="w-full max-w-none min-w-0 px-3 py-6 sm:px-6 sm:py-8">
      <ArchiveWorkspace permissions={permissions} />
    </div>
  )
}
