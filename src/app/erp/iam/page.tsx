import { readSessionPermissions, requirePageUser } from '@/lib/auth/context'
import IamWorkspace from '@/components/erp/iam/IamWorkspace'

export const dynamic = 'force-dynamic'

export default async function IamPage() {
  const userId = await requirePageUser('/erp/iam')

  // Used only to hide what this user cannot do. The API and the database still enforce every permission.
  const permissions = await readSessionPermissions()

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <IamWorkspace permissions={permissions} userId={userId} />
    </main>
  )
}
