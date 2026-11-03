import VentureEventsHub from '@/components/events/VentureEventsHub'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'إدارة الفعاليات والمعارض والمشاريع الخاصة | Venture Foods W.L.L. · AetherBI',
  description: 'محاكي الفعاليات، منيو المعارض، ودراسة جدوى كشتة المارينا ومخيم فندق السفير لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
}

export default function EventsProjectsPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-2 py-4 sm:px-4 sm:py-6 lg:px-6">
      <VentureEventsHub />
    </main>
  )
}
