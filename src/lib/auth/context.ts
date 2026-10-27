import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { AppError } from '@/lib/api/errors'
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
  const supabase = await createClient()
  if (!supabase) {
    throw new AppError(500, 'server_misconfigured', 'The server is not configured.')
  }
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw new AppError(401, 'unauthenticated', 'Sign in to continue.')
  }

  const memberships = await db.query<MembershipRow>(
    `select m.tenant_id,
            coalesce(array_agg(rp.permission) filter (where rp.permission is not null), '{}') as permissions
     from tenant_members m
     join tenants t on t.id = m.tenant_id and t.status = 'active'
     left join role_permissions rp on rp.role_id = m.role_id
     where m.user_id = $1 and ($2::uuid is null or m.tenant_id = $2::uuid)
     group by m.tenant_id`,
    [data.user.id, requestedTenant]
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
  return { userId: data.user.id, tenantId: membership.tenant_id, permissions: granted }
}

/**
 * The permissions the signed-in user holds, for a server page to hand to the screen so it can hide what the user cannot do.
 * This is a display hint only and never grants anything: every API call and database write is checked again. It returns an
 * empty list when nobody is signed in, when Supabase is not configured, and when the user belongs to no company or to several
 * (the API asks those callers to name a tenant, and the screen has no way to).
 */
export async function readSessionPermissions(): Promise<string[]> {
  const supabase = await createClient()
  if (!supabase) return []
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return []
  const memberships = await db.query<MembershipRow>(
    `select m.tenant_id,
            coalesce(array_agg(rp.permission) filter (where rp.permission is not null), '{}') as permissions
     from tenant_members m
     join tenants t on t.id = m.tenant_id and t.status = 'active'
     left join role_permissions rp on rp.role_id = m.role_id
     where m.user_id = $1
     group by m.tenant_id`,
    [data.user.id]
  )
  return memberships.rows.length === 1 ? [...new Set(memberships.rows[0].permissions)].sort() : []
}

/** The signed-in user without any tenant. Only for calls a person makes before they belong to a company. */
export async function authenticateSession(): Promise<SessionUser> {
  const supabase = await createClient()
  if (!supabase) throw new AppError(500, 'server_misconfigured', 'The server is not configured.')
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new AppError(401, 'unauthenticated', 'Sign in to continue.')
  return { userId: data.user.id, email: data.user.email ?? null, emailConfirmed: Boolean(data.user.email_confirmed_at) }
}
