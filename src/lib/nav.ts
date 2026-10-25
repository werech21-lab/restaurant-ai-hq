export type SectionId =
  | 'ceo'
  | 'intelligence'
  | 'finance'
  | 'branches'
  | 'kitchen'
  | 'delivery'
  | 'inventory'
  | 'quality'
  | 'recommendations'
  | 'reports'
  | 'agents'
  | 'settings'

export const navGroups: { id: 'lead' | 'ops' | 'system'; items: SectionId[] }[] = [
  { id: 'lead', items: ['ceo', 'intelligence', 'finance'] },
  { id: 'ops', items: ['branches', 'kitchen', 'delivery', 'inventory', 'quality'] },
  { id: 'system', items: ['recommendations', 'reports', 'agents', 'settings'] },
]

export const sectionIds = navGroups.flatMap((group) => group.items)

export const searchIndex: Record<SectionId, string> = {
  ceo: 'غرفة الرئيس التنفيذي قيادة إيرادات تنبيهات قرارات executive room revenue alerts decisions',
  intelligence: 'مركز الاستخبارات تحليل تحقيق أسباب هامش intelligence analysis margin',
  finance: 'المالية والميزانيات إيرادات ربح انحراف ميزانية finance budget variance',
  branches: 'الفروع والعلامات شويخ سالمية حولي branches brands shuwaikh salmiya',
  kitchen: 'المطبخ المركزي هدر إنتاج وجبات kitchen waste production',
  delivery: 'التوصيل والعقود تالي ديليفري عمولة delivery contracts commission',
  inventory: 'المخزون والتموين نفاد مواد inventory supply stock',
  quality: 'الجودة والامتثال سلامة غذاء تفتيش حرارة quality compliance food safety',
  recommendations: 'التطوير والتوصيات قرار توفير هدر recommendations decisions',
  reports: 'التقارير والأرشيف يومي أسبوعي شهري reports archive',
  agents: 'مجلس الوكلاء مالية جودة عقود agents finance quality',
  settings: 'الصلاحيات والإعدادات تنبيهات حساب لغة settings language account',
}
