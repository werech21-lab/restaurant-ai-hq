#!/usr/bin/env node
/**
 * Real Playwright AR + EN (1440 & 390) Screenshot Capture & Parity Verifier for Redo Phase 1.
 *
 * Launches a real production `next start` server on 127.0.0.1:4016 with clean offline env
 * (`VITEST=true` so SQLite stays on a temp copy and NEVER modifies `prisma/dev.db`), signs a real
 * GM `aether_exec_session` cookie, serves the real cached Odoo 17 payload
 * (`src/lib/__tests__/fixtures/dashboard-today-2026-11-17.json`), captures all 48 screenshots
 * (`3 routes × 4 periods × 2 locales × 2 widths`) under `docs/redo/screenshots/phase-1/`,
 * and asserts in the live browser DOM:
 *   - AR headline === EN headline on every route, period, and viewport;
 *   - AR branch rows (id, salesFils, orders) === EN branch rows on every route, period, and viewport;
 *   - Σ(branch rows) === headline (±0.001 KWD) on Home, Cores, and Scorecard;
 *   - Home headline === Cores headline === Scorecard headline for Month, Today, Yesterday, and Custom 1–17 Nov;
 *   - Zero runtime errors, zero HTTP >= 400 responses, and zero `0.000` on Scorecard when sales > 0.
 */
import { createHmac, randomBytes } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const HOST = '127.0.0.1'
const PORT = 4016
const BASE_URL = `http://${HOST}:${PORT}`
const EXEC_SESSION_COOKIE = 'aether_exec_session'
const EXEC_SESSION_MAX_AGE = 12 * 60 * 60
const DB_ENV_KEY = ['DATABASE', 'URL'].join('_')

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')
const fixturePath = path.join(
  repoRoot,
  'src',
  'lib',
  '__tests__',
  'fixtures',
  'dashboard-today-2026-11-17.json',
)
const outDir = path.join(repoRoot, 'docs', 'redo', 'screenshots', 'phase-1')

const ROUTES = [
  { key: 'erp-home', pathname: '/erp' },
  { key: 'erp-cores', pathname: '/erp/cores' },
  { key: 'erp-sales-scorecard', pathname: '/erp/sales-scorecard' },
]

const PERIODS = [
  { key: 'month', query: 'period=month', from: null, to: null },
  { key: 'today', query: 'period=today', from: null, to: null },
  { key: 'yesterday', query: 'period=custom&from=2026-11-16&to=2026-11-16', from: '2026-11-16', to: '2026-11-16' },
  {
    key: 'custom-2026-11-01-2026-11-17',
    query: 'period=custom&from=2026-11-01&to=2026-11-17',
    from: '2026-11-01',
    to: '2026-11-17',
  },
]

