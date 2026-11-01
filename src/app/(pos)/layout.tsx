import { connection } from 'next/server'
import { ScopeProvider } from '@/components/ScopeProvider'
import { getActiveScope } from '@/lib/scope'

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  await connection()
  const scope = await getActiveScope()
  return (
    <ScopeProvider
      initial={{
        brandId: scope.brandId,
        branchId: scope.branchId,
        labelAr: scope.labelAr,
        labelEn: scope.labelEn,
      }}
    >
      <div className="min-h-screen bg-[#0a0a0a] text-mist-100">{children}</div>
    </ScopeProvider>
  )
}
