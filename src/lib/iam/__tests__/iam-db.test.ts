import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { bootstrapTenant, createUser, getPglite, startDatabase, stopDatabase } from '@/lib/__tests__/support/database'
import type { AuthContext, SessionUser } from '@/lib/auth/context'
import { permissions } from '@/lib/auth/permissions'

vi.mock('@/lib/db', async () => {
  const support = await import('@/lib/__tests__/support/database')
  return { db: support.testDb, withTransaction: support.testWithTransaction }
})

import { hashInvitationToken } from '@/lib/iam/tokens'
import {
  acceptInvitation,
  changeMemberRole,
  createInvitation,
  createRole,
  listInvitations,
  listMembers,
  listRoles,
  removeMember,
  revokeInvitation,
  updateRole,
} from '@/lib/iam/service'

/**
 * Invitations and role management against the real migrations. The rule under test everywhere: nobody gets administrative
 * power by default, and nobody can hand out more than they hold.
 */

const pg = () => getPglite()

type Actor = AuthContext & { email: string }

let owner: Actor
let otherOwner: Actor
let hr: Actor // may invite, update and remove members, but is not a role manager
const day = 86_400_000
// The database stamps created_at with its own clock and requires expires_at after it, so the test clock is the real one.
const now = new Date()

async function outcome(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
    return 'ok'
  } catch (error) {
    const typed = error as { status?: number; code?: string }
    return typed.status ? `${typed.status}:${typed.code}` : `error:${(error as Error).message}`
  }
}

async function roleId(tenantId: string, name: string): Promise<string> {
  return (await pg().query<{ id: string }>('select id from roles where tenant_id = $1 and name = $2', [tenantId, name])).rows[0].id
}

async function permissionsOf(tenantId: string, userId: string): Promise<Set<string>> {
  const result = await pg().query<{ permission: string }>(
    `select rp.permission from tenant_members m join role_permissions rp on rp.role_id = m.role_id where m.tenant_id = $1 and m.user_id = $2`,
    [tenantId, userId]
  )
  return new Set(result.rows.map((row) => row.permission))
}

async function newUser(email: string, confirmed = true): Promise<SessionUser> {
  const id = randomUUID()
  await createUser(id, email)
  return { userId: id, email, emailConfirmed: confirmed }
}

async function actorIn(tenantId: string, userId: string, email: string): Promise<Actor> {
  return { userId, tenantId, email, permissions: await permissionsOf(tenantId, userId) }
}

async function memberWithRole(tenantId: string, role: string, email: string): Promise<Actor> {
  const user = await newUser(email)
  await pg().query('insert into tenant_members (tenant_id, user_id, role_id, created_by) values ($1, $2, $3, $4)', [
    tenantId,
    user.userId,
    await roleId(tenantId, role),
    owner.userId,
  ])
  return actorIn(tenantId, user.userId, email)
}

async function customRole(auth: AuthContext, name: string, perms: string[]): Promise<string> {
  return (await createRole(auth, { name, description: '', permissions: perms })).id
}

async function count(sql: string, params: unknown[] = []): Promise<number> {
  return (await pg().query<{ n: number }>(`select count(*)::int as n from (${sql}) q`, params)).rows[0].n
}

beforeAll(async () => {
  await startDatabase()
  const ownerUser = await newUser('owner-a@example.test')
  const tenantA = await bootstrapTenant('Company A', 'iam-a', ownerUser.userId)
  owner = await actorIn(tenantA, ownerUser.userId, ownerUser.email ?? '')
  const otherUser = await newUser('owner-b@example.test')
  otherOwner = await actorIn(await bootstrapTenant('Company B', 'iam-b', otherUser.userId), otherUser.userId, otherUser.email ?? '')
  const hrRole = await customRole(owner, 'hr', [
    permissions.iamMemberRead,
    permissions.iamMemberInvite,
    permissions.iamMemberUpdate,
    permissions.iamMemberRemove,
    permissions.iamRoleRead,
    permissions.financeInvoiceRead,
  ])
  const hrUser = await newUser('hr@example.test')
  await pg().query('insert into tenant_members (tenant_id, user_id, role_id, created_by) values ($1, $2, $3, $4)', [tenantA, hrUser.userId, hrRole, owner.userId])
  hr = await actorIn(tenantA, hrUser.userId, hrUser.email ?? '')
}, 120_000)
afterAll(stopDatabase)

