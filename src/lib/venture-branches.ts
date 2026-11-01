import { ventureBrands } from '@/modules/governance/domain/venture-brands'

const KUWAIT_AREAS = [
  'السالمية',
  'حولي',
  'الفروانية',
  'الجابرية',
  'الجهراء',
  'الفحيحيل',
  'الشويخ',
  'مبارك الكبير',
  'بيان',
  'كيفان',
] as const

export type VentureBranchOption = {
  id: string
  brandCode: string
  brandNameAr: string
  nameAr: string
  area: string
}

/** Deterministic 6×N branch list for POS branch/brand picker (Kuwait). */
export function ventureBranchOptions(): VentureBranchOption[] {
  const rows: VentureBranchOption[] = []
  for (const brand of ventureBrands) {
    const count = Math.min(brand.branches, KUWAIT_AREAS.length)
    for (let i = 0; i < count; i += 1) {
      const area = KUWAIT_AREAS[i]!
      rows.push({
        id: `${brand.code}-${i + 1}`,
        brandCode: brand.code,
        brandNameAr: brand.nameAr,
        nameAr: `${brand.nameAr} · ${area}`,
        area,
      })
    }
  }
  return rows
}

export const ORDER_TYPES = [
  { id: 'dine_in', labelAr: 'محلي Dine-in' },
  { id: 'takeaway', labelAr: 'سفري Takeaway' },
  { id: 'delivery', labelAr: 'توصيل Delivery' },
  { id: 'aggregator', labelAr: 'طلبات / جاهز / ديليفرو' },
] as const

export type OrderTypeId = (typeof ORDER_TYPES)[number]['id']
