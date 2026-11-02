import { requirePageUser } from '@/lib/auth/context'
import SmartDropzonePortal from '@/modules/smart-dropzone/ui/SmartDropzonePortal'

export const dynamic = 'force-dynamic'

export default async function SmartDropzonePage() {
  await requirePageUser('/erp/smart-dropzone')
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6" style={{ background: '#0a0d12' }} suppressHydrationWarning>
      <SmartDropzonePortal />
    </main>
  )
}
