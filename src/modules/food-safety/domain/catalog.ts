import {
  defaultStorageMode,
  SHELF_LIFE_MATRIX,
  type StorageMode,
} from '@/lib/food-safety/shelf-life-matrix'
import { VENTURE_BRANCHES, VENTURE_BRANDS } from '@/lib/venture-hierarchy'

export const SCRAP_ACCOUNT_CODE = '420001'
export const SCRAP_ACCOUNT_NAME_EN = 'Cost of Scrap'
export const SCRAP_ACCOUNT_NAME_AR = 'تكلفة التوالف والهدر'

export const UNIT_KINDS = [
  'walk_in_freezer',
  'walk_in_chiller',
  'vegetables_chiller',
  'salad_bar_chiller',
  'lowboy_meat',
  'beverage_chiller',
] as const

export type UnitKind = (typeof UNIT_KINDS)[number]

export type ColdUnitSpec = {
  kind: UnitKind
  nameEn: string
  nameAr: string
  targetC: number
  warnAboveC: number
  criticalAboveC: number
}

export const COLD_UNIT_SPECS: readonly ColdUnitSpec[] = [
  { kind: 'walk_in_freezer', nameEn: 'Walk-in Freezer -18°C', nameAr: 'فريزر مشي -18°م', targetC: -18, warnAboveC: -15, criticalAboveC: -12 },
  { kind: 'walk_in_chiller', nameEn: 'Walk-in Chiller +2°C', nameAr: 'براد مشي +2°م', targetC: 2, warnAboveC: 4, criticalAboveC: 5 },
  { kind: 'vegetables_chiller', nameEn: 'Vegetables Chiller', nameAr: 'براد الخضار', targetC: 3, warnAboveC: 5, criticalAboveC: 6 },
  { kind: 'salad_bar_chiller', nameEn: 'Salad Bar Chiller', nameAr: 'براد السلطات', targetC: 2, warnAboveC: 4, criticalAboveC: 5 },
  { kind: 'lowboy_meat', nameEn: 'Lowboy Meat Cooler', nameAr: 'براد لحوم سفلي', targetC: 1, warnAboveC: 3, criticalAboveC: 5 },
  { kind: 'beverage_chiller', nameEn: 'Beverage / Pepsi Chiller', nameAr: 'براد المشروبات / بيبسي', targetC: 4, warnAboveC: 7, criticalAboveC: 10 },
]

/** Extra sites beyond the 10 operating branches (CK + brand locations for HACCP). */
export const EXTRA_SITES = [
  {
    id: 'CK-MAIN',
    brandId: null as string | null,
    areaEn: 'Central Kitchen',
    areaAr: 'مبارك الكبير',
    nameEn: 'Central Kitchen',
    nameAr: 'المطبخ المركزي',
  },
  {
    id: 'WH-MAK',
    brandId: null as string | null,
    areaEn: 'Central Kitchen Warehouse',
    areaAr: 'مستودع المطبخ المركزي',
    nameEn: 'Main Warehouse',
    nameAr: 'المستودع الرئيسي',
  },
  // Farm Brown
  {
    id: 'FB-ALKOUT',
    brandId: 'FARM-BROWN',
    areaEn: 'Al-Kout Mall',
    areaAr: 'الكوت مول',
    nameEn: 'Farm Brown · Al-Kout Mall',
    nameAr: 'فارم براون · الكوت مول',
  },
  // China Garden
  {
    id: 'CG-SALMIYA',
    brandId: 'CHINA-GARDEN',
    areaEn: 'Salmiya',
    areaAr: 'السالمية',
    nameEn: 'China Garden · Salmiya',
    nameAr: 'تشاينا جاردن · السالمية',
  },
  {
    id: 'CG-360',
    brandId: 'CHINA-GARDEN',
    areaEn: '360 Mall',
    areaAr: '360 مول',
    nameEn: 'China Garden · 360 Mall',
    nameAr: 'تشاينا جاردن · 360 مول',
  },
  {
    id: 'CG-ASSIMA',
    brandId: 'CHINA-GARDEN',
    areaEn: 'Assima Mall',
    areaAr: 'العاصمة مول',
    nameEn: 'China Garden · Assima Mall',
    nameAr: 'تشاينا جاردن · العاصمة مول',
  },
  {
    id: 'CG-AVENUES',
    brandId: 'CHINA-GARDEN',
    areaEn: 'The Avenues',
    areaAr: 'الأفنيوز',
    nameEn: 'China Garden · The Avenues',
    nameAr: 'تشاينا جاردن · الأفنيوز',
  },
  {
    id: 'CG-KOUT',
    brandId: 'CHINA-GARDEN',
    areaEn: 'Al-Kout Mall',
    areaAr: 'الكوت مول',
    nameEn: 'China Garden · Al-Kout Mall',
    nameAr: 'تشاينا جاردن · الكوت مول',
  },
  {
    id: 'CG-360',
    brandId: 'CHINA-GARDEN',
    areaEn: 'South Surra (360 Mall)',
    areaAr: 'جنوب السرة (مول 360)',
    nameEn: 'China Garden · 360 Mall',
    nameAr: 'تشاينا جاردن · مول 360',
  },
  // Frank's
  {
    id: 'FS-SALMIYA',
    brandId: 'FRANKS-STEAK',
    areaEn: 'Salmiya',
    areaAr: 'السالمية',
    nameEn: "Frank's · Salmiya",
    nameAr: 'فرانكس · السالمية',
  },
  {
    id: 'FS-ARDIYA',
    brandId: 'FRANKS-STEAK',
    areaEn: 'Ardiya',
    areaAr: 'العارضية',
    nameEn: "Frank's · Ardiya",
    nameAr: 'فرانكس · العارضية',
  },
  {
    id: 'FS-MAK',
    brandId: 'FRANKS-STEAK',
    areaEn: 'Mubarak Al-Kabeer',
    areaAr: 'مبارك الكبير',
    nameEn: "Frank's · Mubarak Al-Kabeer",
    nameAr: 'فرانكس · مبارك الكبير',
  },
  // The Noodle Bar
  {
    id: 'NB-PROMENADE',
    brandId: 'THE-NOODLE-BAR',
    areaEn: 'Promenade Mall',
    areaAr: 'بروميناد مول',
    nameEn: 'The Noodle Bar · Promenade Mall',
    nameAr: 'ذا نودل بار · بروميناد مول',
  },
  {
    id: 'NB-KOUT',
    brandId: 'THE-NOODLE-BAR',
    areaEn: 'Al-Kout Mall',
    areaAr: 'الكوت مول',
    nameEn: 'The Noodle Bar · Al-Kout Mall',
    nameAr: 'ذا نودل بار · الكوت مول',
  },
  // Karak
  {
    id: 'KK-SALMIYA',
    brandId: 'KARAK-CAFETERIA',
    areaEn: 'Salmiya',
    areaAr: 'السالمية',
    nameEn: 'Karak Cafeteria · Salmiya',
    nameAr: 'كرك كافتيريا · السالمية',
  },
  {
    id: 'KK-PROMENADE',
    brandId: 'KARAK-CAFETERIA',
    areaEn: 'Promenade Mall',
    areaAr: 'بروميناد مول',
    nameEn: 'Karak Cafeteria · Promenade Mall',
    nameAr: 'كرك كافتيريا · بروميناد مول',
  },
  // Shawarma Tahina
  {
    id: 'ST-PROMENADE',
    brandId: 'SHAWARMA-TAHINA',
    areaEn: 'Promenade Mall',
    areaAr: 'بروميناد مول',
    nameEn: 'Shawarma Tahina · Promenade Mall',
    nameAr: 'شاورما طحينة · بروميناد مول',
  },
  {
    id: 'ST-MAK',
    brandId: 'SHAWARMA-TAHINA',
    areaEn: 'Mubarak Al-Kabeer',
    areaAr: 'مبارك الكبير',
    nameEn: 'Shawarma Tahina · Mubarak Al-Kabeer',
    nameAr: 'شاورما طحينة · مبارك الكبير',
  },
] as const

