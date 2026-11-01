'use client'

import {
  Archive,
  BarChart3,
  Blocks,
  Brain,
  ClipboardList,
  Building2,
  CreditCard,
  Contact,
  IdCard,
  Landmark,
  Download,
  LineChart,
  LayoutDashboard,
  LogOut,
  ChefHat,
  Monitor,
  Package,
  Radar,
  Receipt,
  Scale,
  Shield,
  ShoppingCart,
  Truck,
  UserRound,
  Users,
  UtensilsCrossed,
  Warehouse,
  Zap,
} from 'lucide-react'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/actions/auth'
import { LanguageSwitch, useI18n, type MessageKey } from '@/lib/i18n'
import { LOCKED_MODULES, MODULES, type ModuleKey } from '@/lib/modules'
import { can, type AccessUser } from '@/lib/permissions'

const icons: Record<ModuleKey, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  users: Users,
  roles: Shield,
  inventory: Package,
  warehouses: Warehouse,
  purchases: ShoppingCart,
  sales: Receipt,
  crm: Contact,
  pos: Monitor,
  recipes: UtensilsCrossed,
  'delivery-hub': Truck,
  kds: ChefHat,
  hr: IdCard,
  accounting: Landmark,
  automations: Zap,
  'app-builder': Blocks,
  reports: BarChart3,
  audit: ClipboardList,
  saas: Building2,
  payments: CreditCard,
}

const ERP_SUITE = [
  { key: 'erp-radar', href: '/erp/aggregator-radar', labelKey: 'nav.erpRadar' as MessageKey, icon: Radar },
  { key: 'erp-intelligence', href: '/erp/intelligence', labelKey: 'nav.erpIntelligence' as MessageKey, icon: Brain },
  { key: 'erp-governance', href: '/erp/governance', labelKey: 'nav.erpGovernance' as MessageKey, icon: Scale },
  { key: 'erp-archive', href: '/erp/archive', labelKey: 'nav.erpArchive' as MessageKey, icon: Archive },
  { key: 'erp-hr', href: '/erp/hr', labelKey: 'nav.erpHr' as MessageKey, icon: IdCard },
  { key: 'erp-finance', href: '/erp/finance', labelKey: 'nav.erpFinance' as MessageKey, icon: Landmark },
  { key: 'erp-inventory', href: '/erp/inventory', labelKey: 'nav.erpInventory' as MessageKey, icon: Package },
  { key: 'erp-odoo', href: '/erp/odoo-sync', labelKey: 'nav.erpOdoo' as MessageKey, icon: Zap },
] as const

function ErpSuiteLinks({ pathname }: { pathname: string }) {
  const { t } = useI18n()
  return (
    <div className="mt-4 space-y-1 border-t border-gold-300/15 pt-4">
      <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-gold-300/80">{t('nav.erpSuite')}</p>
      {ERP_SUITE.map((item) => {
        const Icon = item.icon
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`) || pathname.startsWith(item.href)
        return (
          <a
            key={item.key}
            href={item.href}
            className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold whitespace-nowrap ${
              active
                ? 'bg-gradient-to-l from-[#8cc63f] to-[#00a99d] text-ink-950'
                : 'text-mist-300 hover:bg-ink-800 hover:text-mist-100'
            }`}
          >
            <Icon size={18} />
            {t(item.labelKey)}
          </a>
        )
      })}
    </div>
  )
}

