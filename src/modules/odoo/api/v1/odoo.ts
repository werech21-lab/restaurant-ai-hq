import { NextResponse } from 'next/server'
import { AppError } from '@/lib/api/errors'
import { parseBody } from '@/lib/api/parse'
import type { RouteArgs } from '@/lib/api/route'
import { requireIdempotencyKey } from '@/lib/idempotency'
import { pullOdooSchema } from '@/modules/odoo/schemas/odoo'
import { importOdooFile, odooBoard, pullOdoo } from '@/modules/odoo/services/odoo-service'

function created(outcome: { status: number; body: unknown; replayed: boolean }): NextResponse {
  return NextResponse.json(outcome.body, { status: outcome.status, headers: outcome.replayed ? { 'Idempotent-Replayed': 'true' } : undefined })
}

export async function odooBoardHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await odooBoard(auth) })
}

export async function pullOdooHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const input = await parseBody(request, pullOdooSchema)
  return created(await pullOdoo(auth, requireIdempotencyKey(request), input))
}

export async function importOdooFileHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const key = requireIdempotencyKey(request)
  const type = request.headers.get('content-type') ?? ''
  if (!type.includes('multipart/form-data')) throw new AppError(422, 'validation_failed', 'Upload a CSV or Excel file.')
  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) throw new AppError(422, 'validation_failed', 'Choose a file exported from Odoo.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  return created(await importOdooFile(auth, key, file.name, bytes))
}
