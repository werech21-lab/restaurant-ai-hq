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
      <div className="border-b border-slate-200 dark:border-slate-800/80 px-4 py-4 bg-slate-50/50 dark:bg-[#080b10]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/venture-foods-logo-dark.svg" alt={isAr ? 'فنتشر فودز' : 'Venture Foods'} className="h-10 w-auto object-contain" />
        <div className="mt-3 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"></span>
          <p className="text-[13px] font-black text-slate-900 dark:text-white leading-tight">
            {isAr ? 'نظام الإدارة المالية والتشغيلية' : 'Financial & Operations Management System'}
          </p>
        </div>

        {/* Elegant clear unclipped info badge without truncate */}
        <div className="mt-2.5 px-3 py-2.5 rounded-xl bg-[#F1F5F9] dark:bg-slate-800/80 border border-slate-300/80 dark:border-slate-700/80 text-right leading-relaxed shadow-sm">
          <p className="text-xs font-bold text-[#0F172A] dark:text-slate-100" style={{ color: '#0F172A' }}>
            {isAr ? 'شركة فنتشر فودز ذ.م.م. (ترخيص 2021/22838)' : 'Venture Foods W.L.L. (Lic. 2021/22838)'}
          </p>
          <p className="mt-1 text-xs font-bold text-[#1E3A8A] dark:text-sky-400" style={{ color: '#1E3A8A' }}>
            {isAr ? '6 علامات تجارية · 9 فروع نشطة · مطبخ القرين' : '6 Brands · 9 Active Branches · Central Kitchen'}
          </p>
        </div>
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
      <div className="border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#080b10] p-3">
        <div className="flex items-center gap-2.5 px-1 py-1">
          <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white flex items-center justify-center font-bold text-xs shrink-0 border border-slate-300 dark:border-slate-700">
            {user.name.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-xs text-slate-900 dark:text-white truncate">{displayTeamName(user.name, locale)}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{displayRoleName(user.role.name, locale)}</p>
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