export type SiteRef = {
  id: string
  brandId: string | null
  brandNameEn: string
  brandNameAr: string
  areaEn: string
  areaAr: string
  nameEn: string
  nameAr: string
}

export function listFoodSafetySites(): SiteRef[] {
  const fromBranches: SiteRef[] = VENTURE_BRANCHES.map((b) => {
    const brand = VENTURE_BRANDS.find((x) => x.id === b.brandId)!
    return {
      id: b.id,
      brandId: b.brandId,
      brandNameEn: brand.nameEn,
      brandNameAr: brand.nameAr,
      areaEn: b.areaEn,
      areaAr: b.areaAr,
      nameEn: b.nameEn,
      nameAr: b.nameAr,
    }
  })
  const extras: SiteRef[] = EXTRA_SITES.map((s) => {
    const brand = s.brandId ? VENTURE_BRANDS.find((x) => x.id === s.brandId) : null
    return {
      id: s.id,
      brandId: s.brandId,
      brandNameEn: brand?.nameEn ?? 'Venture Foods Shared',
      brandNameAr: brand?.nameAr ?? 'فنتشر فودز مشترك',
      areaEn: s.areaEn,
      areaAr: s.areaAr,
      nameEn: s.nameEn,
      nameAr: s.nameAr,
    }
  })
  return [...fromBranches, ...extras]
}

export type PrepCatalogItem = {
  code: string
  nameEn: string
  nameAr: string
  shelfLifeHours: number
  unitCostMinor: number
  storageModes: StorageMode[]
  defaultMode: StorageMode
}

/** Derived from HACCP master matrix (Odoo PP03* / RW01*). */
export const PREP_CATALOG: readonly PrepCatalogItem[] = SHELF_LIFE_MATRIX.map((r) => {
  const mode = defaultStorageMode(r)
  return {
    code: r.code,
    nameEn: r.nameEn,
    nameAr: r.nameAr,
    shelfLifeHours: r.hours[mode] ?? 24,
    unitCostMinor: r.unitCostMinor,
    storageModes: (Object.keys(r.hours) as StorageMode[]).filter((m) => r.hours[m] != null),
    defaultMode: mode,
  }
})

export const MAINTENANCE_CONTACT = {
  name: 'Rabih Anis Yehia',
  titleEn: 'Asst. Ops Manager / Maintenance',
  titleAr: 'مساعد مدير العمليات / الصيانة',
  mobile: '97386439',
  mobileDisplay: '+965 97386439',
  email: 'rabihy@venturefoodskw.com',
} as const
