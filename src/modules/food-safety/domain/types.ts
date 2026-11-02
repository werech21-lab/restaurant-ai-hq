export type UnitHealth = 'safe' | 'warn' | 'critical' | 'offline'

export type DoorState = 'closed' | 'open' | 'unknown'

export type ShiftSlot = 'start' | 'mid' | 'end'

export type VisionVerdict = 'safe' | 'warn' | 'danger'

export type ShelfLifeStatus = 'fresh' | 'fefo' | 'expired'

export type SpoilageReason = 'fridge_breakdown' | 'shelf_life_expired' | 'poor_storage' | 'supplier_defect'

export type ColdUnit = {
  id: string
  siteId: string
  kind: string
  nameEn: string
  nameAr: string
  targetC: number
  warnAboveC: number
  criticalAboveC: number
  tempC: number
  humidityPct: number
  door: DoorState
  health: UnitHealth
  lastReadingAt: string
  source: 'iot' | 'seed' | 'manual'
}

export type TelemetryReading = {
  id: string
  unitId: string
  siteId: string
  tempC: number
  humidityPct: number
  door: DoorState
  recordedAt: string
  source: 'iot' | 'manual'
}

export type ShiftCheckIn = {
  id: string
  siteId: string
  unitId: string
  slot: ShiftSlot
  supervisorName: string
  tempPanelPhotoName: string
  productPhotoName: string
  reportedTempC: number | null
  visionVerdict: VisionVerdict
  visionReasonsEn: string[]
  visionReasonsAr: string[]
  createdAt: string
}

export type ShelfLifeBatch = {
  id: string
  siteId: string
  brandId: string | null
  brandNameEn: string
  brandNameAr: string
  itemCode: string
  itemNameEn: string
  itemNameAr: string
  preparedAt: string
  expiresAt: string
  preparedBy: string
  quantity: number
  unitCostMinor: number
  barcode: string
  status: ShelfLifeStatus
  hoursRemaining: number
  msRemaining: number
  storageMode: 'freezer' | 'chiller' | 'line_prep' | 'thawed_chiller' | 'grill_skewer'
  shelfHoursApplied: number
  keepTempEn: string
  keepTempAr: string
  fefoWarnHours: number
}

export type SpoilageDisposal = {
  id: string
  siteId: string
  siteNameEn: string
  siteNameAr: string
  itemCode: string
  itemNameEn: string
  itemNameAr: string
  quantity: number
  reason: SpoilageReason
  photoName: string
  lossMinor: number
  scrapAccountCode: string
  journalRef: string
  stockDeducted: boolean
  createdBy: string
  createdAt: string
  batchId: string | null
  unitId: string | null
}

export type FoodSafetyAlert = {
  id: string
  kind: 'temp_critical' | 'spoilage' | 'vision_danger'
  siteId: string
  titleEn: string
  titleAr: string
  detailEn: string
  detailAr: string
  createdAt: string
  maintenanceHref: string
}

export type FoodSafetyBoard = {
  generatedAt: string
  badgeCount: number
  sites: Array<{
    id: string
    brandId: string | null
    brandNameEn: string
    brandNameAr: string
    areaEn: string
    areaAr: string
    nameEn: string
    nameAr: string
  }>
  units: ColdUnit[]
  batches: ShelfLifeBatch[]
  checkIns: ShiftCheckIn[]
  disposals: SpoilageDisposal[]
  alerts: FoodSafetyAlert[]
  kpis: {
    unitsTotal: number
    unitsCritical: number
    unitsWarn: number
    batchesFresh: number
    batchesFefo: number
    batchesExpired: number
    scrapLossMinorToday: number
    openAlerts: number
  }
  matrixCount: number
  scrapAccount: { code: string; nameEn: string; nameAr: string }
  maintenance: {
    name: string
    titleEn: string
    titleAr: string
    mobile: string
    mobileDisplay: string
    email: string
    waHref: string
  }
  exclusiveRecipients: Array<{
    id: string
    name: string
    email: string
    mobile: string
    mobileDisplay: string
  }>
}
