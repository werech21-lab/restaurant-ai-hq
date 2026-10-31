import type { MessageKey } from '@/lib/i18n'

/** The six Venture Foods Kuwait brands the rank radar filters on. Names match the portfolio rows. */
export const ventureBrands = [
  { code: 'FARM-BROWN', nameEn: 'Farm Brown', nameAr: 'فارم براون', cuisineAr: 'دجاج مقلي وكرسبي', branches: 4, label: 'agg.brand.farm' },
  { code: 'KARAK-CAFETERIA', nameEn: 'Karak Cafeteria', nameAr: 'كرك كافتيريا', cuisineAr: 'كرك وشاباتي وكافتيريا', branches: 6, label: 'agg.brand.karak' },
  { code: 'CHINA-GARDEN', nameEn: 'China Garden', nameAr: 'تشاينا جاردن', cuisineAr: 'صيني وآسيوي', branches: 3, label: 'agg.brand.china' },
  { code: 'THE-NOODLE-BAR', nameEn: 'The Noodle Bar', nameAr: 'ذا نودل بار', cuisineAr: 'نودلز ووك آسيوي', branches: 2, label: 'agg.brand.noodle' },
  { code: 'FRANKS-STEAK', nameEn: 'Franks Steak Sandwiches', nameAr: 'فرانكس ستيك ساندويتش', cuisineAr: 'ستيك فيلي وساندويتش', branches: 3, label: 'agg.brand.franks' },
  { code: 'SHAWARMA-TAHINA', nameEn: 'Shawarma Tahina', nameAr: 'شاورما طحينة', cuisineAr: 'شاورما وشارع شامي', branches: 5, label: 'agg.brand.shawarma' },
] as const satisfies readonly { code: string; nameEn: string; nameAr: string; cuisineAr: string; branches: number; label: MessageKey }[]

export type VentureBrandCode = (typeof ventureBrands)[number]['code']
