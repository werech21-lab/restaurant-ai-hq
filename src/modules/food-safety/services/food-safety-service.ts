import { listFoodSafetySites, PREP_CATALOG, SCRAP_ACCOUNT_CODE } from '@/modules/food-safety/domain/catalog'
import { buildBrotherBarcode, brotherLabelPayload, classifyShelfLife, computeScrapLossMinor } from '@/modules/food-safety/domain/shelf-life'
import type { ShiftCheckIn, ShelfLifeBatch, SpoilageDisposal } from '@/modules/food-safety/domain/types'
import { evaluateVision } from '@/modules/food-safety/domain/vision'
import type { CreateBatchInput, DisposeInput, ShiftCheckInInput, TelemetryInput } from '@/modules/food-safety/schemas/food-safety'
import { dispatchFoodSafetyAlerts } from '@/modules/food-safety/services/alerts'
import {
  addBatch,
  addCheckIn,
  addDisposal,
  applyTelemetry,
  buildBoard,
  getUnit,
} from '@/modules/food-safety/services/store'

export function getFoodSafetyBoard(filter?: { brandId?: string | null; branchId?: string | null }) {
  return buildBoard(filter)
}

export async function ingestTelemetry(input: TelemetryInput) {
  const { unit, alert } = applyTelemetry({
    unitId: input.unitId,
    tempC: input.tempC,
    humidityPct: input.humidityPct,
    door: input.door,
    recordedAt: input.recordedAt,
  })
  let dispatch = null
  if (alert) {
    const site = listFoodSafetySites().find((s) => s.id === unit.siteId)
    dispatch = await dispatchFoodSafetyAlerts({
      kind: 'temp_critical',
      siteNameEn: site?.nameEn ?? unit.siteId,
      siteNameAr: site?.nameAr ?? unit.siteId,
      detailEn: alert.detailEn,
      detailAr: alert.detailAr,
    })
  }
  return { unit, alert, dispatch }
}

export async function submitShiftCheckIn(input: ShiftCheckInInput) {
  const unit = getUnit(input.unitId)
  if (!unit) throw new Error('unit_not_found')
  if (unit.siteId !== input.siteId) throw new Error('site_unit_mismatch')
  const vision = evaluateVision({
    unitKind: unit.kind,
    reportedTempC: input.reportedTempC ?? null,
    criticalAboveC: unit.criticalAboveC,
    warnAboveC: unit.warnAboveC,
    tempPanelPhotoName: input.tempPanelPhotoName,
    productPhotoName: input.productPhotoName,
    notes: input.notes,
  })
  const row: ShiftCheckIn = {
    id: `CHK-${Date.now()}`,
    siteId: input.siteId,
    unitId: input.unitId,
    slot: input.slot,
    supervisorName: input.supervisorName,
    tempPanelPhotoName: input.tempPanelPhotoName,
    productPhotoName: input.productPhotoName,
    reportedTempC: input.reportedTempC ?? null,
    visionVerdict: vision.verdict,
    visionReasonsEn: vision.reasonsEn,
    visionReasonsAr: vision.reasonsAr,
    createdAt: new Date().toISOString(),
  }
  addCheckIn(row)
  let dispatch = null
  if (vision.verdict === 'danger') {
    const site = listFoodSafetySites().find((s) => s.id === input.siteId)
    dispatch = await dispatchFoodSafetyAlerts({
      kind: 'vision_danger',
      siteNameEn: site?.nameEn ?? input.siteId,
      siteNameAr: site?.nameAr ?? input.siteId,
      detailEn: vision.reasonsEn.join('; '),
      detailAr: vision.reasonsAr.join('; '),
    })
  }
  return { checkIn: row, vision, dispatch }
}

