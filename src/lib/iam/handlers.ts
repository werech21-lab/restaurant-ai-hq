import { NextResponse } from 'next/server'
import { parseBody, parseParams, parseQuery } from '@/lib/api/parse'
import type { RouteArgs, SessionRouteArgs } from '@/lib/api/route'
import {
  acceptInvitationSchema,
  changeMemberRoleSchema,
  createInvitationSchema,
  createRoleSchema,
  idParamsSchema,
  listInvitationsQuerySchema,
  listMembersQuerySchema,
  listRolesQuerySchema,
  memberParamsSchema,
  removeMemberQuerySchema,
  revokeInvitationSchema,
  updateRoleSchema,
} from '@/lib/iam/schemas'
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

// Responses to anything that carries a token must never be cached.
const NO_STORE = { 'Cache-Control': 'no-store' }

export async function listMembersHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await listMembers(auth, parseQuery(request, listMembersQuerySchema)))
}

export async function changeMemberRoleHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { userId } = parseParams(params, memberParamsSchema)
  const body = await parseBody(request, changeMemberRoleSchema)
  return NextResponse.json({ data: await changeMemberRole(auth, userId, body) })
}

export async function removeMemberHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { userId } = parseParams(params, memberParamsSchema)
  await removeMember(auth, userId, parseQuery(request, removeMemberQuerySchema))
  return new NextResponse(null, { status: 204 })
}

export async function listRolesHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await listRoles(auth, parseQuery(request, listRolesQuerySchema)))
}

export async function createRoleHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const body = await parseBody(request, createRoleSchema)
  return NextResponse.json({ data: await createRole(auth, body) }, { status: 201 })
}

export async function updateRoleHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  const body = await parseBody(request, updateRoleSchema)
  return NextResponse.json({ data: await updateRole(auth, id, body) })
}

export async function listInvitationsHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await listInvitations(auth, parseQuery(request, listInvitationsQuerySchema)), { headers: NO_STORE })
}

export async function createInvitationHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const body = await parseBody(request, createInvitationSchema)
  const { invitation, token } = await createInvitation(auth, body)
  return NextResponse.json({ data: invitation, token }, { status: 201, headers: NO_STORE })
}

export async function revokeInvitationHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  const body = await parseBody(request, revokeInvitationSchema)
  return NextResponse.json({ data: await revokeInvitation(auth, id, body) }, { headers: NO_STORE })
}

export async function acceptInvitationHandler({ request, session }: SessionRouteArgs): Promise<NextResponse> {
  const body = await parseBody(request, acceptInvitationSchema)
  return NextResponse.json({ data: await acceptInvitation(session, body) }, { headers: NO_STORE })
}
