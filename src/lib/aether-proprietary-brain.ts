/**
 * Typed Aether Finding interfaces (`src/lib/aether-proprietary-brain.ts`).
 *
 * All static JSON snapshot imports (`odoo-intel.json`, `odoo-dataset.ts`) and
 * hardcoded figures have been removed.
 */

export type FindingDomain = 'branches' | 'menu' | 'operations' | 'delivery'
export type FindingSeverity = 'critical' | 'high' | 'medium'

export interface AetherFinding {
  id: string
  domain: FindingDomain
  severity: FindingSeverity
  titleEn: string
  titleAr: string
  faultEn: string
  faultAr: string
  fixEn: string
  fixAr: string
  growthEn: string
  growthAr: string
  resultEn: string
  resultAr: string
  stepsEn: string[]
  stepsAr: string[]
  monthlyKwd: number
}

export const FINDING_DOMAINS: { id: FindingDomain | 'all'; en: string; ar: string }[] = [
  { id: 'all', en: 'All', ar: 'الكل' },
  { id: 'branches', en: 'Locations & rents', ar: 'الأفرع والأجارات' },
  { id: 'menu', en: 'Menu & sales', ar: 'المينيو والمبيعات' },
  { id: 'operations', en: 'Operations', ar: 'العمليات والتشغيل' },
  { id: 'delivery', en: 'Delivery & expenses', ar: 'التوصيل والمصاريف' },
]

export const CHANNEL_ECONOMICS: readonly {
  id: string
  en: string
  ar: string
  commissionPct: number
  riderCostPerOrder: number
}[] = []

export const AETHER_FINDINGS: readonly AetherFinding[] = []

export const AETHER_BRAIN_META = {
  syncedAt: '',
  periodFrom: '',
  periodTo: '',
  totalMonthlyKwd: 0,
  findingsCount: 0,
} as const