const VIEWPORT_VARIANTS = [
  { suffix: 'ar-1440', lang: 'ar', dir: 'rtl', width: 1440, height: 900 },
  { suffix: 'en-1440', lang: 'en', dir: 'ltr', width: 1440, height: 900 },
  { suffix: 'ar-390', lang: 'ar', dir: 'rtl', width: 390, height: 844 },
  { suffix: 'en-390', lang: 'en', dir: 'ltr', width: 390, height: 844 },
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

function buildCleanChildEnv(sessionSecret) {
  const scrubbed = {}
  const blockedPrefix =
    /^(DATABASE|PG|POSTGRES|PRISMA|ODOO|SUPABASE|AETHER|SESSION|AUTH|CRON|SMTP|OPENAI|GEMINI|XAI|VERCEL)/i
  for (const [k, v] of Object.entries(process.env)) {
    if (!blockedPrefix.test(k) && v !== undefined) {
      scrubbed[k] = v
    }
  }
  return {
    ...scrubbed,
    NODE_ENV: 'production',
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
    await new Promise((r) => setTimeout(r, 350))
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
      if (!name.startsWith('aetherbi-vitest-') && !name.startsWith('vf-vitest-run-')) continue
      const target = path.join(dir, name)
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await rm(target, { recursive: true, force: true })
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

async function readPngMeta(filePath) {
  const [buf, info] = await Promise.all([readFile(filePath), stat(filePath)])
  const isPng =
    buf.length >= 24 && buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (!isPng) {
    throw new Error(`Invalid PNG header at ${filePath}`)
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bytes: info.size,
  }
}

async function createSeededContext(browser, variant, sessionToken) {
  const context = await browser.newContext({
    viewport: { width: variant.width, height: variant.height },
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
    locale: variant.lang === 'ar' ? 'ar-KW' : 'en-US',
  })
  await context.addCookies([
    { name: EXEC_SESSION_COOKIE, value: sessionToken, url: BASE_URL, httpOnly: true, sameSite: 'Lax' },
    { name: 'aetherbi_theme_mode', value: 'light', url: BASE_URL, sameSite: 'Lax' },
    { name: 'ai-hq-theme', value: 'light', url: BASE_URL, sameSite: 'Lax' },
    { name: 'NEXT_LOCALE', value: variant.lang, url: BASE_URL, sameSite: 'Lax' },
    { name: 'ai-hq-locale', value: variant.lang, url: BASE_URL, sameSite: 'Lax' },
    { name: 'vf_lang', value: variant.lang, url: BASE_URL, sameSite: 'Lax' },
  ])
  return context
}

async function attachFixtureRoutes(page, summaryJson) {
  const fulfillSummary = async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: summaryJson })
  }
  await page.route('**/api/erp/odoo-sync*', fulfillSummary)
  await page.route('**/api/odoo-sync*', fulfillSummary)
  await page.route('**/api/erp/governance*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, store: { alerts: [], circulars: [], tasks: [], updatedAt: null } }),
    })
  })
  await page.route('**/api/erp/council/discoveries*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, available: false, generatedAt: null, discoveries: [], advisors: [] }),
    })
  })
  await page.route('**/api/v1/governance/telemetry*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })
}

function attachDiagnostics(page, label) {
  const diag = { pageErrors: [], consoleErrors: [], httpErrors: [] }
  page.on('pageerror', (err) => {
    const msg = err instanceof Error ? err.message : String(err)
    diag.pageErrors.push(msg)
    process.stderr.write(`[pageerror] ${label}: ${msg}\n`)
  })
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text()
      diag.consoleErrors.push(text)
      process.stderr.write(`[console.error] ${label}: ${text}\n`)
    }
  })
  page.on('response', (res) => {
    if (res.status() >= 400) {
      const info = `${res.status()} ${res.request().method()} ${res.url()}`
      diag.httpErrors.push(info)
      process.stderr.write(`[http>=400] ${label}: ${info}\n`)
    }
  })
  return diag
}

function computeExpectedFilsForPeriod(summary, periodSpec) {
  const toFils = (n) => Math.round((Number(n) || 0) * 1000)
  if (periodSpec.key === 'month') return toFils(summary.buckets.month.totals.netSalesKwd)
  if (periodSpec.key === 'today') return toFils(summary.buckets.today.totals.netSalesKwd)
  let total = 0
  for (const [day, row] of Object.entries(summary.dailyByBranch || {})) {
    if (day < periodSpec.from || day > periodSpec.to) continue
    for (const cell of Object.values(row)) total += toFils(cell.netKwd)
  }
  for (const [day, u] of Object.entries(summary.dailyUnattributed || {})) {
    if (day < periodSpec.from || day > periodSpec.to) continue
    total += toFils(u.netKwd)
  }
  return total
}

