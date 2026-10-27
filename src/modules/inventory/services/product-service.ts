import { AppError } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/context'
import { db, withTransaction } from '@/lib/db'
import { permissions, type Permission } from '@/lib/auth/permissions'
import type { Product } from '@/modules/inventory/domain/types'
import * as repository from '@/modules/inventory/repositories/product-repository'
import type {
  CreateProductInput,
  DeleteProductInput,
  ListProductsQuery,
  UpdateProductInput,
} from '@/modules/inventory/schemas/product'

export type ProductBody = { data: Product }
export type ProductPage = { data: Product[]; total: number; page: number }

function requirePermission(auth: AuthContext, permission: Permission): void {
  if (!auth.permissions.has(permission)) {
    throw new AppError(403, 'forbidden', 'You do not have permission for this action.')
  }
}

function notFound(): AppError {
  return new AppError(404, 'product_not_found', 'The product was not found.')
}

function versionConflict(): AppError {
  return new AppError(409, 'version_conflict', 'The product was changed by someone else. Reload it and try again.')
}

/** Products of the caller's tenant only. Needs `inventory.item.read`. */
export async function listProducts(auth: AuthContext, query: ListProductsQuery): Promise<ProductPage> {
  requirePermission(auth, permissions.inventoryItemRead)
  const { rows, total } = await repository.listProducts(db, auth.tenantId, query)
  return { data: rows, total, page: query.page }
}

/** Needs `inventory.item.create`. The tenant is the caller's own membership, never a value from the request. */
export async function createProduct(auth: AuthContext, input: CreateProductInput): Promise<ProductBody> {
  requirePermission(auth, permissions.inventoryItemCreate)
  const product = await withTransaction(async (tx) => {
    const created = await repository.insertProduct(tx, auth.tenantId, auth.userId, input)
    await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'product', entityId: created.id, action: 'create', before: null, after: created })
    return created
  })
  return { data: product }
}

/** Needs `inventory.item.update` and the current version. Another tenant's product answers 404, like a missing one. */
export async function updateProduct(auth: AuthContext, id: string, input: UpdateProductInput): Promise<ProductBody> {
  requirePermission(auth, permissions.inventoryItemUpdate)
  const product = await withTransaction(async (tx) => {
    const before = await repository.findProduct(tx, auth.tenantId, id, { lock: true })
    if (!before) throw notFound()
    if (before.version !== input.version) throw versionConflict()
    const after = await repository.updateProduct(tx, auth.tenantId, id, input)
    if (!after) throw versionConflict()
    await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'product', entityId: id, action: 'update', before, after })
    return after
  })
  return { data: product }
}

/** Needs `inventory.item.update` and the current version. The audit row keeps the product as it was. */
export async function deleteProduct(auth: AuthContext, id: string, input: DeleteProductInput): Promise<void> {
  requirePermission(auth, permissions.inventoryItemUpdate)
  await withTransaction(async (tx) => {
    const before = await repository.findProduct(tx, auth.tenantId, id, { lock: true })
    if (!before) throw notFound()
    if (before.version !== input.version) throw versionConflict()
    if (!(await repository.removeProduct(tx, auth.tenantId, id, input.version))) throw versionConflict()
    await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'product', entityId: id, action: 'delete', before, after: null })
  })
}
