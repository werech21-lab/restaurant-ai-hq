#!/usr/bin/env tsx
/**
 * AetherBI Deployment Gate Runner (`scripts/gate/run-gate.ts`)
 *
 * Verifies the 4 owner deployment conditions against any target deployment URL
 * using Playwright headless Chromium and the QA read-only (`auditor`) account.
 *
 * Hard rules enforced:
 * - All inputs read from environment variables only; fails closed if missing.
 * - Never echoes passwords, cookies, or Vercel bypass tokens in logs or outputs.
 * - Performs GET requests only after login (non-GET/HEAD/OPTIONS requests are blocked).
 * - Writes screenshots, visible text dumps, summary.json, and SUMMARY.md to GATE_OUT_DIR.
 * - Exits 0 if and only if all 4 deploy conditions and all 15 pages PASS.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium, type ConsoleMessage, type Locator, type Page, type Response } from '@playwright/test'
import {
  DEFAULT_GATE_TIMEOUT_MS,
  DEFAULT_SETTLE_TIMEOUT_MS,
  buildGateSummary,
  evaluateReceivablesCheck,
  evaluateYtdCheck,
  extractExplicitKwdAmount,
  findBannedStrings,
  isVercelToolbarNoise,
  parseGateEnv,
  parseKwdNumber,
  redactSensitiveText,
  renderSummaryMarkdown,
  sanitizeUrlForReport,
  type BannedStringHit,
  type GateConfig,
  type HttpErrorRecord,
  type MissingTestIdNote,
  type PageGateReport,
  type ReceivablesExtraction,
} from './checks'
import {
  CORES_SELECTORS,
  ERP_HOME_SELECTORS,
  FINANCE_SELECTORS,
  GATE_PAGES,
  LOGIN_SELECTORS,
  RECEIVABLES_SELECTORS,
  type SelectorSpec,
} from './selectors'

interface SelectorMatch {
  locator: Locator | null
  matchedSelector: string | null
  usedFallback: boolean
}

const NAVIGATION_TIMEOUT_MS = DEFAULT_GATE_TIMEOUT_MS // 135_000 ms (covers 120s cold Odoo sync)
const SETTLE_TIMEOUT_MS = DEFAULT_SETTLE_TIMEOUT_MS // 125_000 ms
const RETRY_DELAY_MS = 1_500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function pageSlug(index: number, routePath: string): string {
  const prefix = String(index + 1).padStart(2, '0')
  const clean = routePath.replace(/^\/+/, '').replace(/[^a-zA-Z0-9]+/g, '-')
  return `${prefix}-${clean || 'root'}`
}

function createMissingTestIdTracker() {
  const seen = new Map<string, MissingTestIdNote>()

  return {
    record(spec: SelectorSpec, fallbackUsed: string | null): void {
      if (!seen.has(spec.id)) {
        seen.set(spec.id, {
          selectorId: spec.id,
          page: spec.page,
          preferredTestId: spec.preferredTestId,
          fallbackUsed,
          appSourceHint: spec.appSourceHint,
        })
      }
    },
    list(): MissingTestIdNote[] {
      return [...seen.values()]
    },
  }
}

type MissingTestIdTracker = ReturnType<typeof createMissingTestIdTracker>

/**
 * Resolves a `SelectorSpec` against the current DOM, always trying the
 * preferred `[data-testid="..."]` selector first. Records a missing-testid note
 * whenever a fallback selector is required (or if none matched).
 */
async function resolveSelector(
  page: Page,
  spec: SelectorSpec,
  tracker: MissingTestIdTracker,
  timeoutMs = 3_000,
): Promise<SelectorMatch> {
  const preferred = spec.candidates[0]!
  const preferredLocator = page.locator(preferred).first()
  if ((await preferredLocator.count()) > 0) {
    return { locator: preferredLocator, matchedSelector: preferred, usedFallback: false }
  }

  for (const candidate of spec.candidates.slice(1)) {
    const loc = page.locator(candidate).first()
    if ((await loc.count()) > 0) {
      tracker.record(spec, candidate)
      return { locator: loc, matchedSelector: candidate, usedFallback: true }
    }
  }

  // Wait briefly for late client hydration on any candidate before giving up
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if ((await preferredLocator.count()) > 0) {
      return { locator: preferredLocator, matchedSelector: preferred, usedFallback: false }
    }
    for (const candidate of spec.candidates.slice(1)) {
      const loc = page.locator(candidate).first()
      if ((await loc.count()) > 0) {
        tracker.record(spec, candidate)
        return { locator: loc, matchedSelector: candidate, usedFallback: true }
      }
    }
    await sleep(200)
  }

  tracker.record(spec, null)
  return { locator: null, matchedSelector: null, usedFallback: true }
}