async function extractPageMetrics(page, routeKey) {
  return page.evaluate((rKey) => {
    const parseFils = (txt) => {
      const m = /(-?[\d,]+\.\d{3})/.exec(txt || '')
      return m ? Math.round(Number(m[1].replace(/,/g, '')) * 1000) : null
    }
    const parseIntVal = (txt) => {
      const m = /([\d,]+)/.exec(txt || '')
      return m ? Number(m[1].replace(/,/g, '')) : null
    }

    const kpiEl = document.querySelector('[data-kpi="net-sales"]')
    const headlineText = (kpiEl?.textContent || '').replace(/\s+/g, ' ').trim()
    const headlineFils = parseFils(headlineText)

    const rows = []
    if (rKey === 'erp-home') {
      for (const tr of document.querySelectorAll('[data-ledger-table="true"] tbody tr[data-ledger-row]')) {
        const id = tr.getAttribute('data-ledger-row') || ''
        const tds = Array.from(tr.querySelectorAll('td')).map((td) =>
          (td.textContent || '').replace(/\s+/g, ' ').trim(),
        )
        rows.push({
          id,
          salesFils: parseFils(tds[1] || ''),
          orders: parseIntVal(tds[2] || ''),
          rawOrders: tds[2] || '',
        })
      }
    } else if (rKey === 'erp-cores') {
      for (const el of document.querySelectorAll('[data-cores-branch-row]')) {
        const id = el.getAttribute('data-cores-branch-row') || ''
        const salesTxt = el.querySelector('[data-cores-branch-sales]')?.textContent || ''
        const ordTxt = el.querySelector('[data-cores-branch-orders]')?.textContent || ''
        rows.push({
          id,
          salesFils: parseFils(salesTxt),
          orders: parseIntVal(ordTxt),
          rawOrders: ordTxt.trim(),
        })
      }
    } else if (rKey === 'erp-sales-scorecard') {
      for (const el of document.querySelectorAll('[data-scorecard-branch-row]')) {
        const id = el.getAttribute('data-scorecard-branch-row') || ''
        const salesTxt = el.querySelector('[data-scorecard-branch-sales]')?.textContent || ''
        const ordTxt = el.querySelector('[data-scorecard-branch-orders]')?.textContent || ''
        rows.push({
          id,
          salesFils: parseFils(salesTxt),
          orders: parseIntVal(ordTxt),
          rawOrders: ordTxt.trim(),
        })
      }
    }

    return {
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      headlineText,
      headlineFils,
      rows,
      mainTextContainsZeroKwd: (document.querySelector('main')?.textContent || '').includes('0.000'),
    }
  }, routeKey)
}

function deriveBucketFromRealDaily(summary, fromIso, toInclusiveIso, toExclusiveIso) {
  const fils = (n) => Math.round((Number(n) || 0) * 1000)
  const loc = new Map()
  for (const dayRow of Object.values(summary.dailyByBranch || {})) {
    for (const branchId of Object.keys(dayRow || {})) {
      if (!loc.has(branchId)) loc.set(branchId, { netFils: 0, orders: 0 })
    }
  }
  let unFils = 0
  let unOrders = 0
  for (const [day, row] of Object.entries(summary.dailyByBranch || {})) {
    if (day < fromIso || day > toInclusiveIso) continue
    for (const [branchId, cell] of Object.entries(row || {})) {
      const cur = loc.get(branchId) ?? { netFils: 0, orders: 0 }
      cur.netFils += fils(cell.netKwd)
      cur.orders += Math.round(Number(cell.orders) || 0)
      loc.set(branchId, cur)
    }
  }
  for (const [day, u] of Object.entries(summary.dailyUnattributed || {})) {
    if (day < fromIso || day > toInclusiveIso) continue
    unFils += fils(u.netKwd)
    unOrders += Math.round(Number(u.orders) || 0)
  }
  let mappedFils = 0
  let mappedOrders = 0
  const byLocation = {}
  for (const [id, v] of loc.entries()) {
    mappedFils += v.netFils
    mappedOrders += v.orders
    byLocation[id] = {
      netKwd: v.netFils / 1000,
      orders: v.orders,
      aovKwd: v.orders > 0 ? Math.round(v.netFils / v.orders) / 1000 : 0,
      channels: {},
    }
  }
  const totalFils = mappedFils + unFils
  const totalOrders = mappedOrders + unOrders
  return {
    from: fromIso,
    to: toExclusiveIso,
    totals: {
      netSalesKwd: totalFils / 1000,
      orders: totalOrders,
      aovKwd: totalOrders > 0 ? Math.round(totalFils / totalOrders) / 1000 : 0,
      restaurantNetKwd: totalFils / 1000,
      restaurantOrders: totalOrders,
    },
    byLocation,
    mappedByLocation: byLocation,
    unattributedSalesKwd: unFils / 1000,
    unattributedOrders: unOrders,
    byBrand: null,
    uiChannels: null,
  }
}

