import Link from 'next/link'
import { ArrowUpRight, FileSpreadsheet, Gauge, Receipt } from 'lucide-react'
import { requirePageUser } from '@/lib/auth/context'
import { getCurrentSessionRole } from '@/lib/erp-auth'
import { getLocale } from '@/lib/i18n/server'
import { VentureAccountingHub } from '@/components/accounting/VentureAccountingHub'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'المركز المالي والمحاسبة | فنتشر فودز · AetherBI',
  description: 'مركز القيادة المالي الموحد ودفتر الأستاذ العام ومراكز التكلفة في أودو 17.',
}

export default async function FinancePage() {
  await requirePageUser('/erp/finance')
  const [locale, sessionRole] = await Promise.all([
    getLocale(),
    getCurrentSessionRole(),
  ])
  const isAr = locale !== 'en'
  const isAuditor = sessionRole === 'auditor'

  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 py-5 sm:px-6 space-y-5 min-w-0 overflow-visible">
      <div
        dir={isAr ? 'rtl' : 'ltr'}
        className="ds-surface relative overflow-visible flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-xs dark:border-emerald-500/20 dark:bg-[#0b1320]"
      >
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
          {isAr
            ? 'الوصول السريع لوحدات الإدارة المالية المتخصصة داخل منظومة إيثر:'
            : 'Quick access to specialized Financial Modules inside Aether ERP:'}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/erp/executive-pnl"
            className="ds-focus-ring inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-500/20 transition dark:text-emerald-300"
          >
            <FileSpreadsheet size={14} className="shrink-0" aria-hidden />
            <span>{isAr ? 'قائمة الدخل التنفيذية (P&L)' : 'Executive P&L'}</span>
            <ArrowUpRight size={13} className="shrink-0" aria-hidden />
          </Link>
          <Link
            href="/erp/receivables"
            className="ds-focus-ring inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-bold text-cyan-800 hover:bg-cyan-500/20 transition dark:text-cyan-300"
          >
            <Receipt size={14} className="shrink-0" aria-hidden />
            <span>{isAr ? 'الذمم المدينة المفتوحة' : 'Open receivables'}</span>
            <ArrowUpRight size={13} className="shrink-0" aria-hidden />
          </Link>
          <Link
            href="/erp/cost-intelligence"
            className="ds-focus-ring inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-500/20 transition dark:text-amber-300"
          >
            <Gauge size={14} className="shrink-0" aria-hidden />
            <span>{isAr ? 'ذكاء التكلفة وأسعار الموردين' : 'Cost & Supplier Intelligence'}</span>
            <ArrowUpRight size={13} className="shrink-0" aria-hidden />
          </Link>
        </div>
      </div>

      <VentureAccountingHub
        locale={isAr ? 'ar' : 'en'}
        isAuditor={isAuditor}
        embeddedInErp
      />
    </div>
  )
}
