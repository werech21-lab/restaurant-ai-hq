import {
  brandScopeLabel,
  defaultStorageMode,
  getShelfLifeRule,
  primaryOwnerBrand,
  ruleAllowedAtSiteBrand,
  ruleMatchesBrandFilter,
  SHELF_LIFE_MATRIX,
} from '@/lib/food-safety/shelf-life-matrix'
import {
  COLD_UNIT_SPECS,
  listFoodSafetySites,
  MAINTENANCE_CONTACT,
  SCRAP_ACCOUNT_CODE,
  SCRAP_ACCOUNT_NAME_AR,
  SCRAP_ACCOUNT_NAME_EN,
} from '@/modules/food-safety/domain/catalog'
import { buildBrotherBarcode, classifyShelfLife, computeScrapLossMinor } from '@/modules/food-safety/domain/shelf-life'
import type {
  ColdUnit,
  FoodSafetyAlert,
  FoodSafetyBoard,
  ShiftCheckIn,
  ShelfLifeBatch,
  SpoilageDisposal,
  TelemetryReading,
} from '@/modules/food-safety/domain/types'
import { healthFromTemp } from '@/modules/food-safety/domain/vision'
import { EXCLUSIVE_RADAR_RECIPIENTS } from '@/lib/vf-contact-directory'
import { waLink } from '@/lib/whatsapp'

type Store = {
  units: Map<string, ColdUnit>
  readings: TelemetryReading[]
  checkIns: ShiftCheckIn[]
  batches: ShelfLifeBatch[]
  disposals: SpoilageDisposal[]
  alerts: FoodSafetyAlert[]
  seeded: boolean
}

/** v2 wipes cross-brand seed pollution (China Garden showing Farm Brown / Frank's). */
const STORE_KEY = '__vfFoodSafetyStoreV2' as const

const g = globalThis as typeof globalThis & {
  __vfFoodSafetyStore?: Store
  __vfFoodSafetyStoreV2?: Store
}

function store(): Store {
  // Drop legacy in-memory store so bad cross-brand batches cannot survive redeploys of the process.
  if (g.__vfFoodSafetyStore) delete g.__vfFoodSafetyStore
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = {
      units: new Map(),
      readings: [],
      checkIns: [],
      batches: [],
      disposals: [],
      alerts: [],
      seeded: false,
    }
  }
  return g[STORE_KEY]!
}

