'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Archive,
  BarChart3,
  Blocks,
  Brain,
  ChefHat,
  Contact,
  IdCard,
  Landmark,
  LayoutDashboard,
  LogOut,
  Monitor,
  Package,
  Radar,
  Receipt,
  Scale,
  Shield,
  ShoppingCart,
  Sparkles,
  Store,
  ThermometerSnowflake,
  Users,
  UtensilsCrossed,
  Warehouse,
  Zap,
} from 'lucide-react'
import { logout } from '@/app/actions/auth'
import { useI18n } from '@/lib/i18n'
import type { AccessUser } from '@/lib/permissions'
import { can } from '@/lib/permissions'
import { displayRoleName, displayTeamName } from '@/lib/venture-foods-team'

interface NavItem {
  key: string
  href: string
  labelAr: string
  labelEn: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  live?: boolean
}

interface NavSection {
  id: string
  titleAr: string
  titleEn: string
  items: NavItem[]
}

const SIDEBAR_SECTIONS: NavSection[] = [
  {
    id: 'odoo-executive',
    titleAr: 'مرصد ومحلل أودو التنفيذي',
    titleEn: 'Odoo Executive Sentinel & BI',
    items: [
      { key: 'dashboard', href: '/dashboard', labelAr: 'الملخص العام (لوحة التحكم)', labelEn: 'Executive Dashboard', icon: LayoutDashboard },
      { key: 'erp-intelligence', href: '/erp/intelligence', labelAr: 'التنبيهات والملاحظات اليومية', labelEn: 'Daily Alerts & Anomalies', icon: Brain, live: true },
      { key: 'reports', href: '/reports', labelAr: 'تقارير وإحصائيات أودو', labelEn: 'Odoo Reports & Analytics', icon: BarChart3 },
      { key: 'accounting', href: '/accounting', labelAr: 'المصاريف والعهد والحسابات', labelEn: 'Expenses, Custody & Accounts', icon: Landmark },
      { key: 'erp-radar', href: '/erp/aggregator-radar', labelAr: 'متابعة تطبيقات التوصيل', labelEn: 'Delivery Aggregator Tracking', icon: Radar, live: true },
    ],
  },
  {
    id: 'odoo-operations',
    titleAr: 'تحليل عمليات ومخزون أودو',
    titleEn: 'Odoo Operations & Supply Chain',
    items: [
      { key: 'recipes', href: '/recipes', labelAr: 'تكلفة الطعام والهدر', labelEn: 'Food Cost & Waste', icon: UtensilsCrossed },
      { key: 'inventory', href: '/inventory', labelAr: 'مخزون الفروع ومطبخ القرين', labelEn: 'Branch & Central Kitchen Stock', icon: Package },
      { key: 'sales', href: '/sales', labelAr: 'مبيعات الفروع والتطبيقات', labelEn: 'Branch & Delivery Sales', icon: Receipt },
      { key: 'food-safety', href: '/erp/food-safety', labelAr: 'الثلاجات وتواريخ الصلاحية', labelEn: 'Chillers & Expiry Dates', icon: ThermometerSnowflake, live: true },
      { key: 'purchases', href: '/purchases', labelAr: 'مشتريات وموردي أودو', labelEn: 'Purchases & Vendors', icon: ShoppingCart },
      { key: 'warehouses', href: '/warehouses', labelAr: 'الفروع الـ 9 والمستودعات', labelEn: '9 Active Branches & Warehouses', icon: Warehouse },
    ],
  },
  {
    id: 'odoo-governance',
    titleAr: 'حوكمة العهد والموارد البشرية بأودو',
    titleEn: 'Odoo Governance, Custody & HR',
    items: [
      { key: 'hr', href: '/hr', labelAr: 'كروت البلدية وإقامات موظفي أودو (166)', labelEn: 'Odoo HR, PAM & Residency', icon: IdCard },
      { key: 'erp-governance', href: '/erp/governance', labelAr: 'حوكمة العهد ومكتب سند والرقابة', labelEn: 'Odoo Custody Governance', icon: Scale },
      { key: 'smart-dropzone', href: '/erp/smart-dropzone', labelAr: 'السحب والتحليل الذكي لقيود أودو', labelEn: 'Odoo AI Smart Dropzone', icon: Sparkles, live: true },
      { key: 'erp-archive', href: '/erp/archive', labelAr: 'الأرشيف الرقمي والتعرف الضوئي', labelEn: 'OCR Smart Archive', icon: Archive },
      { key: 'crm', href: '/crm', labelAr: 'علاقات العملاء والتموين', labelEn: 'CRM & Catering', icon: Contact },
    ],
  },
  {
    id: 'odoo-automation-system',
    titleAr: 'محرك القرارات والمنظومة',
    titleEn: 'AI Decision Studio & System',
    items: [
      { key: 'automations', href: '/automations', labelAr: 'نظام التنبيهات والمتابعة التلقائية', labelEn: 'Automated Alerts & Monitoring', icon: Zap },
      { key: 'users', href: '/users', labelAr: 'المستخدمون وصلاحيات أودو', labelEn: 'Users & Odoo Access', icon: Users },
      { key: 'roles', href: '/roles', labelAr: 'الأدوار والمصفوفة الرقابية', labelEn: 'Roles & Security Matrix', icon: Shield },
      { key: 'app-builder', href: '/app-builder', labelAr: 'مدير تطبيقات ونماذج أودو', labelEn: 'App & Model Studio', icon: Blocks },
      { key: 'pos', href: '/pos', labelAr: 'نقطة البيع والكاشير', labelEn: 'POS Terminal', icon: Monitor },
      { key: 'kds', href: '/kds', labelAr: 'شاشة تحضير المطبخ', labelEn: 'Kitchen Display (KDS)', icon: ChefHat },
    ],
  },
]

