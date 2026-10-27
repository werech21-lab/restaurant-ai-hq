import { z } from 'zod'
import { pageQuerySchema } from '@/lib/api/cursor'
import { orgStatuses } from '@/modules/org/domain/types'

const uuid = z.string().uuid()
const versionField = z.number().int().min(1)

export const idParamsSchema = z.object({ id: uuid })

const code = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{1,20}$/, 'Letters, digits, dash and underscore only')
  .transform((value) => value.toUpperCase())

const name = z.string().trim().min(1).max(200)

const timezone = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value })
      return true
    } catch {
      return false
    }
  }, 'Not a known time zone')

export const createBrandSchema = z.object({ code, name, status: z.enum(orgStatuses).default('active') })
export type CreateBrandInput = z.output<typeof createBrandSchema>

/** The code is the brand's identity and cannot change. */
export const updateBrandSchema = z.object({ version: versionField, name, status: z.enum(orgStatuses) })
export type UpdateBrandInput = z.output<typeof updateBrandSchema>

export const listBrandsQuerySchema = pageQuerySchema.extend({ status: z.enum(['active', 'inactive', 'all']).default('all') })
export type ListBrandsQuery = z.output<typeof listBrandsQuerySchema>

export const createBranchSchema = z.object({
  brandId: uuid,
  code,
  name,
  timezone: timezone.default('UTC'),
  status: z.enum(orgStatuses).default('active'),
})
export type CreateBranchInput = z.output<typeof createBranchSchema>

/** A branch keeps its brand and code for good. */
export const updateBranchSchema = z.object({ version: versionField, name, timezone, status: z.enum(orgStatuses) })
export type UpdateBranchInput = z.output<typeof updateBranchSchema>

export const listBranchesQuerySchema = pageQuerySchema.extend({
  status: z.enum(['active', 'inactive', 'all']).default('all'),
  brandId: uuid.optional(),
})
export type ListBranchesQuery = z.output<typeof listBranchesQuerySchema>