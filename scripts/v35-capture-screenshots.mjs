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
import { mkdir, readdir, readFile, rm, stat } from 'node:fs/promises'
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

const VIEWPORT_VARIANTS = [
  { suffix: 'ar-desktop', lang: 'ar', dir: 'rtl', width: 1440, height: 900, isDesktop: true },
  { suffix: 'en-desktop', lang: 'en', dir: 'ltr', width: 1440, height: 900, isDesktop: true },
  { suffix: 'ar-mobile', lang: 'ar', dir: 'rtl', width: 390, height: 844, isDesktop: false },
  { suffix: 'en-mobile', lang: 'en', dir: 'ltr', width: 390, height: 844, isDesktop: false },
]

const PRIMARY_ROUTE = {
  key: 'dashboard',
  prefix: 'dashboard',
  buildPath: (lang) => `/erp?period=today&brand=all&lang=${lang}`,
}

const SECONDARY_ROUTES = [
  {
    key: 'cores',
    prefix: 'cores',
    buildPath: (lang) => `/erp/cores?period=today&brand=all&lang=${lang}`,
    requiresLiveComparisonCube: false,
  },
  {
    key: 'weekday-comparison',
    prefix: 'weekday-comparison',
    buildPath: (lang) => `/erp/weekday-comparison?lang=${lang}`,
    requiresLiveComparisonCube: true,
  },
  {
    key: 'before-after',
    prefix: 'before-after',
    buildPath: (lang) => `/erp/before-after?lang=${lang}`,
    requiresLiveComparisonCube: true,
  },
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
  const remaining = []
  for (const dir of dirs) {
    try {
      const entries = await readdir(dir)
      for (const name of entries) {
        if (name.startsWith('aetherbi-vitest-')) {
          remaining.push(path.join(dir, name))
        }
      }
    } catch {
      // ignore missing dir
    }
  }
  if (remaining.length > 0) {
    throw new Error(`Leftover temp vitest sqlite entries remain: ${remaining.join(', ')}`)
  }
  return removed
}

async function readPngMeta(filePath) {
  const [buf, info] = await Promise.all([readFile(filePath), stat(filePath)])
  const isPng = buf.length >= 24 && buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (!isPng) {
    throw new Error(`Invalid PNG header at ${filePath}`)
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bytes: info.size,
  }
}

async function waitForSettledSidebarWidth(page, expectedCollapsed) {
  await page.waitForFunction(
    (collapsedExpected) => {
      const sidebar = document.querySelector('#ae-sidebar')
      if (!sidebar) return false
      if (sidebar.getAttribute('data-collapsed') !== String(collapsedExpected)) return false
      const w = sidebar.getBoundingClientRect().width
      if (collapsedExpected) {
        return w >= 68 && w <= 80
      }
      return w >= 260 && w <= 284
    },
    expectedCollapsed,
    { timeout: 15_000 },
  )

  let prevWidth = -1
  for (let i = 0; i < 16; i++) {
    const currentWidth = await page.evaluate(() => {
      const el = document.querySelector('#ae-sidebar')
      return el ? Number(el.getBoundingClientRect().width.toFixed(2)) : -1
    })
    const targetOk = expectedCollapsed
      ? Math.abs(currentWidth - 76) <= 2
      : Math.abs(currentWidth - 272) <= 2
    if (targetOk && Math.abs(currentWidth - prevWidth) < 0.25) {
      return currentWidth
    }
    prevWidth = currentWidth
    await page.waitForTimeout(90)
  }
  return prevWidth
}

async function verifyDesktopRailToggle(page) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    document.body.focus()
  })
  await page.keyboard.press('Control+b')
  const expandedWidth = await waitForSettledSidebarWidth(page, false)
  await page.keyboard.press('Control+b')
  const restoredWidth = await waitForSettledSidebarWidth(page, true)
  return { expandedWidth, restoredWidth }
}

async function attachCommonRoutes(page, summaryJson) {
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
}