describe('the migration', () => {
  it('gives the iam permissions to owners only and flags the four built-in roles as system roles', async () => {
    const holders = await pg().query<{ name: string }>(
      `select distinct r.name from role_permissions rp join roles r on r.id = rp.role_id where rp.permission like 'iam.%' and r.is_system`
    )
    expect(holders.rows.map((row) => row.name)).toEqual(['owner'])
    const system = await pg().query<{ name: string }>(`select name from roles where tenant_id = $1 and is_system order by name`, [owner.tenantId])
    expect(system.rows.map((row) => row.name)).toEqual(['accountant', 'approver', 'owner', 'viewer'])
  })
})

describe('permission checks in the service', () => {
  it('refuse every operation to a caller without the matching iam permission', async () => {
    const viewer = await memberWithRole(owner.tenantId, 'viewer', 'viewer@example.test')
    const role = await roleId(owner.tenantId, 'viewer')
    const results = await Promise.all([
      outcome(listMembers(viewer, { limit: 10 })),
      outcome(listRoles(viewer, { limit: 10 })),
      outcome(listInvitations(viewer, { limit: 10, status: 'all' }, now)),
      outcome(createInvitation(viewer, { email: 'x@example.test', roleId: role }, now)),
      outcome(revokeInvitation(viewer, randomUUID(), { version: 1 }, now)),
      outcome(changeMemberRole(viewer, randomUUID(), { roleId: role, expectedRoleId: role })),
      outcome(removeMember(viewer, randomUUID(), { expectedRoleId: role })),
      outcome(createRole(viewer, { name: 'nope', description: '', permissions: [] })),
      outcome(updateRole(viewer, randomUUID(), { name: 'nope', description: '', permissions: [], version: 1 })),
    ])
    expect(results).toEqual(Array(9).fill('403:forbidden'))
  })
})

