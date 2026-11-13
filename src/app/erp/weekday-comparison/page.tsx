import { requirePageUser } from '@/lib/auth/context'
import { WeekdayComparisonStudio } from '@/components/erp/ops-expansion/WeekdayComparisonStudio'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Date & Sales Comparison | Venture Foods — مقارنة التواريخ والمبيعات',
  description:
    'Universal custom Date A vs Date B, Custom Range, Brand (6), and Branch (7) sales & pocket profit comparison studio backed by Odoo 17.',
}

export default async function WeekdayComparisonPage() {
  await requirePageUser('/erp/weekday-comparison')
  return (
    <div className="w-full max-w-[1920px] mx-auto min-w-0">
      <WeekdayComparisonStudio />
    </div>
  )
}