function attachPageDiagnostics(page, label) {
  const diag = {
    pageErrors: [],
    consoleErrors: [],
    failedRequests: [],
    abortedRscPrefetches: [],
    httpErrors: [],
    liveComparisonResponses: [],
    pendingLiveComparison: 0,
  }
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
  page.on('request', (req) => {
    if (req.url().includes('/api/erp/live-comparison')) {
      diag.pendingLiveComparison += 1
    }
  })
  page.on('requestfinished', (req) => {
    if (req.url().includes('/api/erp/live-comparison')) {
      diag.pendingLiveComparison = Math.max(0, diag.pendingLiveComparison - 1)
    }
  })
  page.on('requestfailed', (req) => {
    const url = req.url()
    const errorText = req.failure()?.errorText ?? 'failed'
    if (url.includes('/api/erp/live-comparison')) {
      diag.pendingLiveComparison = Math.max(0, diag.pendingLiveComparison - 1)
    }
    const info = `${req.method()} ${url} -> ${errorText}`
    if (url.includes('_rsc=') && errorText === 'net::ERR_ABORTED') {
      diag.abortedRscPrefetches.push(info)
      return
    }
    diag.failedRequests.push(info)
    process.stderr.write(`[requestfailed] ${label}: ${info}\n`)
  })
  page.on('response', async (res) => {
    const url = res.url()
    if (res.status() >= 400) {
      const info = `${res.status()} ${res.request().method()} ${url}`
      diag.httpErrors.push(info)
      process.stderr.write(`[http>=400] ${label}: ${info}\n`)
    }
    if (url.includes('/api/erp/live-comparison')) {
      try {
        const body = await res.json()
        diag.liveComparisonResponses.push({
          status: res.status(),
          connected: body?.connected ?? null,
          sourceMode: body?.sourceMode ?? null,
          noData: body?.noData ?? null,
          hasCubeA: Boolean(body?.cubeA),
          hasCubeB: Boolean(body?.cubeB),
        })
      } catch {
        diag.liveComparisonResponses.push({ status: res.status(), parseError: true })
      }
    }
  })
  return diag
}

