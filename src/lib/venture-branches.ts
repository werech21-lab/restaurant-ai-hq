import { VENTURE_BRANCHES, VENTURE_BRANDS, brandById } from '@/lib/venture-hierarchy'

export type VentureBranchOption = {
  id: string
  brandCode: string
  brandNameAr: string
  brandNameEn: string
  nameAr: string
  nameEn: string
  area: string
  areaEn: string
}

/** The 10 operating branches for POS / scope pickers. */
export function ventureBranchOptions(): VentureBranchOption[] {
  return VENTURE_BRANCHES.map((branch) => {
    const brand = brandById(branch.brandId)!
    return {
      id: branch.id,
      brandCode: branch.brandId,
      brandNameAr: brand.nameAr,
      brandNameEn: brand.nameEn,
      nameAr: branch.nameAr,
      nameEn: branch.nameEn,
      area: branch.areaAr,
      areaEn: branch.areaEn,
    }
  })
}

export const ORDER_TYPES = [
  { id: 'dine_in', labelAr: 'محلي (صالة)', labelEn: 'Dine-in' },
  { id: 'takeaway', labelAr: 'سفري', labelEn: 'Takeaway' },
  { id: 'talabat', labelAr: 'طلبات', labelEn: 'Talabat' },
  { id: 'deliveroo', labelAr: 'ديليفرو', labelEn: 'Deliveroo' },
  { id: 'jahez', labelAr: 'جاهز', labelEn: 'Jahez' },
  { id: 'in_house', labelAr: 'توصيل الفرع', labelEn: 'In-House Delivery' },
  { id: 'staff_meal', labelAr: '🍽️ وجبة موظف (برقم البصمة)', labelEn: '🍽️ Staff Meal (by Badge ID)' },
] as const

export type OrderTypeId = (typeof ORDER_TYPES)[number]['id']

export { VENTURE_BRANDS, VENTURE_BRANCHES }
