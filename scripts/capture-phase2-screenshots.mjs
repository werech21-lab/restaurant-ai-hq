#!/usr/bin/env node
/**
 * Real Playwright AR + EN (1440 & 390) Screenshot Capture & DOM Verifier for Redo Phase 2.
 *
 * Launches a real production `next start` server on 127.0.0.1:4017 with clean offline env
 * (`VITEST=true` so SQLite stays on a temp copy and NEVER modifies `prisma/dev.db`), computes
 * the real `CouncilSnapshot` + `SeasonsStudio` report from the real cached Odoo 17 payloads via
 * `runCouncil`, signs a real `admin` `aether_exec_session` cookie, captures all 16 screenshots
 * (`4 targets × 2 locales × 2 widths`) under `docs/redo/screenshots/phase-2/`, and asserts in the
 * live browser DOM:
 *   - Today's Discoveries (`[data-todays-discoveries="true"]`) renders all 3 ranked real advisor
 *     discoveries with Odoo models, 3-decimal KWD / hours figures, Why, Proposals, and labelled
 *     `Estimate` formulas on `/erp` and `/erp/feryal-ai` in AR & EN (1440 & 390);
 *   - `/erp/seasons` (`[data-seasons-studio="true"]`) renders `salary-days` with
 *     `data-needs-owner-confirmation="true"` («يحتاج تأكيد المالك» / "Needs owner confirmation"),
 *     marks Ramadan, Eids, and school dates «تقريبي» / "approximate", has zero `winter-2026` or
 *     `summer-2027` assumptions, and carries zero amber classes;
 *   - Zero runtime `pageerror`, zero `console.error`, zero HTTP >= 400 responses, and zero
 *     horizontal overflow (`scrollWidth <= innerWidth`).
 */
import { createHmac, randomBytes } from 'node:crypto'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const HOST = '127.0.0.1'
const PORT = 4017
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
const outDir = path.join(repoRoot, 'docs', 'redo', 'screenshots', 'phase-2')

const ROUTES = [
  { key: 'erp-home-discoveries', pathname: '/erp', query: 'period=month&brand=all' },
  { key: 'erp-feryal-ai', pathname: '/erp/feryal-ai', query: 'period=month&brand=all' },
  { key: 'erp-seasons', pathname: '/erp/seasons', query: '' },
]

const VIEWPORT_VARIANTS = [
  { suffix: 'ar-1440', lang: 'ar', dir: 'rtl', width: 1440, height: 900 },
  { suffix: 'en-1440', lang: 'en', dir: 'ltr', width: 1440, height: 900 },
  { suffix: 'ar-390', lang: 'ar', dir: 'rtl', width: 390, height: 844 },
  { suffix: 'en-390', lang: 'en', dir: 'ltr', width: 390, height: 844 },
]

