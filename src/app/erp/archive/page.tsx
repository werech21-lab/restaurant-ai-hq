import { panelBridgePermissionSet } from '@/lib/auth/panel-bridge'
import ArchiveWorkspace from '@/modules/governance/ui/ArchiveWorkspace'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'أرشيف المستندات والوثائق والتعرف الضوئي | شركة فنتشر فودز ذ.م.م.',
  description: 'الأرشيف الإلكتروني الذكي للوثائق والعقود والفواتير مع استخراج النصوص التلقائي لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
}

export default function ArchivePage() {
  const permissions = [...panelBridgePermissionSet()].sort()
  return (
    <main className="w-full max-w-none px-4 py-8 sm:px-6">
      <ArchiveWorkspace permissions={permissions} />
    </main>
  )
}
