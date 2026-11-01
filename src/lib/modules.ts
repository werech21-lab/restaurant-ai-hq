import type { MessageKey } from '@/lib/i18n'

export const MODULES = [
  { key: 'dashboard', labelKey: 'nav.dashboard', label: 'لوحة التحكم', href: '/dashboard' },
  { key: 'users', labelKey: 'nav.users', label: 'المستخدمون', href: '/users' },
  { key: 'roles', labelKey: 'nav.roles', label: 'الأدوار والصلاحيات', href: '/roles' },
  { key: 'inventory', labelKey: 'nav.inventory', label: 'المخزون', href: '/inventory' },
  { key: 'warehouses', labelKey: 'nav.warehouses', label: 'المستودعات', href: '/warehouses' },
  { key: 'purchases', labelKey: 'nav.purchases', label: 'المشتريات', href: '/purchases' },
  { key: 'sales', labelKey: 'nav.sales', label: 'المبيعات', href: '/sales' },
  { key: 'crm', labelKey: 'nav.crm', label: 'علاقات العملاء', href: '/crm' },
  { key: 'pos', labelKey: 'nav.pos', label: 'نقطة البيع', href: '/pos' },
  { key: 'hr', labelKey: 'nav.hr', label: 'الموارد البشرية', href: '/hr' },
  { key: 'accounting', labelKey: 'nav.accounting', label: 'المحاسبة', href: '/accounting' },
  { key: 'automations', labelKey: 'nav.automations', label: 'الأتمتة', href: '/automations' },
  { key: 'app-builder', labelKey: 'nav.app-builder', label: 'مدير التطبيقات', href: '/app-builder' },
  { key: 'reports', labelKey: 'nav.reports', label: 'التقارير', href: '/reports' },
  { key: 'audit', labelKey: 'nav.audit', label: 'سجل الرقابة', href: '/audit' },
  { key: 'saas', labelKey: 'nav.saas', label: 'المنصة والاشتراكات', href: '/saas' },
  { key: 'payments', labelKey: 'nav.payments', label: 'المدفوعات الإلكترونية', href: '/payments' },
] as const satisfies ReadonlyArray<{
  key: string
  labelKey: MessageKey
  label: string
  href: string
}>

export const LOCKED_MODULES = ['dashboard', 'users', 'roles', 'app-builder'] as const

export type ModuleKey = (typeof MODULES)[number]['key']
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete'

export const MODULE_KEYS: ModuleKey[] = MODULES.map((item) => item.key)
