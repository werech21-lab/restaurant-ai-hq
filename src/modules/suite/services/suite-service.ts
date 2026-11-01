import { AppError } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/context'
import { withTransaction } from '@/lib/pg'
import { suiteStages, type SuiteApp } from '@/modules/suite/domain/apps'
import type { SuiteBoard, SuiteRecord } from '@/modules/suite/domain/types'
import * as repository from '@/modules/suite/repositories/suite-repository'
import type { CreateSuiteRecordInput, UpdateSuiteRecordInput } from '@/modules/suite/schemas/suite'

export type BoardQuery = {
  page?: number
  pageSize?: number
  facetKind?: 'department' | 'location' | 'brand'
  facetValue?: string
}

export async function getBoard(auth: AuthContext, app: SuiteApp, query: BoardQuery = {}): Promise<{ data: SuiteBoard }> {
  return withTransaction(async (tx) => {
    const facets = await repository.listFacets(tx, auth.tenantId, app)
    if (app === 'analytic') {
      const rows = await repository.listAnalyticMatrixRows(tx, auth.tenantId)
      return {
        data: {
          app,
          stages: suiteStages[app],
          records: rows,
          total: rows.length,
          page: 1,
          pageSize: rows.length || 25,
          stageCounts: Object.fromEntries(facets.stages.map((row) => [row.label, row.count])),
          facets: {
            department: facets.department,
            location: facets.location,
            brand: facets.brand,
          },
        },
      }
    }
    const page = await repository.listRecords(tx, auth.tenantId, app, query)
    return {
      data: {
        app,
        stages: suiteStages[app],
        records: page.rows,
        total: page.total,
        page: page.page,
        pageSize: page.pageSize,
        stageCounts: Object.fromEntries(facets.stages.map((row) => [row.label, row.count])),
        facets: {
          department: facets.department,
          location: facets.location,
          brand: facets.brand,
        },
      },
    }
  })
}

export async function createRecord(auth: AuthContext, app: SuiteApp, input: CreateSuiteRecordInput): Promise<{ data: SuiteRecord }> {
  return withTransaction(async (tx) => {
    if (!suiteStages[app].includes(input.stage)) {
      throw new AppError(422, 'validation_failed', 'The stage is not valid for this board.')
    }
    const row = await repository.insertRecord(tx, auth.tenantId, auth.userId, app, input)
    await writeAudit(tx, {
      tenantId: auth.tenantId,
      actorId: auth.userId,
      entity: 'suite_record',
      entityId: row.id,
      action: 'create',
      before: null,
      after: row,
    })
    return { data: row }
  })
}

export async function updateRecord(
  auth: AuthContext,
  app: SuiteApp,
  id: string,
  input: UpdateSuiteRecordInput
): Promise<{ data: SuiteRecord }> {
  return withTransaction(async (tx) => {
    if (!suiteStages[app].includes(input.stage)) {
      throw new AppError(422, 'validation_failed', 'The stage is not valid for this board.')
    }
    const before = await repository.findRecord(tx, auth.tenantId, app, id)
    if (!before) throw new AppError(404, 'not_found', 'The record was not found.')
    const row = await repository.updateRecord(tx, auth.tenantId, app, id, input)
    if (!row) throw new AppError(409, 'version_conflict', 'This record changed. Reload and try again.')
    await writeAudit(tx, {
      tenantId: auth.tenantId,
      actorId: auth.userId,
      entity: 'suite_record',
      entityId: id,
      action: 'update',
      before,
      after: row,
    })
    return { data: row }
  })
}