describe('creating invitations', () => {
  it('stores only a hash, never the token, with an explicit role, an expiry and an audit row without the token', async () => {
    const viewerRole = await roleId(owner.tenantId, 'viewer')
    const { invitation, token } = await createInvitation(owner, { email: 'new.person@example.test', roleId: viewerRole }, now)
    expect(invitation).toMatchObject({ email: 'new.person@example.test', roleName: 'viewer', status: 'pending', version: 1, createdBy: owner.userId })
    expect(new Date(invitation.expiresAt).getTime()).toBe(now.getTime() + 7 * day)
    const stored = await pg().query<{ token_hash: string }>('select token_hash from tenant_invitations where id = $1', [invitation.id])
    expect(stored.rows[0].token_hash).toBe(hashInvitationToken(token))
    expect(JSON.stringify((await pg().query('select * from tenant_invitations')).rows)).not.toContain(token)
    const audit = await pg().query<{ before: unknown; after: unknown }>(`select before, after from audit_log where entity = 'invitation' and entity_id = $1`, [invitation.id])
    expect(audit.rows).toHaveLength(1)
    expect(JSON.stringify(audit.rows)).not.toContain(token)
    expect(JSON.stringify(audit.rows)).not.toContain(hashInvitationToken(token))
  })

  it('does not make anyone a member until they accept', async () => {
    const before = await count('select 1 from tenant_members where tenant_id = $1', [owner.tenantId])
    await createInvitation(owner, { email: 'waiting@example.test', roleId: await roleId(owner.tenantId, 'viewer') }, now)
    expect(await count('select 1 from tenant_members where tenant_id = $1', [owner.tenantId])).toBe(before)
  })

  it('allows only one open invitation per email, and a revoked one frees it', async () => {
    const viewerRole = await roleId(owner.tenantId, 'viewer')
    const { invitation } = await createInvitation(owner, { email: 'dup@example.test', roleId: viewerRole }, now)
    expect(await outcome(createInvitation(owner, { email: 'dup@example.test', roleId: viewerRole }, now))).toBe('409:invitation_pending')
    await revokeInvitation(owner, invitation.id, { version: 1 }, now)
    expect(await outcome(createInvitation(owner, { email: 'dup@example.test', roleId: viewerRole }, now))).toBe('ok')
  })

  it('closes an expired pending invitation (with an audit row) so a fresh one can be made', async () => {
    const viewerRole = await roleId(owner.tenantId, 'viewer')
    const { invitation } = await createInvitation(owner, { email: 'stale@example.test', roleId: viewerRole }, now)
    const later = new Date(now.getTime() + 8 * day)
    expect(await outcome(createInvitation(owner, { email: 'stale@example.test', roleId: viewerRole }, later))).toBe('ok')
    const old = await pg().query<{ status: string }>('select status from tenant_invitations where id = $1', [invitation.id])
    expect(old.rows[0].status).toBe('revoked')
    const audit = await pg().query<{ after: { reason: string } }>(`select after from audit_log where entity = 'invitation' and entity_id = $1 and action = 'update'`, [invitation.id])
    expect(audit.rows[0].after.reason).toBe('expired')
  })

  it('refuses an existing member, an unknown role and a role from another company', async () => {
    const viewerRole = await roleId(owner.tenantId, 'viewer')
    expect(await outcome(createInvitation(owner, { email: hr.email, roleId: viewerRole }, now))).toBe('409:already_member')
    expect(await outcome(createInvitation(owner, { email: 'x1@example.test', roleId: randomUUID() }, now))).toBe('404:role_not_found')
    expect(await outcome(createInvitation(owner, { email: 'x2@example.test', roleId: await roleId(otherOwner.tenantId, 'viewer') }, now))).toBe('404:role_not_found')
  })

  it('stays inside a suspended company', async () => {
    const user = await newUser('suspended-owner@example.test')
    const tenant = await bootstrapTenant('Suspended Co', 'iam-suspended', user.userId)
    const auth = await actorIn(tenant, user.userId, user.email ?? '')
    await pg().query(`update tenants set status = 'suspended' where id = $1`, [tenant])
    expect(await outcome(createInvitation(auth, { email: 'late@example.test', roleId: await roleId(tenant, 'viewer') }, now))).toBe('403:tenant_suspended')
  })
})

