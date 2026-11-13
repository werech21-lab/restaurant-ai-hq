import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { AppError } from '@/lib/api/errors'
import { DEV_OWNER_COOKIE, devOwnerEnabled, devOwnerUserId } from '@/lib/auth/dev-owner'
import { E2E_COOKIE, e2eEnabled, e2eUserId } from '@/lib/auth/e2e-session'
import {
  EXEC_SESSION_COOKIE,
  verifyExecSessionToken,
  type ExecSessionRole,
} from '@/lib/auth/exec-session'
import {
  getPanelSessionUser,
  panelBridgePermissionSet,
  panelBridgeUserId,
  resolvePanelBridgeTenantId,
} from '@/lib/auth/panel-bridge'
import { db } from '@/lib/pg'
import { createClient } from '@/lib/supabase/server'
import { applyPermissionFlags } from '@/lib/auth/member-flags'
import type { Permission } from '@/lib/auth/permissions'

export type AuthContext = {
  userId: string
  tenantId: string
  permissions: ReadonlySet<string>
}

/** The signed-in user as Supabase reports them. Used by the one call that has no tenant yet: accepting an invitation. */
export type SessionUser = { userId: string; email: string | null; emailConfirmed: boolean }

const tenantHeader = z.string().uuid()

type MembershipRow = { tenant_id: string; permissions: string[]; flags: Record<string, unknown> | null }

const membershipSql = `select m.tenant_id, m.permission_flags as flags,
            coalesce(array_agg(rp.permission) filter (where rp.permission is not null), '{}') as permissions
     from tenant_members m
     join tenants t on t.id = m.tenant_id and t.status = 'active'
     left join role_permissions rp on rp.role_id = m.role_id
     where m.user_id = $1 and m.status = 'active'`

async function resolveExecSession(): Promise<{
  email: string
  role: ExecSessionRole
} | null> {
  try {
    const jar = await cookies()
    const execToken = jar.get(EXEC_SESSION_COOKIE)?.value
    const payload = await verifyExecSessionToken(execToken)
    return payload ? { email: payload.sub, role: payload.role } : null
  } catch {
    return null
  }
}

/**
 * Supabase when a real session exists. The local cookie is consulted only while the e2e gate is open.
 * API calls treat a missing Supabase client as a misconfigured server. Pages treat it as signed out.
 */
async function resolveUserId(missingClient: 'throw' | 'none'): Promise<string | null> {
  if (e2eEnabled()) {
    const jar = await cookies()
    const local = await e2eUserId(jar.get(E2E_COOKIE)?.value)
    if (local) return local
  }
  if (devOwnerEnabled()) {
    const jar = await cookies()
    const host = (await headers()).get('host')
    const owner = await devOwnerUserId(jar.get(DEV_OWNER_COOKIE)?.value, host)
    if (owner) return owner
  }
  const supabase = await createClient()
  if (!supabase) {
    if (missingClient === 'throw') throw new AppError(500, 'server_misconfigured', 'The server is not configured.')
    return null
  }
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return data.user.id
}

/**
 * Server-enforced RSC page authentication guard:
 * Checks `aether_exec_session` first, then Supabase/E2E/Prisma sessions.
 * Redirects unauthenticated visitors to `/login`.
 */
export async function requirePageUser(nextPath?: string): Promise<string> {
  let resolvedId: string | null = null
  try {
    const execSession = await resolveExecSession()
    if (execSession) {
      resolvedId = panelBridgeUserId(
        execSession.role === 'auditor'
          ? 'usr_venture_auditor_001'
          : 'usr_venture_exec_001',
      )
    } else {
      const userId = await resolveUserId('none')
      if (userId) {
        resolvedId = userId
      } else {
        const panel = await getPanelSessionUser()
        if (panel) {
          resolvedId = panelBridgeUserId(panel.id)
        }
      }
    }
  } catch {
    resolvedId = null
  }

  if (!resolvedId) {
    const safeTarget =
      nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//')
        ? `/login?next=${encodeURIComponent(nextPath)}`
        : '/login'
    redirect(safeTarget)
  }

  return resolvedId
}

/**
 * Resolves the signed-in user, the tenant they act in and their permissions, then requires `permission`.
 * A user in several tenants must send the `x-tenant-id` header. Membership is always checked in the database.
 */
export async function authenticate(request: NextRequest, permission: Permission): Promise<AuthContext> {
  const requestedTenant = request.headers.get('x-tenant-id')
  if (requestedTenant !== null && !tenantHeader.safeParse(requestedTenant).success) {
    throw new AppError(400, 'tenant_invalid', 'The x-tenant-id header must be a UUID.')
  }
  return authenticateUser(permission, requestedTenant)
}

/**
 * The same checks for callers that have no NextRequest, such as server actions.
 */
