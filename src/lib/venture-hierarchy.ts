/**
 * Canonical Venture Foods Kuwait operating map: 6 brands × 10 branches.
 * Branch `id` is stable and synced onto `Warehouse.code`.
 */
export const VENTURE_BRANDS = [
  {
    id: 'FARM-BROWN',
    code: 'FARM-BROWN',
    nameAr: 'فارم براون',
    nameEn: 'Farm Brown',
    cuisineAr: 'دجاج مقلي وكرسبي',
    cuisineEn: 'Fried & crispy chicken',
  },
  {
    id: 'KARAK-CAFETERIA',
    code: 'KARAK-CAFETERIA',
    nameAr: 'كرك كافتيريا',
    nameEn: 'Karak Cafeteria',
    cuisineAr: 'كرك وشاباتي وكافتيريا',
    cuisineEn: 'Karak, chapati & cafeteria',
  },
  {
    id: 'CHINA-GARDEN',
    code: 'CHINA-GARDEN',
    nameAr: 'تشاينا جاردن',
    nameEn: 'China Garden',
    cuisineAr: 'صيني وآسيوي',
    cuisineEn: 'Chinese & Asian',
  },
  {
    id: 'THE-NOODLE-BAR',
    code: 'THE-NOODLE-BAR',
    nameAr: 'ذا نودل بار',
    nameEn: 'The Noodle Bar',
    cuisineAr: 'نودلز ووك آسيوي',
    cuisineEn: 'Asian noodle & wok',
  },
  {
    id: 'FRANKS-STEAK',
    code: 'FRANKS-STEAK',
    nameAr: 'فرانكس ستيك ساندويتش',
    nameEn: "Frank's Steak Sandwich",
    cuisineAr: 'ستيك فيلي وساندويتش',
    cuisineEn: 'Philly steak sandwiches',
  },
  {
    id: 'SHAWARMA-TAHINA',
    code: 'SHAWARMA-TAHINA',
    nameAr: 'شاورما طحينة',
    nameEn: 'Shawarma Tahina',
    cuisineAr: 'شاورما وشارع شامي',
    cuisineEn: 'Shawarma & Levant street food',
  },
] as const

export type VentureBrandId = (typeof VENTURE_BRANDS)[number]['id']

export const VENTURE_BRANCHES = [
  {
    id: 'FB-SALMIYA',
    brandId: 'FARM-BROWN',
    areaAr: 'السالمية',
    areaEn: 'Salmiya',
    nameAr: 'فارم براون · السالمية',
    nameEn: 'Farm Brown · Salmiya',
  },
  {
    id: 'FB-ARDIYA',
    brandId: 'FARM-BROWN',
    areaAr: 'العارضية',
    areaEn: 'Ardiya',
    nameAr: 'فارم براون · العارضية',
    nameEn: 'Farm Brown · Ardiya',
  },
  {
    id: 'KK-HAWALLY',
    brandId: 'KARAK-CAFETERIA',
    areaAr: 'حولي',
    areaEn: 'Hawally',
    nameAr: 'كرك كافتيريا · حولي',
    nameEn: 'Karak Cafeteria · Hawally',
  },
  {
    id: 'KK-QURAIN',
    brandId: 'KARAK-CAFETERIA',
    areaAr: 'مبارك الكبير',
    areaEn: 'Mubarak Al-Kabeer',
    nameAr: 'كرك كافتيريا · المطبخ المركزي',
    nameEn: 'Karak Cafeteria · Mubarak Al-Kabeer',
  },
  {
    id: 'CG-FARWANIYA',
    brandId: 'CHINA-GARDEN',
    areaAr: 'الفروانية',
    areaEn: 'Farwaniya',
    nameAr: 'تشاينا جاردن · الفروانية',
    nameEn: 'China Garden · Farwaniya',
  },
  {
    id: 'CG-FAHAHEEL',
    brandId: 'CHINA-GARDEN',
    areaAr: 'الفحيحيل',
    areaEn: 'Fahaheel',
    nameAr: 'تشاينا جاردن · الفحيحيل',
    nameEn: 'China Garden · Fahaheel',
  },
  {
    id: 'NB-JABRIYA',
    brandId: 'THE-NOODLE-BAR',
    areaAr: 'الجابرية',
    areaEn: 'Jabriya',
    nameAr: 'ذا نودل بار · الجابرية',
    nameEn: 'The Noodle Bar · Jabriya',
  },
  {
    id: 'FS-SHARQ',
    brandId: 'FRANKS-STEAK',
    areaAr: 'الشرق',
    areaEn: 'Sharq',
    nameAr: 'فرانكس ستيك · الشرق',
    nameEn: 'Franks Steak · Sharq',
  },
  {
    id: 'ST-BAYAN',
    brandId: 'SHAWARMA-TAHINA',
    areaAr: 'بيان',
    areaEn: 'Bayan',
    nameAr: 'شاورما طحينة · بيان',
    nameEn: 'Shawarma Tahina · Bayan',
  },
  {
    id: 'ST-KEIFAN',
    brandId: 'SHAWARMA-TAHINA',
    areaAr: 'كيفان',
    areaEn: 'Keifan',
    nameAr: 'شاورما طحينة · كيفان',
    nameEn: 'Shawarma Tahina · Keifan',
  },
] as const satisfies readonly {
  id: string
  brandId: VentureBrandId
  areaAr: string
  areaEn: string
  nameAr: string
  nameEn: string
}[]

export type VentureBranchId = (typeof VENTURE_BRANCHES)[number]['id']

export const SCOPE_COOKIE_BRAND = 'vf_brand_id'
export const SCOPE_COOKIE_BRANCH = 'vf_branch_id'

export function brandById(id: string | null | undefined) {
  if (!id) return null
  return VENTURE_BRANDS.find((b) => b.id === id) ?? null
}

export function branchById(id: string | null | undefined) {
  if (!id) return null
  return VENTURE_BRANCHES.find((b) => b.id === id) ?? null
}

export function branchesForBrand(brandId: string | null | undefined) {
  if (!brandId) return [...VENTURE_BRANCHES]
  return VENTURE_BRANCHES.filter((b) => b.brandId === brandId)
}

export function isVentureBrandId(value: string | null | undefined): value is VentureBrandId {
  return Boolean(value && VENTURE_BRANDS.some((b) => b.id === value))
}

export function isVentureBranchId(value: string | null | undefined): value is VentureBranchId {
  return Boolean(value && VENTURE_BRANCHES.some((b) => b.id === value))
}

/** Normalize brand/branch pair so a branch always belongs to its brand. */
export function parseScopeIds(input: {
  brandId?: string | null
  branchId?: string | null
}): { brandId: VentureBrandId | null; branchId: VentureBranchId | null } {
  let brandId = isVentureBrandId(input.brandId) ? input.brandId : null
  let branchId = isVentureBranchId(input.branchId) ? input.branchId : null
  if (branchId) {
    const branch = branchById(branchId)
    if (!branch) {
      branchId = null
    } else if (brandId && branch.brandId !== brandId) {
      brandId = branch.brandId
    } else if (!brandId) {
      brandId = branch.brandId
    }
  }
  return { brandId, branchId }
}