describe('no automatic administrative grants', () => {
  it('stops an inviter from inviting into a role that holds more than they do', async () => {
    const accountant = await roleId(owner.tenantId, 'accountant')
    const result = await createInvitation(hr, { email: 'esc1@example.test', roleId: accountant }, now).catch((error: unknown) => error as { status: number; code: string; details?: { missing: string[] } })
    expect(result).toMatchObject({ status: 403, code: 'grant_exceeds_permissions' })
  })

  it('stops an inviter from inviting into the owner role, and from minting an admin role they hold only in part', async () => {
    expect(await outcome(createInvitation(hr, { email: 'esc2@example.test', roleId: await roleId(owner.tenantId, 'owner') }, now))).toBe('403:grant_exceeds_permissions')
    expect(await outcome(createRole(hr, { name: 'sneaky', description: '', permissions: [permissions.iamMemberRead] }))).toBe('403:forbidden')
  })

  it('needs iam.role.manage on top of holding the permissions to invite into an administrative role', async () => {
    const holder = await customRole(owner, 'reader-admin', [permissions.iamMemberRead])
    expect(await outcome(createInvitation(hr, { email: 'esc3@example.test', roleId: holder }, now))).toBe('403:admin_role_requires_role_manage')
    expect(await outcome(createInvitation(owner, { email: 'esc3@example.test', roleId: holder }, now))).toBe('ok')
  })

  it('never lets anyone but a role manager create or edit roles, and never beyond their own permissions', async () => {
    const narrowManager = await customRole(owner, 'role-manager', [permissions.iamRoleManage, permissions.iamRoleRead, permissions.financeInvoiceRead])
    const user = await newUser('rm@example.test')
    await pg().query('insert into tenant_members (tenant_id, user_id, role_id, created_by) values ($1, $2, $3, $4)', [owner.tenantId, user.userId, narrowManager, owner.userId])
    const manager = await actorIn(owner.tenantId, user.userId, 'rm@example.test')
    expect(await outcome(createRole(manager, { name: 'too-much', description: '', permissions: [permissions.financeInvoiceApprove] }))).toBe('403:grant_exceeds_permissions')
    expect(await outcome(createRole(manager, { name: 'fine', description: '', permissions: [permissions.financeInvoiceRead] }))).toBe('ok')
    // Editing a role that is more powerful than the editor is refused as well.
    const approver = await roleId(owner.tenantId, 'approver')
    expect(await outcome(updateRole(manager, approver, { name: 'approver', description: '', permissions: [], version: 1 }))).toBe('403:system_role_locked')
    const strong = await customRole(owner, 'strong', [permissions.financeInvoiceApprove])
    expect(await outcome(updateRole(manager, strong, { name: 'strong', description: '', permissions: [], version: 1 }))).toBe('403:grant_exceeds_permissions')
  })
})

