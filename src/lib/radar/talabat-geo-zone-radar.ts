/**
 * talabat-geo-zone-radar.ts
 * ==============================================================================
 * Venture Foods W.L.L. - Kuwait Geo-Spatial & Aggregator Radar Engine
 * ------------------------------------------------------------------------------
 * Strictly separates 3 operational concepts:
 * 1. Restaurant locations: the whitelisted permanent Odoo POS locations
 *    (src/lib/odoo/odoo-dataset.ts); exhibitions (EXB) and school canteens are excluded.
 * 2. Platform accounts: one per brand × aggregator channel where the Odoo POS cube recorded
 *    sales at that location (Tgo = platform fleet, M/TMP = restaurant fleet).
 * 3. Customer delivery areas: residential areas around each location; their live statuses,
 *    durations and lost-order estimates are a deterministic model, not Odoo data.
 * ==============================================================================
 */
import { BRANDS, CHANNELS } from '@/lib/aether/ledger'
import { ODOO } from '@/lib/odoo/odoo-dataset'
import { zoneLabelAr } from '@/modules/governance/domain/zone-labels'

export type DeliveryZoneStatus =
  | 'ONLINE_VISIBLE'     // 🟢 متاح وظاهر للعميل
  | 'BUSY_IN_AREA'       // 🟡 مشغول في المنطقة (Busy in Zone)
  | 'AREA_CLOSED_HIDDEN' // 🔴 المنطقة مقطوعة / المطعم مخفي (Polygon Shrunk)
  | 'FORCED_TGO_17'      // 🟠 تحول قسري من توصيل المطعم M 10% إلى Tgo 17%

export type AccountDeliveryMode = 'Tgo' | 'M'

export type RadarPlatform = 'Talabat' | 'Deliveroo' | 'Keeta' | 'Jahez'

export type IncidentRootCause =
  | 'TALABAT_FLEET_SHORTAGE' // نقص أسطول سائقي طلبات في المنطقة (Talabat Fleet Shortage)
  | 'PEAK_RADIUS_CUT'        // تقليص مضلع التوصيل وقت الذروة (Peak Radius Cut)
  | 'HIGH_KITCHEN_LOAD'      // ضغط المطبخ والطلبات (High Kitchen Load)
  | 'MANUAL_TABLET_STOP'     // إيقاف يدوي مؤقت (Manual Tablet Stop)

/** ثانياً: أفرع المناطق وتغطية المطعم (Restaurant Zone Accounts) */
export interface RestaurantZoneAccount {
  accountId: string
  accountCode: string
  accountNameAr: string
  accountNameEn: string
  branchId: string
  branchCode: string
  branchNameAr: string
  branchNameEn: string
  brandId: string
  brandNameAr: string
  brandNameEn: string
  platform: RadarPlatform
  deliveryMode: AccountDeliveryMode
  commissionPct: number
  sectorNameAr: string
  sectorNameEn: string
  coveredAreasAr: string[]
  coveredAreasEn: string[]
  status: DeliveryZoneStatus
}

/** ثالثاً: مناطق الزبائن (Customer Delivery Areas) */
export interface AreaZoneRecord {
  id: string
  zoneNameAr: string
  zoneNameEn: string
  distanceKm: number
  deliveryMode: AccountDeliveryMode
  platform: RadarPlatform
  brandId: string
  brandNameAr: string
  brandNameEn: string
  zoneAccountId: string
  zoneAccountNameAr: string
  zoneAccountNameEn: string
  status: DeliveryZoneStatus
  startTime: string
  endTime: string | null
  isOngoing: boolean
  durationMinutes: number
  rootCause: IncidentRootCause
  rootCauseLabelAr: string
  rootCauseLabelEn: string
  estimatedLostOrders: number
  estimatedLostKwd: number
  forcedTgoPenaltyKwd: number
}

