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
  { key: 'hr', icon: '👥', ar: 'الموارد البشرية والإقامات (HR)', en: 'HR & Residencies' },
  { key: 'accounting', icon: '💰', ar: 'المحاسبة والبنوك (Accounting)', en: 'Accounting & Banks' },
  { key: 'purchases', icon: '🛒', ar: 'المشتريات والموردين (Purchases)', en: 'Purchases & Vendors' },
  { key: 'inventory_recipes', icon: '🍲', ar: 'الوصفات والمخزون والمنيو', en: 'Recipes & Inventory' },
  { key: 'sales_aggregators', icon: '🛵', ar: 'المبيعات ومنصات التوصيل', en: 'Sales & Aggregators' },
  { key: 'governance', icon: '⚖️', ar: 'التراخيص والشؤون القانونية', en: 'Licenses & Legal' },
  { key: 'crm_catering', icon: '🤝', ar: 'الكاترينج والعملاء (CRM)', en: 'CRM & Catering' },
]

export function emptySmartDropzoneCounters(): Record<SmartDropzoneDepartment, number> {
  return Object.fromEntries(SMART_DROPZONE_DEPARTMENTS.map((d) => [d, 0])) as Record<
    SmartDropzoneDepartment,
    number
  >
}
