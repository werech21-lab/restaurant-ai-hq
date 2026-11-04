import VentureEventsHub from '@/components/events/VentureEventsHub'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'المعارض والفعاليات ودراسة الجدوى | شركة فنتشر فودز ذ.م.م.',
  description: 'محاكي الفعاليات، منيو المعارض، ودراسة جدوى كشتة المارينا ومخيم فندق السفير لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
}

export default function EventsProjectsPage() {
  return (
    <main className="w-full max-w-none px-2 py-4 sm:px-4 sm:py-6 lg:px-6">
      <VentureEventsHub />
    </main>
  )
}
