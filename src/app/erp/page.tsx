import { requirePageUser } from '@/lib/auth/context'
import ExecutiveCenter from '@/modules/ai/ui/ExecutiveCenter'

export const dynamic = 'force-dynamic'

export default async function ExecutiveCenterPage() {
  await requirePageUser('/erp')

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <ExecutiveCenter />
    </main>
  )
}