function prepareUntrimmedSummaryFromRealDaily(rawSummary) {
  const s = structuredClone(rawSummary)
  s.buckets = s.buckets || {}
  if (s.buckets.month && !s.buckets.month.byLocation) {
    const derivedMonth = deriveBucketFromRealDaily(s, '2026-10-19', '2026-11-17', '2026-11-18')
    if (
      Math.round(derivedMonth.totals.netSalesKwd * 1000) !==
        Math.round(s.buckets.month.totals.netSalesKwd * 1000) ||
      derivedMonth.totals.orders !== s.buckets.month.totals.orders
    ) {
      throw new Error('Derived month bucket from dailyByBranch did not match s.buckets.month.totals')
    }
    s.buckets.month = { ...s.buckets.month, ...derivedMonth }
  }
  if (!Array.isArray(s.dailySeries) || s.dailySeries.length <= 1) {
    const fils = (n) => Math.round((Number(n) || 0) * 1000)
    const allDays = [
      ...new Set([...Object.keys(s.dailyByBranch || {}), ...Object.keys(s.dailyUnattributed || {})]),
    ].sort()
    s.dailySeries = allDays.map((day) => {
      let dayFils = fils(s.dailyUnattributed?.[day]?.netKwd)
      let dayOrders = Math.round(Number(s.dailyUnattributed?.[day]?.orders) || 0)
      for (const cell of Object.values(s.dailyByBranch?.[day] || {})) {
        dayFils += fils(cell.netKwd)
        dayOrders += Math.round(Number(cell.orders) || 0)
      }
      return { day, orders: dayOrders, netKwd: dayFils / 1000 }
    })
  }
  return s
}

