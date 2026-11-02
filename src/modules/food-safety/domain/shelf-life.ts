import {
  formatKuwaitStamp,
  type StorageMode,
} from '@/lib/food-safety/shelf-life-matrix'
import type { ShelfLifeStatus } from '@/modules/food-safety/domain/types'

const FEFO_HOURS = 6

export function classifyShelfLife(
  expiresAtIso: string,
  now = new Date(),
  fefoWarnHours = FEFO_HOURS,
): {
  status: ShelfLifeStatus
  hoursRemaining: number
  msRemaining: number
} {
  const expires = new Date(expiresAtIso).getTime()
  const diffMs = expires - now.getTime()
  const hoursRemaining = Math.round((diffMs / 3_600_000) * 10) / 10
  if (diffMs <= 0) return { status: 'expired', hoursRemaining: hoursRemaining > 0 ? 0 : hoursRemaining, msRemaining: 0 }
  if (hoursRemaining <= fefoWarnHours) return { status: 'fefo', hoursRemaining, msRemaining: diffMs }
  return { status: 'fresh', hoursRemaining, msRemaining: diffMs }
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
  return `LOT-VF-${itemCode}-${siteId}-${stamp}`.slice(0, 56)
}

export function brotherLabelPayload(input: {
  brandName: string
  siteName: string
  itemCode: string
  itemName: string
  preparedAt: string
  expiresAt: string
  shelfHours: number
  keepTemp: string
  preparedBy: string
  barcode: string
  storageMode: StorageMode
}): string {
  const prepared = formatKuwaitStamp(new Date(input.preparedAt))
  const expires = formatKuwaitStamp(new Date(input.expiresAt))
  return [
    '════════════════════════════════',
    '  VENTURE FOODS · Brother DK-2205',
    '       62mm × 45mm Shelf-Life',
    '════════════════════════════════',
    `Brand: ${input.brandName}`,
    `Site:  ${input.siteName}`,
    `[${input.itemCode}] ${input.itemName}`,
    `Prepared: ${prepared}`,
    `EXPIRES:  ${expires} | ${input.shelfHours} Hrs`,
    `${input.keepTemp}`,
    `Storage: ${input.storageMode}`,
    `By: ${input.preparedBy}`,
    `Barcode: ${input.barcode}`,
    '════════════════════════════════',
  ].join('\n')
}

/** Printable HTML for Brother DK-2205 (62mm × 45mm). */
export function brotherLabelHtml(input: {
  brandName: string
  siteName: string
  itemCode: string
  itemName: string
  preparedAt: string
  expiresAt: string
  shelfHours: number
  keepTemp: string
  preparedBy: string
  barcode: string
}): string {
  const prepared = formatKuwaitStamp(new Date(input.preparedAt))
  const expires = formatKuwaitStamp(new Date(input.expiresAt))
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${input.barcode}</title>
<style>
  @page { size: 62mm 45mm; margin: 0; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; background: #fff; color: #000; }
  .label { width: 62mm; height: 45mm; box-sizing: border-box; padding: 2.2mm 2.5mm; border: 0.3mm solid #111; display: flex; flex-direction: column; justify-content: space-between; }
  .brand { font-size: 7.5pt; font-weight: 800; letter-spacing: 0.02em; }
  .site { font-size: 6.5pt; color: #222; }
  .item { font-size: 8pt; font-weight: 800; margin-top: 0.8mm; }
  .meta { font-size: 6.2pt; line-height: 1.25; }
  .exp { font-size: 9.5pt; font-weight: 900; margin: 0.6mm 0; border-top: 0.35mm solid #000; border-bottom: 0.35mm solid #000; padding: 0.6mm 0; }
  .bar { font-size: 6pt; font-family: ui-monospace, Consolas, monospace; letter-spacing: 0.04em; }
</style></head><body onload="window.print()">
<div class="label">
  <div>
    <div class="brand">${escapeHtml(input.brandName)} · Venture Foods</div>
    <div class="site">${escapeHtml(input.siteName)}</div>
    <div class="item">[${escapeHtml(input.itemCode)}] ${escapeHtml(input.itemName)}</div>
  </div>
  <div class="meta">Prepared: ${escapeHtml(prepared)}</div>
  <div class="exp">EXPIRES: ${escapeHtml(expires)} | ${input.shelfHours} Hrs</div>
  <div class="meta">${escapeHtml(input.keepTemp)}<br/>By: ${escapeHtml(input.preparedBy)}</div>
  <div class="bar">${escapeHtml(input.barcode)}</div>
</div>
</body></html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