describe('accepting an invitation', () => {
  async function invite(email: string, roleName = 'viewer') {
    return createInvitation(owner, { email, roleId: await roleId(owner.tenantId, roleName) }, now)
  }

  it('creates the membership with exactly the invited role, marks the invitation accepted and audits both', async () => {
    const { invitation, token } = await invite('joiner@example.test')
    const session = await newUser('Joiner@Example.test')
    const result = await acceptInvitation(session, { token }, new Date(now.getTime() + day))
    expect(result).toMatchObject({ tenantId: owner.tenantId, roleName: 'viewer' })
    expect(await permissionsOf(owner.tenantId, session.userId)).toEqual(await permissionsOf(owner.tenantId, (await memberWithRole(owner.tenantId, 'viewer', 'ref@example.test')).userId))
    const row = await pg().query<{ status: string; accepted_by: string }>('select status, accepted_by from tenant_invitations where id = $1', [invitation.id])
    expect(row.rows[0]).toEqual({ status: 'accepted', accepted_by: session.userId })
    const audit = await pg().query<{ entity: string; actor_id: string }>(
      `select entity, actor_id from audit_log where actor_id = $1 order by entity`,
      [session.userId]
    )
    expect(audit.rows).toEqual([
      { entity: 'invitation', actor_id: session.userId },
      { entity: 'member', actor_id: session.userId },
    ])
  })

  it('cannot be used twice', async () => {
    const { token } = await invite('once@example.test')
    const session = await newUser('once@example.test')
    await acceptInvitation(session, { token }, now)
    const again = await newUser('once@example.test')
    expect(await outcome(acceptInvitation(again, { token }, now))).toBe('404:invitation_invalid')
  })

  it('answers the same 404 for a wrong token, a wrong email, an expired, a revoked and a used invitation', async () => {
    const wrongEmail = await invite('right@example.test')
    const expired = await invite('late@example.test')
    const revoked = await invite('revoked@example.test')
    await revokeInvitation(owner, revoked.invitation.id, { version: 1 }, now)
    const results = [
      await outcome(acceptInvitation(await newUser('guess@example.test'), { token: 'A'.repeat(43) }, now)),
      await outcome(acceptInvitation(await newUser('someone.else@example.test'), { token: wrongEmail.token }, now)),
      await outcome(acceptInvitation(await newUser('late@example.test'), { token: expired.token }, new Date(now.getTime() + 8 * day))),
      await outcome(acceptInvitation(await newUser('revoked@example.test'), { token: revoked.token }, now)),
    ]
    expect(results).toEqual(Array(4).fill('404:invitation_invalid'))
  })

  it('needs a confirmed email', async () => {
    const { token } = await invite('unconfirmed@example.test')
    const session = await newUser('unconfirmed@example.test', false)
    expect(await outcome(acceptInvitation(session, { token }, now))).toBe('403:email_unconfirmed')
    expect(await outcome(acceptInvitation({ ...session, email: null, emailConfirmed: true }, { token }, now))).toBe('403:email_unconfirmed')
    expect(await count('select 1 from tenant_members where user_id = $1', [session.userId])).toBe(0)
  })

  it('refuses a person who is already a member, and leaves the invitation open', async () => {
    const { invitation, token } = await invite('already@example.test')
    const session = await newUser('already@example.test')
    await pg().query('insert into tenant_members (tenant_id, user_id, role_id, created_by) values ($1, $2, $3, $4)', [
      owner.tenantId,
      session.userId,
      await roleId(owner.tenantId, 'viewer'),
      owner.userId,
    ])
    expect(await outcome(acceptInvitation(session, { token }, now))).toBe('409:already_member')
    const row = await pg().query<{ status: string }>('select status from tenant_invitations where id = $1', [invitation.id])
    expect(row.rows[0].status).toBe('pending')
  })

  it('is refused when the inviter has lost the power to grant the role or has left the company', async () => {
    // The inviter is demoted to a role with no powers after inviting.
    const noPowers = await customRole(owner, 'no-powers', [])
    const target = await customRole(owner, 'invoice-reader', [permissions.financeInvoiceRead])
    const { token } = await createInvitation(hr, { email: 'demoted@example.test', roleId: target }, now)
    await pg().query('update tenant_members set role_id = $3 where tenant_id = $1 and user_id = $2', [owner.tenantId, hr.userId, noPowers])
    expect(await outcome(acceptInvitation(await newUser('demoted@example.test'), { token }, now))).toBe('404:invitation_invalid')
    // Restore hr for the other tests.
    await pg().query('update tenant_members set role_id = $3 where tenant_id = $1 and user_id = $2', [owner.tenantId, hr.userId, await roleId(owner.tenantId, 'hr')])

    // The inviter leaves the company after inviting.
    const leaver = await memberWithRole(owner.tenantId, 'hr', 'leaver@example.test')
    const gone = await createInvitation(leaver, { email: 'inviter-gone@example.test', roleId: target }, now)
    await pg().query('delete from tenant_members where tenant_id = $1 and user_id = $2', [owner.tenantId, leaver.userId])
    expect(await outcome(acceptInvitation(await newUser('inviter-gone@example.test'), { token: gone.token }, now))).toBe('404:invitation_invalid')
  })

  it('is refused for a suspended company', async () => {
    const user = await newUser('sus-owner@example.test')
    const tenant = await bootstrapTenant('Sus Two', 'iam-sus-2', user.userId)
    const auth = await actorIn(tenant, user.userId, user.email ?? '')
    const { token } = await createInvitation(auth, { email: 'sus-joiner@example.test', roleId: await roleId(tenant, 'viewer') }, now)
    await pg().query(`update tenants set status = 'suspended' where id = $1`, [tenant])
    expect(await outcome(acceptInvitation(await newUser('sus-joiner@example.test'), { token }, now))).toBe('404:invitation_invalid')
  })

  it('gives an administrative role only when an administrator invited into it, and never adds anything else', async () => {
    const admin = await invite('second-owner@example.test', 'owner')
    const session = await newUser('second-owner@example.test')
    await acceptInvitation(session, { token: admin.token }, now)
    expect((await permissionsOf(owner.tenantId, session.userId)).has(permissions.iamRoleManage)).toBe(true)
    // Nobody who accepted a viewer invitation holds an iam permission.
    const viewerMembers = await pg().query<{ n: number }>(
      `select count(*)::int as n from tenant_members m join roles r on r.id = m.role_id join role_permissions rp on rp.role_id = r.id
       where r.name = 'viewer' and rp.permission like 'iam.%'`
    )
    expect(viewerMembers.rows[0].n).toBe(0)
  })
})

