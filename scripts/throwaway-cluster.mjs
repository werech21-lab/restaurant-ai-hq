// A temporary Postgres on 127.0.0.1 only. It never reads DATABASE_URL or any .env file, never connects
// to Supabase, and deletes its data directory before it exits. Synthetic companies come from runIsolationChecks
// and are rolled back inside that function.
//
//   node scripts/throwaway-cluster.mjs --throwaway-local
//
// Postgres binaries come from the optional package `embedded-postgres`. Set THROWAWAY_PG_PACKAGE to its
// node_modules path when it is not installed in this repository.
import { createHash, randomBytes } from 'node:crypto'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import pg from 'pg'
import { runIsolationChecks } from './ops-lib.mjs'

const DATABASE = 'aether_throwaway_synthetic'
const HOST = '127.0.0.1'
const PORT = 54329

if (process.env.DATABASE_URL) {
  process.stderr.write('Refusing to start: DATABASE_URL is set. This script never uses an external database.\n')
  process.exit(1)
}
if (!process.argv.includes('--throwaway-local')) {
  process.stderr.write('Add --throwaway-local. This starts a temporary Postgres on 127.0.0.1 and deletes it afterwards.\n')
  process.exit(1)
}

const here = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.join(here, '..', 'database', 'migrations')
const password = randomBytes(18).toString('base64url')
const dataDir = await mkdtemp(path.join(tmpdir(), 'aether-throwaway-pg-'))

async function loadEmbeddedPostgres() {
  const root = process.env.THROWAWAY_PG_PACKAGE
  const specifier = root
    ? pathToFileURL(path.join(root, 'node_modules', 'embedded-postgres', 'dist', 'index.js')).href
    : 'embedded-postgres'
  const loaded = await import(specifier)
  return loaded.default
}

const stub = `
  create schema if not exists auth;
  create table if not exists auth.users (id uuid primary key, email text);
  create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  end $$;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  grant usage on schema auth to anon, authenticated;
`

const supabaseUid = `
  create or replace function auth.uid() returns uuid language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
  $$;
`

function assertLocal(url) {
  const parsed = new URL(url)
  if (parsed.hostname !== HOST) throw new Error(`Refusing host ${parsed.hostname}. Only ${HOST} is allowed.`)
  if (parsed.pathname !== `/${DATABASE}`) throw new Error(`Refusing database ${parsed.pathname}.`)
  if (parsed.password !== password) throw new Error('Refusing a connection string that was not created by this process.')
}

async function migrationFiles() {
  const names = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort()
  const files = []
  for (const name of names) {
    const sql = await readFile(path.join(migrationsDir, name), 'utf8')
    files.push({ name, sql, checksum: createHash('sha256').update(sql).digest('hex') })
  }
  return files
}