/** أولاً: الفروع الفعلية للمطعم (Restaurant Branches) */
export interface BranchRadarProfile {
  branchId: string
  branchCode: string
  branchNameAr: string
  branchNameEn: string
  primaryBrandId: string
  primaryBrandNameAr: string
  primaryBrandNameEn: string
  supportedBrandIds: string[]
  tabletOnline: boolean
  batteryPct: number
  assignedFleetType: 'TALABAT_GO_17' | 'HYBRID_TMP_TGO'
  totalZonesCount: number
  onlineZonesCount: number
  busyZonesCount: number
  hiddenZonesCount: number
  openRatioPct: number
  totalLostKwdToday: number
  zoneAccounts: RestaurantZoneAccount[]
  zones: AreaZoneRecord[]
}

export interface ChronologicalIncident {
  id: string
  timestamp: string
  date: string
  brandNameAr: string
  brandNameEn: string
  branchNameAr: string
  branchNameEn: string
  zoneNameAr: string
  zoneNameEn: string
  status: DeliveryZoneStatus
  startTime: string
  endTime: string
  durationMinutes: number
  isOngoing: boolean
  rootCauseLabelAr: string
  rootCauseLabelEn: string
  faultParty: 'TALABAT' | 'BRANCH'
  lostOrders: number
  lostKwd: number
  penaltyKwd: number
  remedyActionAr: string
  remedyActionEn: string
}

export interface GeoRadarKpis {
  totalMonitoredZones: number
  onlineZonesCount: number
  onlineZonesPct: number
  busyZonesCount: number
  avgBusyDurationMinutes: number
  hiddenZonesCount: number
  forcedTgoZonesCount: number
  totalLostSalesKwd: number
  totalTgoPenaltiesKwd: number
  totalFinancialImpactKwd: number
  totalActiveAccounts: number
  tgoAccountsCount: number
  mAccountsCount: number
  issueAccountsCount: number
  lastScannedAt: string
}

// ------------------------------------------------------------------------------
// APPROVED VENTURE FOODS BRANDS WITH ODOO POS SALES (from the live Odoo dataset)
// ------------------------------------------------------------------------------
export const VENTURE_BRANDS = BRANDS.map((b) => ({ id: b.id, nameAr: b.ar, nameEn: b.en, color: b.color }))

export const PERMANENTLY_CLOSED_BRANCHES: any[] = []

// ------------------------------------------------------------------------------
// RESTAURANT LOCATIONS = Odoo whitelisted permanent locations (EXB and school canteens excluded).
// Brand × platform accounts exist only where the Odoo POS cube recorded sales for that brand,
// location and aggregator channel. Customer areas are the residential areas around each location;
// area statuses, durations and lost-order estimates are a deterministic model (not Odoo data).
// ------------------------------------------------------------------------------
const LOCATION_GEO: Record<string, { code: string; areas: [string, string, number][] }> = {
  promenade: { code: 'PRM', areas: [['الرميثية', 'Rumaithiya', 1.4], ['سلوى', 'Salwa', 2.6], ['بيان', 'Bayan', 3.1], ['مشرف', 'Mishref', 3.8]] },
  '360-mall': { code: '360', areas: [['الزهراء', 'Zahra', 0.8], ['جنوب السرة', 'South Surra', 1.9], ['حطين', 'Hittin', 2.4], ['الشهداء', 'Shuhada', 2.9], ['السلام', 'Salam', 3.3]] },
  ardiya: { code: 'ARD', areas: [['العارضية', 'Ardiya', 0.9], ['الأندلس', 'Andalous', 2.2], ['الرابية', 'Rabiya', 2.8], ['الرحاب', 'Rehab', 3.4], ['إشبيلية', 'Ishbiliya', 3.9]] },
  assima: { code: 'ASM', areas: [['مدينة الكويت', 'Kuwait City', 0.7], ['المرقاب', 'Mirqab', 1.9], ['دسمان', 'Dasman', 1.6], ['بنيد القار', 'Bneid Al-Gar', 2.3]] },
  salmiya: { code: 'SLM', areas: [['السالمية', 'Salmiya', 1.0], ['البدع', 'Bidaa', 2.1], ['الشعب البحري', 'Shaab', 2.7], ['الرميثية', 'Rumaithiya', 3.2]] },
  'al-kout': { code: 'KUT', areas: [['الفحيحيل', 'Fahaheel', 0.8], ['المنقف', 'Mangaf', 2.4], ['أبو حليفة', 'Abu Halifa', 3.6], ['الأحمدي', 'Ahmadi', 4.2], ['الفنطاس', 'Fintas', 5.1]] },
  avenues: { code: 'AVN', areas: [['الري', 'Al-Rai', 0.9], ['الشويخ', 'Shuwaikh', 2.2], ['الخالدية', 'Khaldiya', 2.9], ['اليرموك', 'Yarmouk', 3.5], ['القيروان', 'Qairawan', 4.0]] },
}

