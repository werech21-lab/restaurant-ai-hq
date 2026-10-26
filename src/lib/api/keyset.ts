import { decodeCursor, encodeCursor, type Page } from '@/lib/api/cursor'

/** A sortable column. `sql` and `cast` come from a server-side whitelist, never from user input. */
export type SortColumn = { sql: string; cast: 'timestamptz' | 'bigint' | 'date' | 'text' }

export type KeysetArgs = {
  sortKey: string
  column: SortColumn
  direction: 'asc' | 'desc'
  cursor: string | undefined
  /** Shared parameter list. This helper appends to it and returns clauses that use the new placeholders. */
  params: unknown[]
}

export type KeysetClauses = {
  /** An `and ...` fragment, or an empty string on the first page. */
  where: string
  orderBy: string
  /** Select this expression so each row carries its sort value as text. */
  selectValue: string
}

/** Keyset pagination: stable under inserts and fast on an index of (tenant_id, sort column, id). */
export function keysetClauses(args: KeysetArgs): KeysetClauses {
  const { sortKey, column, direction, cursor, params } = args
  const dir = direction === 'asc' ? 'asc' : 'desc'
  let where = ''
  if (cursor) {
    const position = decodeCursor(cursor, { sort: sortKey, direction })
    params.push(position.value)
    const valueIndex = params.length
    params.push(position.id)
    const idIndex = params.length
    const operator = dir === 'asc' ? '>' : '<'
    where = ` and (${column.sql}, id) ${operator} ($${valueIndex}::${column.cast}, $${idIndex}::uuid)`
  }
  return {
    where,
    orderBy: `${column.sql} ${dir}, id ${dir}`,
    selectValue: `(${column.sql})::text as "sortValue"`,
  }
}

/** Fetch `limit + 1` rows, then pass them here. Returns the page and the cursor for the next one. */
export function toPage<T extends { id: string; sortValue: string }>(
  rows: T[],
  limit: number,
  sortKey: string,
  direction: 'asc' | 'desc'
): Page<Omit<T, 'sortValue'>> {
  const hasMore = rows.length > limit
  const pageRows = hasMore ? rows.slice(0, limit) : rows
  const last = pageRows[pageRows.length - 1]
  const data = pageRows.map((row) => {
    const { sortValue: _sortValue, ...rest } = row
    return rest
  })
  return {
    data,
    nextCursor: hasMore && last ? encodeCursor({ sort: sortKey, direction, value: last.sortValue, id: last.id }) : null,
  }
}
