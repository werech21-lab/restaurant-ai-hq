import { z } from 'zod'
import { pageQuerySchema } from '@/lib/api/cursor'
import {
  itemUnits,
  MAX_MOVEMENT_QUANTITY,
  MAX_STOCK,
  movementTypes,
  warehouseStatuses,
} from '@/modules/inventory/domain/types'

const versionField = z.number().int().min(1)
const uuid = z.string().uuid()

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value === undefined || value === null || value === '' ? null : value))

const priceField = z.number().int().min(0).max(1_000_000_000)

// ---- items ----

export const createItemSchema = z.object({
  sku: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9._-]{1,40}$/, 'Letters, digits, dot, dash and underscore only')
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(200),
  unit: z.enum(itemUnits),
  unitCostMinor: priceField,
  sellingPriceMinor: priceField,
  reorderLevel: z.number().int().min(0).max(MAX_STOCK),
  isActive: z.boolean().default(true),
})

export type CreateItemInput = z.output<typeof createItemSchema>

/** SKU and unit never change after creation. */
export const updateItemSchema = z.object({
  version: versionField,
  name: z.string().trim().min(1).max(200),
  unitCostMinor: priceField,
  sellingPriceMinor: priceField,
  reorderLevel: z.number().int().min(0).max(MAX_STOCK),
  isActive: z.boolean(),
})

export type UpdateItemInput = z.output<typeof updateItemSchema>

export const idParamsSchema = z.object({ id: uuid })

export const itemSortKeys = ['name', 'sku', 'currentStock', 'sellingPriceMinor'] as const
export type ItemSortKey = (typeof itemSortKeys)[number]

export const itemStatusFilters = ['active', 'inactive', 'all'] as const

export const listItemsQuerySchema = pageQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(itemStatusFilters).default('active'),
  lowStock: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  sort: z.enum(itemSortKeys).default('name'),
  direction: z.enum(['asc', 'desc']).default('asc'),
})

export type ListItemsQuery = z.output<typeof listItemsQuerySchema>

// ---- warehouses ----

const warehouseFields = {
  name: z.string().trim().min(1).max(200),
  location: optionalText(200),
  capacity: z.number().int().min(0).max(MAX_STOCK).nullable().optional().transform((value) => value ?? null),
  status: z.enum(warehouseStatuses),
}

export const createWarehouseSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{1,20}$/, 'Letters, digits, dash and underscore only')
    .transform((value) => value.toUpperCase()),
  ...warehouseFields,
  status: z.enum(warehouseStatuses).default('active'),
})

export type CreateWarehouseInput = z.output<typeof createWarehouseSchema>

export const updateWarehouseSchema = z.object({ version: versionField, ...warehouseFields })

export type UpdateWarehouseInput = z.output<typeof updateWarehouseSchema>

export const listWarehousesQuerySchema = pageQuerySchema.extend({
  status: z.enum(['active', 'inactive', 'all']).default('all'),
})

export type ListWarehousesQuery = z.output<typeof listWarehousesQuerySchema>

// ---- movements ----

const quantityField = z.number().int().min(1).max(MAX_MOVEMENT_QUANTITY)

const simpleMovement = z.object({
  type: z.enum(['IN', 'OUT']),
  itemId: uuid,
  warehouseId: uuid,
  quantity: quantityField,
  note: optionalText(200),
})

const transferMovement = z.object({
  type: z.literal('TRANSFER'),
  itemId: uuid,
  fromWarehouseId: uuid,
  toWarehouseId: uuid,
  quantity: quantityField,
  note: optionalText(200),
})

export const createMovementSchema = z
  .discriminatedUnion('type', [simpleMovement, transferMovement])
  .refine((value) => value.type !== 'TRANSFER' || value.fromWarehouseId !== value.toWarehouseId, {
    message: 'A transfer needs two different warehouses',
    path: ['toWarehouseId'],
  })

export type CreateMovementInput = z.output<typeof createMovementSchema>

export const listMovementsQuerySchema = pageQuerySchema.extend({
  itemId: uuid.optional(),
  warehouseId: uuid.optional(),
  type: z.enum(movementTypes).optional(),
  direction: z.enum(['asc', 'desc']).default('desc'),
})

export type ListMovementsQuery = z.output<typeof listMovementsQuerySchema>

export const balanceSortKeys = ['itemName', 'onHand'] as const
export type BalanceSortKey = (typeof balanceSortKeys)[number]

export const listBalancesQuerySchema = pageQuerySchema.extend({
  itemId: uuid.optional(),
  warehouseId: uuid.optional(),
  sort: z.enum(balanceSortKeys).default('itemName'),
  direction: z.enum(['asc', 'desc']).default('asc'),
})

export type ListBalancesQuery = z.output<typeof listBalancesQuerySchema>

export const summaryQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
})

export type SummaryQuery = z.output<typeof summaryQuerySchema>
