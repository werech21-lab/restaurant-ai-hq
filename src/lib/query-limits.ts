/** Hard caps for every list path that touches Odoo-scale company data. */
export const PAGE_SIZE = 25
export const MAX_PAGE_SIZE = 25
export const STOCK_SIGNAL_SCAN_LIMIT = 200
export const HR_LIST_LIMIT = 25
export const PRISMA_LIST_TAKE = 25

export function clampPage(page: number | undefined): number {
  if (!Number.isFinite(page) || page == null || page < 1) return 1
  return Math.floor(page)
}

export function clampPageSize(size: number | undefined): number {
  if (!Number.isFinite(size) || size == null || size < 1) return PAGE_SIZE
  return Math.min(MAX_PAGE_SIZE, Math.floor(size))
}
