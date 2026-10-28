import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AcceptInvitation from '@/components/erp/iam/AcceptInvitation'

export const dynamic = 'force-dynamic'

export default async function AcceptInvitationPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const query = await searchParams
  const supabase = await createClient()
  if (!supabase) redirect('/login?next=/erp/iam/accept')

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/erp/iam/accept')

  const raw = Array.isArray(query.token) ? query.token[0] : query.token
  const initialToken = typeof raw === 'string' && raw.length <= 80 ? raw : ''

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <AcceptInvitation initialToken={initialToken} />
    </main>
  )
}