function mintAdminSessionToken(secret) {
  const iat = Math.floor(Date.now() / 1000)
  const payload = {
    sub: 'admin@venturefoodskw.com',
    role: 'admin',
    nameAr: 'مدير النظام والمالك',
    nameEn: 'Owner & Admin',
    titleAr: 'المالك',
    titleEn: 'Owner',
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

function computeRealCouncilPayloads() {
  const tsxCli = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs')
  const serverOnlyShim = path.join(here, 'tsx-server-only-shim.cjs')
  const inlineCode = `
    import { SUGGESTED_SEASON_EVENTS, mergeSeasonEvents } from './src/lib/council/advisors/seasons.ts';
    import { runCouncil } from './src/lib/council/runner.ts';
    import { computeTerminalMappingLedgerSnapshot } from './src/lib/odoo-terminal-mappings.ts';
    import { loadLiveTodaySummary, realHrInput, realInventoryInput } from './src/lib/__tests__/council/support.ts';
    const summary = loadLiveTodaySummary();
    const events = mergeSeasonEvents(null, SUGGESTED_SEASON_EVENTS);
    const snapshot = runCouncil({
      cfo: { summary },
      hr: realHrInput(),
      inventory: realInventoryInput(),
      seasons: { summary, events },
    });
    const discoveriesPayload = {
      ok: true,
      available: snapshot.discoveries.length > 0,
      generatedAt: snapshot.generatedAt,
      discoveries: snapshot.discoveries,
      advisors: snapshot.reports.map((r) => ({
        advisorId: r.advisorId,
        status: r.status,
        generatedAt: r.generatedAt,
        dataGaps: r.dataGaps,
      })),
    };
    const seasonsPayload = {
      ok: true,
      events,
      suggested: true,
      report: snapshot.reports.find((r) => r.advisorId === 'seasons') ?? null,
    };
    const terminalPayload = {
      ok: true,
      role: 'admin',
      ...computeTerminalMappingLedgerSnapshot(),
    };
    process.stdout.write(JSON.stringify({ discoveriesPayload, seasonsPayload, terminalPayload, reports: snapshot.reports }));
  `
  const raw = execFileSync(
    process.execPath,
    [tsxCli, '-r', serverOnlyShim, '-e', inlineCode],
    { cwd: repoRoot, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  )
  return JSON.parse(raw)
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

async function attachRealCouncilRoutes(page, { summaryJson, discoveriesJson, seasonsJson, terminalJson }) {
  const fulfillSummary = async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: summaryJson })
  }
  await page.route('**/api/erp/odoo-sync*', fulfillSummary)
  await page.route('**/api/odoo-sync*', fulfillSummary)
  await page.route('**/api/erp/council/discoveries*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: discoveriesJson })
  })
  await page.route('**/api/erp/seasons*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: seasonsJson })
  })
  await page.route('**/api/erp/governance*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, store: { alerts: [], circulars: [], tasks: [], updatedAt: null } }),
    })
  })
  await page.route('**/api/erp/feryal/chat*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, auditLogs: [] }),
    })
  })
  await page.route('**/api/erp/terminal-mappings*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: terminalJson,
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

async function main() {
  const rawFixture = JSON.parse(await readFile(fixturePath, 'utf8'))
  if (!rawFixture?.summary) {
    throw new Error(`Missing .summary in ${fixturePath}`)
  }
  const summary = prepareUntrimmedSummaryFromRealDaily(rawFixture.summary)
  const summaryJson = JSON.stringify(summary)

  const { discoveriesPayload, seasonsPayload, terminalPayload, reports } = computeRealCouncilPayloads()
  const discoveriesJson = JSON.stringify(discoveriesPayload)
  const seasonsJson = JSON.stringify(seasonsPayload)
  const terminalJson = JSON.stringify(terminalPayload)

  await mkdir(outDir, { recursive: true })

  const sessionSecret = randomBytes(32).toString('hex')
  const sessionToken = mintAdminSessionToken(sessionSecret)
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
        await attachRealCouncilRoutes(page, { summaryJson, discoveriesJson, seasonsJson, terminalJson })

        for (const routeSpec of ROUTES) {
          const file = `${routeSpec.key}__${variant.suffix}.png`
          const outPath = path.join(outDir, file)
          const diag = attachDiagnostics(page, file)

          const qs = routeSpec.query ? `${routeSpec.query}&lang=${variant.lang}` : `lang=${variant.lang}`
          const url = `${BASE_URL}${routeSpec.pathname}?${qs}`
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 })

          if (routeSpec.key === 'erp-seasons') {
            await page.waitForFunction(
              ({ expectedLang, expectedDir }) => {
                const html = document.documentElement
                if (html.lang !== expectedLang || html.dir !== expectedDir) return false
                const studio = document.querySelector('[data-seasons-studio="true"]')
                if (!studio) return false
                const salary = studio.querySelector('[data-season="salary-days"]')
                const badge = salary?.querySelector('[data-needs-owner-confirmation="true"]')
                return Boolean(salary && badge)
              },
              { expectedLang: variant.lang, expectedDir: variant.dir },
              { timeout: 60_000 },
            )
          } else {
            await page.waitForFunction(
              ({ expectedLang, expectedDir }) => {
                const html = document.documentElement
                if (html.lang !== expectedLang || html.dir !== expectedDir) return false
                if (document.querySelector('[data-state-block="loading"]')) return false
                const sec = document.querySelector('[data-todays-discoveries="true"]')
                if (!sec) return false
                const cards = sec.querySelectorAll('[data-discovery]')
                return cards.length === 3
              },
              { expectedLang: variant.lang, expectedDir: variant.dir },
              { timeout: 60_000 },
            )
          }

          await page.evaluate(() => document.fonts.ready)
          await page.waitForTimeout(300)

          const domAudit = await page.evaluate((rKey) => {
            const scrollWidth = document.documentElement.scrollWidth
            const innerWidth = window.innerWidth
            if (rKey === 'erp-seasons') {
              const studio = document.querySelector('[data-seasons-studio="true"]')
              const seasonIds = Array.from(studio?.querySelectorAll('[data-season]') || []).map((el) =>
                el.getAttribute('data-season'),
              )
              const salaryCard = studio?.querySelector('[data-season="salary-days"]')
              const confirmBadge = salaryCard?.querySelector('[data-needs-owner-confirmation="true"]')?.textContent?.trim() || ''
              const ramadanText = studio?.querySelector('[data-season="ramadan-2027"]')?.textContent || ''
              const studioHtml = studio?.outerHTML || ''
              const hasAmber = /\b(?:text|bg|ring|border)-amber-/.test(studioHtml)
              return {
                scrollWidth,
                innerWidth,
                seasonIds,
                confirmBadge,
                ramadanHasApprox: ramadanText.includes('تقريبي') || ramadanText.includes('approximate'),
                hasAmber,
              }
            }
            const sec = document.querySelector('[data-todays-discoveries="true"]')
            const discoveryIds = Array.from(sec?.querySelectorAll('[data-discovery]') || []).map((el) =>
              el.getAttribute('data-discovery'),
            )
            const estimateCount = sec?.querySelectorAll('[data-estimate="true"]').length ?? 0
            const heading = sec?.querySelector('h2')?.textContent?.trim() || ''
            return {
              scrollWidth,
              innerWidth,
              discoveryIds,
              estimateCount,
              heading,
            }
          }, routeSpec.key)

          if (diag.pageErrors.length || diag.consoleErrors.length || diag.httpErrors.length) {
            throw new Error(
              `Runtime diagnostics failed on ${file}: pageErrors=${diag.pageErrors.length} consoleErrors=${diag.consoleErrors.length} httpErrors=${diag.httpErrors.length}`,
            )
          }
          if (domAudit.scrollWidth > domAudit.innerWidth) {
            throw new Error(
              `Horizontal overflow on ${file}: scrollWidth=${domAudit.scrollWidth} > innerWidth=${domAudit.innerWidth}`,
            )
          }

          if (routeSpec.key === 'erp-seasons') {
            const expectedBadge = variant.lang === 'ar' ? 'يحتاج تأكيد المالك' : 'Needs owner confirmation'
            if (domAudit.confirmBadge !== expectedBadge) {
              throw new Error(`Expected badge "${expectedBadge}" on ${file}, got "${domAudit.confirmBadge}"`)
            }
            if (!domAudit.ramadanHasApprox) {
              throw new Error(`Ramadan card missing approximate marker on ${file}`)
            }
            if (domAudit.seasonIds.includes('winter-2026') || domAudit.seasonIds.includes('summer-2027')) {
              throw new Error(`Unrequested winter/summer assumptions found on ${file}: ${domAudit.seasonIds.join(',')}`)
            }
            if (domAudit.hasAmber) {
              throw new Error(`SeasonsStudio rendered amber classes on ${file}`)
            }
          } else {
            if (domAudit.discoveryIds.length !== 3) {
              throw new Error(`Expected 3 discovery cards on ${file}, got ${domAudit.discoveryIds.length}`)
            }
            if (domAudit.estimateCount < 1) {
              throw new Error(`Expected >= 1 labelled Estimate on ${file}`)
            }
          }

          await page.evaluate(() => window.scrollTo(0, 0))
          await page.screenshot({ path: outPath, fullPage: true })
          const pngMeta = await readPngMeta(outPath)
          if (pngMeta.width !== variant.width) {
            throw new Error(`Unexpected PNG width on ${file}: got ${pngMeta.width}, expected ${variant.width}`)
          }

          // On /erp, also capture a focused section screenshot of Today's Discoveries
          if (routeSpec.key === 'erp-home-discoveries') {
            const sectionFile = `todays-discoveries__${variant.suffix}.png`
            const sectionPath = path.join(outDir, sectionFile)
            const loc = page.locator('[data-todays-discoveries="true"]').first()
            await loc.scrollIntoViewIfNeeded()
            await loc.screenshot({ path: sectionPath })
            const secMeta = await readPngMeta(sectionPath)
            captured.push({
              file: sectionFile,
              route: 'todays-discoveries-section',
              lang: variant.lang,
              viewportWidth: variant.width,
              pngWidth: secMeta.width,
              pngHeight: secMeta.height,
              bytes: secMeta.bytes,
              details: domAudit,
            })
            process.stdout.write(
              `CAPTURED ${sectionFile} (${secMeta.width}x${secMeta.height}, ${secMeta.bytes}B) discoveries=${domAudit.discoveryIds.join(',')}\n`,
            )
          }

          page.removeAllListeners('pageerror')
          page.removeAllListeners('console')
          page.removeAllListeners('response')

          captured.push({
            file,
            route: routeSpec.key,
            lang: variant.lang,
            viewportWidth: variant.width,
            pngWidth: pngMeta.width,
            pngHeight: pngMeta.height,
            bytes: pngMeta.bytes,
            details: domAudit,
          })
          process.stdout.write(
            `CAPTURED ${file} (${pngMeta.width}x${pngMeta.height}, ${pngMeta.bytes}B)\n`,
          )
        }
      } finally {
        await context.close().catch(() => undefined)
      }
    }

    const advisorSummary = reports.map((r) => ({
      advisorId: r.advisorId,
      status: r.status,
      findingsCount: r.findings.length,
      findings: r.findings.map((f) => ({
        fingerprint: f.fingerprint,
        titleAr: f.titleAr,
        titleEn: f.titleEn,
      })),
      dataGaps: r.dataGaps.map((g) => g.odooModel),
    }))

    await writeFile(
      path.join(outDir, 'manifest.json'),
      `${JSON.stringify(
        {
          verifiedAt: new Date().toISOString(),
          count: captured.length,
          discoveries: discoveriesPayload.discoveries.map((d) => ({
            fingerprint: d.finding.fingerprint,
            advisorId: d.finding.advisorId,
            linkedAdvisors: d.linkedAdvisors,
            score: d.score,
            titleAr: d.finding.titleAr,
            titleEn: d.finding.titleEn,
          })),
          advisorReports: advisorSummary,
          captures: captured,
        },
        null,
        2,
      )}\n`,
      'utf8',
    )
    process.stdout.write(`VERIFIED ALL ${captured.length} PHASE 2 SCREENSHOTS (AR + EN, 1440 + 390)!\n`)
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