async function readTextFromSpec(
  page: Page,
  spec: SelectorSpec,
  tracker: MissingTestIdTracker,
  timeoutMs = 3_000,
): Promise<string | null> {
  const match = await resolveSelector(page, spec, tracker, timeoutMs)
  if (!match.locator) return null
  const text = await match.locator.innerText().catch(() => match.locator!.textContent())
  return text ? text.trim() : null
}

async function readNumberFromSpec(
  page: Page,
  spec: SelectorSpec,
  tracker: MissingTestIdTracker,
  timeoutMs = 3_000,
): Promise<number | null> {
  const started = Date.now()
  const match = await resolveSelector(page, spec, tracker, timeoutMs)
  if (!match.locator) return null

  const deadline = started + timeoutMs
  do {
    const raw = await match.locator.innerText().catch(() => match.locator!.textContent())
    const parsed = parseKwdNumber(raw ? raw.trim() : null)
    if (parsed !== null) return parsed
    if (Date.now() >= deadline) break
    await sleep(250)
  } while (Date.now() < deadline)

  const finalRaw = await match.locator.innerText().catch(() => match.locator!.textContent())
  return parseKwdNumber(finalRaw ? finalRaw.trim() : null)
}

interface InteractionDiagnostics {
  httpErrors: HttpErrorRecord[]
  consoleErrors: string[]
  pageErrors: string[]
  ignoredToolbarNoiseCount: number
}

async function runTrackedInteraction(
  page: Page,
  secrets: readonly string[],
  action: () => Promise<void>,
): Promise<InteractionDiagnostics> {
  const httpErrors: HttpErrorRecord[] = []
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  let ignoredToolbarNoiseCount = 0

  const onResponse = (res: Response) => {
    const status = res.status()
    if (status >= 400) {
      const rawUrl = res.url()
      if (isVercelToolbarNoise(rawUrl)) {
        ignoredToolbarNoiseCount += 1
        return
      }
      const req = res.request()
      httpErrors.push({
        status,
        method: req.method(),
        url: sanitizeUrlForReport(rawUrl),
        resourceType: req.resourceType(),
      })
    }
  }
  const onConsole = (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      const rawText = msg.text()
      const sourceUrl = msg.location()?.url ?? ''
      if (isVercelToolbarNoise(rawText, sourceUrl)) {
        ignoredToolbarNoiseCount += 1
        return
      }
      consoleErrors.push(redactSensitiveText(rawText, secrets))
    }
  }
  const onPageError = (err: Error) => {
    pageErrors.push(redactSensitiveText(err.message || String(err), secrets))
  }

  page.on('response', onResponse)
  page.on('console', onConsole)
  page.on('pageerror', onPageError)
  try {
    await action()
  } finally {
    page.off('response', onResponse)
    page.off('console', onConsole)
    page.off('pageerror', onPageError)
  }

  return { httpErrors, consoleErrors, pageErrors, ignoredToolbarNoiseCount }
}

async function waitForPageSettled(
  page: Page,
  settleTimeoutMs = SETTLE_TIMEOUT_MS,
): Promise<void> {
  const started = Date.now()
  const remaining = () => Math.max(1_000, settleTimeoutMs - (Date.now() - started))

  await page.waitForLoadState('networkidle', { timeout: remaining() }).catch(() => undefined)

  // Wait for client-side loading skeletons (`aria-busy="true"`) to resolve (up to cold-sync budget;
  // resolves immediately on warm pages once skeletons clear).
  await page
    .waitForFunction(
      () => {
        const busy = document.querySelectorAll('[aria-busy="true"]')
        return busy.length === 0
      },
      { timeout: remaining() },
    )
    .catch(() => undefined)

  await sleep(400)
  await page.waitForLoadState('networkidle', { timeout: remaining() }).catch(() => undefined)

  await page
    .waitForFunction(
      () => document.querySelectorAll('[aria-busy="true"]').length === 0,
      { timeout: Math.min(remaining(), 15_000) },
    )
    .catch(() => undefined)
}

