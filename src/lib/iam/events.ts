import { emit } from '@/lib/events/bus'

type EventBase<N extends string, P> = {
  name: N
  version: 1
  occurredAt: string
  tenantId: string
  payload: P
}

/** Payloads carry ids only. No email, token or name, so the stream can feed analytics without personal data. */
export type IamEvent =
  | EventBase<'iam.invitation.created', { invitationId: string; roleId: string; createdBy: string; expiresAt: string }>
  | EventBase<'iam.invitation.accepted', { invitationId: string; userId: string; roleId: string }>
  | EventBase<'iam.invitation.revoked', { invitationId: string; revokedBy: string }>
  | EventBase<'iam.member.role_changed', { userId: string; fromRoleId: string; toRoleId: string; changedBy: string }>
  | EventBase<'iam.member.removed', { userId: string; roleId: string; removedBy: string }>
  | EventBase<'iam.role.created', { roleId: string; createdBy: string; permissionCount: number }>
  | EventBase<'iam.role.updated', { roleId: string; updatedBy: string; permissionCount: number }>

export function stamp(tenantId: string): { version: 1; occurredAt: string; tenantId: string } {
  return { version: 1, occurredAt: new Date().toISOString(), tenantId }
}

/** Call only after the transaction has committed. */
export async function publishIamEvents(events: readonly IamEvent[]): Promise<void> {
  for (const event of events) await emit(event)
}
