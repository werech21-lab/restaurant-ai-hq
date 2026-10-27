import { redirect } from 'next/navigation'
import { deepLinkId } from '@/lib/deep-link'
import { createClient } from '@/lib/supabase/server'
import InventoryWorkspace from '@/modules/inventory/ui/InventoryWorkspace'

export const dynamic = 'force-dynamic'

export default async function InventoryPage({ searchParams }: { searchParams: { item?: string | string[] } }) {
  const supabase = createClient()
  if (!supabase) redirect('/login?next=/erp/inventory')

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/erp/inventory')

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <InventoryWorkspace initialItemId={deepLinkId(searchParams.item)} />
    </main>
  )
}