interface PageVisitBuffers {
  httpStatus: number | null
  retriedOn5xx: boolean
  httpErrors: HttpErrorRecord[]
  consoleErrors: string[]
  pageErrors: string[]
  ignoredToolbarNoiseCount: number
  finalPath: string
}

async function visitWith5xxRetry(
  page: Page,
  targetUrl: string,
  secrets: readonly string[],
  navigationTimeoutMs = NAVIGATION_TIMEOUT_MS,
  settleTimeoutMs = SETTLE_TIMEOUT_MS,
): Promise<PageVisitBuffers> {
  const attempt = async (): Promise<Omit<PageVisitBuffers, 'retriedOn5xx'>> => {
    const httpErrors: HttpErrorRecord[] = []
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    let ignoredToolbarNoiseCount = 0

    const onResponse = (res: Response) => {
      const status = res.status()
      if (status >= 400) {
        const rawUrl = res.url()
        if (isVercelToolbarNoise(rawUrl)) {
          ignoredToolbarNoiseCount += 1
          return
        }
        const req = res.request()
        httpErrors.push({
          status,
          method: req.method(),
          url: sanitizeUrlForReport(rawUrl),
          resourceType: req.resourceType(),
        })
      }
    }
    const onConsole = (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        const rawText = msg.text()
        const sourceUrl = msg.location()?.url ?? ''
        if (isVercelToolbarNoise(rawText, sourceUrl)) {
          ignoredToolbarNoiseCount += 1
          return
        }
        consoleErrors.push(redactSensitiveText(rawText, secrets))
      }
    }
    const onPageError = (err: Error) => {
      pageErrors.push(redactSensitiveText(err.message || String(err), secrets))
    }

    page.on('response', onResponse)
    page.on('console', onConsole)
    page.on('pageerror', onPageError)

    let httpStatus: number | null = null
    try {
      const response = await page.goto(targetUrl, {
        waitUntil: 'networkidle',
        timeout: navigationTimeoutMs,
      })
      httpStatus = response ? response.status() : null
      await waitForPageSettled(page, settleTimeoutMs)
    } catch (err) {
      pageErrors.push(
        redactSensitiveText(
          `Navigation error: ${err instanceof Error ? err.message : String(err)}`,
          secrets,
        ),
      )
    } finally {
      page.off('response', onResponse)
      page.off('console', onConsole)
      page.off('pageerror', onPageError)
    }

    let finalPath = sanitizeUrlForReport(page.url())
    try {
      finalPath = new URL(page.url()).pathname
    } catch {
      // keep sanitized fallback
    }

    // Exclude the top-level document status from subresource httpErrors to avoid double counting
    const targetSanitized = sanitizeUrlForReport(targetUrl)
    const filteredHttpErrors = httpErrors.filter((entry, idx) => {
      if (
        idx === 0 &&
        httpStatus !== null &&
        entry.status === httpStatus &&
        entry.resourceType === 'document' &&
        entry.url === targetSanitized
      ) {
        return false
      }
      return true
    })

    return {
      httpStatus,
      httpErrors: filteredHttpErrors,
      consoleErrors,
      pageErrors,
      ignoredToolbarNoiseCount,
      finalPath,
    }
  }

  const first = await attempt()
  const saw5xx =
    (first.httpStatus !== null && first.httpStatus >= 500 && first.httpStatus < 600) ||
    first.httpErrors.some((e) => e.status >= 500 && e.status < 600)

  if (!saw5xx) {
    return { ...first, retriedOn5xx: false }
  }

  console.log(`[gate] 5xx detected on ${sanitizeUrlForReport(targetUrl)} — retrying once...`)
  await sleep(RETRY_DELAY_MS)
  const second = await attempt()
  return {
    ...second,
    ignoredToolbarNoiseCount: first.ignoredToolbarNoiseCount + second.ignoredToolbarNoiseCount,
    retriedOn5xx: true,
  }
}

