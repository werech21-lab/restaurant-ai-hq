export const SMART_INGEST_MODULES = [
  'accounting',
  'inventory',
  'purchases',
  'sales_delivery',
  'governance',
  'crm_projects',
] as const

export type SmartIngestModule = (typeof SMART_INGEST_MODULES)[number]

export type SmartIngestModuleMeta = {
  key: SmartIngestModule
  /** Panel permission module key */
  permissionModule: string
  /** Extra panel modules that may also open/ingest this router */
  altPermissionModules?: readonly string[]
  buttonAr: string
  buttonEn: string
  titleAr: string
  titleEn: string
  descAr: string
  descEn: string
  acceptsAr: string
  acceptsEn: string
  /** Department pages that should show the launch button */
  launchHrefs: string[]
  pagePath: string
}

export const SMART_INGEST_META: Record<SmartIngestModule, SmartIngestModuleMeta> = {
  accounting: {
    key: 'accounting',
    permissionModule: 'accounting',
    altPermissionModules: ['reports'],
    buttonAr: '📁 رفع مجلد الحسابات والفواتير الذكي (AI)',
    buttonEn: '📁 Smart Accounts & Invoices Folder Upload (AI)',
    titleAr: '📁 رفع مجلد الحسابات والفواتير الذكي (توزيع تلقائي بالـ AI)',
    titleEn: '📁 Smart Accounting Folder Upload (Auto-Distribute)',
    descAr: 'كشوف بنوك الكويت، فواتير المشتريات، عهد الفروع، والقيود — مطابقة شجرة الحسابات وربط المرفقات.',
    descEn: 'Kuwait bank statements, purchase invoices, petty cash, and journals — chart matching + verified attachments.',
    acceptsAr: 'كشوف NBK / Gulf / Boubyan / Ahli · فواتير · عهد Rabih/Sheila/Amgad/Sanad · Excel/CSV/PDF/صور',
    acceptsEn: 'NBK / Gulf / Boubyan / Ahli statements · invoices · petty cash · Excel/CSV/PDF/images',
    launchHrefs: ['/accounting', '/reports', '/erp/finance'],
    pagePath: '/smart-ingest/accounting',
  },
  inventory: {
    key: 'inventory',
    permissionModule: 'inventory',
    altPermissionModules: ['warehouses', 'recipes'],
    buttonAr: '📁 رفع مجلد المخزون والصور والجرد الذكي (AI)',
    buttonEn: '📁 Smart Inventory, Photos & Count Folder (AI)',
    titleAr: '📁 رفع مجلد المخزون والصور والجرد الذكي (توزيع تلقائي بالـ AI)',
    titleEn: '📁 Smart Inventory Folder Upload (Auto-Distribute)',
    descAr: 'جرد الفروع، مواد RW/PI/PP، الوصفات BOM، وصور المنيو للبراندات — ربط بالأصناف والمستودعات.',
    descEn: 'Branch counts, RW/PI/PP items, BOM recipes, menu photos — match SKUs and warehouses.',
    acceptsAr: 'جرد Excel/CSV · أكواد RW*/PI*/PP* · وصفات · صور أصناف المنيو · رموز PRM/360/ASM/KOUT/QRN/CK',
    acceptsEn: 'Count sheets · RW*/PI*/PP* · recipes · menu images · PRM/360/ASM/KOUT/QRN/CK codes',
    launchHrefs: ['/inventory', '/warehouses', '/recipes', '/stock-count', '/central-kitchen'],
    pagePath: '/smart-ingest/inventory',
  },
  purchases: {
    key: 'purchases',
    permissionModule: 'purchases',
    buttonAr: '📁 رفع مجلد المشتريات والموردين الذكي (AI)',
    buttonEn: '📁 Smart Purchases & Suppliers Folder (AI)',
    titleAr: '📁 رفع مجلد المشتريات والموردين الذكي (توزيع تلقائي بالـ AI)',
    titleEn: '📁 Smart Purchases Folder Upload (Auto-Distribute)',
    descAr: 'فواتير الموردين، عروض الأسعار، عقود التوريد، وسندات الاستلام GRN — ربط بسجل المورد وأوامر الشراء.',
    descEn: 'Supplier invoices, quotes, contracts, GRNs — bind to supplier ledger and POs.',
    acceptsAr: 'فواتير موردين · عروض أسعار · عقود · GRN · Top Pack / الساير / تغليف وغذاء',
    acceptsEn: 'Supplier invoices · quotes · contracts · GRN · packaging & food vendors',
    launchHrefs: ['/purchases'],
    pagePath: '/smart-ingest/purchases',
  },
  sales_delivery: {
    key: 'sales_delivery',
    permissionModule: 'sales',
    altPermissionModules: ['delivery-hub', 'reports'],
    buttonAr: '📁 رفع مجلد كشوفات طلبات والتوصيل الذكي (AI)',
    buttonEn: '📁 Smart Talabat & Delivery Settlements Folder (AI)',
    titleAr: '📁 رفع مجلد كشوفات طلبات والتوصيل الذكي (توزيع تلقائي بالـ AI)',
    titleEn: '📁 Smart Delivery Settlements Folder Upload (AI)',
    descAr: 'كشوف طلبات / ديليفرو / جاهز / / كيتا / سنونو وتقارير POS — فصل MP 10% و TGO 17% وصافي التحويل.',
    descEn: 'Talabat / Deliveroo / Jahez / / Keeta / Snoonu + POS — split MP 10% vs TGO 17% and net payout.',
    acceptsAr: 'تسويات المنصات · تقارير مبيعات فروع · Offline · عمولات · Excel/CSV/PDF',
    acceptsEn: 'Platform settlements · branch sales · Offline periods · commissions · Excel/CSV/PDF',
    launchHrefs: ['/sales', '/delivery-hub', '/erp/aggregator-radar'],
    pagePath: '/smart-ingest/sales_delivery',
  },
  governance: {
    key: 'governance',
    permissionModule: 'audit',
    buttonAr: '📁 رفع مجلد الرخص والعقود القانونية الذكي (AI)',
    buttonEn: '📁 Smart Licenses & Legal Contracts Folder (AI)',
    titleAr: '📁 رفع مجلد الرخص والعقود القانونية الذكي (توزيع تلقائي بالـ AI)',
    titleEn: '📁 Smart Governance & Licenses Folder Upload (AI)',
    descAr: 'رخص تجارية، إطفاء، بلدية، إعلانات، عقود إيجار الفروع، دفاتر السيارات — تنبيهات تجديد 30/60 يوماً.',
    descEn: 'Trade / fire / municipality / ads licenses, branch leases, vehicle books — 30/60 day renewals.',
    acceptsAr: 'رخص · عقود إيجار · Vehicle Registration · PDF/صور/Excel',
    acceptsEn: 'Permits · lease contracts · vehicle registration · PDF/images/Excel',
    launchHrefs: ['/erp/governance', '/erp/compliance'],
    pagePath: '/smart-ingest/governance',
  },
  crm_projects: {
    key: 'crm_projects',
    permissionModule: 'crm',
    buttonAr: '📁 رفع مجلد العقود والكاترينج والمشاريع الذكي (AI)',
    buttonEn: '📁 Smart Catering, CRM & Projects Folder (AI)',
    titleAr: '📁 رفع مجلد العقود والكاترينج والمشاريع الذكي (توزيع تلقائي بالـ AI)',
    titleEn: '📁 Smart CRM & Projects Folder Upload (AI)',
    descAr: 'عقود كاترينج، مقاصف مدارس، معارض (Mishref / Defense / Police)، وقوائم العملاء — ربط بالعميل/المشروع.',
    descEn: 'Catering, school canteens, expo/camp contracts, customer lists — bind to client/project.',
    acceptsAr: 'عقود · قوائم عملاء Excel/CSV · PDF · صور',
    acceptsEn: 'Contracts · customer Excel/CSV · PDF · images',
    launchHrefs: ['/crm', '/erp/sales-crm', '/erp/projects'],
    pagePath: '/smart-ingest/crm_projects',
  },
}

export function isSmartIngestModule(value: string): value is SmartIngestModule {
  return (SMART_INGEST_MODULES as readonly string[]).includes(value)
}

export function metaForModule(module: string): SmartIngestModuleMeta | null {
  if (!isSmartIngestModule(module)) return null
  return SMART_INGEST_META[module]
}

export function permissionModulesFor(meta: SmartIngestModuleMeta): string[] {
  return [meta.permissionModule, ...(meta.altPermissionModules || [])]
}
