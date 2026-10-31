import { NextResponse } from 'next/server'
import { parseBody, parseParams, parseQuery } from '@/lib/api/parse'
import type { RouteArgs } from '@/lib/api/route'
import {
  createAccountSchema,
  listActivityQuerySchema,
  updateAccountSchema,
  updateSecuritySchema,
  userParamsSchema,
} from '@/modules/admin/schemas/admin'
import { createAccount, getSecurity, listAccounts, listActivity, purgeDemoPlaceholders, updateAccount, updateSecurity } from '@/modules/admin/services/admin-service'

function clientIp(request: RouteArgs['request']): string | null {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip')?.trim() ?? ''
  return /^(?:\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]+$/i.test(forwarded) ? forwarded : null
}

export async function purgeDemoHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await purgeDemoPlaceholders(auth) })
}

export async function listAccountsHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await listAccounts(auth))
}

export async function createAccountHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const input = await parseBody(request, createAccountSchema)
  return NextResponse.json(await createAccount(auth, input, clientIp(request)), { status: 201 })
}

export async function updateAccountHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { userId } = parseParams(params, userParamsSchema)
  const input = await parseBody(request, updateAccountSchema)
  return NextResponse.json(await updateAccount(auth, userId, input, clientIp(request)))
}

export async function listActivityHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await listActivity(auth, parseQuery(request, listActivityQuerySchema)))
}

export async function getSecurityHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await getSecurity(auth))
}

export async function updateSecurityHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const input = await parseBody(request, updateSecuritySchema)
  return NextResponse.json(await updateSecurity(auth, input, clientIp(request)))
}
