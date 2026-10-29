import { readSessionPermissions, requirePageUser } from '@/lib/auth/context'
import ArchiveWorkspace from '@/modules/governance/ui/ArchiveWorkspace'

export const dynamic = 'force-dynamic'

export default async function ArchivePage() {
  await requirePageUser('/erp/archive')
  const permissions = await readSessionPermissions()
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <ArchiveWorkspace permissions={permissions} />
    </main>
  )
}