async function waitForLiveComparisonSettled(page, diag, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (diag.liveComparisonResponses.length >= 1 && diag.pendingLiveComparison === 0) {
      await page.waitForTimeout(150)
      if (diag.pendingLiveComparison === 0) return
    }
    await page.waitForTimeout(100)
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

async function capturePrimaryDashboard(browser, sessionToken, summaryJson, useDev) {
  const results = []
  for (const variant of VIEWPORT_VARIANTS) {
    const file = `${PRIMARY_ROUTE.prefix}-${variant.suffix}.png`
    const context = await createSeededContext(browser, variant, sessionToken)
    try {
      const page = await context.newPage()
      const diag = attachPageDiagnostics(page, file)
      await attachCommonRoutes(page, summaryJson)

      const targetUrl = `${BASE_URL}${PRIMARY_ROUTE.buildPath(variant.lang)}`
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
        { expectedLang: variant.lang, expectedDir: variant.dir },
        { timeout: 120_000 },
      )

      await page.locator('[data-kpi="net-sales"]').waitFor({ state: 'visible', timeout: 15_000 })
      const railDefaultWidth = variant.isDesktop ? await waitForSettledSidebarWidth(page, true) : null
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(350)

      const metrics = await page.evaluate(() => {
        const kpiEl = document.querySelector('[data-kpi="net-sales"]')
        let netSalesLines = 0
        let netSalesHeight = 0
        let netSalesText = ''
        if (kpiEl) {
          netSalesText = (kpiEl.textContent ?? '').replace(/\s+/g, ' ').trim()
          netSalesHeight = Number(kpiEl.getBoundingClientRect().height.toFixed(2))
          const range = document.createRange()
          range.selectNodeContents(kpiEl)
          const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0)
          const bands = []
          for (const r of rects) {
            if (!bands.some((y) => Math.abs(y - r.top) <= 2)) {
              bands.push(r.top)
            }
          }
          netSalesLines = bands.length
        }

        const sidebar = document.querySelector('#ae-sidebar')
        const sidebarRect = sidebar ? sidebar.getBoundingClientRect() : null
        return {
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          bodyScrollWidth: document.body.scrollWidth,
          lang: document.documentElement.lang,
          dir: document.documentElement.dir,
          theme: document.documentElement.dataset.theme,
          sidebarCollapsedAttr: sidebar?.getAttribute('data-collapsed') ?? null,
          sidebarWidth: sidebarRect ? Number(sidebarRect.width.toFixed(2)) : null,
          netSalesLines,
          netSalesHeight,
          netSalesText,
        }
      })

      if (metrics.scrollWidth > metrics.innerWidth) {
        throw new Error(
          `Horizontal overflow in ${file}: scrollWidth=${metrics.scrollWidth} > innerWidth=${metrics.innerWidth}`,
        )
      }
      if (variant.isDesktop && (metrics.sidebarWidth === null || metrics.sidebarWidth > 80)) {
        throw new Error(
          `Expected collapsed desktop #ae-sidebar <= 80px in ${file}, got ${metrics.sidebarWidth}px`,
        )
      }
      if (metrics.netSalesLines !== 1) {
        throw new Error(
          `Expected [data-kpi="net-sales"] on 1 single line in ${file}, got ${metrics.netSalesLines} lines (${metrics.netSalesText}, height=${metrics.netSalesHeight})`,
        )
      }
      if (
        diag.pageErrors.length > 0 ||
        diag.consoleErrors.length > 0 ||
        diag.failedRequests.length > 0 ||
        diag.httpErrors.length > 0
      ) {
        throw new Error(
          `Runtime errors in ${file}: pageErrors=${diag.pageErrors.length} consoleErrors=${diag.consoleErrors.length} failedRequests=${diag.failedRequests.length} httpErrors=${diag.httpErrors.length}`,
        )
      }

      const outPath = path.join(outDir, file)
      await page.screenshot({ path: outPath, fullPage: false })
      const pngMeta = await readPngMeta(outPath)

      let railToggle = null
      if (variant.isDesktop) {
        railToggle = await verifyDesktopRailToggle(page)
        if (railToggle.expandedWidth < 260 || railToggle.restoredWidth > 80) {
          throw new Error(
            `Control+b rail toggle check failed on ${file}: expanded=${railToggle.expandedWidth}px restored=${railToggle.restoredWidth}px`,
          )
        }
      }

      const toggleSummary = railToggle
        ? ` railDefault=${railDefaultWidth}px railExpanded=${railToggle.expandedWidth}px railRestored=${railToggle.restoredWidth}px`
        : ''
      process.stdout.write(
        `CAPTURED ${file} png=${pngMeta.width}x${pngMeta.height} bytes=${pngMeta.bytes} mode=${useDev ? 'dev' : 'start'} lang=${metrics.lang} dir=${metrics.dir} theme=${metrics.theme} scrollWidth=${metrics.scrollWidth} innerWidth=${metrics.innerWidth} netSales="${metrics.netSalesText}" netSalesLines=${metrics.netSalesLines} netSalesHeight=${metrics.netSalesHeight}${toggleSummary} pageErrors=${diag.pageErrors.length} consoleErrors=${diag.consoleErrors.length} failedRequests=${diag.failedRequests.length} httpErrors=${diag.httpErrors.length}\n`,
      )
      results.push({ file, ...pngMeta, ...metrics, railToggle, diag })
    } finally {
      await context.close().catch(() => undefined)
    }
  }
  return results
}

