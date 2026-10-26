// Applies database/migrations/*.sql in order, each inside one transaction.
// Usage: node --env-file=.env.local scripts/migrate.mjs
// An applied migration whose file has changed is reported and the run stops: merged migrations are never edited.
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const directory = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'database', 'migrations')
const url = process.env.DATABASE_URL
if (!url) {
  process.stderr.write('DATABASE_URL is not set.\n')
  process.exit(1)
}
const sslMode = process.env.DATABASE_SSL ?? 'require'
const ssl = sslMode === 'disable' ? false : sslMode === 'verify' ? true : { rejectUnauthorized: false }

const client = new pg.Client({ connectionString: url, ssl })
await client.connect()

try {
  await client.query(
    `create table if not exists schema_migrations (
       name text primary key,
       checksum text not null,
       applied_at timestamptz not null default now()
     )`
  )
  const applied = new Map((await client.query('select name, checksum from schema_migrations')).rows.map((row) => [row.name, row.checksum]))
  const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort()

  for (const file of files) {
    const sql = await readFile(path.join(directory, file), 'utf8')
    const checksum = createHash('sha256').update(sql).digest('hex')
    const previous = applied.get(file)
    if (previous !== undefined) {
      if (previous !== checksum) {
        throw new Error(`${file} was changed after it was applied. Add a new migration instead.`)
      }
      process.stdout.write(`skip   ${file}\n`)
      continue
    }
    await client.query('begin')
    try {
      await client.query(sql)
      await client.query('insert into schema_migrations (name, checksum) values ($1, $2)', [file, checksum])
      await client.query('commit')
      process.stdout.write(`apply  ${file}\n`)
    } catch (error) {
      await client.query('rollback')
      throw error
    }
  }
} catch (error) {
  process.stderr.write(`Migration failed: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
} finally {
  await client.end()
}
