// Local browser suite only. Starts Postgres on 127.0.0.1, applies the migrations, seeds two synthetic
// companies, then starts Next.js against that database. It never reads an env file and refuses a
// DATABASE_URL that was already set. The data directory is deleted when the process stops.
//
//   node scripts/e2e-local.mjs
//
// Postgres binaries come from the optional package embedded-postgres. Set THROWAWAY_PG_PACKAGE to its
// install root when it is not a dependency of this repository.
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import pg from 'pg'
import { runIsolationChecks } from './ops-lib.mjs'

const DATABASE = 'aether_e2e_synthetic'
const HOST = '127.0.0.1'
const PG_PORT = 54330
const WEB_PORT = 4010
const runtimeFile = path.join(tmpdir(), 'aether-e2e-runtime.json')

if (process.env.DATABASE_URL) {
  process.stderr.write('Refusing to start: DATABASE_URL is set. This script never uses an external database.\n')
  process.exit(1)
}

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.join(here, '..')
const migrationsDir = path.join(repo, 'database', 'migrations')
const password = randomBytes(18).toString('base64url')
const secret = randomBytes(32).toString('base64url')
const dataDir = await mkdtemp(path.join(tmpdir(), 'aether-e2e-pg-'))

function sign(userId) {
  return `${userId}.${createHmac('sha256', secret).update(userId).digest('base64url')}`
}

async function loadEmbeddedPostgres() {
  const root = process.env.THROWAWAY_PG_PACKAGE || path.join(tmpdir(), 'aether-throwaway-pg16')
  const specifier = pathToFileURL(path.join(root, 'node_modules', 'embedded-postgres', 'dist', 'index.js')).href
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
    } catch (error) {
      await client.query('rollback')
      throw new Error(`${file.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

async function seedCompany(client, slug) {
  const ownerId = randomUUID()
  await client.query('insert into auth.users (id, email) values ($1, $2)', [ownerId, `${slug}@e2e.invalid`])
  const tenantId = (await client.query('select erp_bootstrap_tenant($1, $2, $3) as id', [`Synthetic ${slug}`, slug, ownerId])).rows[0].id
  const viewerId = randomUUID()
  await client.query('insert into auth.users (id, email) values ($1, $2)', [viewerId, `viewer-${slug}@e2e.invalid`])
  await client.query('insert into profiles (id) values ($1) on conflict (id) do nothing', [viewerId])
  const member = await client.query(
    `insert into tenant_members (tenant_id, user_id, role_id, created_by)
     select $1, $2, id, $3 from roles where tenant_id = $1 and name = 'viewer'
     returning user_id`,
    [tenantId, viewerId, ownerId]
  )
  if (member.rowCount !== 1) throw new Error(`The viewer role was not seeded for ${slug}.`)
  return {
    tenantId,
    owner: { userId: ownerId, cookie: sign(ownerId) },
    viewer: { userId: viewerId, cookie: sign(viewerId) },
  }
}

let cluster
let admin
let web
let cleaned = false

async function cleanup() {
  if (cleaned) return
  cleaned = true
  if (web && web.exitCode === null) web.kill()
  await admin?.end().catch(() => undefined)
  await cluster?.stop().catch(() => undefined)
  await rm(dataDir, { recursive: true, force: true })
  await rm(runtimeFile, { force: true })
  process.stdout.write('e2e cleanup  data directory removed\n')
}

try {
  const EmbeddedPostgres = await loadEmbeddedPostgres()
  cluster = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'aether_e2e',
    password,
    port: PG_PORT,
    persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    postgresFlags: ['-c', `listen_addresses=${HOST}`],
    onLog: () => undefined,
    onError: (error) => process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`),
  })
  await cluster.initialise()
  await cluster.start()
  await cluster.createDatabase(DATABASE)
  const url = `postgresql://aether_e2e:${encodeURIComponent(password)}@${HOST}:${PG_PORT}/${DATABASE}`
  const parsed = new URL(url)
  if (parsed.hostname !== HOST || parsed.pathname !== `/${DATABASE}`) throw new Error('The local database URL failed its own check.')

  admin = new pg.Client({ connectionString: url, ssl: false })
  await admin.connect()
  const version = (await admin.query('select version() as v')).rows[0].v
  process.stdout.write(`postgres  ${version.split(',')[0]}\n`)
  process.stdout.write(`target    ${HOST}:${PG_PORT}/${DATABASE}\n`)

  const files = await migrationFiles()
  await applyMigrations(admin, files)
  await admin.query(supabaseUid)
  const applied = (await admin.query('select name from schema_migrations order by name')).rows.map((row) => row.name)
  process.stdout.write(`migrations  applied=${applied.length}\n`)

  const isolation = await runIsolationChecks(admin, randomBytes(4).toString('hex'))
  const failed = isolation.checks.filter((check) => !check.ok)
  process.stdout.write(`rls  ${isolation.ok ? 'PASS' : 'FAIL'}  ${isolation.checks.length - failed.length}/${isolation.checks.length}\n`)
  for (const check of failed) process.stdout.write(`FAIL  ${check.name}  -> ${check.detail}\n`)
  if (!isolation.ok) throw new Error('RLS checks failed.')

  const companyA = await seedCompany(admin, `e2e-a-${randomBytes(3).toString('hex')}`)
  const companyB = await seedCompany(admin, `e2e-b-${randomBytes(3).toString('hex')}`)
  await writeFile(
    runtimeFile,
    JSON.stringify({
      baseUrl: `http://${HOST}:${WEB_PORT}`,
      databaseUrl: url,
      companyA,
      companyB,
    }),
    { mode: 0o600 }
  )

  const nextBin = path.join(repo, 'node_modules', 'next', 'dist', 'bin', 'next')
  web = spawn(process.execPath, [nextBin, 'dev', '-H', HOST, '-p', String(WEB_PORT)], {
    cwd: repo,
    env: {
      ...process.env,
      AETHER_E2E: '1',
      AETHER_E2E_SECRET: secret,
      DATABASE_URL: url,
      DATABASE_SSL: 'disable',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'e2e-local-anon-not-a-secret',
    },
    stdio: 'inherit',
  })
  web.on('exit', (code) => {
    if (!cleaned) {
      process.stderr.write(`next exited ${code ?? 'null'}\n`)
      cleanup().finally(() => process.exit(code ?? 1))
    }
  })

  const stop = () => {
    cleanup().finally(() => process.exit(0))
  }
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  await cleanup()
  process.exit(1)
}
