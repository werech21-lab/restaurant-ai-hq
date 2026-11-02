import type { ShelfLifeStatus } from '@/modules/food-safety/domain/types'

const FEFO_HOURS = 6

export function classifyShelfLife(expiresAtIso: string, now = new Date()): {
  status: ShelfLifeStatus
  hoursRemaining: number
} {
  const expires = new Date(expiresAtIso).getTime()
  const diffMs = expires - now.getTime()
  const hoursRemaining = Math.round((diffMs / 3_600_000) * 10) / 10
  if (hoursRemaining <= 0) return { status: 'expired', hoursRemaining }
  if (hoursRemaining <= FEFO_HOURS) return { status: 'fefo', hoursRemaining }
  return { status: 'fresh', hoursRemaining }
}

/** Loss in KWD fils (3 decimal places): quantity × unitCostMinor. */
export function computeScrapLossMinor(quantity: number, unitCostMinor: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0
  if (!Number.isFinite(unitCostMinor) || unitCostMinor < 0) return 0
  return Math.round(quantity * unitCostMinor)
}

export function formatKwdMinor(minor: number): string {
  const n = (minor / 1000).toFixed(3)
  return `${n} KWD`
}

export function buildBrotherBarcode(itemCode: string, preparedAt: string, siteId: string): string {
  const stamp = preparedAt.replace(/\D/g, '').slice(0, 12)
  return `VF-${itemCode}-${siteId}-${stamp}`.slice(0, 48)
}

export function brotherLabelPayload(input: {
  itemName: string
  preparedAt: string
  expiresAt: string
  preparedBy: string
  barcode: string
  siteName: string
}): string {
  return [
    'Brother DK-2205 · Venture Foods Shelf-Life',
    `Item: ${input.itemName}`,
    `Site: ${input.siteName}`,
    `Prepared: ${input.preparedAt}`,
    `Expires: ${input.expiresAt}`,
    `By: ${input.preparedBy}`,
    `Barcode: ${input.barcode}`,
  ].join('\n')
}
