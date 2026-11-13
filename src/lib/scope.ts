import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import {
  SCOPE_COOKIE_BRANCH,
  SCOPE_COOKIE_BRAND,
  VENTURE_BRANCHES,
  VENTURE_BRANDS,
  brandById,
  branchById,
  branchesForBrand,
  parseScopeIds,
  type VentureBranchId,
  type VentureBrandId,
} from '@/lib/venture-hierarchy'

export type ActiveScope = {
  brandId: VentureBrandId | null
  branchId: VentureBranchId | null
  brand: (typeof VENTURE_BRANDS)[number] | null
  branch: (typeof VENTURE_BRANCHES)[number] | null
  /** Empty = company-wide (all brands / all branches). */
  warehouseIds: string[]
  labelAr: string
  labelEn: string
}

let ensurePromise: Promise<void> | null = null

/** Upsert the 10 operating branch warehouses keyed by stable `code`. */
export async function ensureVentureWarehouses() {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      for (const branch of VENTURE_BRANCHES) {
        const brand = brandById(branch.brandId)
        const existing = await prisma.warehouse.findFirst({ where: { code: branch.id } })
        const name = brand ? `${brand.nameAr} · ${branch.areaAr}` : branch.nameAr
        const location = `الكويت · ${branch.areaAr} · ${brand?.nameEn ?? ''}`
        if (existing) {
          await prisma.warehouse.update({
            where: { id: existing.id },
            data: { name, location, brandCode: branch.brandId, code: branch.id },
          })
        } else {
          await prisma.warehouse.create({
            data: {
              code: branch.id,
              brandCode: branch.brandId,
              name,
              location,
              managerName: 'Venture Foods Ops',
              isDefault: branch.id === 'FB-SALMIYA',
            },
          })
        }
      }
    })().catch((error) => {
      ensurePromise = null
      throw error
    })
  }
  await ensurePromise
}

export async function resolveWarehouseIds(brandId: VentureBrandId | null, branchId: VentureBranchId | null) {
  await ensureVentureWarehouses()
  if (branchId) {
    const row = await prisma.warehouse.findFirst({ where: { code: branchId }, select: { id: true } })
    return row ? [row.id] : []
  }
  if (brandId) {
    const rows = await prisma.warehouse.findMany({
      where: { brandCode: brandId },
      select: { id: true },
    })
    return rows.map((row) => row.id)
  }
  return []
}

function scopeLabels(brandId: VentureBrandId | null, branchId: VentureBranchId | null) {
  const brand = brandById(brandId)
  const branch = branchById(branchId)
  if (branch && brand) {
    return {
      labelAr: `${brand.nameAr} — ${branch.areaAr}`,
      labelEn: `${brand.nameEn} — ${branch.areaEn}`,
    }
  }
  if (brand) {
    return {
      labelAr: `${brand.nameAr} — كل الفروع`,
      labelEn: `${brand.nameEn} — all branches`,
    }
  }
  return {
    labelAr: '6 مطاعم • 7 فروع • 8 قنوات',
    labelEn: '6 Brands • 7 Branches • 8 Channels',
  }
}

/** Server helper: cookies first, then optional searchParams override. */
export async function getActiveScope(
  searchParams?: Record<string, string | string[] | number | undefined | null> | null,
): Promise<ActiveScope> {
  const cookieStore = await cookies()
  const rawBrand = searchParams?.brandId
  const rawBranch = searchParams?.branchId
  const paramBrand = Array.isArray(rawBrand) ? rawBrand[0] : rawBrand != null ? String(rawBrand) : undefined
  const paramBranch = Array.isArray(rawBranch) ? rawBranch[0] : rawBranch != null ? String(rawBranch) : undefined
  // Default always ALL to prevent stuck scope cookies from hiding data
  const { brandId, branchId } = parseScopeIds({
    brandId: paramBrand || null,
    branchId: paramBranch || null,
  })
  const warehouseIds = await resolveWarehouseIds(brandId, branchId)
  const labels = scopeLabels(brandId, branchId)
  return {
    brandId,
    branchId,
    brand: brandById(brandId),
    branch: branchById(branchId),
    warehouseIds,
    ...labels,
  }
}

export function salesWhereForScope(warehouseIds: string[]) {
  if (!warehouseIds.length) return {}
  return { warehouseId: { in: warehouseIds } }
}

export function movementWhereForScope(warehouseIds: string[]) {
  if (!warehouseIds.length) return {}
  return { warehouseId: { in: warehouseIds } }
}

export function warehouseWhereForScope(scope: ActiveScope) {
  if (scope.branchId) return { code: scope.branchId }
  if (scope.brandId) return { brandCode: scope.brandId }
  return {}
}

/** Purchase orders linked via stock IN movements to scoped warehouses. */
export async function purchaseOrderNumbersForScope(warehouseIds: string[]) {
  if (!warehouseIds.length) return null as string[] | null
  const rows = await prisma.stockMovement.findMany({
    where: {
      warehouseId: { in: warehouseIds },
      type: 'IN',
      reference: { not: null },
    },
    select: { reference: true },
    distinct: ['reference'],
  })
  return rows.map((row) => row.reference!).filter(Boolean)
}

export function hrDepartmentTokens(scope: ActiveScope) {
  const tokens: string[] = []
  if (scope.brand) {
    tokens.push(scope.brand.nameAr, scope.brand.nameEn, scope.brand.code)
  }
  if (scope.branch) {
    tokens.push(scope.branch.areaAr, scope.branch.areaEn, scope.branch.nameAr, scope.branch.nameEn)
  }
  return tokens.filter(Boolean)
}

export { branchesForBrand, VENTURE_BRANDS, VENTURE_BRANCHES }
