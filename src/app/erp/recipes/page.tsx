import { Suspense } from 'react'
import { PageSkeleton } from '@/components/erp-ui'
import { VentureRecipesHub } from '@/components/recipes/VentureRecipesHub'

export const metadata = {
  title: 'الوصفات وهندسة تكلفة الغذاء المعيارية | فنتشر فودز · AetherBI',
  description: 'محاسبة تكاليف الوصفات وهندسة المنيو لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
}

export const dynamic = 'force-dynamic'

export default function ErpRecipesPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Recipes" />}>
      <VentureRecipesHub locale="ar" />
    </Suspense>
  )
}
