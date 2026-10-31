import { AppError } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/context'
import { withTransaction } from '@/lib/db'
import { suiteStages, type SuiteApp } from '@/modules/suite/domain/apps'
import type { SuiteBoard, SuiteFacet, SuiteRecord } from '@/modules/suite/domain/types'
import * as repository from '@/modules/suite/repositories/suite-repository'
import type { CreateSuiteRecordInput, UpdateSuiteRecordInput } from '@/modules/suite/schemas/suite'

function countFacet(records: SuiteRecord[], pick: (row: SuiteRecord) => string): SuiteFacet[] {
  const map = new Map<string, number>()
  for (const row of records) {
    const label = pick(row).trim()
    if (!label) continue
    map.set(label, (map.get(label) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([label, count]) => ({ key: label, label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

export async function getBoard(auth: AuthContext, app: SuiteApp): Promise<{ data: SuiteBoard }> {
  return withTransaction(async (tx) => {
    const records = await repository.listRecords(tx, auth.tenantId, app)
    return {
      data: {
        app,
        stages: suiteStages[app],
        records,
        facets: {
          department: countFacet(records, (row) => row.department),
          location: countFacet(records, (row) => row.branchName),
          brand: countFacet(records, (row) => row.brandName),
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
    const before = (await repository.listRecords(tx, auth.tenantId, app)).find((row) => row.id === id)
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
