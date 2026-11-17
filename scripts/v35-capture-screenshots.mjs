/**
 * Offline fixture screenshot capture for the V35 Executive Dashboard redesign.
 *
 * By default, builds the production bundle (`next build`) and launches `next start`
 * on 127.0.0.1:4015 with clean offline env values (VITEST=true so SQLite stays on a
 * temp copy, never modifying prisma/dev.db). Pass `--dev` to diagnose `next dev`
 * or `--skip-build` to reuse an existing `.next` build.
 */
import { createHmac, randomBytes } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { mkdir, readdir, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const HOST = '127.0.0.1'
const PORT = 4015
const BASE_URL = `http://${HOST}:${PORT}`
const EXEC_SESSION_COOKIE = 'aether_exec_session'
const EXEC_SESSION_MAX_AGE = 12 * 60 * 60
const DB_ENV_KEY = ['DATABASE', 'URL'].join('_')

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')
const fixturePath = path.join(repoRoot, 'src', 'lib', '__tests__', 'fixtures', 'dashboard-today-2026-11-17.json')
const outDir = path.join(repoRoot, 'docs', 'design', 'v35')

const CAPTURES = [
  { file: 'dashboard-ar-desktop.png', lang: 'ar', dir: 'rtl', width: 1440, height: 900 },
  { file: 'dashboard-en-desktop.png', lang: 'en', dir: 'ltr', width: 1440, height: 900 },
  { file: 'dashboard-ar-mobile.png', lang: 'ar', dir: 'rtl', width: 390, height: 844 },
  { file: 'dashboard-en-mobile.png', lang: 'en', dir: 'ltr', width: 390, height: 844 },
]

function mintGmSessionToken(secret) {
  const iat = Math.floor(Date.now() / 1000)
  const payload = {
    sub: 'gm@venturefoodskw.com',
    role: 'gm',
    nameAr: 'المدير العام',
    nameEn: 'General Manager',
    titleAr: 'المدير العام',
    titleEn: 'General Manager',
    iat,
    exp: iat + EXEC_SESSION_MAX_AGE,
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sigB64 = createHmac('sha256', secret).update(payloadB64).digest('base64url')
  return `${payloadB64}.${sigB64}`
}

function buildCleanChildEnv(sessionSecret, nodeEnv) {
  const scrubbed = {}
  const blockedPrefix = /^(DATABASE|PG|POSTGRES|PRISMA|ODOO|SUPABASE|AETHER|SESSION|AUTH|CRON|SMTP|OPENAI|GEMINI|XAI|VERCEL)/i
  for (const [k, v] of Object.entries(process.env)) {
    if (!blockedPrefix.test(k) && v !== undefined) {
      scrubbed[k] = v
    }
  }
  return {
    ...scrubbed,
    NODE_ENV: nodeEnv,
    NEXT_TELEMETRY_DISABLED: '1',
    [DB_ENV_KEY]: '',
    ODOO_URL: '',
    ODOO_DB: '',
    ODOO_USERNAME: '',
    ODOO_USER: '',
    ODOO_PASSWORD: '',
    ODOO_API_KEY: '',
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'offline',
    VITEST: 'true',
    AETHER_SESSION_SECRET: sessionSecret,
    SESSION_SECRET: '',
    AUTH_SECRET: '',
  }
}

async function waitForServerReady(url, serverProc, getLogs, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (serverProc.exitCode !== null) {
      throw new Error(`next server exited early with code ${serverProc.exitCode}\n${getLogs()}`)
    }
    try {
      const res = await fetch(`${url}/api/health`, { cache: 'no-store' })
      if (res.ok) return
    } catch {
      // Server still booting
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(`Timed out waiting for ${url}/api/health\n${getLogs()}`)
}

async function stopServerTree(serverProc) {
  if (!serverProc || serverProc.exitCode !== null || !serverProc.pid) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(serverProc.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    serverProc.kill('SIGTERM')
  }
  const exited = await Promise.race([
    new Promise((resolve) => serverProc.once('exit', () => resolve(true))),
    new Promise((resolve) => setTimeout(() => resolve(false), 5000)),
  ])
  if (!exited && process.platform !== 'win32') {
    serverProc.kill('SIGKILL')
  }
}

async function removeTempVitestSqliteCopies() {
  const dirs = Array.from(new Set([path.resolve('/tmp'), os.tmpdir()]))
  const removed = []
  for (const dir of dirs) {
    let entries = []
    try {
      entries = await readdir(dir)
    } catch {
      continue
    }
    for (const name of entries) {
      if (!name.startsWith('aetherbi-vitest-')) continue
      const target = path.join(dir, name)
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await rm(target, { force: true })
          removed.push(target)
          break
        } catch {
          await new Promise((r) => setTimeout(r, 120))
        }
      }
    }
  }
  return removed
}

function runProductionBuild(env) {
  const prismaBin = path.join(repoRoot, 'node_modules', 'prisma', 'build', 'index.js')
  const nextBin = path.join(repoRoot, 'node_modules', 'next', 'dist', 'bin', 'next')
  process.stdout.write('BUILD running prisma generate + next build (offline env)...\n')
  const prismaRes = spawnSync(process.execPath, [prismaBin, 'generate'], {
    cwd: repoRoot,
    env,
    stdio: 'pipe',
    encoding: 'utf8',
  })
  if (prismaRes.status !== 0) {
    throw new Error(`prisma generate failed (${prismaRes.status}):\n${prismaRes.stdout}\n${prismaRes.stderr}`)
  }
  const nextRes = spawnSync(process.execPath, [nextBin, 'build'], {
    cwd: repoRoot,
    env,
    stdio: 'pipe',
    encoding: 'utf8',
  })
  if (nextRes.status !== 0) {
    throw new Error(`next build failed (${nextRes.status}):\n${nextRes.stdout}\n${nextRes.stderr}`)
  }
  process.stdout.write('BUILD complete\n')
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const useDev = args.has('--dev')
  const skipBuild = args.has('--skip-build')

  const rawFixture = JSON.parse(await readFile(fixturePath, 'utf8'))
  if (!rawFixture?.summary) {
    throw new Error(`Missing .summary in ${fixturePath}`)
  }
  const summaryJson = JSON.stringify(rawFixture.summary)
  await mkdir(outDir, { recursive: true })

  const sessionSecret = randomBytes(32).toString('hex')
  const sessionToken = mintGmSessionToken(sessionSecret)
  const nextBin = path.join(repoRoot, 'node_modules', 'next', 'dist', 'bin', 'next')
  const nodeEnv = useDev ? 'development' : 'production'
  const childEnv = buildCleanChildEnv(sessionSecret, nodeEnv)

  if (!useDev && !skipBuild) {
    runProductionBuild(childEnv)
  }

  let serverLogBuffer = ''
  const appendLog = (chunk) => {
    serverLogBuffer = (serverLogBuffer + chunk.toString('utf8')).slice(-8000)
  }

  const nextArgs = [nextBin, useDev ? 'dev' : 'start', '-H', HOST, '-p', String(PORT)]
  const server = spawn(process.execPath, nextArgs, {
    cwd: repoRoot,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  server.stdout?.on('data', appendLog)
  server.stderr?.on('data', appendLog)

  let browser = null
  try {
    await waitForServerReady(BASE_URL, server, () => serverLogBuffer)
    browser = await chromium.launch({ headless: true })

    for (const spec of CAPTURES) {
      const context = await browser.newContext({
        viewport: { width: spec.width, height: spec.height },
        deviceScaleFactor: 1,
        serviceWorkers: 'block',
        locale: spec.lang === 'ar' ? 'ar-KW' : 'en-US',
      })
      try {
        await context.addCookies([
          { name: EXEC_SESSION_COOKIE, value: sessionToken, url: BASE_URL, httpOnly: true, sameSite: 'Lax' },
          { name: 'aetherbi_theme_mode', value: 'light', url: BASE_URL, sameSite: 'Lax' },
          { name: 'ai-hq-theme', value: 'light', url: BASE_URL, sameSite: 'Lax' },
          { name: 'NEXT_LOCALE', value: spec.lang, url: BASE_URL, sameSite: 'Lax' },
          { name: 'ai-hq-locale', value: spec.lang, url: BASE_URL, sameSite: 'Lax' },
          { name: 'vf_lang', value: spec.lang, url: BASE_URL, sameSite: 'Lax' },
        ])

        const page = await context.newPage()
        const diag = {
          pageErrors: [],
          consoleErrors: [],
          failedRequests: [],
          httpErrors: [],
        }

        page.on('pageerror', (err) => {
          const msg = err instanceof Error ? err.message : String(err)
          diag.pageErrors.push(msg)
          process.stderr.write(`[pageerror] ${spec.file}: ${msg}\n`)
        })
        page.on('console', (msg) => {
          if (msg.type() === 'error') {
            const text = msg.text()
            diag.consoleErrors.push(text)
            process.stderr.write(`[console.error] ${spec.file}: ${text}\n`)
          }
        })
        page.on('requestfailed', (req) => {
          const info = `${req.method()} ${req.url()} -> ${req.failure()?.errorText ?? 'failed'}`
          diag.failedRequests.push(info)
          process.stderr.write(`[requestfailed] ${spec.file}: ${info}\n`)
        })
        page.on('response', (res) => {
          if (res.status() >= 400) {
            const info = `${res.status()} ${res.request().method()} ${res.url()}`
            diag.httpErrors.push(info)
            process.stderr.write(`[http>=400] ${spec.file}: ${info}\n`)
          }
        })

        await page.route('**/api/erp/odoo-sync*', async (route) => {
          await route.fulfill({ status: 200, contentType: 'application/json', body: summaryJson })
        })
        await page.route('**/api/erp/governance*', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true, store: { alerts: [], circulars: [], tasks: [], updatedAt: null } }),
          })
        })
        await page.route('**/api/v1/governance/telemetry*', async (route) => {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
        })

        const targetUrl = `${BASE_URL}/erp?period=today&brand=all&lang=${spec.lang}`
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 })

        await page.waitForFunction(
          ({ expectedLang, expectedDir }) => {
            const html = document.documentElement
            if (html.lang !== expectedLang || html.dir !== expectedDir) return false
            if (html.dataset.theme !== 'light') return false
            const sales = document.querySelector('[data-kpi="net-sales"]')
            const orders = document.querySelector('[data-kpi="total-orders"]')
            return Boolean(
              sales?.textContent?.includes('154.700') &&
                orders?.textContent?.includes('24'),
            )
          },
          { expectedLang: spec.lang, expectedDir: spec.dir },
          { timeout: 120_000 },
        )

        await page.locator('[data-kpi="net-sales"]').waitFor({ state: 'visible', timeout: 15_000 })
        await page.evaluate(() => document.fonts.ready)
        await page.waitForTimeout(350)

        const metrics = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          bodyScrollWidth: document.body.scrollWidth,
          lang: document.documentElement.lang,
          dir: document.documentElement.dir,
          theme: document.documentElement.dataset.theme,
        }))

        if (metrics.scrollWidth > metrics.innerWidth) {
          throw new Error(
            `Horizontal overflow in ${spec.file}: scrollWidth=${metrics.scrollWidth} > innerWidth=${metrics.innerWidth}`,
          )
        }

        const outPath = path.join(outDir, spec.file)
        await page.screenshot({ path: outPath, fullPage: false })
        process.stdout.write(
          `CAPTURED ${spec.file} (${spec.width}x${spec.height}) mode=${useDev ? 'dev' : 'start'} lang=${metrics.lang} dir=${metrics.dir} theme=${metrics.theme} scrollWidth=${metrics.scrollWidth} innerWidth=${metrics.innerWidth} pageErrors=${diag.pageErrors.length} consoleErrors=${diag.consoleErrors.length} failedRequests=${diag.failedRequests.length} httpErrors=${diag.httpErrors.length}\n`,
        )
      } finally {
        await context.close().catch(() => undefined)
      }
    }
  } finally {
    await browser?.close().catch(() => undefined)
    await stopServerTree(server)
    const cleaned = await removeTempVitestSqliteCopies()
    process.stdout.write(`CLEANUP removed_temp_sqlite=${cleaned.length}\n`)
  }
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`)
  process.exit(1)
})