function mergeBannedHits(
  existing: BannedStringHit[],
  extra: BannedStringHit[],
): BannedStringHit[] {
  const byPhrase = new Map<string, BannedStringHit>()
  for (const hit of existing) {
    byPhrase.set(hit.phrase, { ...hit })
  }
  for (const hit of extra) {
    const prev = byPhrase.get(hit.phrase)
    if (prev) {
      prev.count += hit.count
    } else {
      byPhrase.set(hit.phrase, { ...hit })
    }
  }
  return [...byPhrase.values()]
}

async function capturePageArtifacts(
  page: Page,
  outDir: string,
  slug: string,
  secrets: readonly string[],
): Promise<{ screenshotFile: string; textFile: string; visibleText: string }> {
  const screenshotFile = `${slug}.png`
  const textFile = `${slug}.txt`
  await page.screenshot({
    path: path.join(outDir, screenshotFile),
    fullPage: true,
  })
  const rawText = await page.evaluate(() => document.body?.innerText ?? '')
  const visibleText = redactSensitiveText(rawText, secrets)
  await writeFile(path.join(outDir, textFile), visibleText, 'utf8')
  return { screenshotFile, textFile, visibleText }
}

async function authenticateQaUser(
  page: Page,
  config: GateConfig,
  tracker: MissingTestIdTracker,
  secrets: readonly string[],
): Promise<void> {
  if (config.shareUrl) {
    console.log(
      `[gate] Opening Vercel share URL (${sanitizeUrlForReport(config.shareUrl)}) to set bypass cookie...`,
    )
    const shareRes = await page.goto(config.shareUrl, {
      waitUntil: 'networkidle',
      timeout: config.navigationTimeoutMs,
    })
    if (!shareRes || shareRes.status() >= 400) {
      throw new Error(
        `Vercel share URL returned HTTP ${shareRes ? shareRes.status() : 'no-response'} (fail-closed).`,
      )
    }
  }

  const loginUrl = `${config.baseUrl}/login`
  console.log(`[gate] Navigating to ${sanitizeUrlForReport(loginUrl)}...`)
  const loginRes = await page.goto(loginUrl, {
    waitUntil: 'networkidle',
    timeout: config.navigationTimeoutMs,
  })
  if (!loginRes || loginRes.status() >= 400) {
    throw new Error(
      `Login page returned HTTP ${loginRes ? loginRes.status() : 'no-response'} (fail-closed).`,
    )
  }

  const emailMatch = await resolveSelector(page, LOGIN_SELECTORS.emailInput, tracker, 10_000)
  const passwordMatch = await resolveSelector(page, LOGIN_SELECTORS.passwordInput, tracker, 10_000)
  const submitMatch = await resolveSelector(page, LOGIN_SELECTORS.submitButton, tracker, 10_000)

  if (!emailMatch.locator || !passwordMatch.locator || !submitMatch.locator) {
    throw new Error('Could not locate login form fields on /login (fail-closed).')
  }

  await emailMatch.locator.fill(config.qaEmail)
  await passwordMatch.locator.fill(config.qaPassword)
  console.log(`[gate] Submitting QA login form for ${config.qaEmail}...`)

  await Promise.all([
    submitMatch.locator.click(),
    page
      .waitForURL(
        (url) => {
          const p = url.pathname
          return p !== '/login' && !p.startsWith('/login/')
        },
        { timeout: 30_000 },
      )
      .catch(() => undefined),
  ])

  await waitForPageSettled(page, config.settleTimeoutMs)

  const currentPath = new URL(page.url()).pathname
  if (currentPath === '/login' || currentPath.startsWith('/login/')) {
    const alertText = await readTextFromSpec(page, LOGIN_SELECTORS.errorAlert, tracker, 1_500)
    const safeAlert = alertText ? redactSensitiveText(alertText, secrets) : 'still on /login'
    throw new Error(`QA login failed (${safeAlert}). Refusing to continue (fail-closed).`)
  }

  console.log(`[gate] QA login succeeded; landed on ${currentPath}.`)
}

