/**
 * Kuwait F&B & Corporate Regulatory Engine (`/erp/regulations`).
 * Cleaned of all hardcoded regulations and synthetic `68%` branch readiness percentages.
 */

import type { GlobalBranch } from '@/lib/aether/global-filter-engine'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import { isNonCompanyCatalogItem } from '@/lib/odoo/non-company-products'

export type RegulationTrackId =
  | 'municipality-pafn'
  | 'manpower-delivery'
  | 'moci-pricing'
  | 'malls-exb'

export interface RegulationPlaybookItem {
  id: string
  track: RegulationTrackId
  code: string
  titleAr: string
  titleEn: string
  authorityAr: string
  authorityEn: string
  effectiveDate: string
  deadlineDate: string
  costImpactKwd: number
  penaltyAvoidedKwd: number
  severity: 'critical' | 'high' | 'standard'
  summaryAr: string
  summaryEn: string
  mitigationStepsAr: string[]
  mitigationStepsEn: string[]
}

export const REGULATIONS_STORAGE_KEY = 'vf_kuwait_regulations_v2'
export const REG_STOP_ORDERS_STORAGE_KEY = 'vf_reg_stop_orders_v2'

export const DEFAULT_REGULATION_BRANCH_READINESS: Record<
  string,
  Record<Exclude<GlobalBranch, 'all'>, boolean>
> = {}

export const REGULATION_TRACK_OPTIONS: readonly {
  id: 'all' | RegulationTrackId
  ar: string
  en: string
}[] = [
  { id: 'all', ar: 'كل التشريعات', en: 'All Regulations' },
  { id: 'municipality-pafn', ar: 'البلدية والغذاء والعارضية', en: 'Municipality & PAFN' },
  { id: 'manpower-delivery', ar: 'القوى العاملة والتوصيل', en: 'Manpower & Delivery' },
  { id: 'moci-pricing', ar: 'التجارة والعروض والمنصات', en: 'MOCI & Platforms' },
  { id: 'malls-exb', ar: 'المجمعات والمعارض EXB', en: 'Malls, Fire & EXB' },
] as const

export const INITIAL_REGULATIONS: RegulationPlaybookItem[] = []

export function sanitizeRegulations(raw: unknown): RegulationPlaybookItem[] {
  if (!Array.isArray(raw) || raw.length === 0) return []
  const validTracks = new Set<string>([
    'municipality-pafn',
    'manpower-delivery',
    'moci-pricing',
    'malls-exb',
  ])
  const out: RegulationPlaybookItem[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Partial<RegulationPlaybookItem>
    if (!r.id || !r.titleAr) continue
    const textFields = [
      r.titleAr,
      r.titleEn,
      r.authorityAr,
      r.authorityEn,
      r.summaryAr,
      r.summaryEn,
      ...(Array.isArray(r.mitigationStepsAr) ? r.mitigationStepsAr.map(String) : []),
      ...(Array.isArray(r.mitigationStepsEn) ? r.mitigationStepsEn.map(String) : []),
    ].filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    if (
      textFields.some(
        (txt) => isExcludedOdooEntity(txt) || isNonCompanyCatalogItem(null, txt),
      )
    ) {
      continue
    }
    const track: RegulationTrackId =
      r.track && validTracks.has(r.track) ? r.track : 'municipality-pafn'
    out.push({
      id: String(r.id),
      track,
      code: typeof r.code === 'string' && r.code ? r.code : `REG-KW-0${out.length + 1}`,
      titleAr: String(r.titleAr),
      titleEn: typeof r.titleEn === 'string' && r.titleEn ? r.titleEn : String(r.titleAr),
      authorityAr:
        typeof r.authorityAr === 'string' && r.authorityAr ? r.authorityAr : 'الجهات الرقابية — الكويت',
      authorityEn:
        typeof r.authorityEn === 'string' && r.authorityEn ? r.authorityEn : 'Kuwait Regulatory Authority',
      effectiveDate:
        typeof r.effectiveDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.effectiveDate)
          ? r.effectiveDate
          : '',
      deadlineDate:
        typeof r.deadlineDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.deadlineDate)
          ? r.deadlineDate
          : '',
      costImpactKwd: Math.max(0, Number(r.costImpactKwd) || 0),
      penaltyAvoidedKwd: Math.max(0, Number(r.penaltyAvoidedKwd) || 0),
      severity:
        r.severity === 'critical' || r.severity === 'high' || r.severity === 'standard'
          ? r.severity
          : 'standard',
      summaryAr: typeof r.summaryAr === 'string' ? r.summaryAr : String(r.titleAr),
      summaryEn: typeof r.summaryEn === 'string' ? r.summaryEn : String(r.titleAr),
      mitigationStepsAr: Array.isArray(r.mitigationStepsAr) ? r.mitigationStepsAr.map(String) : [],
      mitigationStepsEn: Array.isArray(r.mitigationStepsEn) ? r.mitigationStepsEn.map(String) : [],
    })
  }
  return out
}

export function buildRegulationCircularText(
  reg: RegulationPlaybookItem,
  isAr: boolean,
  sealId?: string,
): string {
  const stamp = sealId ?? 'VF-REG'
  return isAr
    ? `${stamp} — ${reg.code}: ${reg.titleAr}`
    : `${stamp} — ${reg.code}: ${reg.titleEn}`
}

export function buildRegulationStopDirective(
  reg: RegulationPlaybookItem,
  isAr: boolean,
): string {
  return isAr ? `${reg.code}: ${reg.titleAr}` : `${reg.code}: ${reg.titleEn}`
}