async function applyMigrations(client, files) {
  await client.query(stub)
  await client.query(
    `create table if not exists schema_migrations (
       name text primary key,
       checksum text not null,
       applied_at timestamptz not null default now()
     )`
  )
  for (const file of files) {
    await client.query('begin')
    try {
      await client.query(file.sql)
      await client.query('insert into schema_migrations (name, checksum) values ($1, $2)', [file.name, file.checksum])
      await client.query('commit')
      process.stdout.write(`apply  ${file.name}\n`)
    } catch (error) {
      await client.query('rollback')
      throw new Error(`${file.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

async function proveRowLock(url) {
  const owner = randomBytes(16).toString('hex')
  const userId = (await (async () => {
    const client = new pg.Client({ connectionString: url, ssl: false })
    await client.connect()
    try {
      const id = (await client.query('select gen_random_uuid() as id')).rows[0].id
      await client.query('insert into auth.users (id, email) values ($1, $2)', [id, `${owner}@validation.invalid`])
      const tenantId = (await client.query('select erp_bootstrap_tenant($1, $2, $3) as id', [`Throwaway ${owner}`, `zz-throwaway-${owner}`, id])).rows[0].id
      return { client, id, tenantId }
    } catch (error) {
      await client.end()
      throw error
    }
  })())

  const holder = userId.client
  const waiter = new pg.Client({ connectionString: url, ssl: false })
  await waiter.connect()
  try {
    await holder.query('begin')
    await holder.query('select id from tenants where id = $1 for update', [userId.tenantId])
    await waiter.query('begin')
    await waiter.query(`set local lock_timeout = '1s'`)
    let blocked = false
    try {
      await waiter.query('select id from tenants where id = $1 for update', [userId.tenantId])
    } catch (error) {
      blocked = error instanceof Error && /lock timeout/i.test(error.message)
      if (!blocked) throw error
    }
    await waiter.query('rollback')
    await holder.query('rollback')
    const left = (await holder.query(`select count(*)::int as n from tenants where slug = $1`, [`zz-throwaway-${owner}`])).rows[0].n
    return { blocked, tenantStillThere: left === 1 }
  } finally {
    await waiter.end()
    await holder.end()
  }
}

let cluster
let admin
try {
  const EmbeddedPostgres = await loadEmbeddedPostgres()
  cluster = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'aether_throwaway',
    password,
    port: PORT,
    persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    postgresFlags: ['-c', `listen_addresses=${HOST}`],
    onLog: (message) => process.stdout.write(message.endsWith('\n') ? message : `${message}\n`),
    onError: (error) => process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`),
  })
  await cluster.initialise()
  await cluster.start()
  await cluster.createDatabase(DATABASE)
  const url = `postgresql://aether_throwaway:${encodeURIComponent(password)}@${HOST}:${PORT}/${DATABASE}`
  assertLocal(url)

  admin = new pg.Client({ connectionString: url, ssl: false })
  await admin.connect()
  const version = (await admin.query('select version() as v')).rows[0].v
  process.stdout.write(`postgres  ${version.split(',')[0]}\n`)
  process.stdout.write(`target    ${HOST}:${PORT}/${DATABASE}\n`)

  const files = await migrationFiles()
  await applyMigrations(admin, files)
  const applied = (await admin.query('select name from schema_migrations order by name')).rows.map((row) => row.name)
  const wanted = files.filter((file) => file.name >= '0009' && file.name <= '0016').map((file) => file.name)
  const missing = wanted.filter((name) => !applied.includes(name))
  const orderOk = wanted.every((name, index) => applied.indexOf(name) > (index === 0 ? -1 : applied.indexOf(wanted[index - 1])))
  process.stdout.write(`migrations 0009-0016  ${missing.length === 0 && orderOk ? 'PASS' : 'FAIL'}  applied=${applied.length} missing=${missing.join(',') || 'none'}\n`)

  await admin.query(supabaseUid)
  const isolation = await runIsolationChecks(admin, randomBytes(4).toString('hex'))
  const failed = isolation.checks.filter((check) => !check.ok)
  process.stdout.write(`rls  ${isolation.ok ? 'PASS' : 'FAIL'}  ${isolation.checks.length - failed.length}/${isolation.checks.length}\n`)
  for (const check of failed) process.stdout.write(`FAIL  ${check.name}  -> ${check.detail}\n`)

  await admin.query('begin')
  await admin.query('create temp table throwaway_probe (n int)')
  await admin.query('insert into throwaway_probe (n) values (1)')
  await admin.query('rollback')
  const probeLeft = (await admin.query(`select to_regclass('pg_temp.throwaway_probe') is not null as left`)).rows[0].left
  process.stdout.write(`rollback  ${probeLeft ? 'FAIL' : 'PASS'}  a failed transaction left ${probeLeft ? 'the probe table' : 'nothing'}\n`)

  const lock = await proveRowLock(url)
  process.stdout.write(`row lock  ${lock.blocked ? 'PASS' : 'FAIL'}  second session ${lock.blocked ? 'waited and timed out' : 'did not block'}\n`)
  process.stdout.write(`holder rollback kept the company  ${lock.tenantStillThere ? 'PASS' : 'FAIL'}\n`)

  if (missing.length > 0 || !orderOk || !isolation.ok || probeLeft || !lock.blocked || !lock.tenantStillThere) process.exitCode = 1
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
} finally {
  await admin?.end().catch(() => undefined)
  if (cluster) {
    await cluster.dropDatabase(DATABASE).catch(() => undefined)
    await cluster.stop().catch(() => undefined)
  }
  await rm(dataDir, { recursive: true, force: true }).catch(() => undefined)
  process.stdout.write('cleanup  data directory removed\n')
  process.exit(process.exitCode ?? 0)
}
