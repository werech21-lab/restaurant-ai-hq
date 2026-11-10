import FoodSafetyHub from '@/modules/food-safety/ui/FoodSafetyHub'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'منظومة سلامة الغذاء ومراقبة درجات التبريد والرقابة الصحية | فنتشر فودز · AetherBI',
  description: 'الرصد اللحظي لثلاجات وغرف تبريد مواقع المطاعم والمطبخ المركزي، سجلات الفحص اليومي لبلدية الكويت والهيئة العامة للغذاء، وصيانة معدات التبريد.',
}

export default function FoodSafetyPage() {
  return (
    <main className="w-full max-w-none px-4 py-6 sm:px-6" suppressHydrationWarning>
      <FoodSafetyHub />
    </main>
  )
}
