/**
 * Typed Journey interfaces (`src/lib/full-journey-enterprise-brain.ts`).
 *
 * All static snapshot imports (`odoo-journey.json`, `odoo-intel.json`, `odoo-dataset.ts`)
 * and hardcoded figures have been removed.
 */

export type JourneyStage =
  | 'procurement'
  | 'kitchen'
  | 'menu'
  | 'operations'
  | 'opex'
  | 'delivery'
  | 'quality'

export type PlaySeverity = 'critical' | 'high' | 'medium'

export interface JourneyPlay {
  id: string
  stage: JourneyStage
  severity: PlaySeverity
  titleEn: string
  titleAr: string
  evidenceEn: string
  evidenceAr: string
  causeEn: string
  causeAr: string
  fixEn: string
  fixAr: string
  growthEn: string
  growthAr: string
  monthlyKwd: number
  annualKwd: number
  confidenceEn: string
  confidenceAr: string
  ownerEn: string
  ownerAr: string
  stepsEn: string[]
  stepsAr: string[]
  brands: readonly string[] | 'all'
  branches: readonly string[] | 'all'
  channels: readonly string[] | 'all'
}

export interface BranchTrueCashRow {
  id: string
  en: string
  ar: string
  netSales: number
  orders: number
  trueNetCash: number
}

export interface BrandTrueCashRow {
  id: string
  en: string
  ar: string
  netSales: number
  orders: number
}

export const JOURNEY_META = {
  syncedAt: '',
  periodFrom: '',
  periodTo: '',
} as const

export const BRANCH_TRUE_CASH: readonly BranchTrueCashRow[] = []
export const BRAND_TRUE_CASH: readonly BrandTrueCashRow[] = []
export const JOURNEY_PLAYS: readonly JourneyPlay[] = []
export const JOURNEY_TOP_BY_STAGE: readonly JourneyPlay[] = []
