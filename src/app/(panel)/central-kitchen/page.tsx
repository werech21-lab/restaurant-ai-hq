import { Suspense } from 'react'
import { connection } from 'next/server'
import Link from 'next/link'
import { requireUser } from '@/lib/erp-auth'
import { Forbidden, PageHeader, PageSkeleton, btnPrimary, btnGhost, cardClass } from '@/components/erp-ui'
import { getLocale, tx } from '@/lib/i18n/server'
import { can, firstAllowedHref } from '@/lib/permissions'
import { getActiveScope } from '@/lib/scope'
import { SmartIngestLaunchButton } from '@/components/SmartIngestLaunchButton'

export const metadata = { title: 'Central Kitchen | AetherBI' }
export const dynamic = 'force-dynamic'

async function CentralKitchenContent() {
  await connection()
  const locale = await getLocale()
  const user = await requireUser()
  if (!can(user, 'recipes', 'view') && !can(user, 'inventory', 'view')) {
    return <Forbidden href={firstAllowedHref(user)} />
  }
  const scope = await getActiveScope()
  const scopeLabel = locale === 'en' ? scope.labelEn : scope.labelAr

  return (
    <div>
      <PageHeader
        title={tx(locale, 'المطبخ المركزي', 'Central kitchen')}
        description={tx(
          locale,
          `${scopeLabel} · وصفات BOM، خصم المواد، والهدر التشغيلي`,
          `${scopeLabel} · BOM recipes, ingredient deduction, and operational waste`,
        )}
      />
      <div className="mb-4">
        <SmartIngestLaunchButton module="inventory" locale={locale} />
      </div>
      <div className={`${cardClass} grid gap-4 p-6 sm:grid-cols-2`}>
        <div>
          <h2 className="text-lg font-bold text-mist-100">{tx(locale, 'الوصفات وتكلفة الغذاء', 'Recipes & food cost')}</h2>
          <p className="mt-2 text-sm text-mist-400">
            {tx(
              locale,
              'إدارة الوصفات المعيارية ونسبة تكلفة الغذاء وخصم المواد عند البيع.',
              'Manage standard recipes, food-cost %, and ingredient deduction on sale.',
            )}
          </p>
          <Link href="/recipes" className={`${btnPrimary} mt-4`}>
            {tx(locale, 'فتح الوصفات', 'Open recipes')}
          </Link>
        </div>
        <div>
          <h2 className="text-lg font-bold text-mist-100">{tx(locale, 'شاشة المطبخ KDS', 'Kitchen KDS')}</h2>
          <p className="mt-2 text-sm text-mist-400">
            {tx(
              locale,
              'تذاكر التحضير الحية واتفاقيات مستوى الخدمة للفروع.',
              'Live prep tickets and SLA tracking across branches.',
            )}
          </p>
          <Link href="/kds" className={`${btnGhost} mt-4`}>
            {tx(locale, 'فتح KDS', 'Open KDS')}
          </Link>
        </div>
        <div>
          <h2 className="text-lg font-bold text-mist-100">{tx(locale, 'مخزون المطبخ (ERP)', 'Kitchen inventory (ERP)')}</h2>
          <p className="mt-2 text-sm text-mist-400">
            {tx(locale, 'شجرة التصنيع والمشتريات المتقدمة داخل منظومة ERP.', 'MRP and advanced purchasing inside the ERP suite.')}
          </p>
          <Link href="/erp/kitchen" className={`${btnGhost} mt-4`}>
            {tx(locale, 'فتح مطبخ ERP', 'Open ERP kitchen')}
          </Link>
        </div>
        <div>
          <h2 className="text-lg font-bold text-mist-100">{tx(locale, 'الجرد والهدر', 'Stock count & waste')}</h2>
          <p className="mt-2 text-sm text-mist-400">
            {tx(locale, 'جرد دوري وضبط فروقات الهدر حسب البراند والفرع.', 'Periodic counts and waste variance by brand and branch.')}
          </p>
          <Link href="/stock-count" className={`${btnGhost} mt-4`}>
            {tx(locale, 'فتح الجرد', 'Open stock count')}
          </Link>
        </div>
        <div>
          <h2 className="text-lg font-bold text-mist-100">
            {tx(locale, 'سلامة الغذاء ومصفوفة الصلاحية', 'Food safety & shelf-life matrix')}
          </h2>
          <p className="mt-2 text-sm text-mist-400">
            {tx(
              locale,
              'ساعات صلاحية HACCP لتحضيرات PP03* ومواد RW01*، عدّاد FEFO حي، وملصقات Brother DK-2205.',
              'HACCP shelf-life hours for PP03* preps and RW01* raw items, live FEFO countdown, and Brother DK-2205 labels.',
            )}
          </p>
          <Link href="/erp/food-safety" className={`${btnPrimary} mt-4`}>
            {tx(locale, 'فتح سلامة الغذاء والبرادات', 'Open Food Safety & Cold Chain')}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function CentralKitchenPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Central kitchen" />}>
      <CentralKitchenContent />
    </Suspense>
  )
}
