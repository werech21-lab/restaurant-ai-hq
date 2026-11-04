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
    id: 'executive-bi',
    titleAr: 'القيادة والذكاء التنفيذي',
    titleEn: 'Executive & BI',
    items: [
      { key: 'dashboard', href: '/dashboard', labelAr: 'لوحة القيادة التنفيذية', labelEn: 'Executive Dashboard', icon: LayoutDashboard },
      { key: 'reports', href: '/reports', labelAr: 'التقارير المؤسسية', labelEn: 'Executive Reports', icon: BarChart3 },
      { key: 'sales', href: '/sales', labelAr: 'المبيعات والقنوات', labelEn: 'Sales & Channels', icon: Receipt },
      { key: 'erp-radar', href: '/erp/aggregator-radar', labelAr: 'رادار منصات التوصيل', labelEn: 'Aggregator Radar', icon: Radar, live: true },
    ],
  },
  {
    id: 'restaurant-ops',
    titleAr: 'عمليات المطاعم والتشغيل',
    titleEn: 'Restaurant Operations',
    items: [
      { key: 'pos', href: '/pos', labelAr: 'نقطة البيع POS', labelEn: 'POS Terminal', icon: Monitor },
      { key: 'kds', href: '/kds', labelAr: 'شاشة المطبخ KDS', labelEn: 'Kitchen Display (KDS)', icon: ChefHat },
      { key: 'recipes', href: '/recipes', labelAr: 'الوصفات وتكاليف الطعام', labelEn: 'Recipes & Food Cost', icon: UtensilsCrossed },
      { key: 'food-safety', href: '/erp/food-safety', labelAr: 'سلامة الغذاء والهاسب', labelEn: 'Food Safety & HACCP', icon: ThermometerSnowflake, live: true },
    ],
  },
  {
    id: 'supply-chain',
    titleAr: 'سلاسل الإمداد والمخزون',
    titleEn: 'Supply Chain & Inventory',
    items: [
      { key: 'inventory', href: '/inventory', labelAr: 'المخزون وحركات المواد', labelEn: 'Inventory', icon: Package },
      { key: 'warehouses', href: '/warehouses', labelAr: 'الفروع والمستودعات', labelEn: 'Warehouses & Branches', icon: Warehouse },
      { key: 'purchases', href: '/purchases', labelAr: 'المشتريات والموردين', labelEn: 'Purchases & Vendors', icon: ShoppingCart },
    ],
  },
  {
    id: 'finance-hr-events',
    titleAr: 'المالية والموارد والفعاليات',
    titleEn: 'Finance, HR & Events',
    items: [
      { key: 'accounting', href: '/accounting', labelAr: 'المحاسبة والشجرة المالية', labelEn: 'Finance & Accounting', icon: Landmark },
      { key: 'hr', href: '/hr', labelAr: 'الموارد البشرية وقانون العمل', labelEn: 'HR & Kuwait Labor 6/2010', icon: IdCard },
      { key: 'events-projects', href: '/erp/events-projects', labelAr: 'المشاريع والفعاليات والمخيمات', labelEn: 'Events, Camps & Projects', icon: Store },
      { key: 'crm', href: '/crm', labelAr: 'علاقات العملاء والتموين', labelEn: 'CRM & Catering', icon: Contact },
    ],
  },
  {
    id: 'ai-governance',
    titleAr: 'الذكاء الاصطناعي والحوكمة',
    titleEn: 'AI & Governance',
    items: [
      { key: 'smart-dropzone', href: '/erp/smart-dropzone', labelAr: 'السحب الذكي للمستندات', labelEn: 'AI Smart Dropzone', icon: Sparkles, live: true },
      { key: 'erp-intelligence', href: '/erp/intelligence', labelAr: 'ذكاء القرارات التشغيلية', labelEn: 'Decision Intelligence', icon: Brain },
      { key: 'erp-governance', href: '/erp/governance', labelAr: 'الحوكمة والامتثال', labelEn: 'Governance & Compliance', icon: Scale },
      { key: 'erp-archive', href: '/erp/archive', labelAr: 'أرشيف المستندات OCR', labelEn: 'OCR Smart Archive', icon: Archive },
    ],
  },
  {
    id: 'system-access',
    titleAr: 'المنظومة وإدارة الوصول',
    titleEn: 'System & Access Control',
    items: [
      { key: 'automations', href: '/automations', labelAr: 'الأتمتة والتنبيهات', labelEn: 'Automations & Alerts', icon: Zap },
      { key: 'users', href: '/users', labelAr: 'المستخدمون وفريق العمل', labelEn: 'Users & Staff', icon: Users },
      { key: 'roles', href: '/roles', labelAr: 'الأدوار والصلاحيات', labelEn: 'Roles & Permissions', icon: Shield },
      { key: 'app-builder', href: '/app-builder', labelAr: 'مدير التطبيقات', labelEn: 'App Manager', icon: Blocks },
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
        <img src="/venture-foods-logo-dark.svg" alt="Venture Foods" className="h-10 w-auto object-contain" />
        <p className="mt-2.5 text-[11px] font-bold leading-4 text-slate-300 truncate">{companyName}</p>
        <p className="mt-0.5 text-[10px] font-semibold text-[#8cc63f]">{t('panel.tagline')}</p>
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
                          LIVE
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
