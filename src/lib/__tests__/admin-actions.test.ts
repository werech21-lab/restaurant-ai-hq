import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/lib/api/errors'
import { permissions } from '@/lib/auth/permissions'

const authenticateUser = vi.fn()
const createProduct = vi.fn()
const updateProduct = vi.fn()
const removeProduct = vi.fn()
const revalidatePath = vi.fn()

vi.mock('@/lib/auth/context', () => ({ authenticateUser: (...args: unknown[]) => authenticateUser(...args) }))
vi.mock('@/modules/inventory', () => ({
  createProduct: (...args: unknown[]) => createProduct(...args),
  updateProduct: (...args: unknown[]) => updateProduct(...args),
  deleteProduct: (...args: unknown[]) => removeProduct(...args),
}))
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => null) }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() }, errorFields: () => ({}) }))

import { deleteProduct, saveProduct } from '@/app/admin/actions'

const auth = { userId: 'u', tenantId: 't', permissions: new Set<string>() }
const form = { name: 'Burger', category: '', price: '1.500', available: true }
const ID = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  vi.clearAllMocks()
  authenticateUser.mockResolvedValue(auth)
  createProduct.mockResolvedValue({ data: {} })
  updateProduct.mockResolvedValue({ data: {} })
  removeProduct.mockResolvedValue(undefined)
})

describe('saveProduct', () => {
  it('creates with the caller\'s context, exact fils, the default category and no tenant from the form', async () => {
    const result = await saveProduct({ ...form, tenantId: 'someone-elses' } as typeof form)
    expect(result).toEqual({ ok: true })
    expect(authenticateUser).toHaveBeenCalledWith(permissions.inventoryItemCreate, null)
    expect(createProduct).toHaveBeenCalledWith(auth, { name: 'Burger', category: 'عام', priceMinor: 1_500, available: true })
    expect(revalidatePath).toHaveBeenCalledWith('/admin')
  })

  it('updates with the version the form was loaded with, under the update permission', async () => {
    expect(await saveProduct(form, ID, 4)).toEqual({ ok: true })
    expect(authenticateUser).toHaveBeenCalledWith(permissions.inventoryItemUpdate, null)
    expect(updateProduct).toHaveBeenCalledWith(auth, ID, { name: 'Burger', category: 'عام', priceMinor: 1_500, available: true, version: 4 })
  })

  it('rejects bad input before touching authentication or the database', async () => {
    expect(await saveProduct({ ...form, price: '-1' })).toEqual({ ok: false, error: 'price' })
    expect(await saveProduct({ ...form, price: '1.0005' })).toEqual({ ok: false, error: 'price' })
    expect(await saveProduct({ ...form, price: '99999999999' })).toEqual({ ok: false, error: 'price' })
    expect(await saveProduct({ ...form, name: '  ' })).toEqual({ ok: false, error: 'name' })
    expect(await saveProduct({ ...form, category: 'x'.repeat(81) })).toEqual({ ok: false, error: 'category' })
    expect(await saveProduct(form, 'not-a-uuid', 1)).toEqual({ ok: false, error: 'conflict' })
    expect(await saveProduct(form, ID, undefined)).toEqual({ ok: false, error: 'conflict' })
    expect(authenticateUser).not.toHaveBeenCalled()
    expect(createProduct).not.toHaveBeenCalled()
    expect(updateProduct).not.toHaveBeenCalled()
  })

  it.each([
    [new AppError(401, 'unauthenticated', 'x'), 'signin'],
    [new AppError(403, 'forbidden', 'x'), 'forbidden'],
    [new AppError(403, 'no_tenant_access', 'x'), 'forbidden'],
    [new AppError(400, 'tenant_required', 'x'), 'tenant'],
    [new AppError(409, 'version_conflict', 'x'), 'conflict'],
    [new AppError(404, 'product_not_found', 'x'), 'conflict'],
    [new AppError(500, 'server_misconfigured', 'x'), 'config'],
  ])('maps %s to the %s message', async (error, expected) => {
    authenticateUser.mockRejectedValueOnce(error)
    expect(await saveProduct(form)).toEqual({ ok: false, error: expected })
    expect(createProduct).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('hides an unexpected database error behind a generic message', async () => {
    createProduct.mockRejectedValueOnce(new Error('connection to 10.0.0.5 refused, password=secret'))
    const result = await saveProduct(form)
    expect(result).toEqual({ ok: false, error: 'request' })
    expect(JSON.stringify(result)).not.toMatch(/secret|10\.0\.0\.5/)
  })
})

describe('deleteProduct', () => {
  it('deletes under the update permission with the version', async () => {
    expect(await deleteProduct(ID, 2)).toEqual({ ok: true })
    expect(authenticateUser).toHaveBeenCalledWith(permissions.inventoryItemUpdate, null)
    expect(removeProduct).toHaveBeenCalledWith(auth, ID, { version: 2 })
  })

  it('refuses a malformed id and a caller without permission, and deletes nothing', async () => {
    expect(await deleteProduct("1' or '1'='1", 1)).toEqual({ ok: false, error: 'conflict' })
    authenticateUser.mockRejectedValueOnce(new AppError(403, 'forbidden', 'x'))
    expect(await deleteProduct(ID, 1)).toEqual({ ok: false, error: 'forbidden' })
    expect(removeProduct).not.toHaveBeenCalled()
  })
})