async function runGate(): Promise<number> {
  const startedAt = new Date()
  let config: GateConfig
  try {
    config = parseGateEnv(process.env, startedAt)
  } catch (err) {
    console.error(`[gate] Configuration error: ${err instanceof Error ? err.message : String(err)}`)
    return 1
  }

  const secrets: string[] = [config.qaPassword]
  if (config.shareUrl) {
    try {
      const shareParsed = new URL(config.shareUrl)
      if (shareParsed.search) secrets.push(shareParsed.search)
      for (const value of shareParsed.searchParams.values()) {
        if (value) secrets.push(value)
      }
    } catch {
      // ignore
    }
  }

  const resolvedOutDir = path.resolve(config.outDir)
  await mkdir(resolvedOutDir, { recursive: true })

  const tracker = createMissingTestIdTracker()
  const browser = await chromium.launch({ headless: true })

  let nonGetBlockedCount = 0

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'ar-KW',
      timezoneId: 'Asia/Kuwait',
    })
    const page = await context.newPage()

    // Step 1: Optional share URL + login via /login form
    await authenticateQaUser(page, config, tracker, secrets)

    // Hard rule: GET requests only after login (block any non-GET/HEAD/OPTIONS mutation)
    await context.route('**/*', async (route) => {
      const method = route.request().method().toUpperCase()
      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        nonGetBlockedCount += 1
        await route.abort('blockedbyclient')
        return
      }
      await route.continue()
    })

    const receivablesExtraction: ReceivablesExtraction = {
      erpCard: null,
      erpLineUnderCard: null,
      erpBadgeValue: null,
      erpBadgePresent: false,
      erpTieOutStatus: 'missing',
      erpCreditsLine: null,
      financeGlCard: null,
      financeReceivablesTabCard: null,
      financeCreditsCard: null,
      receivablesCard: null,
      receivablesCreditsCard: null,
    }

    const pageReports: PageGateReport[] = []

    // Step 2 & 3: Visit all 15 pages, capture PNG + visible text, run checks
    for (let i = 0; i < GATE_PAGES.length; i += 1) {
      const routePath = GATE_PAGES[i]!
      const slug = pageSlug(i, routePath)
      const targetUrl = `${config.baseUrl}${routePath}`
      console.log(`[gate] (${i + 1}/${GATE_PAGES.length}) GET ${routePath}`)

      const visit = await visitWith5xxRetry(
        page,
        targetUrl,
        secrets,
        config.navigationTimeoutMs,
        config.settleTimeoutMs,
      )
      let ignoredToolbarNoiseCount = visit.ignoredToolbarNoiseCount
      const artifacts = await capturePageArtifacts(page, resolvedOutDir, slug, secrets)
      let bannedHits = findBannedStrings(artifacts.visibleText)
      const failures: string[] = []
      const keyNumbers: Record<string, string | number | null> = {}

      if (visit.httpStatus === null || visit.httpStatus >= 400) {
        failures.push(`Page HTTP status ${visit.httpStatus ?? 'null'}`)
      }
      if (visit.finalPath === '/login' || visit.finalPath.startsWith('/login/')) {
        failures.push('Redirected to /login during page visit')
      }
      for (const httpErr of visit.httpErrors) {
        failures.push(`HTTP ${httpErr.status} (${httpErr.resourceType}) ${httpErr.url}`)
      }
      for (const cErr of visit.consoleErrors) {
        failures.push(`Console error: ${cErr.slice(0, 180)}`)
      }
      for (const pErr of visit.pageErrors) {
        failures.push(`Page error: ${pErr.slice(0, 180)}`)
      }

      // Page-specific extractions
      if (routePath === '/erp') {
        receivablesExtraction.erpCard = await readNumberFromSpec(
          page,
          ERP_HOME_SELECTORS.receivablesCard,
          tracker,
        )
        receivablesExtraction.erpLineUnderCard = await readNumberFromSpec(
          page,
          ERP_HOME_SELECTORS.receivablesLineUnderCard,
          tracker,
        )
        receivablesExtraction.erpCreditsLine = await readNumberFromSpec(
          page,
          ERP_HOME_SELECTORS.receivablesCreditsLine,
          tracker,
        )

        const tieOutMatch = await resolveSelector(
          page,
          ERP_HOME_SELECTORS.receivablesTieOutContainer,
          tracker,
        )
        if (tieOutMatch.locator) {
          const attr = await tieOutMatch.locator.getAttribute('data-ar-tie-out')
          if (attr === 'ties' || attr === 'mismatch') {
            receivablesExtraction.erpTieOutStatus = attr
          }
        }

        const badgeMatch = await resolveSelector(
          page,
          ERP_HOME_SELECTORS.receivablesBadge,
          tracker,
        )
        if (badgeMatch.locator) {
          receivablesExtraction.erpBadgePresent = true
          const badgeVisibleText = (await badgeMatch.locator.innerText().catch(() => '')).trim()
          const selfAriaLabel = ((await badgeMatch.locator.getAttribute('aria-label').catch(() => '')) ?? '').trim()
          const childAriaLabel =
            selfAriaLabel ||
            (((await badgeMatch.locator.locator('[aria-label]').first().getAttribute('aria-label').catch(() => '')) ?? '').trim())
          const parsedFromVisible =
            !badgeMatch.usedFallback
              ? parseKwdNumber(badgeVisibleText)
              : extractExplicitKwdAmount(badgeVisibleText)
          const parsedBadgeVal = parsedFromVisible ?? extractExplicitKwdAmount(childAriaLabel)
          if (parsedBadgeVal !== null) {
            receivablesExtraction.erpBadgeValue = parsedBadgeVal
          }
        }

        keyNumbers.receivablesCard = receivablesExtraction.erpCard
        keyNumbers.receivablesLine = receivablesExtraction.erpLineUnderCard
        keyNumbers.unappliedCredits = receivablesExtraction.erpCreditsLine
        keyNumbers.receivablesBadge =
          receivablesExtraction.erpBadgeValue !== null
            ? receivablesExtraction.erpBadgeValue
            : receivablesExtraction.erpBadgePresent
              ? `present (${receivablesExtraction.erpTieOutStatus})`
              : 'missing'
      } else if (routePath === '/erp/finance') {
        receivablesExtraction.financeGlCard = await readNumberFromSpec(
          page,
          FINANCE_SELECTORS.glSummaryReceivablesCard,
          tracker,
        )

        // Switch client-side tab to Open Receivables (pure client state, zero network writes)
        const tabMatch = await resolveSelector(
          page,
          FINANCE_SELECTORS.receivablesTabButton,
          tracker,
        )
        if (tabMatch.locator) {
          const tabDiag = await runTrackedInteraction(page, secrets, async () => {
            await tabMatch.locator!.click()
            await sleep(400)
          })
          ignoredToolbarNoiseCount += tabDiag.ignoredToolbarNoiseCount
          for (const httpErr of tabDiag.httpErrors) {
            visit.httpErrors.push(httpErr)
            failures.push(`HTTP ${httpErr.status} (${httpErr.resourceType}) ${httpErr.url}`)
          }
          for (const cErr of tabDiag.consoleErrors) {
            visit.consoleErrors.push(cErr)
            failures.push(`Console error: ${cErr.slice(0, 180)}`)
          }
          for (const pErr of tabDiag.pageErrors) {
            visit.pageErrors.push(pErr)
            failures.push(`Page error: ${pErr.slice(0, 180)}`)
          }
          const tabArtifacts = await capturePageArtifacts(
            page,
            resolvedOutDir,
            `${slug}-receivables-tab`,
            secrets,
          )
          bannedHits = mergeBannedHits(bannedHits, findBannedStrings(tabArtifacts.visibleText))
          receivablesExtraction.financeReceivablesTabCard = await readNumberFromSpec(
            page,
            FINANCE_SELECTORS.receivablesTabNetCard,
            tracker,
          )
          receivablesExtraction.financeCreditsCard = await readNumberFromSpec(
            page,
            FINANCE_SELECTORS.receivablesTabCreditsCard,
            tracker,
          )
        } else {
          failures.push('Could not locate Open Receivables tab on /erp/finance')
        }

        keyNumbers.glTabReceivables = receivablesExtraction.financeGlCard
        keyNumbers.receivablesTabNet = receivablesExtraction.financeReceivablesTabCard
        keyNumbers.creditsCard = receivablesExtraction.financeCreditsCard
      } else if (routePath === '/erp/receivables') {
        receivablesExtraction.receivablesCard = await readNumberFromSpec(
          page,
          RECEIVABLES_SELECTORS.netCard,
          tracker,
        )
        receivablesExtraction.receivablesCreditsCard = await readNumberFromSpec(
          page,
          RECEIVABLES_SELECTORS.creditsCard,
          tracker,
        )
        keyNumbers.receivablesNet = receivablesExtraction.receivablesCard
        keyNumbers.creditsCard = receivablesExtraction.receivablesCreditsCard
      }

      if (bannedHits.length > 0) {
        failures.push(
          `Banned string(s): ${bannedHits.map((h) => `«${h.phrase}» (${h.count}x)`).join(', ')}`,
        )
      }

      pageReports.push({
        path: routePath,
        finalPath: visit.finalPath,
        passed: failures.length === 0,
        httpStatus: visit.httpStatus,
        retriedOn5xx: visit.retriedOn5xx,
        httpErrors: visit.httpErrors,
        consoleErrors: visit.consoleErrors,
        pageErrors: visit.pageErrors,
        ignoredToolbarNoiseCount,
        bannedHits,
        keyNumbers,
        failures,
        screenshotFile: artifacts.screenshotFile,
        textFile: artifacts.textFile,
      })
    }

    // Step 2b: Check 2026 YTD company total on /erp/cores using Year filter
    // Executed after the 15-page pass so localStorage period='year' never leaks into other pages.
    console.log('[gate] Checking 2026 YTD company total on /erp/cores?period=year...')
    const ytdUrl = `${config.baseUrl}/erp/cores?period=year&brand=all&branch=all&channel=all`
    const ytdVisit = await visitWith5xxRetry(
      page,
      ytdUrl,
      secrets,
      config.navigationTimeoutMs,
      config.settleTimeoutMs,
    )

    // Ensure the Year filter is active; if URL hydration did not switch it, select Year in UI
    const ytdInteractionDiag = await runTrackedInteraction(page, secrets, async () => {
      const currentSearch = new URL(page.url()).searchParams
      if (currentSearch.get('period') !== 'year') {
        const trigger = await resolveSelector(
          page,
          CORES_SELECTORS.periodDropdownTrigger,
          tracker,
          2_000,
        )
        if (trigger.locator) {
          await trigger.locator.click()
          const yearOpt = await resolveSelector(
            page,
            CORES_SELECTORS.yearPeriodOption,
            tracker,
            2_000,
          )
          if (yearOpt.locator) {
            await yearOpt.locator.click()
          }
        }
      }

      // Wait for CoresHubStudio client hydration to reflect the Year window before reading YTD
      await page
        .waitForFunction(
          () => {
            const text = document.body?.innerText ?? ''
            return (
              text.includes('الفترة المختارة: السنة') ||
              text.includes('Selected period: Year') ||
              new URLSearchParams(window.location.search).get('period') === 'year'
            )
          },
          { timeout: config.settleTimeoutMs },
        )
        .catch(() => undefined)

      await waitForPageSettled(page, config.settleTimeoutMs)
    })

    const ytdActual = await readNumberFromSpec(page, CORES_SELECTORS.ytdCompanyTotal, tracker, 10_000)
    const ytdArtifacts = await capturePageArtifacts(page, resolvedOutDir, '02b-erp-cores-ytd', secrets)
    const ytdBannedHits = findBannedStrings(ytdArtifacts.visibleText)
    const ytdCheck = evaluateYtdCheck(ytdActual, config.expectedYtd, config.ytdTolerancePct)

    const coresReport = pageReports.find((p) => p.path === '/erp/cores')
    if (coresReport) {
      coresReport.ignoredToolbarNoiseCount +=
        ytdVisit.ignoredToolbarNoiseCount + ytdInteractionDiag.ignoredToolbarNoiseCount
      coresReport.keyNumbers.ytd2026Total = ytdActual
      if (ytdCheck.deltaPct !== null) {
        coresReport.keyNumbers.ytdDeltaPct = `${ytdCheck.deltaPct >= 0 ? '+' : ''}${ytdCheck.deltaPct.toFixed(3)}%`
      }
      if (ytdVisit.httpStatus === null || ytdVisit.httpStatus >= 400) {
        coresReport.httpErrors.push({
          status: ytdVisit.httpStatus ?? 0,
          method: 'GET',
          url: sanitizeUrlForReport(ytdUrl),
          resourceType: 'document',
        })
        coresReport.failures.push(`YTD view HTTP status ${ytdVisit.httpStatus ?? 'null'}`)
      }
      for (const httpErr of [...ytdVisit.httpErrors, ...ytdInteractionDiag.httpErrors]) {
        coresReport.httpErrors.push(httpErr)
        coresReport.failures.push(`YTD HTTP ${httpErr.status} (${httpErr.resourceType}) ${httpErr.url}`)
      }
      for (const cErr of [...ytdVisit.consoleErrors, ...ytdInteractionDiag.consoleErrors]) {
        coresReport.consoleErrors.push(cErr)
        coresReport.failures.push(`YTD console error: ${cErr.slice(0, 180)}`)
      }
      for (const pErr of [...ytdVisit.pageErrors, ...ytdInteractionDiag.pageErrors]) {
        coresReport.pageErrors.push(pErr)
        coresReport.failures.push(`YTD page error: ${pErr.slice(0, 180)}`)
      }
      if (ytdBannedHits.length > 0) {
        coresReport.bannedHits = mergeBannedHits(coresReport.bannedHits, ytdBannedHits)
        coresReport.failures.push(
          `YTD banned string(s): ${ytdBannedHits.map((h) => `«${h.phrase}» (${h.count}x)`).join(', ')}`,
        )
      }
      if (ytdCheck.failure) {
        coresReport.failures.push(ytdCheck.failure)
      }
      coresReport.passed = coresReport.failures.length === 0
    }

    // Step 4(b): Evaluate cross-page receivables consistency & non-zero credits
    const receivablesCheck = evaluateReceivablesCheck(
      receivablesExtraction,
      config.expectedReceivables,
    )

    for (const targetPath of ['/erp', '/erp/finance', '/erp/receivables'] as const) {
      const report = pageReports.find((p) => p.path === targetPath)
      const recFailures = receivablesCheck.perPageFailures[targetPath]
      if (report && recFailures.length > 0) {
        report.failures.push(...recFailures)
        report.passed = false
      }
    }

    // Step 5: Write summary.json and SUMMARY.md
    const summary = buildGateSummary({
      timestampIso: startedAt.toISOString(),
      baseUrl: config.baseUrl,
      shareUrlUsed: Boolean(config.shareUrl),
      outDir: resolvedOutDir,
      expectedReceivables: config.expectedReceivables,
      expectedYtd: config.expectedYtd,
      ytdTolerancePct: config.ytdTolerancePct,
      pages: pageReports,
      receivables: receivablesCheck,
      ytd2026: ytdCheck,
      missingTestIds: tracker.list(),
      nonGetBlockedCount,
    })

    const summaryJsonPath = path.join(resolvedOutDir, 'summary.json')
    const summaryMdPath = path.join(resolvedOutDir, 'SUMMARY.md')
    await writeFile(summaryJsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
    await writeFile(summaryMdPath, renderSummaryMarkdown(summary), 'utf8')

    console.log('\n================ AETHERBI DEPLOYMENT GATE ================')
    for (const p of summary.pages) {
      console.log(`  [${p.passed ? 'PASS' : 'FAIL'}] ${p.path}${p.failures.length > 0 ? ` — ${p.failures[0]}` : ''}`)
    }
    console.log(
      `  OVERALL: ${summary.overall} (exit ${summary.exitCode}, ignored toolbar noise: ${summary.ignoredToolbarNoiseCount})`,
    )
    console.log(`  Reports: ${summaryJsonPath}`)
    console.log(`           ${summaryMdPath}`)
    console.log('==========================================================\n')

    return summary.exitCode
  } finally {
    await browser.close()
  }
}

runGate()
  .then((code) => {
    process.exitCode = code
  })
  .catch((err) => {
    const extraSecrets: (string | undefined)[] = [
      process.env.AETHER_QA_PASSWORD,
      process.env.GATE_SHARE_URL,
    ]
    if (process.env.GATE_SHARE_URL) {
      try {
        const parsed = new URL(process.env.GATE_SHARE_URL)
        if (parsed.search) extraSecrets.push(parsed.search)
        for (const val of parsed.searchParams.values()) {
          if (val) extraSecrets.push(val)
        }
      } catch {
        // ignore invalid URL
      }
    }
    const safeMsg = redactSensitiveText(
      err instanceof Error ? err.message : String(err),
      extraSecrets,
    )
    console.error(`[gate] Fatal error: ${safeMsg}`)
    process.exitCode = 1
  })
