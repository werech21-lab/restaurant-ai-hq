import { z } from 'zod'
import { DEFAULT_PRODUCT_CATEGORY, MAX_PRODUCT_PRICE_MINOR } from '@/modules/inventory/domain/types'

const versionField = z.number().int().min(1)

const productFields = {
  name: z.string().trim().min(1).max(200),
  category: z
    .string()
    .trim()
    .max(80)
    .transform((value) => (value === '' ? DEFAULT_PRODUCT_CATEGORY : value)),
  priceMinor: z.number().int().min(0).max(MAX_PRODUCT_PRICE_MINOR),
  available: z.boolean(),
}

export const productIdSchema = z.string().uuid()

export const createProductSchema = z.object(productFields)
export type CreateProductInput = z.output<typeof createProductSchema>

/** The tenant of a product never changes, so it is not part of any input. */
export const updateProductSchema = z.object({ version: versionField, ...productFields })
export type UpdateProductInput = z.output<typeof updateProductSchema>

export const deleteProductSchema = z.object({ version: versionField })
export type DeleteProductInput = z.output<typeof deleteProductSchema>

export const PRODUCT_PAGE_SIZE = 50

export const listProductsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.number().int().min(1).max(100_000).default(1),
})
export type ListProductsQuery = z.output<typeof listProductsQuerySchema>
