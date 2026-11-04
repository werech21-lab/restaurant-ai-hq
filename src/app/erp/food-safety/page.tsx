import FoodSafetyHub from '@/modules/food-safety/ui/FoodSafetyHub'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'منظومة سلامة الغذاء ومراقبة درجات التبريد والرقابة الصحية | فنتشر فودز · AetherBI',
  description: 'الرصد اللحظي لثلاجات وغرف تبريد الفروع الـ 9 والمطبخ المركزي بالقرين، سجلات الفحص اليومي لبلدية الكويت والهيئة العامة للغذاء، وصيانة معدات التبريد.',
}

export default function FoodSafetyPage() {
  return (
    <div className="w-full">
      <FoodSafetyHub />
    </div>
  )
}
