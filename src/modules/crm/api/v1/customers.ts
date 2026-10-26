import { NextResponse } from 'next/server'
import { parseBody, parseParams, parseQuery } from '@/lib/api/parse'
import type { RouteArgs } from '@/lib/api/route'
import { idParamsSchema } from '@/modules/crm/schemas/common'
import {
  createCustomerSchema,
  listCustomersQuerySchema,
  updateCustomerSchema,
} from '@/modules/crm/schemas/customer'
import {
  createCustomer,
  getCustomer,
  getCustomerProfile,
  listCustomers,
  updateCustomer,
} from '@/modules/crm/services/customer-service'

export async function listCustomersHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const query = parseQuery(request, listCustomersQuerySchema)
  const page = await listCustomers(auth, query)
  return NextResponse.json(page, { status: 200 })
}

export async function createCustomerHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const input = await parseBody(request, createCustomerSchema)
  const customer = await createCustomer(auth, input)
  return NextResponse.json({ data: customer }, { status: 201 })
}

export async function getCustomerHandler({ auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  return NextResponse.json(await getCustomer(auth, id), { status: 200 })
}

export async function updateCustomerHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  const input = await parseBody(request, updateCustomerSchema)
  return NextResponse.json(await updateCustomer(auth, id, input), { status: 200 })
}

export async function customerProfileHandler({ auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  return NextResponse.json(await getCustomerProfile(auth, id), { status: 200 })
}