function hash(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function seededTemp(unitId: string, targetC: number, criticalAboveC: number, dayKey: string): number {
  const h = hash(`${unitId}:${dayKey}`)
  const roll = h % 100
  // Known problem sites from maintenance data get hotter seed bias
  const hotSites = ['FB-ALKOUT', 'FB-SALMIYA', 'CG-360', 'FB-ARDIYA', 'ST-KEIFAN', 'CG-ASSIMA', 'CK-MAIN']
  const siteId = unitId.split('::')[0] ?? ''
  const isHot = hotSites.includes(siteId) && (unitId.includes('vegetables') || unitId.includes('salad') || unitId.includes('freezer'))
  if (isHot && roll < 18) return criticalAboveC + 1.5 + (h % 20) / 10
  if (roll < 8) return criticalAboveC + 0.4 + (h % 10) / 10
  if (roll < 22) return targetC + 1.2 + (h % 15) / 10
  return targetC + ((h % 21) - 10) / 10
}

function dayKey(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuwait', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

export function ensureSeeded(now = new Date()): void {
  const s = store()
  if (s.seeded) {
    refreshBatchStatuses(now)
    return
  }
  const sites = listFoodSafetySites()
  const key = dayKey(now)
  for (const site of sites) {
    for (const spec of COLD_UNIT_SPECS) {
      const id = `${site.id}::${spec.kind}`
      const tempC = seededTemp(id, spec.targetC, spec.criticalAboveC, key)
      const health = healthFromTemp(tempC, spec.warnAboveC, spec.criticalAboveC)
      const unit: ColdUnit = {
        id,
        siteId: site.id,
        kind: spec.kind,
        nameEn: spec.nameEn,
        nameAr: spec.nameAr,
        targetC: spec.targetC,
        warnAboveC: spec.warnAboveC,
        criticalAboveC: spec.criticalAboveC,
        tempC: Math.round(tempC * 10) / 10,
        humidityPct: 55 + (hash(id) % 25),
        door: hash(id) % 17 === 0 ? 'open' : 'closed',
        health,
        lastReadingAt: now.toISOString(),
        source: 'seed',
      }
      s.units.set(id, unit)
      if (health === 'critical') {
        pushAlert({
          kind: 'temp_critical',
          siteId: site.id,
          titleEn: `Critical fridge temperature · ${site.nameEn}`,
          titleAr: `حرارة براد حرجة · ${site.nameAr}`,
          detailEn: `${spec.nameEn} at ${unit.tempC}°C (limit ${spec.criticalAboveC}°C)`,
          detailAr: `${spec.nameAr} عند ${unit.tempC}°م (الحد ${spec.criticalAboveC}°م)`,
          now,
        })
      }
    }
  }

  // Seed FEFO batches ONLY at sites owned by the SKU's brand (or CK). Never mix brands.
  const seedRules = SHELF_LIFE_MATRIX.filter((r) => r.ownerBrand !== 'SHARED')
  let bi = 0
  for (const prep of seedRules) {
    const owner = primaryOwnerBrand(prep)
    const compatibleSites = sites.filter(
      (site) =>
        site.id === 'CK-MAIN' ||
        (site.brandId != null && ruleAllowedAtSiteBrand(prep, site.brandId)),
    )
    // Prefer brand branches first, then CK — never a foreign brand site.
    const brandSites = compatibleSites.filter((site) => site.brandId === owner)
    const ckSites = compatibleSites.filter((site) => site.id === 'CK-MAIN')
    const pick = [...brandSites.slice(0, 2), ...ckSites.slice(0, 1)]
    for (const site of pick) {
      bi += 1
      const mode = defaultStorageMode(prep)
      const shelfHours = prep.hours[mode] ?? 24
      const hoursAgo = (hash(`${prep.code}:${site.id}`) % Math.max(6, Math.floor(shelfHours * 0.9))) + 1
      const preparedAt = new Date(now.getTime() - hoursAgo * 3_600_000)
      const expiresAt = new Date(preparedAt.getTime() + shelfHours * 3_600_000)
      const cls = classifyShelfLife(expiresAt.toISOString(), now, prep.fefoWarnHours)
      const brandId = site.brandId ?? owner
      const brandNameEn = site.brandId ? site.brandNameEn : brandScopeLabel(owner, true)
      const brandNameAr = site.brandId ? site.brandNameAr : brandScopeLabel(owner, false)
      const batch: ShelfLifeBatch = {
        id: `BATCH-V2-${bi.toString().padStart(4, '0')}`,
        siteId: site.id,
        brandId,
        brandNameEn,
        brandNameAr,
        itemCode: prep.code,
        itemNameEn: prep.nameEn,
        itemNameAr: prep.nameAr,
        preparedAt: preparedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        preparedBy: bi % 2 === 0 ? 'CK Prep Lead' : 'Branch Supervisor',
        quantity: 2 + (hash(prep.code + site.id) % 8),
        unitCostMinor: prep.unitCostMinor,
        barcode: buildBrotherBarcode(prep.code, preparedAt.toISOString(), site.id),
        status: cls.status,
        hoursRemaining: cls.hoursRemaining,
        msRemaining: cls.msRemaining,
        storageMode: mode,
        shelfHoursApplied: shelfHours,
        keepTempEn: prep.keepTempEn,
        keepTempAr: prep.keepTempAr,
        fefoWarnHours: prep.fefoWarnHours,
      }
      s.batches.push(batch)
    }
  }

  s.seeded = true
}

function refreshBatchStatuses(now: Date): void {
  const s = store()
  for (const batch of s.batches) {
    const cls = classifyShelfLife(batch.expiresAt, now, batch.fefoWarnHours ?? 6)
    batch.status = cls.status
    batch.hoursRemaining = cls.hoursRemaining
    batch.msRemaining = cls.msRemaining
  }
}

function pushAlert(input: {
  kind: FoodSafetyAlert['kind']
  siteId: string
  titleEn: string
  titleAr: string
  detailEn: string
  detailAr: string
  now: Date
}): FoodSafetyAlert {
  const s = store()
  const alert: FoodSafetyAlert = {
    id: `AL-${s.alerts.length + 1}-${input.now.getTime()}`,
    kind: input.kind,
    siteId: input.siteId,
    titleEn: input.titleEn,
    titleAr: input.titleAr,
    detailEn: input.detailEn,
    detailAr: input.detailAr,
    createdAt: input.now.toISOString(),
    maintenanceHref: waLink(MAINTENANCE_CONTACT.mobile, `Food Safety alert: ${input.titleEn} — ${input.detailEn}`),
  }
  s.alerts.unshift(alert)
  if (s.alerts.length > 200) s.alerts.length = 200
  return alert
}

export function applyTelemetry(input: {
  unitId: string
  tempC: number
  humidityPct?: number
  door?: ColdUnit['door']
  recordedAt?: string
}): { unit: ColdUnit; alert: FoodSafetyAlert | null } {
  ensureSeeded()
  const s = store()
  const unit = s.units.get(input.unitId)
  if (!unit) throw new Error(`unknown_unit:${input.unitId}`)
  const now = input.recordedAt ? new Date(input.recordedAt) : new Date()
  unit.tempC = Math.round(input.tempC * 10) / 10
  if (input.humidityPct !== undefined) unit.humidityPct = input.humidityPct
  if (input.door) unit.door = input.door
  unit.health = healthFromTemp(unit.tempC, unit.warnAboveC, unit.criticalAboveC)
  unit.lastReadingAt = now.toISOString()
  unit.source = 'iot'
  const reading: TelemetryReading = {
    id: `TEL-${s.readings.length + 1}`,
    unitId: unit.id,
    siteId: unit.siteId,
    tempC: unit.tempC,
    humidityPct: unit.humidityPct,
    door: unit.door,
    recordedAt: unit.lastReadingAt,
    source: 'iot',
  }
  s.readings.unshift(reading)
  if (s.readings.length > 500) s.readings.length = 500
  let alert: FoodSafetyAlert | null = null
  if (unit.health === 'critical') {
    const site = listFoodSafetySites().find((x) => x.id === unit.siteId)
    alert = pushAlert({
      kind: 'temp_critical',
      siteId: unit.siteId,
      titleEn: `Critical fridge temperature · ${site?.nameEn ?? unit.siteId}`,
      titleAr: `حرارة براد حرجة · ${site?.nameAr ?? unit.siteId}`,
      detailEn: `${unit.nameEn} at ${unit.tempC}°C`,
      detailAr: `${unit.nameAr} عند ${unit.tempC}°م`,
      now,
    })
  }
  return { unit, alert }
}

export function addCheckIn(row: ShiftCheckIn): ShiftCheckIn {
  ensureSeeded()
  const s = store()
  s.checkIns.unshift(row)
  if (s.checkIns.length > 300) s.checkIns.length = 300
  if (row.visionVerdict === 'danger') {
    pushAlert({
      kind: 'vision_danger',
      siteId: row.siteId,
      titleEn: 'AI Vision: spoilage / unsafe cold chain',
      titleAr: 'رادار الرؤية: تلف / سلسلة تبريد غير آمنة',
      detailEn: row.visionReasonsEn.join('; '),
      detailAr: row.visionReasonsAr.join('; '),
      now: new Date(row.createdAt),
    })
  }
  return row
}

export function addBatch(row: ShelfLifeBatch): ShelfLifeBatch {
  ensureSeeded()
  store().batches.unshift(row)
  return row
}

export function addDisposal(row: SpoilageDisposal): SpoilageDisposal {
  ensureSeeded()
  const s = store()
  s.disposals.unshift(row)
  if (row.batchId) {
    const batch = s.batches.find((b) => b.id === row.batchId)
    if (batch) {
      batch.quantity = Math.max(0, batch.quantity - row.quantity)
      if (batch.quantity === 0) {
        batch.status = 'expired'
        batch.hoursRemaining = 0
      }
    }
  }
  pushAlert({
    kind: 'spoilage',
    siteId: row.siteId,
    titleEn: `Spoilage disposal · ${row.itemNameEn}`,
    titleAr: `إعدام تلف · ${row.itemNameAr}`,
    detailEn: `${row.quantity} units · loss ${computeScrapLossMinor(row.quantity, row.lossMinor / Math.max(1, row.quantity))} fils posted to ${SCRAP_ACCOUNT_CODE}`,
    detailAr: `${row.quantity} وحدة · خسارة مُرحّلة إلى حساب ${SCRAP_ACCOUNT_CODE}`,
    now: new Date(row.createdAt),
  })
  return row
}

export function getUnit(unitId: string): ColdUnit | undefined {
  ensureSeeded()
  return store().units.get(unitId)
}

export function buildBoard(filter?: { brandId?: string | null; branchId?: string | null }): FoodSafetyBoard {
  ensureSeeded()
  const s = store()
  refreshBatchStatuses(new Date())
  let sites = listFoodSafetySites()
  if (filter?.branchId) sites = sites.filter((x) => x.id === filter.branchId)
  else if (filter?.brandId) {
    // Brand scope: that brand's branches only (CK excluded — avoids false "China Garden" location on CK rows).
    sites = sites.filter((x) => x.brandId === filter.brandId)
  }
  const siteIds = new Set(sites.map((x) => x.id))
  const units = [...s.units.values()].filter((u) => siteIds.has(u.siteId))
  const batches = s.batches.filter((b) => {
    if (!siteIds.has(b.siteId)) return false
    if (!filter?.brandId) return true
    // Strict item ownership — never show Farm Brown SKU under China Garden filter.
    if (b.brandId && b.brandId !== filter.brandId) return false
    const rule = getShelfLifeRule(b.itemCode)
    if (rule && !ruleMatchesBrandFilter(rule, filter.brandId)) return false
    return true
  })
  const checkIns = s.checkIns.filter((c) => siteIds.has(c.siteId)).slice(0, 40)
  const disposals = s.disposals.filter((d) => siteIds.has(d.siteId)).slice(0, 40)
  const alerts = s.alerts.filter((a) => siteIds.has(a.siteId)).slice(0, 40)
  const today = dayKey()
  const scrapLossMinorToday = disposals
    .filter((d) => dayKey(new Date(d.createdAt)) === today)
    .reduce((sum, d) => sum + d.lossMinor, 0)

  const badgeCount =
    units.filter((u) => u.health === 'critical').length +
    batches.filter((b) => b.status === 'expired').length +
    alerts.filter((a) => a.kind !== 'spoilage').length

  return {
    generatedAt: new Date().toISOString(),
    badgeCount,
    sites,
    units,
    batches,
    checkIns,
    disposals,
    alerts,
    kpis: {
      unitsTotal: units.length,
      unitsCritical: units.filter((u) => u.health === 'critical').length,
      unitsWarn: units.filter((u) => u.health === 'warn').length,
      batchesFresh: batches.filter((b) => b.status === 'fresh').length,
      batchesFefo: batches.filter((b) => b.status === 'fefo').length,
      batchesExpired: batches.filter((b) => b.status === 'expired').length,
      scrapLossMinorToday,
      openAlerts: alerts.length,
    },
    matrixCount: SHELF_LIFE_MATRIX.length,
    scrapAccount: {
      code: SCRAP_ACCOUNT_CODE,
      nameEn: SCRAP_ACCOUNT_NAME_EN,
      nameAr: SCRAP_ACCOUNT_NAME_AR,
    },
    maintenance: {
      ...MAINTENANCE_CONTACT,
      waHref: waLink(
        MAINTENANCE_CONTACT.mobile,
        'Urgent cold-chain repair needed — please open a maintenance ticket for the flagged fridge before product spoils.',
      ),
    },
    exclusiveRecipients: EXCLUSIVE_RADAR_RECIPIENTS.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      mobile: r.mobile,
      mobileDisplay: r.mobileDisplay,
    })),
  }
}
