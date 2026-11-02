import { describe, expect, it } from 'vitest'
import { classifyShelfLife, computeScrapLossMinor, formatKwdMinor } from '@/modules/food-safety/domain/shelf-life'
import { evaluateVision, healthFromTemp } from '@/modules/food-safety/domain/vision'
import { SCRAP_ACCOUNT_CODE } from '@/modules/food-safety/domain/catalog'
import { createShelfLifeBatch, disposeSpoilage, getFoodSafetyBoard, submitShiftCheckIn } from '@/modules/food-safety'

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
    expect(computeScrapLossMinor(0, 100)).toBe(0)
    expect(computeScrapLossMinor(-1, 100)).toBe(0)
  })
})

describe('food-safety vision', () => {
  it('flags chiller above +5°C as danger', () => {
    const result = evaluateVision({
      unitKind: 'vegetables_chiller',
      reportedTempC: 6.2,
      criticalAboveC: 5,
      warnAboveC: 4,
      tempPanelPhotoName: 'panel.jpg',
      productPhotoName: 'veg.jpg',
    })
    expect(result.verdict).toBe('danger')
  })

  it('flags freezer above -12°C as danger', () => {
    const result = evaluateVision({
      unitKind: 'walk_in_freezer',
      reportedTempC: -10,
      criticalAboveC: -12,
      warnAboveC: -15,
      tempPanelPhotoName: 'panel.jpg',
      productPhotoName: 'meat.jpg',
    })
    expect(result.verdict).toBe('danger')
  })

  it('detects mold cue in photo name', () => {
    const result = evaluateVision({
      unitKind: 'salad_bar_chiller',
      reportedTempC: 2,
      criticalAboveC: 5,
      warnAboveC: 4,
      tempPanelPhotoName: 'panel.jpg',
      productPhotoName: 'salad-mold.jpg',
    })
    expect(result.verdict).toBe('warn')
  })

  it('maps temp bands to health', () => {
    expect(healthFromTemp(2, 4, 5)).toBe('safe')
    expect(healthFromTemp(4.5, 4, 5)).toBe('warn')
    expect(healthFromTemp(6, 4, 5)).toBe('critical')
  })
})

describe('food-safety board & disposal', () => {
  it('seeds cold units across sites and posts scrap to 420001', async () => {
    const board = getFoodSafetyBoard()
    expect(board.units.length).toBeGreaterThan(40)
    expect(board.scrapAccount.code).toBe(SCRAP_ACCOUNT_CODE)
    expect(board.exclusiveRecipients).toHaveLength(3)
    expect(board.maintenance.mobile).toBe('97386439')

    const site = board.sites.find((s) => s.id === 'CK-QURAIN') ?? board.sites[0]
    const created = createShelfLifeBatch({
      siteId: site.id,
      itemCode: 'PP03-DYN',
      preparedBy: 'Test Chef',
      quantity: 3,
    })
    expect(created.batch.barcode).toContain('PP03-DYN')
    expect(created.label).toContain('Brother DK-2205')

    const disposal = await disposeSpoilage({
      siteId: site.id,
      itemCode: 'PP03-DYN',
      quantity: 2,
      reason: 'fridge_breakdown',
      photoName: 'dispose.jpg',
      createdBy: 'Supervisor',
      batchId: created.batch.id,
    })
    expect(disposal.accounting.accountCode).toBe('420001')
    expect(disposal.accounting.lossMinor).toBe(2 * 380)
    expect(disposal.disposal.stockDeducted).toBe(true)
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
    expect(result.checkIn.visionVerdict).toBe('danger')
  })
})
