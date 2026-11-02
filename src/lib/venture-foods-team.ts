/**
 * Official Venture Foods management team accounts for /users and login demos.
 * Names are bilingual; DB stores the English canonical name.
 */

export type VfTeamMember = {
  key: string
  nameEn: string
  nameAr: string
  emails: string[]
  roleEn: string
  roleAr: string
  roleDescriptionEn: string
  roleDescriptionAr: string
  isAdmin: boolean
  /** Modules with write access; empty + isAdmin = full. */
  writeModules: string[]
  viewOnlyModules?: string[]
  /** Default demo password (panel SQLite). Official Aether admin keeps its own. */
  password?: string
}

export const VF_TEAM: VfTeamMember[] = [
  {
    key: 'ahmed',
    nameEn: 'Ahmed Al-Ebrahim (CEO)',
    nameAr: 'أحمد الإبراهيم (الرئيس التنفيذي)',
    emails: ['ahmed@venturefoodskw.com', 'admin@aetherbi.com', 'admin@erp.com'],
    roleEn: 'System Administrator',
    roleAr: 'مدير النظام',
    roleDescriptionEn: 'CEO / full system administrator',
    roleDescriptionAr: 'الرئيس التنفيذي ومدير النظام بصلاحيات كاملة',
    isAdmin: true,
    writeModules: [],
    password: '123456',
  },
  {
    key: 'choukrallah',
    nameEn: 'Choukrallah Nassif',
    nameAr: 'شكرالله ناصيف',
    emails: ['operations@venturefoodskw.com'],
    roleEn: 'Operations Manager',
    roleAr: 'مدير العمليات',
    roleDescriptionEn: 'Restaurant operations across brands and branches',
    roleDescriptionAr: 'عمليات المطاعم عبر البراندات والفروع',
    isAdmin: false,
    writeModules: ['inventory', 'warehouses', 'purchases', 'hr', 'delivery-hub', 'kds', 'recipes'],
    viewOnlyModules: ['dashboard', 'reports', 'audit', 'crm', 'sales'],
    password: '123456',
  },
  {
    key: 'abdullah',
    nameEn: 'Abdullah Abdulghafar Awirah',
    nameAr: 'عبدالله عبدالغفار عويرة',
    emails: ['Sec@venturefoodskw.com'],
    roleEn: 'Executive Secretary',
    roleAr: 'السكرتير التنفيذي',
    roleDescriptionEn: 'Executive office coordination and follow-ups',
    roleDescriptionAr: 'تنسيق مكتب الإدارة والمتابعات',
    isAdmin: false,
    writeModules: ['crm', 'reports'],
    viewOnlyModules: ['dashboard', 'hr', 'audit', 'sales'],
    password: '123456',
  },
  {
    key: 'mohamed',
    nameEn: 'Mohamed Al Saeed',
    nameAr: 'محمد السعيد',
    emails: ['mohameda@venturefoodskw.com'],
    roleEn: 'Financial Manager',
    roleAr: 'المدير المالي',
    roleDescriptionEn: 'Finance, accounting, and payables oversight',
    roleDescriptionAr: 'الإشراف على المالية والمحاسبة والمستحقات',
    isAdmin: false,
    writeModules: ['purchases', 'sales', 'accounting', 'payments'],
    viewOnlyModules: ['dashboard', 'reports', 'audit', 'crm', 'hr'],
    password: '123456',
  },
  {
    key: 'samy',
    nameEn: 'Samy Sabry',
    nameAr: 'سامي صبري',
    emails: ['samys@venturefoodskw.com'],
    roleEn: 'Senior Accountant',
    roleAr: 'محاسب أول',
    roleDescriptionEn: 'Day-to-day accounting and invoice control',
    roleDescriptionAr: 'المحاسبة اليومية ومراقبة الفواتير',
    isAdmin: false,
    writeModules: ['purchases', 'sales', 'accounting'],
    viewOnlyModules: ['dashboard', 'reports', 'audit', 'crm', 'payments'],
    password: '123456',
  },
  {
    key: 'munir',
    nameEn: 'Munir Ahmed',
    nameAr: 'منير أحمد',
    emails: ['warehouse@venturefoodskw.com'],
    roleEn: 'Warehouse Manager',
    roleAr: 'مدير المستودع',
    roleDescriptionEn: 'Central warehouse stock and transfers',
    roleDescriptionAr: 'مخزون المستودع المركزي والتحويلات',
    isAdmin: false,
    writeModules: ['inventory', 'warehouses'],
    viewOnlyModules: ['dashboard', 'purchases', 'reports'],
    password: '123456',
  },
  {
    key: 'abdulrahman',
    nameEn: 'Abdulrahman Mohamed',
    nameAr: 'عبدالرحمن محمد',
    emails: ['abdelrahmanm@venturefoodskw.com'],
    roleEn: 'Marketing Coordinator',
    roleAr: 'منسق التسويق',
    roleDescriptionEn: 'Marketing coordination and customer outreach',
    roleDescriptionAr: 'تنسيق التسويق وتواصل العملاء',
    isAdmin: false,
    writeModules: ['crm', 'sales'],
    viewOnlyModules: ['dashboard', 'reports', 'pos'],
    password: '123456',
  },
  {
    key: 'sheyam',
    nameEn: 'Sheyam Hekmat',
    nameAr: 'شيام حكمت',
    emails: ['sheyamh@venturefoodskw.com'],
    roleEn: 'HR & Admin Manager',
    roleAr: 'مدير الموارد البشرية والإدارية',
    roleDescriptionEn: 'HR, payroll, and administrative control',
    roleDescriptionAr: 'الموارد البشرية والرواتب والشؤون الإدارية',
    isAdmin: false,
    writeModules: ['hr'],
    viewOnlyModules: ['dashboard', 'reports', 'audit'],
    password: '123456',
  },
]

