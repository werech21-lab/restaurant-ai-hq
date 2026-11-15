/**
 * Canonical Venture Foods Kuwait operating map: 6 brands • 7 branches • 8 channels.
 * Strictly aligned with the 7 verified Odoo operating branches:
 * salmiya, ardiya, al-kout, promenade, 360-mall, avenues, assima.
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
    id: 'CG-ALKOUT',
    brandId: 'CHINA-GARDEN',
    areaAr: 'الكوت مول',
    areaEn: 'Al-Kout Mall',
    nameAr: 'فرع الكوت',
    nameEn: 'Al-Kout Branch',
  },
  {
    id: 'ST-PROMENADE',
    brandId: 'SHAWARMA-TAHINA',
    areaAr: 'بروميناد مول',
    areaEn: 'Promenade Mall',
    nameAr: 'فرع بروميناد',
    nameEn: 'Promenade Branch',
  },
  {
    id: 'NB-360',
    brandId: 'THE-NOODLE-BAR',
    areaAr: 'مول 360',
    areaEn: '360 Mall',
    nameAr: 'فرع 360 مول',
    nameEn: '360 Mall Branch',
  },
  {
    id: 'FS-AVENUES',
    brandId: 'FRANKS-STEAK',
    areaAr: 'الأفنيوز',
    areaEn: 'The Avenues',
    nameAr: 'فرع الأفنيوز',
    nameEn: 'Avenues Branch',
  },
  {
    id: 'CG-ASSIMA',
    brandId: 'CHINA-GARDEN',
    areaAr: 'العاصمة مول',
    areaEn: 'Assima Mall',
    nameAr: 'فرع العاصمة',
    nameEn: 'Assima Branch',
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
