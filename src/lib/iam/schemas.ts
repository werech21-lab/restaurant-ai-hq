import { z } from 'zod'
import { pageQuerySchema } from '@/lib/api/cursor'
import { allPermissions } from '@/lib/auth/permissions'
import { MAX_INVITATION_DAYS, TOKEN_PATTERN, normalizeEmail } from '@/lib/iam/domain'

const uuid = z.string().uuid()
const versionField = z.number().int().min(1)

const permissionField = z.string().refine((value) => (allPermissions as readonly string[]).includes(value), 'Unknown permission')

export const memberParamsSchema = z.object({ userId: uuid })
export const idParamsSchema = z.object({ id: uuid })

// ---- invitations ----

/** `roleId` is required on purpose: an invitation never falls back to a default role. */
export const createInvitationSchema = z.object({
  email: z.string().trim().max(254).email().transform(normalizeEmail),
  roleId: uuid,
  expiresInDays: z.number().int().min(1).max(MAX_INVITATION_DAYS).optional(),
})
export type CreateInvitationInput = z.output<typeof createInvitationSchema>

export const revokeInvitationSchema = z.object({ version: versionField })
export type RevokeInvitationInput = z.output<typeof revokeInvitationSchema>

export const acceptInvitationSchema = z.object({ token: z.string().regex(TOKEN_PATTERN) })
export type AcceptInvitationInput = z.output<typeof acceptInvitationSchema>

export const listInvitationsQuerySchema = pageQuerySchema.extend({
  status: z.enum(['pending', 'accepted', 'revoked', 'expired', 'all']).default('all'),
})
export type ListInvitationsQuery = z.output<typeof listInvitationsQuerySchema>

// ---- members ----

/** The current role is sent back so a change made on a stale screen answers 409 instead of overwriting someone else's edit. */
export const changeMemberRoleSchema = z.object({ roleId: uuid, expectedRoleId: uuid })
export type ChangeMemberRoleInput = z.output<typeof changeMemberRoleSchema>

export const removeMemberQuerySchema = z.object({ expectedRoleId: uuid })
export type RemoveMemberQuery = z.output<typeof removeMemberQuerySchema>

export const listMembersQuerySchema = pageQuerySchema
export type ListMembersQuery = z.output<typeof listMembersQuerySchema>

// ---- roles ----

const roleFields = {
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).default(''),
  permissions: z
    .array(permissionField)
    .max(allPermissions.length)
    .transform((values) => [...new Set(values)].sort()),
}

export const createRoleSchema = z.object(roleFields)
export type CreateRoleInput = z.output<typeof createRoleSchema>

export const updateRoleSchema = z.object({ version: versionField, ...roleFields })
export type UpdateRoleInput = z.output<typeof updateRoleSchema>

export const listRolesQuerySchema = pageQuerySchema
export type ListRolesQuery = z.output<typeof listRolesQuerySchema>
