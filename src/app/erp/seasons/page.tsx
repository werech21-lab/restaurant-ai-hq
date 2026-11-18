import { requirePageUser } from '@/lib/auth/context'
import { SeasonsStudio } from '@/components/erp/SeasonsStudio'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'المواسم والمناسبات | فنتشر فودز',
  description: 'تقويم المواسم القابل للتعديل من المالك، مع مقارنة السنة الماضية من Odoo وخطة تحضير قبل كل موسم.',
}

export default async function SeasonsPage() {
  await requirePageUser('/erp/seasons')
  return (
    <div className="w-full max-w-[1920px] mx-auto min-w-0">
      <SeasonsStudio />
    </div>
  )
}
