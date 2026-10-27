import { redirect } from 'next/navigation'
import { deepLinkId } from '@/lib/deep-link'
import { createClient } from '@/lib/supabase/server'
import CrmWorkspace from '@/modules/crm/ui/CrmWorkspace'

export const dynamic = 'force-dynamic'

export default async function CrmPage({ searchParams }: { searchParams: Promise<{ customer?: string | string[] }> }) {
  const query = await searchParams
  const supabase = await createClient()
  if (!supabase) redirect('/login?next=/erp/crm')

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/erp/crm')

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <CrmWorkspace initialCustomerId={deepLinkId(query.customer)} />
    </main>
  )
}
