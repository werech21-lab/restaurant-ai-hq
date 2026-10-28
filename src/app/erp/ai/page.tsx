import { requirePageUser } from '@/lib/auth/context'
import AiWorkspace from '@/modules/ai/ui/AiWorkspace'

export const dynamic = 'force-dynamic'

export default async function AiPage() {
  await requirePageUser('/erp/ai')

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <AiWorkspace />
    </main>
  )
}