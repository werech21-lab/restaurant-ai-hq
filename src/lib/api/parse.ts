import type { NextRequest } from 'next/server'
import type { z } from 'zod'
import { AppError } from '@/lib/api/errors'

function validate<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new AppError(
      422,
      'validation_failed',
      'The request did not pass validation.',
      result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
    )
  }
  return result.data
}

export async function parseBody<S extends z.ZodType>(request: NextRequest, schema: S): Promise<z.output<S>> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    throw new AppError(400, 'invalid_json', 'The request body must be valid JSON.')
  }
  return validate(schema, raw)
}

export function parseQuery<S extends z.ZodType>(request: NextRequest, schema: S): z.output<S> {
  return validate(schema, Object.fromEntries(request.nextUrl.searchParams.entries()))
}

export function parseParams<S extends z.ZodType>(params: Record<string, string>, schema: S): z.output<S> {
  return validate(schema, params)
}