export function createShelfLifeBatch(input: CreateBatchInput) {
  const site = listFoodSafetySites().find((s) => s.id === input.siteId)
  if (!site) throw new Error('site_not_found')
  const prep = PREP_CATALOG.find((p) => p.code === input.itemCode)
  if (!prep) throw new Error('item_not_found')
  const preparedAt = input.preparedAt ? new Date(input.preparedAt) : new Date()
  const expiresAt = new Date(preparedAt.getTime() + prep.shelfLifeHours * 3_600_000)
  const cls = classifyShelfLife(expiresAt.toISOString(), new Date())
  const row: ShelfLifeBatch = {
    id: `BATCH-${Date.now()}`,
    siteId: site.id,
    brandId: site.brandId,
    brandNameEn: site.brandNameEn,
    brandNameAr: site.brandNameAr,
    itemCode: prep.code,
    itemNameEn: prep.nameEn,
    itemNameAr: prep.nameAr,
    preparedAt: preparedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    preparedBy: input.preparedBy,
    quantity: input.quantity,
    unitCostMinor: prep.unitCostMinor,
    barcode: buildBrotherBarcode(prep.code, preparedAt.toISOString(), site.id),
    status: cls.status,
    hoursRemaining: cls.hoursRemaining,
  }
  addBatch(row)
  const label = brotherLabelPayload({
    itemName: prep.nameEn,
    preparedAt: preparedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    preparedBy: input.preparedBy,
    barcode: row.barcode,
    siteName: site.nameEn,
  })
  return { batch: row, label }
}

export function printBatchLabel(batchId: string) {
  const board = buildBoard()
  const batch = board.batches.find((b) => b.id === batchId)
  if (!batch) throw new Error('batch_not_found')
  const site = board.sites.find((s) => s.id === batch.siteId)
  const label = brotherLabelPayload({
    itemName: batch.itemNameEn,
    preparedAt: batch.preparedAt,
    expiresAt: batch.expiresAt,
    preparedBy: batch.preparedBy,
    barcode: batch.barcode,
    siteName: site?.nameEn ?? batch.siteId,
  })
  return { batch, label }
}

export async function disposeSpoilage(input: DisposeInput) {
  const site = listFoodSafetySites().find((s) => s.id === input.siteId)
  if (!site) throw new Error('site_not_found')
  const prep = PREP_CATALOG.find((p) => p.code === input.itemCode)
  const unitCost = input.unitCostMinor ?? prep?.unitCostMinor ?? 500
  const lossMinor = computeScrapLossMinor(input.quantity, unitCost)
  const journalRef = `SCRAP-${SCRAP_ACCOUNT_CODE}-${Date.now()}`
  const row: SpoilageDisposal = {
    id: `DISP-${Date.now()}`,
    siteId: site.id,
    siteNameEn: site.nameEn,
    siteNameAr: site.nameAr,
    itemCode: input.itemCode,
    itemNameEn: prep?.nameEn ?? input.itemCode,
    itemNameAr: prep?.nameAr ?? input.itemCode,
    quantity: input.quantity,
    reason: input.reason,
    photoName: input.photoName,
    lossMinor,
    scrapAccountCode: SCRAP_ACCOUNT_CODE,
    journalRef,
    stockDeducted: true,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
    batchId: input.batchId ?? null,
    unitId: input.unitId ?? null,
  }
  addDisposal(row)
  const dispatch = await dispatchFoodSafetyAlerts({
    kind: 'spoilage',
    siteNameEn: site.nameEn,
    siteNameAr: site.nameAr,
    detailEn: `${row.itemNameEn} × ${row.quantity} · ${(lossMinor / 1000).toFixed(3)} KWD → ${SCRAP_ACCOUNT_CODE}`,
    detailAr: `${row.itemNameAr} × ${row.quantity} · ${(lossMinor / 1000).toFixed(3)} د.ك → ${SCRAP_ACCOUNT_CODE}`,
  })
  return {
    disposal: row,
    accounting: {
      accountCode: SCRAP_ACCOUNT_CODE,
      accountNameEn: 'Cost of Scrap',
      lossMinor,
      lossKwd: (lossMinor / 1000).toFixed(3),
      journalRef,
      stockDeducted: true,
      pnlImpact: true,
      stockCountPath: '/stock-count',
    },
    dispatch,
  }
}
