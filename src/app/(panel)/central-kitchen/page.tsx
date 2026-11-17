import { Suspense } from 'react'
import { connection } from 'next/server'
import Link from 'next/link'
import { requireUser } from '@/lib/erp-auth'
import { Forbidden, PageHeader, PageSkeleton } from '@/components/erp-ui'
import { getLocale, tx } from '@/lib/i18n/server'
import { can, firstAllowedHref } from '@/lib/permissions'
import { getActiveScope } from '@/lib/scope'
import { SmartIngestLaunchButton } from '@/components/SmartIngestLaunchButton'

export const metadata = { title: 'Central Kitchen | AetherBI' }
export const dynamic = 'force-dynamic'

async function CentralKitchenContent() {
  await connection()
  const locale = await getLocale()
  const uiLocale = locale === 'en' ? 'en' : 'ar'
  const user = await requireUser()
  if (!can(user, 'recipes', 'view') && !can(user, 'inventory', 'view')) {
    return <Forbidden href={firstAllowedHref(user)} />
  }
  const scope = await getActiveScope()
  const scopeLabel = locale === 'en' ? scope.labelEn : scope.labelAr

  const cards = [
    {
      title: tx(locale, 'الوصفات وتكلفة الغذاء', 'Recipes & food cost'),
      desc: tx(
        locale,
        'إدارة الوصفات المعيارية ونسبة تكلفة الغذاء وخصم المواد عند البيع.',
        'Manage standard recipes, food-cost %, and ingredient deduction on sale.',
      ),
      href: '/recipes',
      cta: tx(locale, 'فتح الوصفات', 'Open recipes'),
      primary: true,
    },
    {
      title: tx(locale, 'شاشة المطبخ KDS', 'Kitchen KDS'),
      desc: tx(
        locale,
        'تذاكر التحضير واتفاقيات مستوى الخدمة للفروع.',
        'Prep tickets and SLA tracking across branches.',
      ),
      href: '/kds',
      cta: tx(locale, 'فتح KDS', 'Open KDS'),
      primary: false,
    },
    {
      title: tx(locale, 'مخزون المطبخ (ERP)', 'Kitchen inventory (ERP)'),
      desc: tx(locale, 'شجرة التصنيع والمشتريات المتقدمة داخل منظومة ERP.', 'MRP and advanced purchasing inside the ERP suite.'),
      href: '/erp/kitchen',
      cta: tx(locale, 'فتح مطبخ ERP', 'Open ERP kitchen'),
      primary: false,
    },
    {
      title: tx(locale, 'الجرد والهدر', 'Stock count & waste'),
      desc: tx(locale, 'جرد دوري وضبط فروقات الهدر حسب البراند والفرع.', 'Periodic counts and waste variance by brand and branch.'),
      href: '/stock-count',
      cta: tx(locale, 'فتح الجرد', 'Open stock count'),
      primary: false,
    },
    {
      title: tx(locale, 'سلامة الغذاء ومصفوفة الصلاحية', 'Food safety & shelf-life matrix'),
      desc: tx(
        locale,
        'ساعات صلاحية HACCP لتحضيرات PP03* ومواد RW01*، عدّاد FEFO، وملصقات Brother DK-2205.',
        'HACCP shelf-life hours for PP03* preps and RW01* raw items, FEFO countdown, and Brother DK-2205 labels.',
      ),
      href: '/erp/food-safety',
      cta: tx(locale, 'فتح سلامة الغذاء والبرادات', 'Open Food Safety & Cold Chain'),
      primary: true,
    },
  ]

  return (
    <div dir={uiLocale === 'en' ? 'ltr' : 'rtl'} className="space-y-4">
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
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((item) => (
          <section
            key={item.href}
            className="ds-surface flex flex-col justify-between gap-4 rounded-2xl p-5 sm:p-6"
          >
            <div>
              <h2 className="ds-section-title" style={{ color: 'var(--ds-text-primary)' }}>
                {item.title}
              </h2>
              <p className="ds-caption mt-2 text-sm leading-relaxed" style={{ color: 'var(--ds-text-secondary)' }}>
                {item.desc}
              </p>
            </div>
            <div>
              <Link
                href={item.href}
                className={
                  item.primary
                    ? 'ds-motion ds-focus-ring inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-emerald-500'
                    : 'ds-surface ds-motion ds-focus-ring inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-[var(--ds-bg-hover)]'
                }
              >
                {item.cta}
              </Link>
            </div>
          </section>
        ))}
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