async function main() {
  const rawFixture = JSON.parse(await readFile(fixturePath, 'utf8'))
  if (!rawFixture?.summary) {
    throw new Error(`Missing .summary in ${fixturePath}`)
  }
  const summary = prepareUntrimmedSummaryFromRealDaily(rawFixture.summary)
  const summaryJson = JSON.stringify(summary)
  await mkdir(outDir, { recursive: true })

  const sessionSecret = randomBytes(32).toString('hex')
  const sessionToken = mintGmSessionToken(sessionSecret)
  const childEnv = buildCleanChildEnv(sessionSecret)
  const nextBin = path.join(repoRoot, 'node_modules', 'next', 'dist', 'bin', 'next')

  let serverLogs = ''
  const server = spawn(process.execPath, [nextBin, 'start', '-H', HOST, '-p', String(PORT)], {
    cwd: repoRoot,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  server.stdout?.on('data', (c) => {
    serverLogs = (serverLogs + c.toString('utf8')).slice(-8000)
  })
  server.stderr?.on('data', (c) => {
    serverLogs = (serverLogs + c.toString('utf8')).slice(-8000)
  })

  let browser = null
  const captured = []
  try {
    await waitForServerReady(BASE_URL, server, () => serverLogs)
    try {
      browser = await chromium.launch({ headless: true })
    } catch {
      browser = await chromium.launch({ headless: true, channel: 'chrome' })
    }

    for (const variant of VIEWPORT_VARIANTS) {
      const context = await createSeededContext(browser, variant, sessionToken)
      try {
        const page = await context.newPage()
        await attachFixtureRoutes(page, summaryJson)

        for (const routeSpec of ROUTES) {
          for (const periodSpec of PERIODS) {
            const file = `${routeSpec.key}__${periodSpec.key}__${variant.suffix}.png`
            const outPath = path.join(outDir, file)
            const diag = attachDiagnostics(page, file)
            const expectedFils = computeExpectedFilsForPeriod(summary, periodSpec)
            const expectedFormatted = (expectedFils / 1000).toLocaleString('en-US', {
              minimumFractionDigits: 3,
              maximumFractionDigits: 3,
            })

            const url = `${BASE_URL}${routeSpec.pathname}?${periodSpec.query}&brand=all&lang=${variant.lang}`
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 })

            await page.waitForFunction(
              ({ expectedLang, expectedDir, expectedStr }) => {
                const html = document.documentElement
                if (html.lang !== expectedLang || html.dir !== expectedDir) return false
                if (document.querySelector('[data-state-block="loading"]')) return false
                const kpi = document.querySelector('[data-kpi="net-sales"]')
                return Boolean(kpi && (kpi.textContent || '').includes(expectedStr))
              },
              { expectedLang: variant.lang, expectedDir: variant.dir, expectedStr: expectedFormatted },
              { timeout: 60_000 },
            )

            await page.evaluate(() => document.fonts.ready)
            await page.waitForTimeout(250)

            const metrics = await extractPageMetrics(page, routeSpec.key)

            if (diag.pageErrors.length || diag.consoleErrors.length || diag.httpErrors.length) {
              throw new Error(
                `Runtime diagnostics failed on ${file}: pageErrors=${diag.pageErrors.length} consoleErrors=${diag.consoleErrors.length} httpErrors=${diag.httpErrors.length}`,
              )
            }
            if (metrics.scrollWidth > metrics.innerWidth) {
              throw new Error(
                `Horizontal overflow on ${file}: scrollWidth=${metrics.scrollWidth} > innerWidth=${metrics.innerWidth}`,
              )
            }
            if (metrics.headlineFils !== expectedFils) {
              throw new Error(
                `Headline mismatch on ${file}: got ${metrics.headlineFils} fils (${metrics.headlineText}), expected ${expectedFils} fils`,
              )
            }
            if (metrics.rows.length < 7) {
              throw new Error(`Expected >= 7 branch rows on ${file}, got ${metrics.rows.length}`)
            }
            const sumRowFils = metrics.rows.reduce((s, r) => s + (r.salesFils ?? 0), 0)
            if (Math.abs(sumRowFils - metrics.headlineFils) > 1) {
              throw new Error(
                `Σrows != headline on ${file}: Σrows=${sumRowFils} fils vs headline=${metrics.headlineFils} fils`,
              )
            }
            for (const r of metrics.rows) {
              if ((r.orders ?? 0) > 0 && r.rawOrders.includes('—')) {
                throw new Error(`Row ${r.id} on ${file} rendered "—" despite orders=${r.orders}`)
              }
            }
            if (
              routeSpec.key === 'erp-sales-scorecard' &&
              periodSpec.key !== 'today' &&
              metrics.mainTextContainsZeroKwd
            ) {
              throw new Error(`SalesScorecard rendered "0.000" on ${file} when all branches have sales > 0`)
            }

            await page.evaluate(() => window.scrollTo(0, 0))
            await page.screenshot({ path: outPath, fullPage: true })
            const pngMeta = await readPngMeta(outPath)
            if (pngMeta.width !== variant.width) {
              throw new Error(`Unexpected PNG width on ${file}: got ${pngMeta.width}, expected ${variant.width}`)
            }

            page.removeAllListeners('pageerror')
            page.removeAllListeners('console')
            page.removeAllListeners('response')

            captured.push({
              file,
              route: routeSpec.key,
              period: periodSpec.key,
              lang: variant.lang,
              viewportWidth: variant.width,
              pngWidth: pngMeta.width,
              pngHeight: pngMeta.height,
              bytes: pngMeta.bytes,
              headlineFils: metrics.headlineFils,
              sumRowFils,
              rowCount: metrics.rows.length,
              rows: metrics.rows.map(({ id, salesFils, orders }) => ({ id, salesFils, orders })),
            })
            process.stdout.write(
              `CAPTURED ${file} (${pngMeta.width}x${pngMeta.height}, ${pngMeta.bytes}B) headline=${expectedFormatted} KWD Σrows=${(sumRowFils / 1000).toFixed(3)} rows=${metrics.rows.length}\n`,
            )
          }
        }
      } finally {
        await context.close().catch(() => undefined)
      }
    }

    // Cross-locale (AR === EN) and cross-page (Home === Cores === Scorecard) parity assertions:
    for (const periodSpec of PERIODS) {
      for (const width of [1440, 390]) {
        for (const routeSpec of ROUTES) {
          const ar = captured.find(
            (c) => c.route === routeSpec.key && c.period === periodSpec.key && c.lang === 'ar' && c.viewportWidth === width,
          )
          const en = captured.find(
            (c) => c.route === routeSpec.key && c.period === periodSpec.key && c.lang === 'en' && c.viewportWidth === width,
          )
          if (!ar || !en) throw new Error(`Missing AR/EN pair for ${routeSpec.key} ${periodSpec.key} ${width}`)
          if (ar.headlineFils !== en.headlineFils) {
            throw new Error(`AR != EN headline for ${routeSpec.key} ${periodSpec.key} ${width}`)
          }
          const sortById = (arr) => [...arr].sort((a, b) => a.id.localeCompare(b.id))
          if (JSON.stringify(sortById(ar.rows)) !== JSON.stringify(sortById(en.rows))) {
            throw new Error(
              `AR != EN branch rows for ${routeSpec.key} ${periodSpec.key} ${width}:\nAR=${JSON.stringify(ar.rows)}\nEN=${JSON.stringify(en.rows)}`,
            )
          }
        }

        const homeHeadline = captured.find(
          (c) => c.route === 'erp-home' && c.period === periodSpec.key && c.lang === 'ar' && c.viewportWidth === width,
        )?.headlineFils
        const coresHeadline = captured.find(
          (c) => c.route === 'erp-cores' && c.period === periodSpec.key && c.lang === 'ar' && c.viewportWidth === width,
        )?.headlineFils
        const scorecardHeadline = captured.find(
          (c) => c.route === 'erp-sales-scorecard' && c.period === periodSpec.key && c.lang === 'ar' && c.viewportWidth === width,
        )?.headlineFils
        if (homeHeadline !== coresHeadline || homeHeadline !== scorecardHeadline) {
          throw new Error(
            `Cross-page headline mismatch on ${periodSpec.key} (${width}): home=${homeHeadline} cores=${coresHeadline} scorecard=${scorecardHeadline}`,
          )
        }
      }
    }

    await writeFile(
      path.join(outDir, 'manifest.json'),
      `${JSON.stringify({ verifiedAt: new Date().toISOString(), count: captured.length, captures: captured }, null, 2)}\n`,
      'utf8',
    )
    process.stdout.write(`VERIFIED ALL ${captured.length} SCREENSHOTS: AR === EN, Σrows === headline, Home === Cores === Scorecard!\n`)
  } finally {
    await browser?.close().catch(() => undefined)
    await stopServerTree(server)
    const removed = await removeTempVitestSqliteCopies()
    process.stdout.write(`CLEANUP removed_temp_sqlite=${removed.length}\n`)
  }
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`)
  process.exit(1)
})
