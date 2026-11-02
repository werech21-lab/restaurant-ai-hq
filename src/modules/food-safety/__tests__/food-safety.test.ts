import { describe, expect, it } from 'vitest'
import {
  computeExpiry,
  countdownParts,
  formatKuwaitStamp,
  getShelfLifeRule,
  resolveShelfHours,
  SHELF_LIFE_MATRIX,
} from '@/lib/food-safety/shelf-life-matrix'
import { classifyShelfLife, computeScrapLossMinor, formatKwdMinor } from '@/modules/food-safety/domain/shelf-life'
import { SCRAP_ACCOUNT_CODE } from '@/modules/food-safety/domain/catalog'
import { createShelfLifeBatch, disposeSpoilage, getFoodSafetyBoard, getShelfLifeMatrix, submitShiftCheckIn } from '@/modules/food-safety'

describe('HACCP shelf-life matrix', () => {
  it('covers required Odoo prep codes with correct hours', () => {
    expect(SHELF_LIFE_MATRIX.length).toBeGreaterThanOrEqual(40)
    expect(getShelfLifeRule('PP03192')?.hours.chiller).toBe(48)
    expect(getShelfLifeRule('PP03279')?.hours.freezer).toBe(720)
    expect(getShelfLifeRule('PP03279')?.hours.thawed_chiller).toBe(24)
    expect(getShelfLifeRule('PP03279')?.hours.grill_skewer).toBe(12)
    expect(getShelfLifeRule('PP03199')?.hours.line_prep).toBe(8)
    expect(getShelfLifeRule('PP03123')?.hours.chiller).toBe(36)
    expect(getShelfLifeRule('PP03205')?.hours.chiller).toBe(24)
    expect(getShelfLifeRule('PP03117')?.hours.chiller).toBe(72)
    expect(getShelfLifeRule('PP03117')?.hours.line_prep).toBe(12)
    expect(getShelfLifeRule('PP03200')?.hours.chiller).toBe(120)
    expect(resolveShelfHours(getShelfLifeRule('PP03126')!, 'freezer')).toBe(720)
    expect(resolveShelfHours(getShelfLifeRule('PP03126')!, 'line_prep')).toBeNull()
  })

  it('formats Kuwait stamps and live countdown', () => {
    const prepared = new Date('2026-11-02T07:30:00.000Z') // 10:30 Kuwait (UTC+3)
    const stamp = formatKuwaitStamp(prepared)
    expect(stamp).toMatch(/02\/11\/2026/)
    expect(stamp).toMatch(/10:30/)
    const expires = computeExpiry(prepared, 48)
    const mid = countdownParts(expires.toISOString(), new Date(prepared.getTime() + 47 * 3_600_000 + 30 * 60_000))
    expect(mid.expired).toBe(false)
    expect(mid.hours).toBe(0)
    expect(mid.minutes).toBe(30)
    const dead = countdownParts(expires.toISOString(), new Date(expires.getTime() + 1000))
    expect(dead.expired).toBe(true)
    expect(dead.display).toBe('00h : 00m : 00s')
  })
})

describe('food-safety shelf-life', () => {
  it('classifies fresh, fefo, and expired', () => {
    const now = new Date('2026-11-02T12:00:00.000Z')
    expect(classifyShelfLife(new Date(now.getTime() + 12 * 3_600_000).toISOString(), now).status).toBe('fresh')
    expect(classifyShelfLife(new Date(now.getTime() + 3 * 3_600_000).toISOString(), now).status).toBe('fefo')
    expect(classifyShelfLife(new Date(now.getTime() - 60_000).toISOString(), now).status).toBe('expired')
  })

  it('computes KWD scrap loss to 3 decimals via fils', () => {
    expect(computeScrapLossMinor(2, 1850)).toBe(3700)
    expect(formatKwdMinor(3700)).toBe('3.700 KWD')
  })
})

describe('food-safety vision & board', () => {
  it('seeds board from matrix and creates Brother-labeled batch', async () => {
    const matrix = getShelfLifeMatrix()
    expect(matrix.count).toBe(SHELF_LIFE_MATRIX.length)
    const board = getFoodSafetyBoard()
    expect(board.matrixCount).toBe(SHELF_LIFE_MATRIX.length)
    expect(board.exclusiveRecipients).toHaveLength(3)

    const site = board.sites.find((s) => s.id === 'CK-QURAIN') ?? board.sites[0]
    const created = createShelfLifeBatch({
      siteId: site.id,
      itemCode: 'PP03192',
      preparedBy: 'Test Chef',
      quantity: 3,
      storageMode: 'chiller',
    })
    expect(created.batch.shelfHoursApplied).toBe(48)
    expect(created.batch.barcode.startsWith('LOT-VF-')).toBe(true)
    expect(created.labelHtml).toContain('62mm')
    expect(created.label).toContain('EXPIRES:')

    const disposal = await disposeSpoilage({
      siteId: site.id,
      itemCode: 'PP03192',
      quantity: 2,
      reason: 'shelf_life_expired',
      photoName: 'dispose.jpg',
      createdBy: 'Supervisor',
      batchId: created.batch.id,
    })
    expect(disposal.accounting.accountCode).toBe(SCRAP_ACCOUNT_CODE)
    expect(disposal.accounting.lossMinor).toBe(2 * 1850)
  })

  it('rejects invalid storage mode for a SKU', () => {
    const board = getFoodSafetyBoard()
    const site = board.sites[0]
    expect(() =>
      createShelfLifeBatch({
        siteId: site.id,
        itemCode: 'PP03205',
        preparedBy: 'Chef',
        quantity: 1,
        storageMode: 'freezer',
      }),
    ).toThrow('storage_mode_not_allowed')
  })

  it('runs shift check-in vision path', async () => {
    const board = getFoodSafetyBoard()
    const unit = board.units.find((u) => u.kind === 'vegetables_chiller')!
    const result = await submitShiftCheckIn({
      siteId: unit.siteId,
      unitId: unit.id,
      slot: 'start',
      supervisorName: 'Ops Lead',
      tempPanelPhotoName: 'panel.jpg',
      productPhotoName: 'veg.jpg',
      reportedTempC: 7,
    })
    expect(result.vision.verdict).toBe('danger')
  })
})