async function inspectAndCaptureSecondaryRoutes(browser, sessionToken, summaryJson, useDev) {
  const reports = []
  for (const routeSpec of SECONDARY_ROUTES) {
    const routeOutcomes = []
    for (const variant of VIEWPORT_VARIANTS) {
      const file = `${routeSpec.prefix}-${variant.suffix}.png`
      const outPath = path.join(outDir, file)
      const context = await createSeededContext(browser, variant, sessionToken)
      try {
        const page = await context.newPage()
        const diag = attachPageDiagnostics(page, file)
        await attachCommonRoutes(page, summaryJson)

        const targetUrl = `${BASE_URL}${routeSpec.buildPath(variant.lang)}`
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 })

        await page.waitForFunction(
          ({ expectedLang, expectedDir }) => {
            const html = document.documentElement
            return html.lang === expectedLang && html.dir === expectedDir && html.dataset.theme === 'light'
          },
          { expectedLang: variant.lang, expectedDir: variant.dir },
          { timeout: 120_000 },
        )

        await waitForLiveComparisonSettled(page, diag)

        await page.waitForFunction(
          () => document.querySelector('[data-state-block="loading"]') === null,
          { timeout: 30_000 },
        )

        if (variant.isDesktop) {
          await waitForSettledSidebarWidth(page, true)
        }
        await page.evaluate(() => document.fonts.ready)
        await page.waitForTimeout(400)

        const probe = await page.evaluate(() => {
          const emptyBlocks = Array.from(document.querySelectorAll('[data-state-block="empty"]')).map((el) =>
            (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
          )
          const errorBlocks = Array.from(document.querySelectorAll('[data-state-block="error"]')).map((el) =>
            (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
          )
          const unavailableEls = document.querySelectorAll('[data-unavailable="true"]').length
          const chartSvgs = document.querySelectorAll('.recharts-wrapper svg, [data-chart-kind] svg').length
          const comparisonCharts = document.querySelectorAll('[data-chart-kind="comparison-bar"]').length
          const bodyText = (document.body.innerText ?? '').replace(/\s+/g, ' ').trim()
          const sidebar = document.querySelector('#ae-sidebar')
          return {
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            lang: document.documentElement.lang,
            dir: document.documentElement.dir,
            theme: document.documentElement.dataset.theme,
            sidebarWidth: sidebar ? Number(sidebar.getBoundingClientRect().width.toFixed(2)) : null,
            emptyBlocks,
            errorBlocks,
            unavailableEls,
            chartSvgs,
            comparisonCharts,
            hasTodaySalesFixture: bodyText.includes('154.700'),
          }
        })

        const hasDisconnectedEmpty = probe.emptyBlocks.some(
          (t) => t.includes('لا توجد بيانات من Odoo') || t.includes('No data from Odoo'),
        )
        const hasErrors =
          diag.pageErrors.length > 0 ||
          diag.consoleErrors.length > 0 ||
          diag.httpErrors.length > 0 ||
          diag.failedRequests.filter((f) => !f.includes('net::ERR_ABORTED')).length > 0 ||
          probe.errorBlocks.length > 0
        const hasOverflow = probe.scrollWidth > probe.innerWidth
        const rendersMeaningfulFixture =
          !hasDisconnectedEmpty &&
          !hasErrors &&
          !hasOverflow &&
          (routeSpec.key === 'cores' ? probe.hasTodaySalesFixture && probe.chartSvgs > 0 : probe.comparisonCharts > 0)

        let capturedMeta = null
        if (rendersMeaningfulFixture) {
          await page.screenshot({ path: outPath, fullPage: false })
          capturedMeta = await readPngMeta(outPath)
          process.stdout.write(
            `CAPTURED ${file} png=${capturedMeta.width}x${capturedMeta.height} bytes=${capturedMeta.bytes} mode=${useDev ? 'dev' : 'start'} lang=${probe.lang} dir=${probe.dir} theme=${probe.theme} scrollWidth=${probe.scrollWidth} innerWidth=${probe.innerWidth} sidebarWidth=${probe.sidebarWidth} chartSvgs=${probe.chartSvgs} liveComp=${JSON.stringify(diag.liveComparisonResponses)} pageErrors=${diag.pageErrors.length} consoleErrors=${diag.consoleErrors.length} failedRequests=${diag.failedRequests.length} httpErrors=${diag.httpErrors.length}\n`,
          )
        } else {
          await rm(outPath, { force: true }).catch(() => undefined)
          process.stdout.write(
            `SKIPPED_CAPTURE ${file} reason=${hasDisconnectedEmpty ? 'requires_live_odoo_cube_disconnected_empty_state' : 'not_cleanly_renderable'} lang=${probe.lang} dir=${probe.dir} scrollWidth=${probe.scrollWidth} innerWidth=${probe.innerWidth} sidebarWidth=${probe.sidebarWidth} emptyBlocks=${JSON.stringify(probe.emptyBlocks)} liveComp=${JSON.stringify(diag.liveComparisonResponses)} pageErrors=${diag.pageErrors.length} consoleErrors=${diag.consoleErrors.length} failedRequests=${diag.failedRequests.length} httpErrors=${diag.httpErrors.length}\n`,
          )
        }

        routeOutcomes.push({
          file,
          captured: Boolean(capturedMeta),
          capturedMeta,
          probe,
          diag,
        })
      } finally {
        await context.close().catch(() => undefined)
      }
    }
    reports.push({ route: routeSpec.key, outcomes: routeOutcomes })
  }
  return reports
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

    await capturePrimaryDashboard(browser, sessionToken, summaryJson, useDev)
    await inspectAndCaptureSecondaryRoutes(browser, sessionToken, summaryJson, useDev)
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
