/** Client-safe department catalog for the Smart Dropzone UI (no Node imports). */

export const SMART_DROPZONE_DEPARTMENTS = [
  'hr',
  'accounting',
  'purchases',
  'inventory_recipes',
  'sales_aggregators',
  'governance',
  'crm_catering',
] as const

export type SmartDropzoneDepartment = (typeof SMART_DROPZONE_DEPARTMENTS)[number]

export const SMART_DROPZONE_DEPT_CARDS: Array<{
  key: SmartDropzoneDepartment
  icon: string
  ar: string
  en: string
}> = [
  { key: 'hr', icon: '👥', ar: 'الموارد البشرية وشؤون العاملين والإقامات', en: 'HR & Residencies' },
  { key: 'accounting', icon: '💰', ar: 'المحاسبة والمالية والقيود والبنوك', en: 'Accounting & Banks' },
  { key: 'purchases', icon: '🛒', ar: 'المشتريات والموردين وفواتير الشراء', en: 'Purchases & Vendors' },
  { key: 'inventory_recipes', icon: '🍲', ar: 'الوصفات وتكاليف الطعام والمخزون', en: 'Recipes & Inventory' },
  { key: 'sales_aggregators', icon: '🛵', ar: 'المبيعات وتطبيقات التوصيل والعمولات', en: 'Sales & Aggregators' },
  { key: 'governance', icon: '⚖️', ar: 'التراخيص والحوكمة والشؤون القانونية', en: 'Licenses & Legal' },
  { key: 'crm_catering', icon: '🤝', ar: 'علاقات العملاء والكاترينج والشركات', en: 'CRM & Catering' },
]

export function emptySmartDropzoneCounters(): Record<SmartDropzoneDepartment, number> {
  return Object.fromEntries(SMART_DROPZONE_DEPARTMENTS.map((d) => [d, 0])) as Record<
    SmartDropzoneDepartment,
    number
  >
}
