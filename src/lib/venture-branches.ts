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
  { id: 'dine_in', labelAr: 'طلبات الصالة (محلي)', labelEn: 'Dine-in' },
  { id: 'takeaway', labelAr: 'طلبات سفري واستلام', labelEn: 'Takeaway' },
  { id: 'talabat', labelAr: 'طلبات — توصيل أسطول الشركة (10%)', labelEn: 'Talabat Fleet (10%)' },
  { id: 'deliveroo', labelAr: 'منصة ديليفرو (18%)', labelEn: 'Deliveroo (18%)' },
  { id: 'jahez', labelAr: 'منصة جاهز (15%)', labelEn: 'Jahez (15%)' },
  { id: 'in_house', labelAr: 'الموقع الإلكتروني والاتصال المباشر', labelEn: 'Direct Web & Call' },
  { id: 'staff_meal', labelAr: '🍽️ صرف وجبة موظف (برقم البصمة)', labelEn: '🍽️ Staff Meal (by Badge ID)' },
] as const

export type OrderTypeId = (typeof ORDER_TYPES)[number]['id']

export { VENTURE_BRANDS, VENTURE_BRANCHES }
