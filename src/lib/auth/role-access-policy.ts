import type { ExecSessionRole } from '@/lib/auth/exec-role-meta'

/**
 * Pure Edge-, Server-, and Client-safe RBAC Route & Action Isolation Matrix
 * (`src/lib/auth/role-access-policy.ts`).
 * Contains ZERO secrets, hashes, or corporate email literals so it is safe to import anywhere.
 */

const SHORT_ERP_ROUTE_ALIASES: Record<string, string> = {
  '/erp/reviews': '/erp/social-reviews',
  '/erp/booth': '/erp/booth-feasibility',
  '/erp/commissions': '/erp/aggregator-radar',
}

function stripTrailingSlash(pathname: string): string {
  const trimmed = String(pathname || '').split('?')[0]?.split('#')[0]?.trim() || ''
  if (trimmed.length > 1 && trimmed.endsWith('/')) {
    return trimmed.replace(/\/+$/, '')
  }
  return trimmed
}

/**
 * Resolves friendly short `/erp/*` route slugs (`/erp/reviews`, `/erp/booth`, `/erp/commissions`)
 * to their canonical Next.js App Router directory paths when matched.
 */
export function resolveCanonicalErpAlias(pathname: string): string | null {
  const clean = stripTrailingSlash(pathname)
  for (const [alias, target] of Object.entries(SHORT_ERP_ROUTE_ALIASES)) {
    if (clean === alias) return target
    if (clean.startsWith(`${alias}/`)) {
      return `${target}${clean.slice(alias.length)}`
    }
  }
  return null
}

const MARKETING_ALLOWED_PREFIXES = [
  '/erp/cores',
  '/erp/weekday-comparison',
  '/erp/before-after',
  '/erp/social-reviews',
  '/erp/reviews',
  '/erp/booth-feasibility',
  '/erp/booth',
  '/erp/events-intelligence',
  '/erp/feryal-ai',
  '/erp/feryal',
] as const

const SUPPLY_ALLOWED_PREFIXES = [
  '/erp/warehouse-chain',
  '/erp/prep-sla',
  '/erp/delivery-sla',
  '/erp/feryal-ai',
  '/erp/feryal',
] as const

function matchesAnyPrefix(cleanPath: string, prefixes: readonly string[]): boolean {
  return prefixes.some(
    (prefix) => cleanPath === prefix || cleanPath.startsWith(`${prefix}/`),
  )
}

/**
 * Evaluates whether `role` is authorized to view a given `/erp` or `/erp/*` route.
 * - `marketing`: `/erp` (sales/orders/quiet hours with rent/payroll/supplier costs masked),
 *   `/erp/cores`, `/erp/weekday-comparison`, `/erp/before-after`, `/erp/reviews` (`/erp/social-reviews`),
 *   `/erp/booth` (`/erp/booth-feasibility`), and `/erp/feryal-ai` (`/erp/feryal`).
 *   Explicitly blocks `/erp/commissions` (`/erp/aggregator-radar`), `/erp/planning`,
 *   `/erp/regulations`, `/erp/warehouse-chain`, `/erp/prep-sla`, `/erp/delivery-sla`, etc.
 * - `supply`: `/erp/warehouse-chain` (Ardiya Central Kitchen EXB -> 7 active branches),
 *   `/erp/prep-sla`, `/erp/delivery-sla`, and `/erp/feryal-ai` (`/erp/feryal`).
 *   Explicitly blocks sensitive P&L (`/erp`, `/erp/cores`, `/erp/weekday-comparison`, `/erp/before-after`),
 *   commissions, planning, reviews, booth, and regulatory routes.
 * - `admin` | `gm` | `dgm` | `ops` | `cfo` | `auditor`: full 13-module visibility
 *   (`auditor` remains strictly Read-Only on all mutation endpoints; `/erp/admin` & terminal mappings remain `admin`-only).
 */
export function isErpRouteAllowedForRole(
  role: ExecSessionRole,
  pathname: string,
): boolean {
  const clean = stripTrailingSlash(pathname)
  if (clean !== '/erp' && !clean.startsWith('/erp/')) {
    if (role === 'supply' || role === 'marketing') {
      return false
    }
    return true
  }

  if (
    (clean === '/erp/admin' ||
      clean.startsWith('/erp/admin/') ||
      clean === '/erp/iam' ||
      clean.startsWith('/erp/iam/')) &&
    role !== 'admin'
  ) {
    return false
  }

  if (role === 'marketing') {
    if (clean === '/erp') return true
    return matchesAnyPrefix(clean, MARKETING_ALLOWED_PREFIXES)
  }

  if (role === 'supply') {
    return matchesAnyPrefix(clean, SUPPLY_ALLOWED_PREFIXES)
  }

  return true
}

/**
 * Safe redirect destination when a scoped role visits a forbidden route:
 * - `marketing` -> `/erp/cores`
 * - `supply`    -> `/erp/warehouse-chain`
 * - others      -> `/erp`
 */
export function resolveRoleRedirectForForbiddenRoute(role: ExecSessionRole): string {
  if (role === 'marketing') return '/erp/cores'
  if (role === 'supply') return '/erp/warehouse-chain'
  return '/erp'
}

/**
 * Default landing route after login or root `/` visit for each executive role.
 */
export function resolveRoleDefaultHome(role: ExecSessionRole): string {
  if (role === 'supply') return '/erp/warehouse-chain'
  return '/erp'
}

/**
 * Computes a safe post-login redirect path honoring each role's RBAC boundary.
 */
export function resolvePostLoginRedirectForRole(
  role: ExecSessionRole,
  sanitizedNext?: string | null,
): string {
  const defaultHome = resolveRoleDefaultHome(role)
  const candidate = String(sanitizedNext || '').trim()
  if (!candidate || candidate === '/' || (candidate === '/erp' && role === 'supply')) {
    return defaultHome
  }
  const pathOnly = candidate.split('?')[0] || candidate
  if (!isErpRouteAllowedForRole(role, pathOnly)) {
    return resolveRoleRedirectForForbiddenRoute(role)
  }
  return candidate
}

/**
 * Returns `true` ONLY for executive roles authorized to trigger `POST /api/erp/odoo-sync`.
 * Explicitly blocks `marketing`, `supply`, and `auditor` (`403 Forbidden`).
 */
export function canTriggerManualOdooSync(role: ExecSessionRole): boolean {
  return (
    role === 'admin' ||
    role === 'gm' ||
    role === 'dgm' ||
    role === 'ops' ||
    role === 'cfo'
  )
}

/**
 * Masks internal rent, payroll, supplier procurement, and net pocket margin figures on `/erp`
 * with `Restricted to Finance/GM` when signed in as `marketing`.
 */
export function shouldMaskInternalCostsForRole(role: ExecSessionRole): boolean {
  return role === 'marketing'
}
