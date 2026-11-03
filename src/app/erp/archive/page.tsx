import { panelBridgePermissionSet } from '@/lib/auth/panel-bridge'
import ArchiveWorkspace from '@/modules/governance/ui/ArchiveWorkspace'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'أرشيف المستندات والتعرف الضوئي OCR | فنتشر فودز · AetherBI',
  description: 'الأرشيف الإلكتروني الذكي للوثائق والعقود والفواتير مع استخراج النصوص التلقائي لشركة فنتشر فودز.',
}

export default function ArchivePage() {
  const permissions = [...panelBridgePermissionSet()].sort()
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <ArchiveWorkspace permissions={permissions} />
    </main>
  )
}