export async function authenticateUser(permission: Permission, requestedTenant: string | null): Promise<AuthContext> {
  if (requestedTenant !== null && !tenantHeader.safeParse(requestedTenant).success) {
    throw new AppError(400, 'tenant_invalid', 'The tenant must be a UUID.')
  }

  const execSession = await resolveExecSession()
  if (execSession) {
    const tenantId = requestedTenant ?? (await resolvePanelBridgeTenantId()) ?? '00000000-0000-0000-0000-000000000001'
    const fullSet = panelBridgePermissionSet()
    const granted: ReadonlySet<string> =
      execSession.role === 'auditor'
        ? new Set([...fullSet].filter((p) => p.endsWith('.read')))
        : fullSet

    if (!granted.has(permission)) {
      throw new AppError(403, 'forbidden', 'Read-only auditor session')
    }

    return {
      userId: panelBridgeUserId(
        execSession.role === 'auditor'
          ? 'usr_venture_auditor_001'
          : 'usr_venture_exec_001',
      ),
      tenantId,
      permissions: granted,
    }
  }

  const userId = await resolveUserId('none')
  if (userId) {
    const memberships = await db.query<MembershipRow>(
      `${membershipSql} and ($2::uuid is null or m.tenant_id = $2::uuid)
       group by m.tenant_id, m.permission_flags`,
      [userId, requestedTenant],
    )

    if (memberships.rows.length === 0) {
      throw new AppError(403, 'no_tenant_access', 'You do not have access to this tenant.')
    }
    if (memberships.rows.length > 1) {
      throw new AppError(400, 'tenant_required', 'Send the x-tenant-id header to choose a tenant.')
    }

    const membership = memberships.rows[0]
    const granted = new Set(membership.permissions)
    applyPermissionFlags(granted, membership.flags)
    if (!granted.has(permission)) {
      throw new AppError(403, 'forbidden', 'You do not have permission for this action.')
    }
    return { userId, tenantId: membership.tenant_id, permissions: granted }
  }

  const panel = await getPanelSessionUser()
  if (!panel) {
    throw new AppError(401, 'unauthenticated', 'Sign in to continue.')
  }
  const tenantId = requestedTenant ?? (await resolvePanelBridgeTenantId()) ?? '00000000-0000-0000-0000-000000000001'
  const fullPanelSet = panelBridgePermissionSet()
  const isAuditorPanel =
    typeof panel.email === 'string' && panel.email.toLowerCase().includes('auditor')
  const granted: ReadonlySet<string> = isAuditorPanel
    ? new Set([...fullPanelSet].filter((p) => p.endsWith('.read')))
    : fullPanelSet
  if (!granted.has(permission)) {
    throw new AppError(403, 'forbidden', 'You do not have permission for this action.')
  }
  return { userId: panelBridgeUserId(panel.id), tenantId, permissions: granted }
}

/**
 * Returns permissions for the authenticated session user, or an empty array when unauthenticated.
 */
export async function readSessionPermissions(): Promise<string[]> {
  try {
    const execSession = await resolveExecSession()
    if (execSession) {
      const fullSet = [...panelBridgePermissionSet()]
      if (execSession.role === 'auditor') {
        return fullSet.filter((p) => p.endsWith('.read')).sort()
      }
      return fullSet.sort()
    }

    const userId = await resolveUserId('none')
    if (userId) {
      const memberships = await db.query<MembershipRow>(
        `${membershipSql}
         group by m.tenant_id, m.permission_flags`,
        [userId],
      )
      if (memberships.rows.length === 1) {
        const granted = new Set(memberships.rows[0].permissions)
        applyPermissionFlags(granted, memberships.rows[0].flags)
        return [...granted].sort()
      }
    }

    const panel = await getPanelSessionUser()
    if (panel) {
      return [...panelBridgePermissionSet()].sort()
    }
  } catch {
    // fall through
  }
  return []
}

/** The signed-in user without any tenant. Only for calls a person makes before they belong to a company. */
export async function authenticateSession(): Promise<SessionUser> {
  const execSession = await resolveExecSession()
  if (execSession) {
    return {
      userId: panelBridgeUserId(
        execSession.role === 'auditor'
          ? 'usr_venture_auditor_001'
          : 'usr_venture_exec_001',
      ),
      email: execSession.email,
      emailConfirmed: true,
    }
  }
  if (e2eEnabled()) {
    const jar = await cookies()
    const local = await e2eUserId(jar.get(E2E_COOKIE)?.value)
    if (local) return { userId: local, email: null, emailConfirmed: true }
  }
  const supabase = await createClient()
  if (!supabase) throw new AppError(500, 'server_misconfigured', 'The server is not configured.')
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new AppError(401, 'unauthenticated', 'Sign in to continue.')
  return { userId: data.user.id, email: data.user.email ?? null, emailConfirmed: Boolean(data.user.email_confirmed_at) }
}
