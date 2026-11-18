import { requirePageUser } from '@/lib/auth/context'
import { DecisionRoomStudio, type DecisionRoomTab } from '@/components/aether/DecisionRoomStudio'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'غرفة القرار | فنتشر فودز',
  description: 'مقترحات مجلس المستشارين من بيانات Odoo مع الدليل والأثر التقديري، والقرار وقياس نتيجته.',
}

const TABS: readonly DecisionRoomTab[] = ['all', 'drivers', 'menu', 'benchmark', 'forecast', 'log']

export default async function DecisionRoomPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageUser('/erp/decisions')
  const raw = (await searchParams).tab
  const tab = typeof raw === 'string' && (TABS as readonly string[]).includes(raw) ? (raw as DecisionRoomTab) : 'all'
  return (
    <div className="w-full max-w-[1920px] mx-auto min-w-0">
      <DecisionRoomStudio initialTab={tab} />
    </div>
  )
}
