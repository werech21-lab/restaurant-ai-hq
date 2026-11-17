/**
 * Pure selector for scoping `OdooPeriodCube` headline KPIs (`netSalesKwd`, `orders`, `aovKwd`)
 * to the active `{ branch, brand, channel }` filter.
 *
 * Honesty rules:
 * - Never falls back to company-wide totals when a branch, brand, or channel filter is active.
 * - Returns `null` for any metric the cube cannot honestly provide (e.g. `brand + branch` orders,
 *   `brand` when order count timed out, `brand + channel`, or a missing branch/brand/channel).
 */

import type { OdooPeriodCube } from '@/lib/odoo-live-connector'

export interface CubeHeadlineSelection {
  branch?: string
  brand?: string
  channel?: string
}

export interface PeriodCubeHeadline {
  netSalesKwd: number | null
  orders: number | null
  aovKwd: number | null
}

const NULL_HEADLINE: PeriodCubeHeadline = {
  netSalesKwd: null,
  orders: null,
  aovKwd: null,
}

function normalizeZero(n: number): number {
  return Object.is(n, -0) ? 0 : n
}

function round3(n: number): number {
  return normalizeZero(Math.round(n * 1000) / 1000)
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? round3(value) : null
}

function countOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : null
}

function resolveAov(
  netSalesKwd: number | null,
  orders: number | null,
  explicitAov?: unknown,
): number | null {
  if (netSalesKwd === null || orders === null) return null
  if (typeof explicitAov === 'number' && Number.isFinite(explicitAov)) {
    return round3(explicitAov)
  }
  return orders > 0 ? round3(netSalesKwd / orders) : 0
}

export function selectCubeHeadline(
  cube: OdooPeriodCube | null | undefined,
  selection?: CubeHeadlineSelection,
): PeriodCubeHeadline {
  if (!cube || !cube.connected || cube.noData) {
    return { ...NULL_HEADLINE }
  }

  const branch = selection?.branch ?? 'all'
  const brand = selection?.brand ?? 'all'
  const channel = selection?.channel ?? 'all'

  // POS payment methods are recorded at receipt/branch level, never per product brand line.
  if (brand !== 'all' && channel !== 'all') {
    return { ...NULL_HEADLINE }
  }

  if (brand === 'all' && branch === 'all' && channel === 'all') {
    const netSalesKwd = finiteOrNull(cube.totals?.netSalesKwd)
    const orders = countOrNull(cube.totals?.orders)
    return {
      netSalesKwd,
      orders,
      aovKwd: resolveAov(netSalesKwd, orders, cube.totals?.aovKwd),
    }
  }

  if (brand === 'all' && branch !== 'all' && channel === 'all') {
    const row =
      branch === 'unattributed'
        ? cube.unattributed
        : cube.byBranch?.[branch as keyof OdooPeriodCube['byBranch']]
    if (!row) return { ...NULL_HEADLINE }
    const netSalesKwd = finiteOrNull(row.netKwd)
    const orders = countOrNull(row.orders)
    return {
      netSalesKwd,
      orders,
      aovKwd: resolveAov(netSalesKwd, orders, row.aovKwd),
    }
  }

  if (brand !== 'all' && branch === 'all' && channel === 'all') {
    const row = cube.byBrand?.[brand as keyof OdooPeriodCube['byBrand']]
    if (!row) return { ...NULL_HEADLINE }
    const netSalesKwd = finiteOrNull(row.netKwd)
    const orders = countOrNull(row.orders)
    return {
      netSalesKwd,
      orders,
      aovKwd: resolveAov(netSalesKwd, orders),
    }
  }

  if (brand !== 'all' && branch !== 'all' && channel === 'all') {
    const cell = cube.brandByBranch?.[branch]?.[brand as keyof OdooPeriodCube['byBrand']]
    if (!cell) return { ...NULL_HEADLINE }
    const netSalesKwd = finiteOrNull(cell.netKwd)
    return {
      netSalesKwd,
      orders: null,
      aovKwd: null,
    }
  }

  // brand === 'all' && channel !== 'all'
  if (branch === 'all') {
    const cell = cube.byChannel?.[channel as keyof OdooPeriodCube['byChannel']]
    if (!cell) return { ...NULL_HEADLINE }
    const netSalesKwd = finiteOrNull(cell.netKwd)
    const orders = countOrNull(cell.orders)
    return {
      netSalesKwd,
      orders,
      aovKwd: resolveAov(netSalesKwd, orders),
    }
  }

  const branchRow =
    branch === 'unattributed'
      ? cube.unattributed
      : cube.byBranch?.[branch as keyof OdooPeriodCube['byBranch']]
  const cell = branchRow?.channels?.[channel as keyof OdooPeriodCube['byChannel']]
  if (!cell) return { ...NULL_HEADLINE }
  const netSalesKwd = finiteOrNull(cell.netKwd)
  const orders = countOrNull(cell.orders)
  return {
    netSalesKwd,
    orders,
    aovKwd: resolveAov(netSalesKwd, orders),
  }
}
