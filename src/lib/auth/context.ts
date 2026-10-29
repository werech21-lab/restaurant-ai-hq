import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { AppError } from '@/lib/api/errors'
import { DEV_OWNER_COOKIE, devOwnerEnabled, devOwnerHostAllowed, devOwnerUserId } from '@/lib/auth/dev-owner'
import { E2E_COOKIE, e2eEnabled, e2eUserId } from '@/lib/auth/e2e-session'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import type { Permission } from '@/lib/auth/permissions'

export type AuthContext = {
  userId: string
  tenantId: string
  permissions: ReadonlySet<string>
}

/** The signed-in user as Supabase reports them. Used by the one call that has no tenant yet: accepting an invitation. */
export type SessionUser = { userId: string; email: string | null; emailConfirmed: boolean }

const tenantHeader = z.string().uuid()

type MembershipRow = { tenant_id: string; permissions: string[] }

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

/** Sends an ERP page to the login screen unless a real session, or the local e2e cookie, is present. */
export async function requirePageUser(nextPath: string): Promise<string> {
  const userId = await resolveUserId('none')
  if (!userId) {
    if (devOwnerEnabled() && devOwnerHostAllowed((await headers()).get('host'))) {
      redirect(`/dev/owner?next=${encodeURIComponent(nextPath)}`)
    }
    redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  }
  return userId
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
 * The requested tenant is only a choice among the
 * tenants the user belongs to. It never grants access: membership and permissions are read from the database.
 */
export async function authenticateUser(permission: Permission, requestedTenant: string | null): Promise<AuthContext> {
  if (requestedTenant !== null && !tenantHeader.safeParse(requestedTenant).success) {
    throw new AppError(400, 'tenant_invalid', 'The tenant must be a UUID.')
  }
  const userId = await resolveUserId('throw')
  if (!userId) throw new AppError(401, 'unauthenticated', 'Sign in to continue.')

  const memberships = await db.query<MembershipRow>(
    `select m.tenant_id,
            coalesce(array_agg(rp.permission) filter (where rp.permission is not null), '{}') as permissions
     from tenant_members m
     join tenants t on t.id = m.tenant_id and t.status = 'active'
     left join role_permissions rp on rp.role_id = m.role_id
     where m.user_id = $1 and ($2::uuid is null or m.tenant_id = $2::uuid)
     group by m.tenant_id`,
    [userId, requestedTenant]
  )

  if (memberships.rows.length === 0) {
    throw new AppError(403, 'no_tenant_access', 'You do not have access to this tenant.')
  }
  if (memberships.rows.length > 1) {
    throw new AppError(400, 'tenant_required', 'Send the x-tenant-id header to choose a tenant.')
  }

  const membership = memberships.rows[0]
  const granted = new Set(membership.permissions)
  if (!granted.has(permission)) {
    throw new AppError(403, 'forbidden', 'You do not have permission for this action.')
  }
  return { userId, tenantId: membership.tenant_id, permissions: granted }
}

/**
 * The permissions the signed-in user holds, for a server page to hand to the screen so it can hide what the user cannot do.
 * This is a display hint only and never grants anything: every API call and database write is checked again. It returns an
 * empty list when nobody is signed in, when Supabase is not configured, and when the user belongs to no company or to several
 * (the API asks those callers to name a tenant, and the screen has no way to).
 */
export async function readSessionPermissions(): Promise<string[]> {
  const userId = await resolveUserId('none')
  if (!userId) return []
  const memberships = await db.query<MembershipRow>(
    `select m.tenant_id,
            coalesce(array_agg(rp.permission) filter (where rp.permission is not null), '{}') as permissions
     from tenant_members m
     join tenants t on t.id = m.tenant_id and t.status = 'active'
     left join role_permissions rp on rp.role_id = m.role_id
     where m.user_id = $1
     group by m.tenant_id`,
    [userId]
  )
  return memberships.rows.length === 1 ? [...new Set(memberships.rows[0].permissions)].sort() : []
}

/** The signed-in user without any tenant. Only for calls a person makes before they belong to a company. */
export async function authenticateSession(): Promise<SessionUser> {
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
