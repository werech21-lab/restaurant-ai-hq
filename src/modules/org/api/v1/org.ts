import { NextResponse } from 'next/server'
import { parseBody, parseParams, parseQuery } from '@/lib/api/parse'
import type { RouteArgs } from '@/lib/api/route'
import {
  createBranch,
  createBrand,
  getBranch,
  getBrand,
  listBranches,
  listBrands,
  updateBranch,
  updateBrand,
} from '@/modules/org/services/org-service'
import {
  createBranchSchema,
  createBrandSchema,
  idParamsSchema,
  listBranchesQuerySchema,
  listBrandsQuerySchema,
  updateBranchSchema,
  updateBrandSchema,
} from '@/modules/org/schemas/org'

export async function listBrandsHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await listBrands(auth, parseQuery(request, listBrandsQuerySchema)))
}

export async function createBrandHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await createBrand(auth, await parseBody(request, createBrandSchema)), { status: 201 })
}

export async function getBrandHandler({ auth, params }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await getBrand(auth, parseParams(params, idParamsSchema).id))
}

export async function updateBrandHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  return NextResponse.json(await updateBrand(auth, id, await parseBody(request, updateBrandSchema)))
}

export async function listBranchesHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await listBranches(auth, parseQuery(request, listBranchesQuerySchema)))
}

export async function createBranchHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await createBranch(auth, await parseBody(request, createBranchSchema)), { status: 201 })
}

export async function getBranchHandler({ auth, params }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await getBranch(auth, parseParams(params, idParamsSchema).id))
}

export async function updateBranchHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  return NextResponse.json(await updateBranch(auth, id, await parseBody(request, updateBranchSchema)))
}