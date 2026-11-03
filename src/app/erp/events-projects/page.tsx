import { requirePageUser } from '@/lib/auth/context'
import VentureEventsHub from '@/components/events/VentureEventsHub'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'إدارة المعارض والمخيمات والفعاليات | AetherBI ERP',
  description: 'منظومة إدارة المعارض والمخيمات والفعاليات - شركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
}

export default async function EventsProjectsPage() {
  await requirePageUser('/erp/events-projects')
  return (
    <main className="mx-auto w-full max-w-7xl px-2 py-4 sm:px-4 sm:py-6 lg:px-6">
      <VentureEventsHub />
    </main>
  )
}
