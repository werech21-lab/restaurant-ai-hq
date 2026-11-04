'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Building2,
  CheckSquare,
  FileText,
  IdCard,
  Landmark,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  Shield,
  ShoppingCart,
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
}

interface NavSection {
  id: string
  titleAr: string
  titleEn: string
  items: NavItem[]
}

const SIDEBAR_SECTIONS: NavSection[] = [
  {
    id: 'management-finance',
    titleAr: 'الإدارة والمالية',
    titleEn: 'Management & Finance',
    items: [
      { key: 'dashboard', href: '/dashboard', labelAr: 'الملخص العام', labelEn: 'Overview Summary', icon: LayoutDashboard },
      { key: 'sales', href: '/sales', labelAr: 'المبيعات وتطبيقات التوصيل', labelEn: 'Sales & Delivery Channels', icon: Receipt },
      { key: 'accounting', href: '/accounting', labelAr: 'المصاريف والعهد والحسابات', labelEn: 'Expenses, Custody & Accounts', icon: Landmark },
      { key: 'reports', href: '/reports', labelAr: 'التقارير المالية', labelEn: 'Financial Reports', icon: BarChart3 },
      { key: 'sales-scorecard', href: '/erp/sales-scorecard', labelAr: 'التحليل التفصيلي للمبيعات والأصناف', labelEn: 'Sales & Items Scorecard', icon: FileText },
    ],
  },
  {
    id: 'inventory-operations',
    titleAr: 'المخزون والتشغيل',
    titleEn: 'Inventory & Operations',
    items: [
      { key: 'inventory', href: '/inventory', labelAr: 'مخزون الفروع ومطبخ القرين', labelEn: 'Branch & Central Kitchen Stock', icon: Package },
      { key: 'recipes', href: '/recipes', labelAr: 'تكلفة الأغذية والهدر', labelEn: 'Food Cost & Waste', icon: UtensilsCrossed },
      { key: 'purchases', href: '/purchases', labelAr: 'المشتريات والموردين', labelEn: 'Purchases & Vendors', icon: ShoppingCart },
      { key: 'warehouses', href: '/warehouses', labelAr: 'الفروع والمستودعات', labelEn: 'Branches & Warehouses', icon: Warehouse },
    ],
  },
  {
    id: 'monitoring-audit',
    titleAr: 'الرقابة والمتابعة',
    titleEn: 'Monitoring & Control',
    items: [
      { key: 'food-safety', href: '/erp/food-safety', labelAr: 'الثلاجات وتواريخ الصلاحية', labelEn: 'Chillers & Expiry Dates', icon: ThermometerSnowflake },
      { key: 'automations', href: '/automations', labelAr: 'التنبيهات التلقائية', labelEn: 'Automated Notifications', icon: Zap },
      { key: 'erp-radar', href: '/erp/aggregator-radar', labelAr: 'متابعة تطبيقات التوصيل', labelEn: 'Delivery Aggregator Control', icon: Store },
    ],
  },
  {
    id: 'people',
    titleAr: 'شؤون الموظفين',
    titleEn: 'Human Resources',
    items: [
      { key: 'hr', href: '/hr', labelAr: 'الإقامات وكروت البلدية', labelEn: 'Residencies & Health Cards', icon: IdCard },
    ],
  },
  {
    id: 'administration',
    titleAr: 'إدارة النظام',
    titleEn: 'System Administration',
    items: [
      { key: 'users', href: '/users', labelAr: 'المستخدمون والصلاحيات', labelEn: 'Users & Permissions', icon: Users },
      { key: 'roles', href: '/roles', labelAr: 'الأدوار والمصفوفة الرقابية', labelEn: 'Roles & Audit Matrix', icon: Shield },
    ],
  },
]