describe('revoking and listing invitations', () => {
  it('needs the current version, refuses a closed invitation, and is invisible to another company', async () => {
    const { invitation } = await createInvitation(owner, { email: 'rv@example.test', roleId: await roleId(owner.tenantId, 'viewer') }, now)
    expect(await outcome(revokeInvitation(owner, invitation.id, { version: 9 }, now))).toBe('409:version_conflict')
    expect(await outcome(revokeInvitation(otherOwner, invitation.id, { version: 1 }, now))).toBe('404:invitation_not_found')
    const revoked = await revokeInvitation(owner, invitation.id, { version: 1 }, now)
    expect(revoked).toMatchObject({ status: 'revoked', version: 2 })
    expect(await outcome(revokeInvitation(owner, invitation.id, { version: 2 }, now))).toBe('409:invitation_not_pending')
  })

  it('lists by status with expired computed, tenant scoped, and never exposes the token or its hash', async () => {
    await createInvitation(owner, { email: 'listed@example.test', roleId: await roleId(owner.tenantId, 'viewer'), expiresInDays: 1 }, now)
    const later = new Date(now.getTime() + 2 * day)
    const expired = await listInvitations(owner, { limit: 100, status: 'expired' }, later)
    expect(expired.data.some((row) => row.email === 'listed@example.test')).toBe(true)
    const pending = await listInvitations(owner, { limit: 100, status: 'pending' }, later)
    expect(pending.data.some((row) => row.email === 'listed@example.test')).toBe(false)
    expect(JSON.stringify(expired)).not.toMatch(/token/i)
    const foreign = await listInvitations(otherOwner, { limit: 100, status: 'all' }, later)
    expect(foreign.data).toEqual([])
  })

  it('pages with a cursor', async () => {
    const first = await listInvitations(owner, { limit: 2, status: 'all' }, now)
    expect(first.data).toHaveLength(2)
    expect(first.nextCursor).toBeTruthy()
    const second = await listInvitations(owner, { limit: 2, status: 'all', cursor: first.nextCursor ?? undefined }, now)
    expect(second.data.map((row) => row.id).filter((id) => first.data.some((seen) => seen.id === id))).toEqual([])
  })
})