/** Odoo aggregator channels that map onto platform accounts in the radar. */
const RADAR_CHANNELS: { channel: string; platform: RadarPlatform; mode: AccountDeliveryMode; labelEn: string; labelAr: string }[] = [
  { channel: 'talabat-tgo', platform: 'Talabat', mode: 'Tgo', labelEn: 'Talabat Go (Tgo)', labelAr: 'طلبات جو (Tgo)' },
  { channel: 'talabat-tmp', platform: 'Talabat', mode: 'M', labelEn: 'Talabat Marketplace (TMP)', labelAr: 'سوق طلبات (TMP)' },
  { channel: 'keeta', platform: 'Keeta', mode: 'Tgo', labelEn: 'Keeta', labelAr: 'كيتا' },
  { channel: 'deliveroo-go', platform: 'Deliveroo', mode: 'Tgo', labelEn: 'Deliveroo Go', labelAr: 'ديليفرو جو' },
  { channel: 'deliveroo-mp', platform: 'Deliveroo', mode: 'M', labelEn: 'Deliveroo Marketplace', labelAr: 'سوق ديليفرو' },
  { channel: 'jahez', platform: 'Jahez', mode: 'Tgo', labelEn: 'Jahez', labelAr: 'جاهز' },
]

function radarHash(key: string) {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  return (h >>> 0) / 4294967295
}

const ROOT_CAUSE_LABELS: Record<IncidentRootCause, { ar: string; en: string; fault: 'TALABAT' | 'BRANCH' }> = {
  TALABAT_FLEET_SHORTAGE: { ar: 'نقص أسطول سائقي المنصة في المنطقة', en: 'Platform fleet shortage in the area', fault: 'TALABAT' },
  PEAK_RADIUS_CUT: { ar: 'تقليص مضلع التوصيل وقت الذروة', en: 'Peak delivery-radius shrinkage', fault: 'TALABAT' },
  HIGH_KITCHEN_LOAD: { ar: 'ضغط المطبخ والطلبات في الموقع', en: 'High kitchen load at the location', fault: 'BRANCH' },
  MANUAL_TABLET_STOP: { ar: 'إيقاف يدوي مؤقت للجهاز اللوحي', en: 'Manual tablet stop', fault: 'BRANCH' },
}