function NavLinks({
  user,
  pathname,
  tone,
  enabledKeys,
}: {
  user: AccessUser
  pathname: string
  tone: 'dark' | 'light'
  enabledKeys: string[] | null
}) {
  const { t } = useI18n()
  const locked = new Set<string>(LOCKED_MODULES)
  const items = MODULES.filter((item) => {
    if (!can(user, item.key, 'view')) return false
    if (!enabledKeys || locked.has(item.key)) return true
    return enabledKeys.includes(item.key)
  })
  const idle =
    tone === 'dark'
      ? 'text-mist-300 hover:bg-ink-800 hover:text-mist-100'
      : 'border border-gold-300/20 bg-ink-900 text-mist-100'
  const links = [
    ...items.map((item) => ({
      key: item.key,
      label: t(item.labelKey as MessageKey),
      href: item.href,
      icon: icons[item.key],
    })),
    { key: 'profile', label: t('nav.profile'), href: '/profile', icon: UserRound },
  ]
  return (
    <>
      {links.map((item) => {
        const Icon = item.icon
        const active = pathname === item.href || (item.href !== '/profile' && pathname.startsWith(`${item.href}/`))
        return (
          <a
            key={item.key}
            href={item.href}
            className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold whitespace-nowrap ${
              active ? 'bg-gradient-to-l from-[#8cc63f] to-[#00a99d] text-ink-950' : idle
            }`}
          >
            <Icon size={18} />
            {item.label}
          </a>
        )
      })}
    </>
  )
}

export function Sidebar({ user, enabledKeys }: { user: AccessUser; enabledKeys: string[] | null }) {
  const pathname = usePathname()
  const { t, companyName } = useI18n()
  return (
    <>
      <aside className="app-sidebar fixed inset-y-0 start-0 z-30 hidden w-64 flex-col border-e border-gold-300/10 bg-ink-950 text-mist-100 md:flex">
        <div className="border-b border-gold-300/15 px-4 py-5">
          <div className="flex items-center justify-between gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/venture-foods-logo-dark.svg" alt="Venture Foods" className="h-11 w-auto object-contain" />
            <LanguageSwitch />
          </div>
          <p className="mt-3 text-[11px] font-semibold leading-4 text-mist-400">{companyName}</p>
          <p className="mt-1 text-[10px] text-[#8cc63f]">{t('panel.tagline')}</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <NavLinks user={user} pathname={pathname} tone="dark" enabledKeys={enabledKeys} />
          <a
            href="/download"
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${
              pathname === '/download'
                ? 'bg-gradient-to-l from-[#8cc63f] to-[#00a99d] text-ink-950'
                : 'text-mist-300 hover:bg-ink-800'
            }`}
          >
            <Download size={18} />
            {t('nav.download')}
          </a>
          {can(user, 'reports', 'view') ? (
            <a
              href="/bi-analytics"
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                pathname.startsWith('/bi-analytics')
                  ? 'bg-gradient-to-l from-[#8cc63f] to-[#00a99d] text-ink-950'
                  : 'text-mist-300 hover:bg-ink-800'
              }`}
            >
              <LineChart size={18} />
              {t('nav.bi')}
            </a>
          ) : null}
          {user.role.isAdmin ? <ErpSuiteLinks pathname={pathname} /> : null}
        </nav>
        <div className="border-t border-gold-300/15 p-4">
          <p className="font-semibold text-mist-100">{user.name}</p>
          <p className="text-xs text-mist-400">{user.role.name}</p>
          <p className="text-xs text-mist-500" dir="ltr">
            {user.email}
          </p>
          <form action={logout} className="mt-3">
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm font-semibold text-mist-100 hover:border-gold-300/40"
            >
              <LogOut size={16} />
              {t('nav.logout')}
            </button>
          </form>
        </div>
      </aside>
      <div className="app-mobile-nav sticky top-0 z-20 border-b border-gold-300/15 bg-ink-950 md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/venture-foods-logo-dark.svg" alt="Venture Foods" className="h-9 w-auto" />
            <LanguageSwitch />
          </div>
          <form action={logout}>
            <button type="submit" className="text-sm font-semibold text-[#8cc63f]">
              {t('nav.exit')}
            </button>
          </form>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 pb-3">
          <NavLinks user={user} pathname={pathname} tone="light" enabledKeys={enabledKeys} />
        </nav>
      </div>
    </>
  )
}
