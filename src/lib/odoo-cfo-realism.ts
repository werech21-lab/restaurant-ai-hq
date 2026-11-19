/**
 * Typed CFO Realism interfaces (`src/lib/odoo-cfo-realism.ts`).
 *
 * All static JSON snapshot imports (`odoo-journey.json`, `odoo-dataset.ts`) and
 * hardcoded estimates have been removed.
 */

import type { JourneyPlay } from '@/lib/full-journey-enterprise-brain'

export interface OdooProvenanceBadge {
  badgeAr: string
  badgeEn: string
  models: readonly string[]
  recordsScanned: number
  correlationAr: string
  correlationEn: string
}

export interface CfoFieldStep {
  step: 1 | 2 | 3
  ownerAr: string
  ownerEn: string
  branchAr: string
  branchEn: string
  actionAr: string
  actionEn: string
}

export interface CfoThreeTierImpact {
  conservativeKwd: number
  realisticKwd: number
  stretchKwd: number
  assumptionAr: string
  assumptionEn: string
}

export interface CfoRealismProfile {
  playId: string
  provenance: OdooProvenanceBadge
  fieldSteps: readonly [CfoFieldStep, CfoFieldStep, CfoFieldStep]
  monthlyTiers: CfoThreeTierImpact
}

export function buildCfoRealismForPlay(p: JourneyPlay): CfoRealismProfile {
  const emptyStep = (step: 1 | 2 | 3): CfoFieldStep => ({
    step,
    ownerAr: p.ownerAr,
    ownerEn: p.ownerEn,
    branchAr: '',
    branchEn: '',
    actionAr: '',
    actionEn: '',
  })
  return {
    playId: p.id,
    provenance: {
      badgeAr: '',
      badgeEn: '',
      models: [],
      recordsScanned: 0,
      correlationAr: '',
      correlationEn: '',
    },
    fieldSteps: [emptyStep(1), emptyStep(2), emptyStep(3)],
    monthlyTiers: {
      conservativeKwd: 0,
      realisticKwd: 0,
      stretchKwd: 0,
      assumptionAr: '',
      assumptionEn: '',
    },
  }
}