export function Sidebar({ user }: { user: AccessUser; enabledKeys?: string[] | null }) {
  const pathname = usePathname()
  const { t, companyName, locale } = useI18n()
  const isAr = locale === 'ar'

  return (
    <aside className="app-sidebar fixed inset-y-0 start-0 z-30 hidden w-64 shrink-0 flex-col border-e border-slate-800/80 bg-[#0a0d14] text-mist-100 md:flex">
      {/* Brand Header */}
      <div className="border-b border-slate-800/80 px-4 py-4 bg-[#07090e]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/venture-foods-logo-dark.svg" alt={isAr ? 'فنتشر فودز' : 'Venture Foods'} className="h-10 w-auto object-contain" />
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <p className="text-[12px] font-black text-white truncate">
            {isAr ? 'مرصد ومحلل أودو الذكي' : 'Odoo AI Sentinel & Analytics'}
          </p>
        </div>
        <p className="mt-0.5 text-[11px] font-bold text-slate-300 truncate">
          {isAr ? 'شركة فنتشر فودز ذ.م.م. (ترخيص 2021/22838)' : 'Venture Foods W.L.L. (Lic. 2021/22838)'}
        </p>
        <p className="mt-1 text-[10px] font-bold text-[#8cc63f] whitespace-nowrap overflow-visible leading-tight tracking-tight">
          {isAr ? '6 علامات تجارية · 9 فروع · مطبخ القرين' : '6 Brands · 9 Active Branches · Central Kitchen'}
        </p>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 py-3">
        {SIDEBAR_SECTIONS.map((section, idx) => {
          const visibleItems = section.items.filter((item) => {
            if (user.role.isAdmin) return true
            return can(user, item.key, 'view')
          })

          if (visibleItems.length === 0) return null

          return (
            <div key={section.id} className={idx > 0 ? 'border-t border-slate-800/60 pt-3' : ''}>
              <div className="px-3 pb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {isAr ? section.titleAr : section.titleEn}
                </span>
              </div>

              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon
                  const active =
                    pathname === item.href ||
                    (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`))

                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={`group flex shrink-0 items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                        active
                          ? 'bg-gradient-to-l from-[#8cc63f] to-[#00a99d] text-ink-950 shadow-sm font-bold'
                          : 'text-slate-300 hover:bg-slate-900/90 hover:text-white'
                      }`}
                    >
                      <span className="inline-flex min-w-0 items-center gap-2.5">
                        <Icon
                          size={17}
                          className={`shrink-0 transition-colors ${
                            active ? 'text-ink-950' : 'text-slate-400 group-hover:text-emerald-400'
                          }`}
                        />
                        <span className="truncate">{isAr ? item.labelAr : item.labelEn}</span>
                      </span>

                      {item.live ? (
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-black tracking-wide ${
                            active
                              ? 'bg-ink-950/20 text-ink-950'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {isAr ? 'مباشر' : 'LIVE'}
                        </span>
                      ) : null}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* User Footer */}
      <div className="border-t border-slate-800/80 bg-[#07090e] p-3">
        <div className="flex items-center gap-2.5 px-1 py-1">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#8cc63f] to-[#00a99d] text-ink-950 flex items-center justify-center font-bold text-xs shrink-0 shadow-inner">
            {user.name.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-xs text-white truncate">{displayTeamName(user.name, locale)}</p>
            <p className="text-[10px] text-slate-400 truncate">{displayRoleName(user.role.name, locale)}</p>
          </div>
        </div>
        <form action={logout} className="mt-2.5">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-700 hover:bg-slate-800 hover:text-white transition-all shadow-sm"
          >
            <LogOut size={14} />
            <span>{t('nav.logout')}</span>
          </button>
        </form>
      </div>
    </aside>
  )
}
