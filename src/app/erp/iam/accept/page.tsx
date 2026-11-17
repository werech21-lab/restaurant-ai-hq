import { requirePageUser } from '@/lib/auth/context'
import AcceptInvitation from '@/components/erp/iam/AcceptInvitation'

export const dynamic = 'force-dynamic'

export default async function AcceptInvitationPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const query = await searchParams
  await requirePageUser('/erp/iam/accept')

  const raw = Array.isArray(query.token) ? query.token[0] : query.token
  const initialToken = typeof raw === 'string' && raw.length <= 80 ? raw : ''

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
      <AcceptInvitation initialToken={initialToken} />
    </div>
  )
}
