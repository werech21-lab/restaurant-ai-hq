import type { EffectiveInvitationStatus } from '@/lib/iam/domain'

export type Member = {
  id: string
  userId: string
  displayName: string
  email: string | null
  roleId: string
  roleName: string
  createdAt: string
}

export type Role = {
  id: string
  name: string
  description: string
  isSystem: boolean
  version: number
  permissions: string[]
  memberCount: number
  createdAt: string
  updatedAt: string
}

export type Invitation = {
  id: string
  email: string
  roleId: string
  roleName: string
  status: EffectiveInvitationStatus
  expiresAt: string
  acceptedBy: string | null
  acceptedAt: string | null
  revokedAt: string | null
  version: number
  createdAt: string
  createdBy: string
}

/** The one place a token appears: the answer to the request that created the invitation. */
export type CreatedInvitation = { invitation: Invitation; token: string }

export type AcceptedInvitation = { tenantId: string; roleId: string; roleName: string }
