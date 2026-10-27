import { redirect } from 'next/navigation'
import ProductManager, { type AccessState, type ProductRow } from '@/app/admin/ProductManager'
import { AppError } from '@/lib/api/errors'
import { authenticateUser } from '@/lib/auth/context'
import { permissions } from '@/lib/auth/permissions'
import { errorFields, logger } from '@/lib/logger'
import { supabaseEnv } from '@/lib/supabase/env'
import { listProducts } from '@/modules/inventory'
import { listProductsQuerySchema, PRODUCT_PAGE_SIZE } from '@/modules/inventory/client'

export const dynamic = 'force-dynamic'

type SearchParams = { q?: string | string[]; page?: string | string[] }

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  if (!supabaseEnv()) redirect('/login')
  const params = await searchParams
  const query = listProductsQuerySchema.safeParse({ q: first(params.q) || undefined, page: Number(first(params.page) ?? 1) })
  const { q, page } = query.success ? query.data : { q: undefined, page: 1 }

  let products: ProductRow[] = []
  let total = 0
  let canCreate = false
  let canUpdate = false
  let access: AccessState = 'ok'
  try {
    const auth = await authenticateUser(permissions.inventoryItemRead, null)
    const result = await listProducts(auth, { q, page })
    products = result.data.map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      priceMinor: product.priceMinor,
      available: product.available,
      version: product.version,
    }))
    total = result.total
    canCreate = auth.permissions.has(permissions.inventoryItemCreate)
    canUpdate = auth.permissions.has(permissions.inventoryItemUpdate)
  } catch (error) {
    if (error instanceof AppError && (error.code === 'unauthenticated' || error.code === 'server_misconfigured')) redirect('/login')
    if (error instanceof AppError && (error.code === 'forbidden' || error.code === 'no_tenant_access')) access = 'forbidden'
    else if (error instanceof AppError && error.code === 'tenant_required') access = 'tenant'
    else {
      logger.error('Product list failed', errorFields(error))
      access = 'error'
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8 sm:px-6">
      <ProductManager
        products={products}
        total={total}
        page={page}
        pageSize={PRODUCT_PAGE_SIZE}
        query={q ?? ''}
        canCreate={canCreate}
        canUpdate={canUpdate}
        access={access}
      />
    </main>
  )
}
