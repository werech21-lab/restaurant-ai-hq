/**
 * Executive recommendations types (`src/lib/analytics/recommendations.ts`).
 *
 * All hardcoded recommendation impact estimates have been purged.
 */

export type Priority = 'top' | 'high' | 'medium'

export interface ExecutiveRec {
  id: string
  priority: Priority
  deptEn: string
  deptAr: string
  issueEn: string
  issueAr: string
  fixEn: string
  fixAr: string
  impact: number
}

export const RECS: ExecutiveRec[] = []
export const RECS_TOTAL_KWD = 0