const fmtClock = (minutesFromNoon: number) => {
  const total = 12 * 60 + minutesFromNoon
  const h24 = Math.floor(total / 60) % 24
  const m = total % 60
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`
}

function buildBranchProfile(loc: (typeof ODOO.restaurants)[number]): BranchRadarProfile {
  const geo = LOCATION_GEO[loc.id] ?? { code: loc.code, areas: [[loc.ar, loc.en, 1.0]] as [string, string, number][] }
  const branchId = `BR-${geo.code}`
  const brandsAtLocation = [...loc.brands].sort((a, b) => b.netKwd - a.netKwd)
  const primary = BRANDS.find((b) => b.id === brandsAtLocation[0]?.brand) ?? BRANDS[0]

  // Platform accounts: one per brand × aggregator channel with Odoo sales at this location.
  const zoneAccounts: RestaurantZoneAccount[] = []
  for (const rc of RADAR_CHANNELS) {
    const ch = CHANNELS.find((c) => c.id === rc.channel)
    for (const cell of ODOO.cube.filter((r) => r.location === loc.id && r.channel === rc.channel && r.netKwd > 0).sort((a, b) => b.netKwd - a.netKwd)) {
      const brand = BRANDS.find((b) => b.id === cell.brand)
      if (!brand) continue
      zoneAccounts.push({
        accountId: `ACC-${geo.code}-${brand.id}-${rc.channel}`.toUpperCase(),
        accountCode: `${geo.code}-${rc.channel.toUpperCase()}`,
        accountNameAr: `${brand.ar} - ${rc.labelAr} · ${loc.ar}`,
        accountNameEn: `${brand.en} - ${rc.labelEn} · ${loc.en}`,
        branchId,
        branchCode: geo.code,
        branchNameAr: loc.ar,
        branchNameEn: loc.en,
        brandId: brand.id,
        brandNameAr: brand.ar,
        brandNameEn: brand.en,
        platform: rc.platform,
        deliveryMode: rc.mode,
        commissionPct: ch?.commissionPct ?? 0,
        sectorNameAr: `${rc.labelAr} · ${geo.areas.map((a) => a[0]).join('، ')}`,
        sectorNameEn: `${rc.labelEn} · ${geo.areas.map((a) => a[1]).join(', ')}`,
        coveredAreasAr: geo.areas.map((a) => a[0]),
        coveredAreasEn: geo.areas.map((a) => a[1]),
        status: 'ONLINE_VISIBLE',
      })
    }
  }

  // Delivery demand at the location (Odoo aggregator payments) drives the lost-order model.
  const aggPayments = loc.channels.filter((c) => RADAR_CHANNELS.some((rc) => rc.channel === c.channel))
  const aggAmount = aggPayments.reduce((s, c) => s + c.amountKwd, 0)
  const aggOrders = aggPayments.reduce((s, c) => s + c.payments, 0)
  const avgBasket = aggOrders ? aggAmount / aggOrders : 0
  const ordersPerAreaMinute = aggOrders / 31 / (13 * 60) / Math.max(geo.areas.length, 1)
  const tgoPct = CHANNELS.find((c) => c.id === 'talabat-tgo')?.commissionPct ?? 0
  const tmpPct = CHANNELS.find((c) => c.id === 'talabat-tmp')?.commissionPct ?? 0

  const zones: AreaZoneRecord[] = geo.areas.map(([ar, en, km], i) => {
    const acc = zoneAccounts.length ? zoneAccounts[i % zoneAccounts.length] : null
    const h = radarHash(`${loc.id}|${en}`)
    let status: DeliveryZoneStatus = 'ONLINE_VISIBLE'
    if (acc) {
      if (h < 0.1) status = 'AREA_CLOSED_HIDDEN'
      else if (h < 0.24) status = 'BUSY_IN_AREA'
      else if (h < 0.3 && acc.deliveryMode === 'M') status = 'FORCED_TGO_17'
    }
    const rootCause: IncidentRootCause = status === 'AREA_CLOSED_HIDDEN' ? 'PEAK_RADIUS_CUT' : status === 'BUSY_IN_AREA' && h > 0.19 ? 'HIGH_KITCHEN_LOAD' : 'TALABAT_FLEET_SHORTAGE'
    const issue = status !== 'ONLINE_VISIBLE'
    const durationMinutes = issue ? 20 + Math.round(h * 160) : 0
    const lostOrders = status === 'BUSY_IN_AREA' || status === 'AREA_CLOSED_HIDDEN' ? Math.max(1, Math.round(durationMinutes * ordersPerAreaMinute * (status === 'AREA_CLOSED_HIDDEN' ? 1 : 0.5))) : 0
    const lostKwd = Math.round(lostOrders * avgBasket * 1000) / 1000
    const forcedOrders = status === 'FORCED_TGO_17' ? Math.max(1, Math.round(durationMinutes * ordersPerAreaMinute)) : 0
    const penalty = Math.round(forcedOrders * avgBasket * ((tgoPct - tmpPct) / 100) * 1000) / 1000
    if (acc && issue && acc.status === 'ONLINE_VISIBLE') acc.status = status
    const label = ROOT_CAUSE_LABELS[rootCause]
    return {
      id: `${geo.code}-Z${i + 1}`,
      zoneNameAr: ar,
      zoneNameEn: en,
      distanceKm: km,
      deliveryMode: acc?.deliveryMode ?? 'Tgo',
      platform: acc?.platform ?? 'Talabat',
      brandId: acc?.brandId ?? primary.id,
      brandNameAr: acc?.brandNameAr ?? primary.ar,
      brandNameEn: acc?.brandNameEn ?? primary.en,
      zoneAccountId: acc?.accountId ?? '',
      zoneAccountNameAr: acc?.accountNameAr ?? '—',
      zoneAccountNameEn: acc?.accountNameEn ?? '—',
      status,
      startTime: issue ? fmtClock(Math.round(h * 600)) : '11:00 AM',
      endTime: null,
      isOngoing: issue,
      durationMinutes,
      rootCause,
      rootCauseLabelAr: issue ? `${label.ar} (نموذج)` : `طبيعي - ${acc?.deliveryMode === 'M' ? 'تغطية المطعم (TMP)' : 'تغطية المنصة (Tgo)'}`,
      rootCauseLabelEn: issue ? `${label.en} (model)` : `Normal - ${acc?.deliveryMode === 'M' ? 'Restaurant Fleet (TMP)' : 'Platform Fleet (Tgo)'}`,
      estimatedLostOrders: lostOrders,
      estimatedLostKwd: lostKwd,
      forcedTgoPenaltyKwd: penalty,
    }
  })

  const online = zones.filter((z) => z.status === 'ONLINE_VISIBLE').length
  const busy = zones.filter((z) => z.status === 'BUSY_IN_AREA').length
  const hidden = zones.filter((z) => z.status === 'AREA_CLOSED_HIDDEN').length
  return {
    branchId,
    branchCode: geo.code,
    branchNameAr: loc.ar,
    branchNameEn: loc.en,
    primaryBrandId: primary.id,
    primaryBrandNameAr: primary.ar,
    primaryBrandNameEn: primary.en,
    supportedBrandIds: brandsAtLocation.map((b) => b.brand),
    tabletOnline: true,
    batteryPct: 70 + Math.round(radarHash(`${loc.id}|battery`) * 30),
    assignedFleetType: loc.channels.some((c) => c.channel === 'talabat-tmp' && c.amountKwd > 0) ? 'HYBRID_TMP_TGO' : 'TALABAT_GO_17',
    totalZonesCount: zones.length,
    onlineZonesCount: online,
    busyZonesCount: busy,
    hiddenZonesCount: hidden,
    openRatioPct: zones.length ? Math.round((online / zones.length) * 1000) / 10 : 0,
    totalLostKwdToday: Math.round(zones.reduce((s, z) => s + z.estimatedLostKwd + z.forcedTgoPenaltyKwd, 0) * 1000) / 1000,
    zoneAccounts,
    zones,
  }
}

export const INITIAL_BRANCH_PROFILES: BranchRadarProfile[] = ODOO.restaurants.map(buildBranchProfile)

// ------------------------------------------------------------------------------
// SLA BREACH & BLACKOUT INCIDENT LOG (derived from the modeled area statuses above)
// ------------------------------------------------------------------------------
const INCIDENT_DATE = ODOO.meta.syncedAt.slice(0, 10)

export const HISTORICAL_CHRONOLOGICAL_INCIDENTS: ChronologicalIncident[] = INITIAL_BRANCH_PROFILES.flatMap((b) =>
  b.zones
    .filter((z) => z.status !== 'ONLINE_VISIBLE')
    .map((z) => ({ b, z })),
)
  .sort((x, y) => y.z.estimatedLostKwd + y.z.forcedTgoPenaltyKwd - (x.z.estimatedLostKwd + x.z.forcedTgoPenaltyKwd))
  .slice(0, 6)
  .map(({ b, z }, i) => {
    const fault = ROOT_CAUSE_LABELS[z.rootCause].fault
    return {
      id: `INC-${INCIDENT_DATE.replace(/-/g, '')}-${String(i + 1).padStart(2, '0')}`,
      timestamp: `${INCIDENT_DATE} ${z.startTime}`,
      date: INCIDENT_DATE,
      brandNameAr: z.brandNameAr,
      brandNameEn: z.brandNameEn,
      branchNameAr: b.branchNameAr,
      branchNameEn: b.branchNameEn,
      zoneNameAr: z.zoneNameAr,
      zoneNameEn: z.zoneNameEn,
      status: z.status,
      startTime: z.startTime,
      endTime: 'مستمر الآن',
      durationMinutes: z.durationMinutes,
      isOngoing: true,
      rootCauseLabelAr: z.rootCauseLabelAr,
      rootCauseLabelEn: z.rootCauseLabelEn,
      faultParty: fault,
      lostOrders: z.estimatedLostOrders,
      lostKwd: z.estimatedLostKwd,
      penaltyKwd: z.forcedTgoPenaltyKwd,
      remedyActionAr:
        fault === 'BRANCH'
          ? 'إعادة توزيع طاقم المطبخ وتفعيل خطة الذروة في الموقع'
          : z.status === 'FORCED_TGO_17'
            ? 'المطالبة بفرق العمولة وإعادة المنطقة إلى تغطية المطعم (TMP)'
            : 'تقديم مطالبة رسمية لمدير الحساب في المنصة واستعادة مضلع التوصيل',
      remedyActionEn:
        fault === 'BRANCH'
          ? 'Rebalance kitchen crew and trigger the location peak plan'
          : z.status === 'FORCED_TGO_17'
            ? 'Claim the commission difference and return the area to restaurant fleet (TMP)'
            : 'Lodge a formal claim with the platform account manager and restore the delivery polygon',
    }
  })

// ------------------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------------------
export function calculateGeoRadarKpis(branches: BranchRadarProfile[]): GeoRadarKpis {
  let totalMonitoredZones = 0
  let onlineZonesCount = 0
  let busyZonesCount = 0
  let hiddenZonesCount = 0
  let forcedTgoZonesCount = 0
  let totalLostSalesKwd = 0
  let totalTgoPenaltiesKwd = 0
  let totalBusyMinutes = 0
  let totalActiveAccounts = 0
  let tgoAccountsCount = 0
  let mAccountsCount = 0
  let issueAccountsCount = 0

  for (const branch of branches) {
    for (const acc of branch.zoneAccounts) {
      totalActiveAccounts += 1
      if (acc.deliveryMode === 'Tgo') tgoAccountsCount += 1
      else mAccountsCount += 1
      if (acc.status !== 'ONLINE_VISIBLE') issueAccountsCount += 1
    }
    for (const zone of branch.zones) {
      totalMonitoredZones += 1
      if (zone.status === 'ONLINE_VISIBLE') {
        onlineZonesCount += 1
      } else if (zone.status === 'BUSY_IN_AREA') {
        busyZonesCount += 1
        totalBusyMinutes += zone.durationMinutes
      } else if (zone.status === 'AREA_CLOSED_HIDDEN') {
        hiddenZonesCount += 1
        totalBusyMinutes += zone.durationMinutes
      } else if (zone.status === 'FORCED_TGO_17') {
        forcedTgoZonesCount += 1
      }
      totalLostSalesKwd += zone.estimatedLostKwd
      totalTgoPenaltiesKwd += zone.forcedTgoPenaltyKwd
    }
  }

  const onlineZonesPct = totalMonitoredZones > 0
    ? Number(((onlineZonesCount / totalMonitoredZones) * 100).toFixed(1))
    : 0

  const avgBusyDurationMinutes = (busyZonesCount + hiddenZonesCount) > 0
    ? Math.round(totalBusyMinutes / (busyZonesCount + hiddenZonesCount))
    : 0

  return {
    totalMonitoredZones,
    onlineZonesCount,
    onlineZonesPct,
    busyZonesCount,
    avgBusyDurationMinutes,
    hiddenZonesCount,
    forcedTgoZonesCount,
    totalLostSalesKwd: Number(totalLostSalesKwd.toFixed(3)),
    totalTgoPenaltiesKwd: Number(totalTgoPenaltiesKwd.toFixed(3)),
    totalFinancialImpactKwd: Number((totalLostSalesKwd + totalTgoPenaltiesKwd).toFixed(3)),
    totalActiveAccounts,
    tgoAccountsCount,
    mAccountsCount,
    issueAccountsCount,
    lastScannedAt: new Date().toLocaleTimeString('ar-KW', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  }
}

/** Formats a clean formal email text table for the 3 designated executives */
export function formatTalabatAreaAlertEmail(branches: BranchRadarProfile[], kpis: GeoRadarKpis): string {
  const lines: string[] = [
    '========================================================================================',
    '🚨 AetherBI · VENTURE FOODS W.L.L. — AGGREGATOR (Tgo & M) BUSY & HIDDEN AREAS ALERT',
    '========================================================================================',
    `Date & Time: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuwait' })} (Kuwait Time)`,
    `Active Accounts: ${kpis.totalActiveAccounts} (Tgo: ${kpis.tgoAccountsCount} | M: ${kpis.mAccountsCount})`,
    `Monitored Customer Areas: ${kpis.totalMonitoredZones} | Online: ${kpis.onlineZonesCount} (${kpis.onlineZonesPct}%)`,
    `⚠️ Busy Areas: ${kpis.busyZonesCount} | 🛑 Hidden / Shrunk Polygons: ${kpis.hiddenZonesCount}`,
    `Estimated Lost Sales Today: ${kpis.totalLostSalesKwd.toFixed(3)} KWD`,
    `Tgo 17% Commission Penalty: ${kpis.totalTgoPenaltiesKwd.toFixed(3)} KWD`,
    `Total Commercial Loss: ${kpis.totalFinancialImpactKwd.toFixed(3)} KWD`,
    '----------------------------------------------------------------------------------------',
    'BREAKDOWN OF AFFECTED RESTAURANT LOCATIONS & CUSTOMER DELIVERY AREAS (MODELED STATUSES):',
    '----------------------------------------------------------------------------------------',
  ]

  for (const b of branches) {
    const affected = b.zones.filter((z) => z.status !== 'ONLINE_VISIBLE')
    if (affected.length === 0) continue

    lines.push(`\n🏢 [${b.branchCode}] ${b.branchNameAr} (${b.primaryBrandNameAr}):`)
    for (const z of affected) {
      const statusIcon = z.status === 'BUSY_IN_AREA' ? '🟡 BUSY' : '🔴 HIDDEN / POLYGON CUT'
      const timeStr = z.isOngoing ? `منذ ${z.startTime} (مستمر - ${z.durationMinutes} دقيقة)` : `من ${z.startTime} إلى ${z.endTime} (${z.durationMinutes} دقيقة)`
      lines.push(`   - [${z.deliveryMode}] ${statusIcon} في منطقة [${zoneLabelAr(z.zoneNameAr)}]: ${timeStr}`)
      lines.push(`     * السبب: ${z.rootCauseLabelAr}`)
      lines.push(`     * الخسارة التقديرية: -${z.estimatedLostKwd.toFixed(3)} د.ك | الطلبات الضائعة: ~${z.estimatedLostOrders} طلب`)
    }
  }

  lines.push('\n========================================================================================')
  lines.push('ACTION REQUIRED:')
  lines.push('1. Contact Talabat Key Account Manager to challenge area blackout & polygon restriction.')
  lines.push('2. Export formal SLA Breach penalty claim for invoice reconciliation.')
  lines.push('========================================================================================')

  return lines.join('\n')
}
