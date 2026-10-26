import { describe, expect, it, vi } from 'vitest'
import { AppError } from '@/lib/api/errors'
import { decodeCursor, encodeCursor } from '@/lib/api/cursor'
import { keysetClauses, toPage } from '@/lib/api/keyset'
import { hashRequest, runIdempotent } from '@/lib/idempotency'
import type { Queryable } from '@/lib/db'

const ID_A = '11111111-1111-4111-8111-111111111111'
const ID_B = '22222222-2222-4222-8222-222222222222'

describe('cursor', () => {
  it('round-trips a position', () => {
    const cursor = encodeCursor({ sort: 'createdAt', direction: 'desc', value: '2026-10-01 10:00:00+00', id: ID_A })
    expect(decodeCursor(cursor, { sort: 'createdAt', direction: 'desc' }).id).toBe(ID_A)
  })

  it('rejects garbage and a cursor from another sort order', () => {
    expect(() => decodeCursor('not-a-cursor', { sort: 'createdAt', direction: 'desc' })).toThrow(AppError)
    const cursor = encodeCursor({ sort: 'createdAt', direction: 'desc', value: 'x', id: ID_A })
    expect(() => decodeCursor(cursor, { sort: 'totalMinor', direction: 'desc' })).toThrow(AppError)
    expect(() => decodeCursor(cursor, { sort: 'createdAt', direction: 'asc' })).toThrow(AppError)
  })
})

describe('keysetClauses', () => {
  const column = { sql: 'total_minor', cast: 'bigint' } as const

  it('adds no filter on the first page', () => {
    const params: unknown[] = ['tenant']
    const clauses = keysetClauses({ sortKey: 'totalMinor', column, direction: 'desc', cursor: undefined, params })
    expect(clauses.where).toBe('')
    expect(clauses.orderBy).toBe('total_minor desc, id desc')
    expect(params).toEqual(['tenant'])
  })

  it('compares the sort value and id with the right operator', () => {
    const cursor = encodeCursor({ sort: 'totalMinor', direction: 'asc', value: '500', id: ID_A })
    const params: unknown[] = ['tenant']
    const clauses = keysetClauses({ sortKey: 'totalMinor', column, direction: 'asc', cursor, params })
    expect(clauses.where).toBe(' and (total_minor, id) > ($2::bigint, $3::uuid)')
    expect(params).toEqual(['tenant', '500', ID_A])
  })
})

describe('toPage', () => {
  const rows = [
    { id: ID_A, sortValue: '1', name: 'a' },
    { id: ID_B, sortValue: '2', name: 'b' },
  ]

  it('returns a cursor only when there is another page', () => {
    const more = toPage(rows, 1, 'totalMinor', 'asc')
    expect(more.data).toEqual([{ id: ID_A, name: 'a' }])
    expect(more.nextCursor).not.toBeNull()
    const last = toPage(rows, 2, 'totalMinor', 'asc')
    expect(last.data).toHaveLength(2)
    expect(last.nextCursor).toBeNull()
  })

  it('handles an empty result', () => {
    expect(toPage([], 25, 'totalMinor', 'asc')).toEqual({ data: [], nextCursor: null })
  })
})

describe('runIdempotent', () => {
  const args = { tenantId: 't', scope: 's', key: 'key-12345678', requestHash: hashRequest({ a: 1 }) }

  function fakeTx(responses: Array<{ rowCount: number; rows: unknown[] }>): Queryable {
    const query = vi.fn()
    responses.forEach((response) => query.mockResolvedValueOnce(response))
    return { query } as unknown as Queryable
  }

  it('runs the work and stores the response on first use', async () => {
    const tx = fakeTx([
      { rowCount: 1, rows: [{ key: 'k' }] },
      { rowCount: 1, rows: [] },
    ])
    const run = vi.fn(async () => ({ status: 201 as const, body: { ok: true } }))
    const result = await runIdempotent(tx, args, run)
    expect(result).toEqual({ replayed: false, status: 201, body: { ok: true } })
    expect(run).toHaveBeenCalledOnce()
  })

  it('replays the stored response without running the work', async () => {
    const tx = fakeTx([
      { rowCount: 0, rows: [] },
      { rowCount: 1, rows: [{ request_hash: args.requestHash, response_status: 201, response_body: { ok: true } }] },
    ])
    const run = vi.fn()
    const result = await runIdempotent(tx, args, run)
    expect(result).toEqual({ replayed: true, status: 201, body: { ok: true } })
    expect(run).not.toHaveBeenCalled()
  })

  it('rejects the same key with a different request', async () => {
    const tx = fakeTx([
      { rowCount: 0, rows: [] },
      { rowCount: 1, rows: [{ request_hash: 'other', response_status: 201, response_body: {} }] },
    ])
    await expect(runIdempotent(tx, args, vi.fn())).rejects.toMatchObject({ status: 422, code: 'idempotency_key_reused' })
  })

  it('hashes equal requests equally and different requests differently', () => {
    expect(hashRequest({ a: 1 })).toBe(hashRequest({ a: 1 }))
    expect(hashRequest({ a: 1 })).not.toBe(hashRequest({ a: 2 }))
  })
})
