import { requirePageUser } from '@/lib/auth/context'
import AiWorkspace from '@/modules/ai/ui/AiWorkspace'

export const dynamic = 'force-dynamic'

export default async function AiPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  await requirePageUser('/erp/ai')
  const query = await searchParams
  const tab = Array.isArray(query.tab) ? query.tab[0] : query.tab

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <AiWorkspace initialTab={tab} />
    </main>
  )
}