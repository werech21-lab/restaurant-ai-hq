import { requirePageUser } from '@/lib/auth/context'
import { WeekdayComparisonStudio } from '@/components/erp/ops-expansion/WeekdayComparisonStudio'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'مقارنة مبيعات أيام الأسبوع المتناظرة | فنتشر فودز',
  description:
    'مقارنة المبيعات بين أيام الأسبوع المتناظرة مثل الأربعاء هذا الأسبوع مقارنة مع الأربعاء الأسبوع الماضي مع منحنى الساعات ومتوسط 4 أسابيع.',
}

export default async function WeekdayComparisonPage() {
  await requirePageUser('/erp/weekday-comparison')
  return (
    <div className="w-full">
      <WeekdayComparisonStudio />
    </div>
  )
}