describe('changing and removing members', () => {
  it('moves a member inside the actor\'s own permissions, audits it and needs the expected current role', async () => {
    const target = await memberWithRole(owner.tenantId, 'viewer', 'move@example.test')
    const viewerRole = await roleId(owner.tenantId, 'viewer')
    const reader = await customRole(owner, 'invoice-reader-2', [permissions.financeInvoiceRead])
    expect(await outcome(changeMemberRole(hr, target.userId, { roleId: reader, expectedRoleId: randomUUID() }))).toBe('409:version_conflict')
    const moved = await changeMemberRole(hr, target.userId, { roleId: reader, expectedRoleId: viewerRole })
    expect(moved.roleId).toBe(reader)
    const audit = await pg().query<{ actor_id: string }>(`select actor_id from audit_log where entity = 'member' and entity_id = $1 and action = 'update'`, [target.userId])
    expect(audit.rows).toEqual([{ actor_id: hr.userId }])
    expect(await outcome(changeMemberRole(hr, target.userId, { roleId: reader, expectedRoleId: reader }))).toBe('422:role_unchanged')
  })

  it('stops a non-administrator from promoting someone, or touching an administrator', async () => {
    const target = await memberWithRole(owner.tenantId, 'viewer', 'promote@example.test')
    const viewerRole = await roleId(owner.tenantId, 'viewer')
    expect(await outcome(changeMemberRole(hr, target.userId, { roleId: await roleId(owner.tenantId, 'owner'), expectedRoleId: viewerRole }))).toBe('403:grant_exceeds_permissions')
    const ownerRole = await roleId(owner.tenantId, 'owner')
    expect(await outcome(changeMemberRole(hr, owner.userId, { roleId: viewerRole, expectedRoleId: ownerRole }))).toBe('403:admin_member_requires_role_manage')
    expect(await outcome(removeMember(hr, owner.userId, { expectedRoleId: ownerRole }))).toBe('403:admin_member_requires_role_manage')
  })

  it('never changes or removes the caller themselves', async () => {
    const ownerRole = await roleId(owner.tenantId, 'owner')
    expect(await outcome(changeMemberRole(owner, owner.userId, { roleId: await roleId(owner.tenantId, 'viewer'), expectedRoleId: ownerRole }))).toBe('403:cannot_change_own_role')
    expect(await outcome(removeMember(owner, owner.userId, { expectedRoleId: ownerRole }))).toBe('403:cannot_remove_self')
  })

  it('keeps at least one role manager: the last one cannot be demoted or removed, and nothing is changed', async () => {
    const user = await newUser('solo@example.test')
    const tenant = await bootstrapTenant('Solo Co', 'iam-solo', user.userId)
    const solo = await actorIn(tenant, user.userId, 'solo@example.test')
    const second = await newUser('second@example.test')
    const customManager = await customRole(solo, 'manager-lite', [permissions.iamRoleManage, permissions.iamMemberUpdate, permissions.iamMemberRemove])
    await pg().query('insert into tenant_members (tenant_id, user_id, role_id, created_by) values ($1, $2, $3, $4)', [tenant, second.userId, customManager, solo.userId])
    const manager = await actorIn(tenant, second.userId, 'second@example.test')
    const ownerRole = await roleId(tenant, 'owner')
    // The second manager tries to demote the only owner; they are still a role manager themselves, so this is allowed...
    // ...but after it, removing the second manager would leave nobody.
    const viewer = await roleId(tenant, 'viewer')
    await expect(changeMemberRole(manager, solo.userId, { roleId: viewer, expectedRoleId: ownerRole })).rejects.toMatchObject({ code: 'grant_exceeds_permissions' })
    // Remove the owner (allowed: the owner holds more, but removal needs no grant), leaving only `manager`.
    await removeMember(manager, solo.userId, { expectedRoleId: ownerRole })
    expect(await count('select 1 from tenant_members where tenant_id = $1', [tenant])).toBe(1)
    // Now the last role manager is `manager`; it cannot remove itself and cannot be removed by anyone else, so editing the role to drop iam.role.manage is refused.
    expect(
      await outcome(updateRole(manager, customManager, { name: 'manager-lite', description: '', permissions: [permissions.iamMemberUpdate], version: 1 }))
    ).toBe('409:last_admin')
    expect(await permissionsOf(tenant, second.userId)).toContain(permissions.iamRoleManage)
  })

  it('removes a member, audits the delete and is scoped to the caller\'s company', async () => {
    const target = await memberWithRole(owner.tenantId, 'viewer', 'bye@example.test')
    const viewerRole = await roleId(owner.tenantId, 'viewer')
    expect(await outcome(removeMember(otherOwner, target.userId, { expectedRoleId: viewerRole }))).toBe('404:member_not_found')
    expect(await outcome(removeMember(hr, target.userId, { expectedRoleId: randomUUID() }))).toBe('409:version_conflict')
    await removeMember(hr, target.userId, { expectedRoleId: viewerRole })
    expect(await count('select 1 from tenant_members where user_id = $1', [target.userId])).toBe(0)
    const audit = await pg().query<{ before: { roleId: string }; after: unknown }>(`select before, after from audit_log where entity = 'member' and entity_id = $1 and action = 'delete'`, [target.userId])
    expect(audit.rows).toHaveLength(1)
    expect(audit.rows[0].after).toBeNull()
  })

  it('lists only this company\'s members', async () => {
    const mine = await listMembers(owner, { limit: 100 })
    const theirs = await listMembers(otherOwner, { limit: 100 })
    expect(mine.data.map((row) => row.userId)).toContain(hr.userId)
    expect(theirs.data.map((row) => row.userId)).not.toContain(hr.userId)
    expect(theirs.data.map((row) => row.userId)).toEqual([otherOwner.userId])
  })
})

