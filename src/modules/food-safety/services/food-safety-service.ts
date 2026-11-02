import {
  computeExpiry,
  defaultStorageMode,
  getShelfLifeRule,
  listShelfLifeRules,
  resolveShelfHours,
  type BrandScope,
  type ShelfCategory,
  type StorageMode,
} from '@/lib/food-safety/shelf-life-matrix'
import { listFoodSafetySites, PREP_CATALOG, SCRAP_ACCOUNT_CODE } from '@/modules/food-safety/domain/catalog'
import { brotherLabelHtml, brotherLabelPayload, buildBrotherBarcode, classifyShelfLife, computeScrapLossMinor } from '@/modules/food-safety/domain/shelf-life'
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

export function getShelfLifeMatrix(filter?: {
  brand?: string | null
  category?: string | null
  query?: string | null
}) {
  const rules = listShelfLifeRules({
    brand: filter?.brand as BrandScope | null,
    category: filter?.category as ShelfCategory | null,
    query: filter?.query,
  })
  return {
    count: rules.length,
    rules,
    catalog: PREP_CATALOG,
  }
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
  const rule = getShelfLifeRule(input.itemCode)
  if (!rule) throw new Error('item_not_found')
  const mode: StorageMode = input.storageMode ?? defaultStorageMode(rule)
  const shelfHours = resolveShelfHours(rule, mode)
  if (shelfHours == null) throw new Error('storage_mode_not_allowed')
  const preparedAt = input.preparedAt ? new Date(input.preparedAt) : new Date()
  const expiresAt = computeExpiry(preparedAt, shelfHours)
  const cls = classifyShelfLife(expiresAt.toISOString(), new Date(), rule.fefoWarnHours)
  const barcode = buildBrotherBarcode(rule.code, preparedAt.toISOString(), site.id)
  const row: ShelfLifeBatch = {
    id: `BATCH-${Date.now()}`,
    siteId: site.id,
    brandId: input.brandId ?? site.brandId,
    brandNameEn: site.brandNameEn,
    brandNameAr: site.brandNameAr,
    itemCode: rule.code,
    itemNameEn: rule.nameEn,
    itemNameAr: rule.nameAr,
    preparedAt: preparedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    preparedBy: input.preparedBy,
    quantity: input.quantity,
    unitCostMinor: rule.unitCostMinor,
    barcode,
    status: cls.status,
    hoursRemaining: cls.hoursRemaining,
    msRemaining: cls.msRemaining,
    storageMode: mode,
    shelfHoursApplied: shelfHours,
    keepTempEn: rule.keepTempEn,
    keepTempAr: rule.keepTempAr,
    fefoWarnHours: rule.fefoWarnHours,
  }
  addBatch(row)
  const labelInput = {
    brandName: site.brandNameEn,
    siteName: site.nameEn,
    itemCode: rule.code,
    itemName: rule.nameEn,
    preparedAt: preparedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    shelfHours,
    keepTemp: rule.keepTempEn,
    preparedBy: input.preparedBy,
    barcode,
    storageMode: mode,
  }
  return {
    batch: row,
    label: brotherLabelPayload(labelInput),
    labelHtml: brotherLabelHtml(labelInput),
    preview: {
      shelfHours,
      storageMode: mode,
      expiresAtKuwait: expiresAt.toISOString(),
      fefoWarnHours: rule.fefoWarnHours,
    },
  }
}

export function printBatchLabel(batchId: string) {
  const board = buildBoard()
  const batch = board.batches.find((b) => b.id === batchId)
  if (!batch) throw new Error('batch_not_found')
  const site = board.sites.find((s) => s.id === batch.siteId)
  const labelInput = {
    brandName: batch.brandNameEn,
    siteName: site?.nameEn ?? batch.siteId,
    itemCode: batch.itemCode,
    itemName: batch.itemNameEn,
    preparedAt: batch.preparedAt,
    expiresAt: batch.expiresAt,
    shelfHours: batch.shelfHoursApplied,
    keepTemp: batch.keepTempEn,
    preparedBy: batch.preparedBy,
    barcode: batch.barcode,
    storageMode: batch.storageMode,
  }
  return {
    batch,
    label: brotherLabelPayload(labelInput),
    labelHtml: brotherLabelHtml(labelInput),
  }
}

export async function disposeSpoilage(input: DisposeInput) {
  const site = listFoodSafetySites().find((s) => s.id === input.siteId)
  if (!site) throw new Error('site_not_found')
  const rule = getShelfLifeRule(input.itemCode)
  const prep = PREP_CATALOG.find((p) => p.code === input.itemCode)
  const unitCost = input.unitCostMinor ?? rule?.unitCostMinor ?? prep?.unitCostMinor ?? 500
  const lossMinor = computeScrapLossMinor(input.quantity, unitCost)
  const journalRef = `SCRAP-${SCRAP_ACCOUNT_CODE}-${Date.now()}`
  const row: SpoilageDisposal = {
    id: `DISP-${Date.now()}`,
    siteId: site.id,
    siteNameEn: site.nameEn,
    siteNameAr: site.nameAr,
    itemCode: input.itemCode,
    itemNameEn: rule?.nameEn ?? prep?.nameEn ?? input.itemCode,
    itemNameAr: rule?.nameAr ?? prep?.nameAr ?? input.itemCode,
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

export async function alertExclusiveForBatch(batchId: string) {
  const board = buildBoard()
  const batch = board.batches.find((b) => b.id === batchId)
  if (!batch) throw new Error('batch_not_found')
  const site = board.sites.find((s) => s.id === batch.siteId)
  return dispatchFoodSafetyAlerts({
    kind: 'spoilage',
    siteNameEn: site?.nameEn ?? batch.siteId,
    siteNameAr: site?.nameAr ?? batch.siteId,
    detailEn: `EXPIRED batch ${batch.itemCode} ${batch.itemNameEn} · LOT ${batch.barcode} — ban use and dispose to 420001`,
    detailAr: `دفعة منتهية ${batch.itemCode} ${batch.itemNameAr} · LOT ${batch.barcode} — حظر الاستخدام وإعدام إلى 420001`,
  })
}
