import FoodSafetyHub from '@/modules/food-safety/ui/FoodSafetyHub'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'سلامة الغذاء ومراقبة درجات حرارة البرادات والـ HACCP | فنتشر فودز · AetherBI',
  description: 'نظام إدارة سلامة الغذاء والصلاحيات ومطابقة بلدية الكويت والهيئة العامة للغذاء والتغذية لشركة فنتشر فودز.',
}

export default function FoodSafetyPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <FoodSafetyHub />
    </main>
  )
}
