/**
 * Canonical Venture Foods Kuwait operating map: 7 brands × 10 branches.
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
    nameAr: 'فرع السالمية',
    nameEn: 'Salmiya Branch',
  },
  {
    id: 'FB-ARDIYA',
    brandId: 'FARM-BROWN',
    areaAr: 'العارضية',
    areaEn: 'Ardiya',
    nameAr: 'فرع العارضية',
    nameEn: 'Ardiya Branch',
  },
  {
    id: 'KK-HAWALLY',
    brandId: 'KARAK-CAFETERIA',
    areaAr: 'حولي',
    areaEn: 'Hawally',
    nameAr: 'فرع حولي',
    nameEn: 'Hawally Branch',
  },
  {
    id: 'KK-QURAIN',
    brandId: 'KARAK-CAFETERIA',
    areaAr: 'صباح السالم / مبارك الكبير',
    areaEn: 'Sabah Al-Salem / Mubarak Al-Kabeer',
    nameAr: 'فرع صباح السالم / مبارك الكبير',
    nameEn: 'Sabah Al-Salem / Mubarak Al-Kabeer Branch',
  },
  {
    id: 'CG-FARWANIYA',
    brandId: 'CHINA-GARDEN',
    areaAr: 'الفروانية',
    areaEn: 'Farwaniya',
    nameAr: 'فرع الفروانية',
    nameEn: 'Farwaniya Branch',
  },
  {
    id: 'CG-FAHAHEEL',
    brandId: 'CHINA-GARDEN',
    areaAr: 'الفحيحيل / الكوت',
    areaEn: 'Fahaheel / Al-Kout',
    nameAr: 'فرع الفحيحيل / الكوت',
    nameEn: 'Fahaheel / Al-Kout Branch',
  },
  {
    id: 'NB-JABRIYA',
    brandId: 'THE-NOODLE-BAR',
    areaAr: 'المهبولة',
    areaEn: 'Mahboula',
    nameAr: 'فرع المهبولة',
    nameEn: 'Mahboula Branch',
  },
  {
    id: 'FS-SHARQ',
    brandId: 'FRANKS-STEAK',
    areaAr: 'شرق',
    areaEn: 'Sharq',
    nameAr: 'فرع شرق',
    nameEn: 'Sharq Branch',
  },
  {
    id: 'ST-BAYAN',
    brandId: 'SHAWARMA-TAHINA',
    areaAr: 'بيان',
    areaEn: 'Bayan',
    nameAr: 'فرع بيان',
    nameEn: 'Bayan Branch',
  },
  {
    id: 'ST-KEIFAN',
    brandId: 'SHAWARMA-TAHINA',
    areaAr: 'السالمية',
    areaEn: 'Salmiya',
    nameAr: 'فرع السالمية',
    nameEn: 'Salmiya Branch',
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
