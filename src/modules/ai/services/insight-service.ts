import type { Page } from '@/lib/api/cursor'
import { AppError } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/context'
import { db, withTransaction } from '@/lib/db'
import { DomainError } from '@/lib/domain-error'
import type { Insight, InsightStatus } from '@/modules/ai/domain/types'
import * as repository from '@/modules/ai/repositories/ai-repository'
import type { InsightVersionBody, ListInsightsQuery } from '@/modules/ai/schemas/ai'

export type InsightBody = { data: Insight }

function notFound(): AppError {
  return new AppError(404, 'not_found', 'The insight was not found.')
}

function versionConflict(): AppError {
  return new AppError(409, 'version_conflict', 'The insight was changed by someone else. Reload it and try again.')
}

/** open to acknowledged, and open or acknowledged to resolved. A resolved insight is history. */
export function canMoveInsight(from: InsightStatus, to: InsightStatus): boolean {
  if (from === 'open') return to === 'acknowledged' || to === 'resolved'
  if (from === 'acknowledged') return to === 'resolved'
  return false
}

export function listInsights(auth: AuthContext, query: ListInsightsQuery): Promise<Page<Insight>> {
  return repository.listInsights(db, auth.tenantId, query)
}

export async function getInsight(auth: AuthContext, id: string): Promise<InsightBody> {
  const insight = await repository.findInsight(db, auth.tenantId, id)
  if (insight === null) throw notFound()
  return { data: insight }
}

async function moveInsight(auth: AuthContext, id: string, input: InsightVersionBody, to: InsightStatus): Promise<InsightBody> {
  return withTransaction(async (tx): Promise<InsightBody> => {
    const before = await repository.findInsight(tx, auth.tenantId, id, { lock: true })
    if (before === null) throw notFound()
    if (before.version !== input.version) throw versionConflict()
    if (!canMoveInsight(before.status, to)) {
      throw new DomainError('invalid_transition', `An insight that is ${before.status} cannot become ${to}.`)
    }
    const after = await repository.setInsightStatus(tx, auth.tenantId, id, input.version, to)
    if (after === null) throw versionConflict()
    await writeAudit(tx, {
      tenantId: auth.tenantId,
      actorId: auth.userId,
      entity: 'ai_insight',
      entityId: id,
      action: 'update',
      before,
      after,
    })
    return { data: after }
  })
}

/** "تم الاطلاع": the executive has seen it. A later scan keeps it acknowledged while the cause lasts. */
export function acknowledgeInsight(auth: AuthContext, id: string, input: InsightVersionBody): Promise<InsightBody> {
  return moveInsight(auth, id, input, 'acknowledged')
}

/** Closes an insight by hand. If its cause is still there, the next scan raises it again as a new insight. */
export function resolveInsight(auth: AuthContext, id: string, input: InsightVersionBody): Promise<InsightBody> {
  return moveInsight(auth, id, input, 'resolved')
}
