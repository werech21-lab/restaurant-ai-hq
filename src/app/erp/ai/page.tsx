import { requirePageUser } from '@/lib/auth/context'
import AiWorkspace from '@/modules/ai/ui/AiWorkspace'

export const dynamic = 'force-dynamic'

export default async function AiPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  await requirePageUser('/erp/ai')
  const query = await searchParams
  const tab = Array.isArray(query.tab) ? query.tab[0] : query.tab

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
      <AiWorkspace initialTab={tab} />
    </div>
  )
}