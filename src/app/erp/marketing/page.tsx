import { readSessionPermissions, requirePageUser } from '@/lib/auth/context'
import MarketingHub from '@/modules/suite/ui/MarketingHub'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'مركز التسويق والحملات | فنتشر فودز · AetherBI',
  description: 'إدارة القنوات الرقمية والحملات التسويقية والأتمتة المتكاملة مع أودو 17.',
}

export default async function MarketingPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  await requirePageUser('/erp/marketing')
  const permissions = await readSessionPermissions()
  const query = await searchParams
  const tab = Array.isArray(query.tab) ? query.tab[0] : query.tab
  return (
    <div className="mx-auto w-full min-w-0 max-w-[1920px] overflow-visible pb-24 sm:pb-10">
      <MarketingHub permissions={permissions} initialTab={tab ?? 'website'} />
    </div>
  )
}
