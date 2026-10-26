import { z } from 'zod'
import { pageQuerySchema } from '@/lib/api/cursor'
import { customerStatuses, customerTypes } from '@/modules/crm/domain/types'
import { MAX_MINOR, optionalText, versionField } from '@/modules/crm/schemas/common'

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .regex(/^[^@\s]+@[^@\s]+$/, 'Invalid email address')
  .or(z.literal(''))
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional()
  .transform((value) => value ?? null)

const phone = z
  .string()
  .trim()
  .regex(/^[0-9+()\-\s]{3,32}$/, 'Invalid phone number')
  .or(z.literal(''))
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional()
  .transform((value) => value ?? null)

const creditLimit = z
  .number()
  .int()
  .min(0)
  .max(MAX_MINOR)
  .nullable()
  .optional()
  .transform((value) => value ?? null)

const customerFields = {
  name: z.string().trim().min(1).max(200),
  customerType: z.enum(customerTypes).default('company'),
  email,
  phone,
  taxId: optionalText(40),
  address: optionalText(500),
  /** Fils. Null is no limit, 0 is no credit. */
  creditLimitMinor: creditLimit,
  notes: optionalText(2000),
}

/** A new customer is active unless the caller says otherwise, which keeps the finance inline "add customer" working. */
export const createCustomerSchema = z.object({
  ...customerFields,
  status: z.enum(customerStatuses).default('active'),
})

export type CreateCustomerInput = z.output<typeof createCustomerSchema>

export const updateCustomerSchema = z.object({
  ...customerFields,
  status: z.enum(customerStatuses),
  version: versionField,
})

export type UpdateCustomerInput = z.output<typeof updateCustomerSchema>

export const customerSortKeys = ['name', 'createdAt'] as const

export const listCustomersQuerySchema = pageQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(customerStatuses).optional(),
  sort: z.enum(customerSortKeys).default('name'),
  direction: z.enum(['asc', 'desc']).default('asc'),
})

export type ListCustomersQuery = z.output<typeof listCustomersQuerySchema>
