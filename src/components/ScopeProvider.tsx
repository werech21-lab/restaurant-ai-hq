'use client'

import { createContext, useContext, useMemo, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
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

export type ScopeSnapshot = {
  brandId: VentureBrandId | null
  branchId: VentureBranchId | null
  labelAr: string
  labelEn: string
}

type ScopeContextValue = {
  brandId: VentureBrandId | null
  branchId: VentureBranchId | null
  brand: (typeof VENTURE_BRANDS)[number] | null
  branch: (typeof VENTURE_BRANCHES)[number] | null
  brands: typeof VENTURE_BRANDS
  branches: typeof VENTURE_BRANCHES
  filteredBranches: ReturnType<typeof branchesForBrand>
  labelAr: string
  labelEn: string
  pending: boolean
  setBrand: (brandId: VentureBrandId | null) => void
  setBranch: (branchId: VentureBranchId | null) => void
  reset: () => void
}

const ScopeContext = createContext<ScopeContextValue | null>(null)

function writeScopeCookies(brandId: string | null, branchId: string | null) {
  const maxAge = 60 * 60 * 24 * 365
  document.cookie = `${SCOPE_COOKIE_BRAND}=${brandId ?? ''}; path=/; max-age=${maxAge}; samesite=lax`
  document.cookie = `${SCOPE_COOKIE_BRANCH}=${branchId ?? ''}; path=/; max-age=${maxAge}; samesite=lax`
}

function labelsFor(brandId: VentureBrandId | null, branchId: VentureBranchId | null) {
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
    labelAr: 'كل العلامات التجارية — كل مواقع المطاعم (7)',
    labelEn: 'All 7 brands — All 7 restaurant locations',
  }
}

export function ScopeProvider({
  initial,
  children,
}: {
  initial: ScopeSnapshot
  children: ReactNode
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const brandId = initial.brandId
  const branchId = initial.branchId

  const value = useMemo<ScopeContextValue>(() => {
    const apply = (nextBrand: VentureBrandId | null, nextBranch: VentureBranchId | null) => {
      const parsed = parseScopeIds({ brandId: nextBrand, branchId: nextBranch })
      writeScopeCookies(parsed.brandId, parsed.branchId)
      startTransition(() => {
        router.refresh()
      })
    }

    return {
      brandId,
      branchId,
      brand: brandById(brandId),
      branch: branchById(branchId),
      brands: VENTURE_BRANDS,
      branches: VENTURE_BRANCHES,
      filteredBranches: branchesForBrand(brandId),
      ...labelsFor(brandId, branchId),
      pending,
      setBrand: (id) => {
        const keepBranch = id && branchId && branchById(branchId)?.brandId === id ? branchId : null
        apply(id, keepBranch)
      },
      setBranch: (id) => {
        const branch = branchById(id)
        apply(branch?.brandId ?? brandId, id)
      },
      reset: () => apply(null, null),
    }
  }, [brandId, branchId, pending, router])

  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>
}

export function useScope() {
  const value = useContext(ScopeContext)
  if (!value) throw new Error('useScope must be used within ScopeProvider')
  return value
}

export function useOptionalScope() {
  return useContext(ScopeContext)
}
