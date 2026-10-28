import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Static checks on the repository itself: no service-role credential, only the two public Supabase variables reach the browser,
 * server secrets are never read in browser code, and Staging and Production env files cannot be committed by accident.
 * The patterns are built from pieces so that this file does not match its own checks.
 */

const root = process.cwd()
const SERVICE_ROLE = new RegExp('service' + '_role|service' + 'Role|SERVICE' + '_ROLE_KEY|SUPABASE_SERVICE', 'i')
const PUBLIC_ALLOWED = new Set(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'])

async function files(directory: string, include: (file: string) => boolean): Promise<string[]> {
  const found: string[] = []
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch {
    return found
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) found.push(...(await files(full, include)))
    else if (include(full)) found.push(full)
  }
  return found
}

const isCode = (file: string) => /\.(ts|tsx|mjs|js|sql|json)$/.test(file)
const isTest = (file: string) => file.includes(`${path.sep}__tests__${path.sep}`)
const isBrowser = (file: string, text: string) =>
  /^\s*['"]use client['"]/.test(text) || file.includes(`${path.sep}ui${path.sep}`) || file.includes(`${path.sep}components${path.sep}`)

describe('credentials', () => {
  it('has no service-role key or client anywhere in the code, scripts, migrations or env examples', async () => {
    const targets = [
      ...(await files(path.join(root, 'src'), isCode)),
      ...(await files(path.join(root, 'scripts'), isCode)),
      ...(await files(path.join(root, 'database'), isCode)),
      path.join(root, '.env.example'),
      path.join(root, '.env.staging.example'),
    ]
    const offenders: string[] = []
    for (const file of targets) {
      const text = await readFile(file, 'utf8').catch(() => '')
      if (!file.endsWith('security-static.test.ts') && SERVICE_ROLE.test(text)) offenders.push(path.relative(root, file))
    }
    expect(offenders).toEqual([])
  })

  it('exposes only the two public Supabase variables to the browser', async () => {
    const offenders: string[] = []
    for (const file of await files(path.join(root, 'src'), (name) => /\.(ts|tsx)$/.test(name) && !isTest(name))) {
      const text = await readFile(file, 'utf8')
      for (const match of text.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) {
        if (!PUBLIC_ALLOWED.has(match[0])) offenders.push(`${path.relative(root, file)}: ${match[0]}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('never reads the database URL in browser code', async () => {
    const offenders: string[] = []
    for (const file of await files(path.join(root, 'src'), (name) => /\.(ts|tsx)$/.test(name) && !isTest(name))) {
      const text = await readFile(file, 'utf8')
      if (isBrowser(file, text) && /process\.env\.DATABASE|from ['"]pg['"]|from ['"]@\/lib\/db['"]/.test(text)) offenders.push(path.relative(root, file))
    }
    expect(offenders).toEqual([])
  })

  it('contains no pasted publishable or secret key material', async () => {
    const markers = ['sb_' + 'secret_', 'sb_' + 'publishable_']
    const roots = ['src', 'scripts', 'database', 'e2e'].map((name) => path.join(root, name))
    const offenders: string[] = []
    for (const directory of roots) {
      for (const file of await files(directory, isCode)) {
        const text = await readFile(file, 'utf8')
        if (markers.some((marker) => text.includes(marker))) offenders.push(path.relative(root, file))
      }
    }
    expect(offenders).toEqual([])
  })

  it('has env examples with placeholders only', async () => {
    for (const name of ['.env.example', '.env.staging.example']) {
      const text = await readFile(path.join(root, name), 'utf8')
      const values = text
        .split('\n')
        .filter((line) => /^[A-Z_]+=/.test(line))
        .map((line) => line.slice(line.indexOf('=') + 1).trim())
      for (const value of values) {
        if (value === '' || value === 'require' || value === 'verify' || value === 'disable') continue
        expect(value, `${name}: ${value}`).toMatch(/YOUR_|REGION/)
      }
      expect(text).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}|sb_secret|sbp_[A-Za-z0-9]{10,}/)
    }
  })
})

describe('env files', () => {
  it('git ignores the real env files, including Staging and Production', async () => {
    const ignore = (await readFile(path.join(root, '.gitignore'), 'utf8')).split('\n').map((line) => line.trim())
    for (const name of ['.env', '.env.staging', '.env.production']) expect(ignore, name).toContain(name)
    expect(ignore).toContain('.env*.local')
  })

  it('has a Staging example that never points at Production by name', async () => {
    const text = await readFile(path.join(root, '.env.staging.example'), 'utf8')
    expect(text).toMatch(/STAGING/)
    expect(text).not.toMatch(/PRODUCTION_PROJECT|YOUR_PROD/i)
  })
})

describe('logging', () => {
  it('commits no console.log in application code', async () => {
    const offenders: string[] = []
    for (const file of await files(path.join(root, 'src'), (name) => /\.(ts|tsx)$/.test(name) && !isTest(name))) {
      const text = await readFile(file, 'utf8')
      if (/\bconsole\.log\(/.test(text)) offenders.push(path.relative(root, file))
    }
    expect(offenders).toEqual([])
  })
})