/** Official AetherBI break-glass account (same person as Ahmed / CEO). */
export const AETHER_ADMIN_PASSWORD = 'AetherAdmin#2026!'

const OLD_DEMO_EMAILS = new Set([
  'accountant@erp.com',
  'store@erp.com',
  'sales@erp.com',
])

export function isLegacyDemoEmail(email: string) {
  return OLD_DEMO_EMAILS.has(email.trim().toLowerCase())
}

export function findTeamMemberByEmail(email: string): VfTeamMember | undefined {
  const needle = email.trim().toLowerCase()
  return VF_TEAM.find((member) => member.emails.some((e) => e.toLowerCase() === needle))
}

export function displayTeamName(nameOrEmail: string, locale: 'ar' | 'en') {
  const byEmail = findTeamMemberByEmail(nameOrEmail)
  if (byEmail) return locale === 'en' ? byEmail.nameEn : byEmail.nameAr
  const byName = VF_TEAM.find(
    (m) =>
      m.nameEn === nameOrEmail ||
      m.nameAr === nameOrEmail ||
      nameOrEmail.includes(m.nameEn.split(' (')[0]) ||
      m.nameEn.startsWith(nameOrEmail) ||
      m.nameAr.startsWith(nameOrEmail),
  )
  if (byName) return locale === 'en' ? byName.nameEn : byName.nameAr
  return nameOrEmail
}

export function displayRoleName(roleName: string, locale: 'ar' | 'en') {
  const hit = VF_TEAM.find((m) => m.roleEn === roleName || m.roleAr === roleName)
  if (hit) return locale === 'en' ? hit.roleEn : hit.roleAr
  const legacy: Record<string, { ar: string; en: string }> = {
    'مدير النظام': { ar: 'مدير النظام', en: 'System Administrator' },
    SUPER_ADMIN: { ar: 'مدير النظام', en: 'System Administrator' },
    محاسب: { ar: 'محاسب', en: 'Accountant' },
    'أمين مخزن': { ar: 'أمين مخزن', en: 'Storekeeper' },
    'مندوب مبيعات': { ar: 'مندوب مبيعات', en: 'Sales Representative' },
    'System Administrator': { ar: 'مدير النظام', en: 'System Administrator' },
    Accountant: { ar: 'محاسب', en: 'Accountant' },
    Storekeeper: { ar: 'أمين مخزن', en: 'Storekeeper' },
    'Sales Representative': { ar: 'مندوب مبيعات', en: 'Sales Representative' },
  }
  const mapped = legacy[roleName]
  if (mapped) return locale === 'en' ? mapped.en : mapped.ar
  return roleName
}
