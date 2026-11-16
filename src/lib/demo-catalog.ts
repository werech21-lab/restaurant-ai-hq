/** Local seed catalog. Production reads must not surface these rows. */
export const DEMO_PRODUCT_CODES = [
  'EL-1001',
  'EL-1002',
  'EL-1003',
  'EL-1004',
  'OF-2001',
  'OF-2002',
  'OF-2003',
  'OF-2004',
  'FD-3001',
  'FD-3002',
  'FD-3003',
  'FD-3004',
  'PT-4001',
  'PT-4002',
  'PT-4003',
] as const

export const DEMO_SUPPLIER_EMAILS = [
  'kitchen@suppliers.kw',
  'pack@suppliers.kw',
  'central@venturefoods.kw',
  'fresh@suppliers.kw',
] as const

export const DEMO_CUSTOMER_EMAILS = [
  'catering@customers.kw',
  'corporate@customers.kw',
  'farmbrown@customers.kw',
  'shawarma@customers.kw',
] as const

export const DEMO_INVOICE_NUMBERS = ['INV-00001', 'INV-00002', 'INV-00003'] as const
export const DEMO_PURCHASE_NUMBERS = ['PO-00001', 'PO-00002', 'PO-00003'] as const

export function demoCatalogReadsHidden(env: {
  NODE_ENV?: string
  VERCEL_ENV?: string
} = process.env): boolean {
  return env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production'
}

export function demoCatalogSeedAllowed(env: {
  NODE_ENV?: string
  VERCEL_ENV?: string
} = process.env): boolean {
  return !demoCatalogReadsHidden(env)
}
