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
  { id: 'takeaway', labelAr: 'سفري / استلام كاونتر', labelEn: 'Takeaway / Counter Pickup' },
  { id: 'dine_in', labelAr: 'طلب محلي بالفرع', labelEn: 'Dine-In / Store Order' },
  { id: 'talabat', labelAr: 'توصيل أسطول الشركة (10%)', labelEn: 'Talabat Fleet (10%)' },
  { id: 'talabat_go', labelAr: 'منصة طلبات (17%)', labelEn: 'Talabat GO (17%)' },
  { id: 'keeta', labelAr: 'منصة كيتا (12%)', labelEn: 'Keeta (12%)' },
  { id: 'deliveroo', labelAr: 'منصة ديليفرو (18%)', labelEn: 'Deliveroo (18%)' },
  { id: 'jahez', labelAr: 'منصة جاهز (15%)', labelEn: 'Jahez (15%)' },
  { id: 'staff_meal', labelAr: 'وجبة موظف معتمدة (0 د.ك)', labelEn: 'Staff Meal (0 KD)' },
] as const

export type OrderTypeId = (typeof ORDER_TYPES)[number]['id']

export { VENTURE_BRANDS, VENTURE_BRANCHES }