describe('roles', () => {
  it('creates a custom role, rejects a duplicate name, and keeps built-in roles locked', async () => {
    const created = await createRole(owner, { name: 'warehouse', description: 'Stock', permissions: [permissions.inventoryStockRead, permissions.inventoryItemRead] })
    expect(created).toMatchObject({ name: 'warehouse', isSystem: false, version: 1, memberCount: 0 })
    expect(created.permissions).toEqual([permissions.inventoryItemRead, permissions.inventoryStockRead])
    expect(await outcome(createRole(owner, { name: 'warehouse', description: '', permissions: [] }))).toBe('409:role_exists')
    expect(await outcome(updateRole(owner, await roleId(owner.tenantId, 'owner'), { name: 'owner', description: '', permissions: [], version: 1 }))).toBe('403:system_role_locked')
    // Same name in another company is fine.
    expect(await outcome(createRole(otherOwner, { name: 'warehouse', description: '', permissions: [] }))).toBe('ok')
  })

  it('updates with the version, replaces permissions, audits before and after, and refuses a stale version', async () => {
    const created = await createRole(owner, { name: 'editable', description: '', permissions: [permissions.crmCustomerRead] })
    expect(await outcome(updateRole(owner, created.id, { name: 'editable', description: '', permissions: [], version: 7 }))).toBe('409:version_conflict')
    const updated = await updateRole(owner, created.id, { name: 'editable', description: 'v2', permissions: [permissions.crmLeadRead], version: 1 })
    expect(updated).toMatchObject({ description: 'v2', version: 2, permissions: [permissions.crmLeadRead] })
    const audit = await pg().query<{ before: { permissions: string[] }; after: { permissions: string[] } }>(
      `select before, after from audit_log where entity = 'role' and entity_id = $1 and action = 'update'`,
      [created.id]
    )
    expect(audit.rows[0].before.permissions).toEqual([permissions.crmCustomerRead])
    expect(audit.rows[0].after.permissions).toEqual([permissions.crmLeadRead])
  })

  it('does not see or edit another company\'s role', async () => {
    const theirs = await createRole(otherOwner, { name: 'private', description: '', permissions: [] })
    expect(await outcome(updateRole(owner, theirs.id, { name: 'private', description: '', permissions: [], version: 1 }))).toBe('404:role_not_found')
    expect((await listRoles(owner, { limit: 100 })).data.map((role) => role.id)).not.toContain(theirs.id)
  })
})

describe('events', () => {
  it('carry ids only, never an email or a token', async () => {
    const { subscribe } = await import('@/lib/events/bus')
    const seen: string[] = []
    const stop = subscribe('iam.invitation.created', (event) => {
      seen.push(JSON.stringify(event))
    })
    const { token } = await createInvitation(owner, { email: 'event@example.test', roleId: await roleId(owner.tenantId, 'viewer') }, now)
    stop()
    expect(seen).toHaveLength(1)
    expect(seen[0]).not.toContain('event@example.test')
    expect(seen[0]).not.toContain(token)
  })
})
