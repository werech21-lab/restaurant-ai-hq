import type { Page } from '@/lib/api/cursor'
import { AppError } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/context'
import { permissions } from '@/lib/auth/permissions'
import { isUniqueViolation, requirePermission, versionConflict } from '@/lib/auth/require'
import { db, withTransaction, type Queryable } from '@/lib/db'
import type { Branch, Brand } from '@/modules/org/domain/types'
import { publishOrgEvents, type OrgEvent } from '@/modules/org/events'
import * as repository from '@/modules/org/repositories/org-repository'
import type {
  CreateBranchInput,
  CreateBrandInput,
  ListBranchesQuery,
  ListBrandsQuery,
  UpdateBranchInput,
  UpdateBrandInput,
} from '@/modules/org/schemas/org'

export type BrandBody = { data: Brand }
export type BranchBody = { data: Branch }

function eventBase(auth: AuthContext) {
  return { version: 1 as const, occurredAt: new Date().toISOString(), tenantId: auth.tenantId }
}

const brandNotFound = () => new AppError(404, 'brand_not_found', 'The brand was not found.')
const branchNotFound = () => new AppError(404, 'branch_not_found', 'The branch was not found.')

async function audit(tx: Queryable, auth: AuthContext, entity: 'brand' | 'branch', id: string, action: 'create' | 'update', before: unknown, after: unknown) {
  await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity, entityId: id, action, before, after })
}

// ---- brands ----

export async function createBrand(auth: AuthContext, input: CreateBrandInput): Promise<BrandBody> {
  requirePermission(auth, permissions.orgBrandManage)
  const events: OrgEvent[] = []
  const brand = await withTransaction(async (tx) => {
    let created: Brand
    try {
      created = await repository.insertBrand(tx, auth.tenantId, auth.userId, input)
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError(409, 'brand_code_exists', `A brand with code ${input.code} already exists.`)
      throw error
    }
    await audit(tx, auth, 'brand', created.id, 'create', null, created)
    events.push({ ...eventBase(auth), name: 'org.brand.created', payload: { brandId: created.id, code: created.code, createdBy: auth.userId } })
    return created
  })
  await publishOrgEvents(events)
  return { data: brand }
}

export async function updateBrand(auth: AuthContext, id: string, input: UpdateBrandInput): Promise<BrandBody> {
  requirePermission(auth, permissions.orgBrandManage)
  const events: OrgEvent[] = []
  const brand = await withTransaction(async (tx) => {
    const before = await repository.findBrand(tx, auth.tenantId, id, { lock: true })
    if (!before) throw brandNotFound()
    if (before.version !== input.version) throw versionConflict('brand')
    if (input.status === 'inactive' && before.status === 'active' && (await repository.countActiveBranches(tx, auth.tenantId, id)) > 0) {
      throw new AppError(409, 'brand_has_active_branches', 'Make the brand\'s branches inactive first.')
    }
    if (!(await repository.updateBrand(tx, auth.tenantId, id, input))) throw versionConflict('brand')
    const after = await repository.findBrand(tx, auth.tenantId, id)
    if (!after) throw brandNotFound()
    await audit(tx, auth, 'brand', id, 'update', before, after)
    events.push({ ...eventBase(auth), name: 'org.brand.updated', payload: { brandId: id, code: after.code, status: after.status, updatedBy: auth.userId } })
    return after
  })
  await publishOrgEvents(events)
  return { data: brand }
}

export async function listBrands(auth: AuthContext, query: ListBrandsQuery): Promise<Page<Brand>> {
  requirePermission(auth, permissions.orgBrandRead)
  return repository.listBrands(db, auth.tenantId, query)
}

export async function getBrand(auth: AuthContext, id: string): Promise<BrandBody> {
  requirePermission(auth, permissions.orgBrandRead)
  const brand = await repository.findBrand(db, auth.tenantId, id)
  if (!brand) throw brandNotFound()
  return { data: brand }
}

// ---- branches ----

export async function createBranch(auth: AuthContext, input: CreateBranchInput): Promise<BranchBody> {
  requirePermission(auth, permissions.orgBranchManage)
  const events: OrgEvent[] = []
  const branch = await withTransaction(async (tx) => {
    const brand = await repository.findBrand(tx, auth.tenantId, input.brandId, { lock: true })
    if (!brand) throw brandNotFound()
    if (input.status === 'active' && brand.status !== 'active') throw new AppError(422, 'brand_inactive', 'An active branch needs an active brand.')
    let created: Branch
    try {
      created = await repository.insertBranch(tx, auth.tenantId, auth.userId, input)
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError(409, 'branch_code_exists', `A branch with code ${input.code} already exists.`)
      throw error
    }
    await audit(tx, auth, 'branch', created.id, 'create', null, created)
    events.push({
      ...eventBase(auth),
      name: 'org.branch.created',
      payload: { branchId: created.id, brandId: created.brandId, code: created.code, createdBy: auth.userId },
    })
    return created
  })
  await publishOrgEvents(events)
  return { data: branch }
}

export async function updateBranch(auth: AuthContext, id: string, input: UpdateBranchInput): Promise<BranchBody> {
  requirePermission(auth, permissions.orgBranchManage)
  const events: OrgEvent[] = []
  const branch = await withTransaction(async (tx) => {
    const before = await repository.findBranch(tx, auth.tenantId, id, { lock: true })
    if (!before) throw branchNotFound()
    if (before.version !== input.version) throw versionConflict('branch')
    if (input.status === 'active' && before.status !== 'active') {
      const brand = await repository.findBrand(tx, auth.tenantId, before.brandId, { lock: true })
      if (!brand || brand.status !== 'active') throw new AppError(422, 'brand_inactive', 'An active branch needs an active brand.')
    }
    if (!(await repository.updateBranch(tx, auth.tenantId, id, input))) throw versionConflict('branch')
    const after = await repository.findBranch(tx, auth.tenantId, id)
    if (!after) throw branchNotFound()
    await audit(tx, auth, 'branch', id, 'update', before, after)
    events.push({
      ...eventBase(auth),
      name: 'org.branch.updated',
      payload: { branchId: id, brandId: after.brandId, code: after.code, status: after.status, updatedBy: auth.userId },
    })
    return after
  })
  await publishOrgEvents(events)
  return { data: branch }
}

export async function listBranches(auth: AuthContext, query: ListBranchesQuery): Promise<Page<Branch>> {
  requirePermission(auth, permissions.orgBranchRead)
  return repository.listBranches(db, auth.tenantId, query)
}

export async function getBranch(auth: AuthContext, id: string): Promise<BranchBody> {
  requirePermission(auth, permissions.orgBranchRead)
  const branch = await repository.findBranch(db, auth.tenantId, id)
  if (!branch) throw branchNotFound()
  return { data: branch }
}