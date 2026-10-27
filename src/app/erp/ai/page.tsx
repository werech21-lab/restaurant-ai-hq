import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AiWorkspace from '@/modules/ai/ui/AiWorkspace'

export const dynamic = 'force-dynamic'

export default async function AiPage() {
  const supabase = createClient()
  if (!supabase) redirect('/login?next=/erp/ai')

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/erp/ai')

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <AiWorkspace />
    </main>
  )
}