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
  { id: 'dine_in', labelAr: 'محلي Dine-in', labelEn: 'Dine-in' },
  { id: 'takeaway', labelAr: 'سفري Takeaway', labelEn: 'Takeaway' },
  { id: 'delivery', labelAr: 'توصيل Delivery', labelEn: 'Delivery' },
  { id: 'aggregator', labelAr: 'طلبات / جاهز / ديليفرو', labelEn: 'Talabat / Jahez / Deliveroo' },
] as const

export type OrderTypeId = (typeof ORDER_TYPES)[number]['id']

export { VENTURE_BRANDS, VENTURE_BRANCHES }
