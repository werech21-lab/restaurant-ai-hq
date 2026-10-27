import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import type { QueryResult, QueryResultRow } from 'pg'
import type { Queryable } from '@/lib/db'

/**
 * An in-process Postgres (PGlite) with the real migrations applied. Integration tests run the real repositories and
 * services against it. Supabase's `auth` schema and roles are stubbed because they do not exist outside Supabase.
 */
let instance: PGlite | null = null

const supabaseStub = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  create role anon;
  create role authenticated;
  -- Supabase grants every new public table, sequence and function to these roles by default. Mirroring that here means
  -- the privilege tests prove the migrations revoke what they must, instead of passing because nothing was granted.
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  grant usage on schema auth to anon, authenticated;
`

function adapt(source: { query: PGlite['query'] }): Queryable {
  return {
    query: async <R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => {
      const result = await source.query<R>(text, params)
      const rowCount = result.affectedRows ?? result.rows.length
      return { rows: result.rows, rowCount } as unknown as QueryResult<R>
    },
  }
}

export function getPglite(): PGlite {
  if (!instance) throw new Error('Call startDatabase() first')
  return instance
}

export async function startDatabase(): Promise<void> {
  instance = new PGlite({
    parsers: {
      20: (value: string) => Number(value),
      1082: (value: string) => value,
    },
  })
  await instance.exec(supabaseStub)
  const directory = path.join(process.cwd(), 'database', 'migrations')
  const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort()
  for (const file of files) {
    await instance.exec(await readFile(path.join(directory, file), 'utf8'))
  }
}

export async function stopDatabase(): Promise<void> {
  await instance?.close()
  instance = null
}

export const testDb: Queryable = {
  query: (text, params) => adapt(getPglite()).query(text, params),
}

export async function testWithTransaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
  return getPglite().transaction(async (transaction) => fn(adapt(transaction)))
}

export async function createUser(id: string): Promise<void> {
  await getPglite().query('insert into auth.users (id) values ($1)', [id])
}

export async function bootstrapTenant(name: string, slug: string, owner: string): Promise<string> {
  const result = await getPglite().query<{ id: string }>('select erp_bootstrap_tenant($1, $2, $3) as id', [name, slug, owner])
  return result.rows[0].id
}
