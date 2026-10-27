'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { AppError } from '@/lib/api/errors'
import { authenticateUser } from '@/lib/auth/context'
import { permissions } from '@/lib/auth/permissions'
import { errorFields, logger } from '@/lib/logger'
import { parseKwdToMinor } from '@/lib/money'
import { createClient } from '@/lib/supabase/server'
import { createProduct, deleteProduct as removeProduct, updateProduct } from '@/modules/inventory'
import { createProductSchema, productIdSchema, updateProductSchema } from '@/modules/inventory/client'

export type ProductInput = {
  name: string
  category: string
  price: string
  available: boolean
}

export type ActionError = 'name' | 'price' | 'category' | 'request' | 'config' | 'signin' | 'forbidden' | 'tenant' | 'conflict'
export type ActionResult = { ok: true } | { ok: false; error: ActionError }

const CODE_TO_ERROR: Record<string, ActionError> = {
  server_misconfigured: 'config',
  unauthenticated: 'signin',
  no_tenant_access: 'forbidden',
  forbidden: 'forbidden',
  tenant_required: 'tenant',
  version_conflict: 'conflict',
  product_not_found: 'conflict',
}

function failure(error: unknown): ActionResult {
  if (error instanceof AppError && CODE_TO_ERROR[error.code]) return { ok: false, error: CODE_TO_ERROR[error.code] }
  logger.error('Product action failed', errorFields(error))
  return { ok: false, error: 'request' }
}

function parsed(input: ProductInput): { error: 'name' | 'price' | 'category' } | { value: { name: string; category: string; priceMinor: number; available: boolean } } {
  const priceMinor = parseKwdToMinor(input.price)
  if (priceMinor === null) return { error: 'price' }
  const candidate = createProductSchema.safeParse({ name: input.name, category: input.category, priceMinor, available: input.available })
  if (!candidate.success) {
    const field = candidate.error.issues[0]?.path[0]
    return { error: field === 'priceMinor' ? 'price' : field === 'category' ? 'category' : 'name' }
  }
  return { value: candidate.data }
}

/**
 * Creates a product (no `id`) or changes one (with `id` and the `version` the form was loaded with). The tenant and the
 * permission come from the signed-in user's membership in the database, never from the form.
 */
export async function saveProduct(input: ProductInput, id?: string, version?: number): Promise<ActionResult> {
  const result = parsed(input)
  if ('error' in result) return { ok: false, error: result.error }
  try {
    if (id === undefined) {
      const auth = await authenticateUser(permissions.inventoryItemCreate, null)
      await createProduct(auth, result.value)
    } else {
      if (!productIdSchema.safeParse(id).success) return { ok: false, error: 'conflict' }
      const checked = updateProductSchema.safeParse({ ...result.value, version })
      if (!checked.success) return { ok: false, error: 'conflict' }
      const auth = await authenticateUser(permissions.inventoryItemUpdate, null)
      await updateProduct(auth, id, checked.data)
    }
  } catch (error) {
    return failure(error)
  }
  revalidatePath('/admin')
  return { ok: true }
}

export async function deleteProduct(id: string, version: number): Promise<ActionResult> {
  if (!productIdSchema.safeParse(id).success) return { ok: false, error: 'conflict' }
  try {
    const auth = await authenticateUser(permissions.inventoryItemUpdate, null)
    await removeProduct(auth, id, { version })
  } catch (error) {
    return failure(error)
  }
  revalidatePath('/admin')
  return { ok: true }
}

export async function signOut() {
  const supabase = await createClient()
  if (supabase) await supabase.auth.signOut()
  redirect('/login')
}