export function Sidebar({ user }: { user: AccessUser; enabledKeys?: string[] | null }) {
  const pathname = usePathname()
  const { t, locale } = useI18n()
  const isAr = locale === 'ar'

  return (
    <aside className="app-sidebar fixed inset-y-0 start-0 z-30 hidden w-64 shrink-0 flex-col border-e border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1017] text-slate-800 dark:text-slate-200 md:flex">
      {/* Brand Header */}
      <div className="shrink-0 border-b border-slate-200 dark:border-slate-800/80 px-4 pt-5 pb-4 bg-slate-50/50 dark:bg-[#080b10]">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0B1D42] text-base font-black tracking-wide"
            style={{ color: '#FFFFFF' }}
            aria-hidden
          >
            VF
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black leading-tight text-slate-900 dark:text-white">{isAr ? 'فنتشر فودز' : 'Venture Foods'}</p>
            <p className="text-[11px] font-semibold leading-tight text-slate-500 dark:text-slate-400" dir="ltr">
              Venture Foods W.L.L.
            </p>
          </div>
        </div>

        <p className="mt-3 flex items-center text-[13px] font-black leading-snug text-slate-900 dark:text-white">
          <span className="mr-1 ml-2 inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500"></span>
          <span>{isAr ? 'نظام الإدارة المالية والتشغيلية' : 'Financial & Operations Management System'}</span>
        </p>

        {/* Company info: three independent centred lines, nothing truncated */}
        <div
          dir={isAr ? 'rtl' : 'ltr'}
          className="mt-2.5 space-y-1.5 rounded-xl border border-slate-300/80 bg-[#F1F5F9] px-4 py-3 text-center leading-relaxed shadow-sm dark:border-slate-700/80 dark:bg-slate-800/80"
        >
          <p className="text-xs font-bold text-[#0F172A] dark:text-slate-100" style={{ color: '#0F172A' }}>
            {isAr ? 'شركة فنتشر فودز لإدارة المطاعم ذ.م.م.' : 'Venture Foods Restaurant Management W.L.L.'}
          </p>
          <p>
            <span className="inline-block whitespace-nowrap rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-xs font-bold text-[#0F172A]" style={{ color: '#0F172A' }}>
              {isAr ? 'ترخيص رقم: ' : 'Licence No: '}
              <span dir="ltr" className="inline-block tabular-nums">2021/22838</span>
            </span>
          </p>
          <p className="text-xs font-bold text-[#1E3A8A] dark:text-sky-400" style={{ color: '#1E3A8A' }}>
            {isAr ? '6 علامات تجارية · 9 فروع · مطبخ القرين' : '6 Brands · 9 Branches · Central Kitchen'}
          </p>
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2.5 py-3 pb-28">
        {SIDEBAR_SECTIONS.map((section, idx) => {
          const visibleItems = section.items.filter((item) => {
            if (user.role.isAdmin) return true
            return can(user, item.key, 'view')
          })

          if (visibleItems.length === 0) return null

          return (
            <div key={section.id} className={idx > 0 ? 'border-t border-slate-200 dark:border-slate-800/60 pt-3' : ''}>
              <div className="px-3 pb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
                          ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-black shadow-sm font-bold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/80 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span className="inline-flex min-w-0 items-center gap-2.5">
                        <Icon
                          size={16}
                          className={`shrink-0 transition-colors ${
                            active
                              ? 'text-white dark:text-black'
                              : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white'
                          }`}
                        />
                        <span className="truncate">{isAr ? item.labelAr : item.labelEn}</span>
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* User Footer */}
      <div className="shrink-0 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#080b10] px-4 py-3">
        <div className="flex items-center gap-2.5 py-1">
          <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white flex items-center justify-center font-bold text-xs shrink-0 border border-slate-300 dark:border-slate-700">
            {user.name.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-xs leading-snug text-slate-900 dark:text-white break-words">{displayTeamName(user.name, locale)}</p>
            <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400 break-words">{displayRoleName(user.role.name, locale)}</p>
          </div>
        </div>
        <form action={logout} className="mt-2">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
          >
            <LogOut size={13} />
            <span>{t('nav.logout')}</span>
          </button>
        </form>
      </div>
    </aside>
  )
}
