import { z } from 'zod'
import { AppError } from '@/lib/api/errors'

export const MAX_PAGE_SIZE = 100
export const DEFAULT_PAGE_SIZE = 25

export type Page<T> = { data: T[]; nextCursor: string | null }

/** Query fields shared by every list endpoint. */
export const pageQuerySchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
})

export type CursorPosition = { sort: string; direction: 'asc' | 'desc'; value: string; id: string }

const positionSchema = z.object({
  sort: z.string(),
  direction: z.enum(['asc', 'desc']),
  value: z.string(),
  id: z.string().uuid(),
})

export function encodeCursor(position: CursorPosition): string {
  return Buffer.from(JSON.stringify(position), 'utf8').toString('base64url')
}

/** Decodes a cursor and rejects it when it belongs to a different sort order than the current request. */
export function decodeCursor(cursor: string, expected: { sort: string; direction: 'asc' | 'desc' }): CursorPosition {
  let raw: unknown
  try {
    raw = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
  } catch {
    throw new AppError(400, 'cursor_invalid', 'The cursor is not valid.')
  }
  const parsed = positionSchema.safeParse(raw)
  if (!parsed.success || parsed.data.sort !== expected.sort || parsed.data.direction !== expected.direction) {
    throw new AppError(400, 'cursor_invalid', 'The cursor is not valid for this sort order.')
  }
  return parsed.data
}
