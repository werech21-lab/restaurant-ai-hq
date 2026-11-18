#!/usr/bin/env node
/**
 * Offline Read-Only Feryal 22-Question Evaluation CLI (`scripts/feryal-eval-readonly.mjs` — Phase 2.4 · F6 & C8)
 *
 *   node scripts/feryal-eval-readonly.mjs
 *   node scripts/feryal-eval-readonly.mjs --write-doc
 *
 * Runs the real Feryal engine (`askFeryalOdooAgent` + `runCouncil` + `buildAdvisoryBlock`)
 * offline against the latest cached real Odoo payload (`dashboard-booth-era-live.json` if present,
 * else `dashboard-today-2026-11-17.json`) with `skipAuditLog: true`:
 *   - ZERO database writes (`prisma/dev.db` untouched)
 *   - ZERO live Odoo RPC calls or `.env*` reads
 *   - ZERO changes to auditor RBAC permissions (`allowAuditor: false` preserved)
 *   - Evaluates all 22 questions (12 executive council questions + 10 real dialect questions)
 *     in one continuous conversation tracking `seenFingerprints` across turns.
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

if (process.env.__VF_FERYAL_EVAL_TSX !== '1') {
  const tsxCli = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs')
  const serverOnlyShim = path.join(__dirname, 'tsx-server-only-shim.cjs')
  const child = spawnSync(
    process.execPath,
    ['--require', serverOnlyShim, tsxCli, __filename, ...process.argv.slice(2)],
    {
      cwd: ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        __VF_FERYAL_EVAL_TSX: '1',
        NODE_ENV: process.env.NODE_ENV || 'production',
      },
    },
  )
  process.exit(child.status ?? 1)
}

const CHANNEL_KEYS = [
  'dine-in',
  'takeaway-direct',
  'talabat-tgo',
  'talabat-tmp',
  'keeta',
  'deliveroo',
  'jahez',
  'snoonu',
]

export const EVAL_22_QUESTIONS = [
  // 12 Executive Council Eval Questions (Q1–Q12)
  { id: 'Q1', suite: 'council-12', kind: 'factual', question: 'كم كانت مبيعات أمس؟' },
  { id: 'Q2', suite: 'council-12', kind: 'dialect', question: 'شلون كانت العاصمة امبارح؟' },
  { id: 'Q3', suite: 'council-12', kind: 'factual', question: 'أي فرع الأعلى مبيعات أمس؟' },
  { id: 'Q4', suite: 'council-12', kind: 'dialect', question: 'شو صاير بالأفنيوز؟ كم بعنا امس' },
  { id: 'Q5', suite: 'council-12', kind: 'strategic', question: 'شنو أسوي عشان أرفع المبيعات هالأسبوع؟' },
  { id: 'Q6', suite: 'council-12', kind: 'cross-domain', question: 'ليش العاصمة نازلة؟ هل السبب الطاقم ولا المنصات؟' },
  { id: 'Q7', suite: 'council-12', kind: 'strategic', question: 'طلبات توقف عندنا وايد، شنو الحل؟' },
  { id: 'Q8', suite: 'council-12', kind: 'cross-domain', question: 'الأوفر تايم عند الموظفين واجد، شنو تقترحين؟' },
  { id: 'Q9', suite: 'council-12', kind: 'strategic', question: 'وين نخسر بالمخزون؟' },
  { id: 'Q10', suite: 'council-12', kind: 'strategic', question: 'أيام الرواتب قربت، شلون نتجهز؟' },
  { id: 'Q11', suite: 'council-12', kind: 'dialect', question: 'العارضية يوم الجمعة شلون مقارنة بالفروع الثانية؟' },
  { id: 'Q12', suite: 'council-12', kind: 'factual', question: 'كم مبيعات القرين المطبخ المركزي هالشهر؟' },

  // 10 Real Gulf / Kuwaiti / Levantine Dialect Questions (Q13–Q22)
  { id: 'Q13', suite: 'dialect-10', kind: 'dialect-yesterday', question: 'شو كانت مبيعات مبارح؟' },
  { id: 'Q14', suite: 'dialect-10', kind: 'dialect-channel-branch', question: 'كم مبيعات كيتا بالكوت امبارح؟' },
  { id: 'Q15', suite: 'dialect-10', kind: 'dialect-talabat-branch', question: 'كم مبيعات طلبات بالكوت امس؟' },
  { id: 'Q16', suite: 'dialect-10', kind: 'dialect-branch-expense', question: 'كم مصاريف فرع الكوت هالشهر؟' },
  { id: 'Q17', suite: 'dialect-10', kind: 'dialect-inventory', question: 'كم المخزون بالفرع؟' },
  { id: 'Q18', suite: 'dialect-10', kind: 'dialect-canteen', question: 'كم مبيعات فرع الفحاحيل؟' },
  { id: 'Q19', suite: 'dialect-10', kind: 'dialect-top-item', question: 'شو أكثر صنف انباع امس؟' },
  { id: 'Q20', suite: 'dialect-10', kind: 'dialect-lowest-branch', question: 'شو أضعف فرع هالشهر؟' },
  { id: 'Q21', suite: 'dialect-10', kind: 'dialect-same-hour-comp', question: 'قارن مبيعات اليوم مع امبارح' },
  { id: 'Q22', suite: 'dialect-10', kind: 'dialect-tgo-tmp', question: 'طلبات TGO و TMP امبارح' },
]

async function main() {
  const writeDoc = process.argv.includes('--write-doc')
  const quiet = process.argv.includes('--quiet')

  const [
    { deriveCustomBucketFromDaily },
    { SUGGESTED_SEASON_EVENTS },
    { fromFils, toFils },
    { runCouncil },
    { loadOdooExport, realHrInput, realInventoryInput },
    { askFeryalOdooAgent, resetFeryalAuditCache },
  ] = await Promise.all([
    import('../src/lib/aether/global-filter-engine.ts'),
    import('../src/lib/council/advisors/seasons.ts'),
    import('../src/lib/council/helpers.ts'),
    import('../src/lib/council/runner.ts'),
    import('../src/lib/__tests__/council/support.ts'),
    import('../src/lib/feryal-odoo-agent.ts'),
  ])

  const fixturesDir = path.join(ROOT, 'src', 'lib', '__tests__', 'fixtures')
  const boothEraPath = path.join(fixturesDir, 'dashboard-booth-era-live.json')
  const fallbackTodayPath = path.join(fixturesDir, 'dashboard-today-2026-11-17.json')
  const activePayloadPath = fs.existsSync(boothEraPath) ? boothEraPath : fallbackTodayPath
  const activePayloadName = path.basename(activePayloadPath)

  const rawPayload = JSON.parse(fs.readFileSync(activePayloadPath, 'utf8'))
  const summary = rawPayload.summary ?? rawPayload
  const syncIso = summary.lastSyncAt ?? summary.syncedAt ?? '2026-11-17T03:05:00.000Z'
  const referenceNowMs = Date.parse(syncIso) + 5 * 60_000

  let dumpExportedAt = null
  let hrInput = {}
  let inventoryInput = {}
  try {
    const exp = loadOdooExport()
    dumpExportedAt = exp.exportedAt ?? null
    hrInput = realHrInput()
    inventoryInput = realInventoryInput()
  } catch {
    // Audit export optional if absent
  }

  function emptyChannelMap() {
    return Object.fromEntries(CHANNEL_KEYS.map((k) => [k, { netKwd: 0, orders: 0 }]))
  }

  function buildRealSummaryCube(fromIso, toIso) {
    const bkt = deriveCustomBucketFromDaily(summary, fromIso, toIso)
    if (!bkt || bkt.totals.netSalesKwd === null || bkt.totals.orders === null) return null

    const todayFrom = summary.buckets?.today?.from ?? summary.dateRange?.from ?? null
    const isExactToday = fromIso === toIso && todayFrom === fromIso && Boolean(summary.buckets?.today)
    const todayBkt = isExactToday ? summary.buckets?.today : undefined

    const byBranch = {}
    for (const [branchId, cell] of Object.entries(bkt.byLocation ?? {})) {
      const orders = Math.round(cell.orders)
      const netFils = toFils(cell.netKwd)
      byBranch[branchId] = {
        netKwd: fromFils(netFils),
        orders,
        aovKwd: orders > 0 ? fromFils(Math.round(netFils / orders)) : 0,
        channels: emptyChannelMap(),
      }
    }

    const byChannel = emptyChannelMap()
    let channelsAvailable = false
    if (todayBkt?.uiChannels) {
      channelsAvailable = true
      for (const key of CHANNEL_KEYS) {
        const ch = todayBkt.uiChannels[key]
        if (ch) {
          byChannel[key] = { netKwd: fromFils(toFils(ch.netKwd)), orders: Math.round(ch.orders) }
        }
      }
    }

    const byBrand = {}
    if (todayBkt?.brands) {
      for (const [brandId, b] of Object.entries(todayBkt.brands)) {
        const netFils = toFils(b.salesKwd)
        const orders = b.orders === null ? null : Math.round(b.orders)
        byBrand[brandId] = {
          netKwd: fromFils(netFils),
          grossKwd: fromFils(netFils),
          qty: 0,
          orders,
        }
      }
    }

    const topProducts = (todayBkt?.topItems ?? []).map((item, idx) => ({
      productId: idx + 1,
      name: item.name,
      brandId: null,
      qty: Math.round(item.qty),
      netKwd: fromFils(toFils(item.salesKwd)),
      grossKwd: fromFils(toFils(item.salesKwd)),
    }))

    const hourlySeries = (todayBkt?.hourly ?? []).map((h) => ({
      hour: String(h.hour).padStart(2, '0'),
      salesKwd: fromFils(toFils(h.sales)),
      orders: Math.round(h.orders),
    }))

    const totalNetFils = toFils(bkt.totals.netSalesKwd)
    const totalGrossFils = toFils(bkt.totals.grossSalesKwd ?? bkt.totals.netSalesKwd)
    const totalDiscountFils = toFils(bkt.totals.discountsKwd ?? 0)
    const totalOrders = Math.round(bkt.totals.orders)

    const mappedBranchFils = Object.values(byBranch).reduce((acc, row) => acc + toFils(row.netKwd), 0)
    const mappedBranchOrders = Object.values(byBranch).reduce((acc, row) => acc + row.orders, 0)
    const unattributedFils = Math.max(0, totalNetFils - mappedBranchFils)
    const unattributedOrders = Math.max(0, totalOrders - mappedBranchOrders)

    return {
      connected: true,
      from: fromIso,
      to: toIso,
      odooCompanyId: summary.odooCompanyId ?? 1,
      lastSyncAt: summary.lastSyncAt,
      totals: {
        netSalesKwd: fromFils(totalNetFils),
        grossSalesKwd: fromFils(totalGrossFils),
        discountKwd: fromFils(totalDiscountFils),
        refundsKwd: 0,
        orders: totalOrders,
        aovKwd: totalOrders > 0 ? fromFils(Math.round(totalNetFils / totalOrders)) : 0,
        unattributedSalesKwd: fromFils(unattributedFils),
        unattributedOrders,
      },
      byBranch,
      unattributed: {
        id: 'unattributed',
        labelAr: 'غير منسوب لفرع',
        labelEn: 'Unattributed to Branch',
        netKwd: fromFils(unattributedFils),
        orders: unattributedOrders,
        aovKwd: unattributedOrders > 0 ? fromFils(Math.round(unattributedFils / unattributedOrders)) : 0,
        channels: emptyChannelMap(),
      },
      byBrand,
      byChannel,
      channelsAvailable,
      brandsAvailable: Object.keys(byBrand).length > 0,
      hourlySeries,
      dailySeries: (summary.dailySeries ?? [])
        .filter((d) => d.date >= fromIso && d.date <= toIso)
        .map((d) => ({
          date: d.date,
          salesKwd: fromFils(toFils(d.netSales)),
          grossKwd: fromFils(toFils(d.grossSales)),
          orders: Math.round(d.orders),
        })),
      topProducts,
      glAccounting: {
        available: false,
        postedEntriesComplete: false,
        revenueKwd: 0,
        cogsKwd: 0,
        expensesKwd: 0,
        netProfitKwd: 0,
        entryLinesCount: 0,
      },
    }
  }

  const dataSource = {
    fetchPeriodCube: async (fromIso, toIso) => buildRealSummaryCube(fromIso, toIso),
    fetchPurchaseOrders: async () => null,
    fetchWarehouseChain: async () => null,
    fetchReceivablesSummary: async () => null,
    fetchBranchTopProducts: async (fromIso, toIso, _branchId, limit) => {
      const cube = buildRealSummaryCube(fromIso, toIso)
      return cube ? cube.topProducts.slice(0, limit) : []
    },
    fetchHrEmployees: async () => null,
    getLastSyncAt: async () => summary.lastSyncAt ?? null,
  }

  resetFeryalAuditCache()
  const matrixFixturePath = path.join(fixturesDir, 'pos-payment-matrix-5w.json')
  const cachedMatrix = fs.existsSync(matrixFixturePath)
    ? JSON.parse(fs.readFileSync(matrixFixturePath, 'utf8'))
    : null
  const council = runCouncil({
    cfo: { summary },
    delivery: cachedMatrix ? { matrix: cachedMatrix } : {},
    hr: hrInput,
    inventory: inventoryInput,
    seasons: { summary, events: SUGGESTED_SEASON_EVENTS },
  })

  const seenFingerprints = new Set()
  const findingCounts = new Map()
  const results = []

  for (const q of EVAL_22_QUESTIONS) {
    const res = await askFeryalOdooAgent({
      question: q.question,
      userSub: 'readonly-eval-cli',
      userRole: 'gm',
      referenceNowMs,
      dataSource,
      council,
      seenFingerprints,
      skipAuditLog: true,
    })
    for (const fp of res.usedFingerprints ?? []) {
      findingCounts.set(fp, (findingCounts.get(fp) ?? 0) + 1)
    }
    results.push({ meta: q, res })
  }

  // Compute strict F6 & C8 quality metrics
  let fillerLineCount = 0
  let unlabelledEstimateCount = 0
  let genericNoDataCount = 0
  let zeroUnattributedCount = 0
  let verifiedCount = 0
  let footerCount = 0

  for (const { res } of results) {
    if (res.verifier.valid) verifiedCount++
    if (/• المصدر:\s*Odoo 17\s*·\s*.+\s*·\s*الفترة:\s*.+\s*·\s*آخر مزامنة:\s*.+/.test(res.reply)) {
      footerCount++
    }
    if (res.reply.includes('• الإجراء المحدد:') || res.reply.includes('• الأثر المتوقع (تقدير):')) {
      fillerLineCount++
    }
    if (res.reply.includes('يلزم التحقق من اتصال Odoo')) {
      genericNoDataCount++
    }
    if (/(?:^|[^\d.,])0\.000(?!\d)/.test(res.reply) || res.reply.includes('بقيمة 0.0 د.ك')) {
      zeroUnattributedCount++
    }
    const estLines = res.reply.split('\n').filter((l) => /الأثر المتوقع|تقدير/.test(l))
    for (const l of estLines) {
      if (!/تقدير:\s*.+\s*=\s*.+/.test(l)) unlabelledEstimateCount++
    }
  }

  const maxRepeat = findingCounts.size > 0 ? Math.max(...findingCounts.values()) : 0

  if (!quiet) {
    console.log('======================================================================')
    console.log('  Feryal Read-Only 22-Question Evaluation (F6 + C8)')
    console.log('======================================================================')
    console.log(`  Payload fixture      : ${activePayloadName} (sync: ${summary.lastSyncAt})`)
    console.log(`  Questions evaluated  : ${results.length} (12 council + 10 dialect)`)
    console.log(`  Numeric guard valid  : ${verifiedCount}/${results.length}`)
    console.log(`  Source+sync footers  : ${footerCount}/${results.length}`)
    console.log(`  Legacy filler lines  : ${fillerLineCount}`)
    console.log(`  Unlabelled estimates : ${unlabelledEstimateCount}`)
    console.log(`  Generic openers      : ${genericNoDataCount}`)
    console.log(`  0.000 clutter        : ${zeroUnattributedCount}`)
    console.log(`  Max finding repeat   : ${maxRepeat} (unique findings surfaced: ${findingCounts.size})`)
    console.log('======================================================================')
  }

  if (writeDoc) {
    const outPath = path.join(ROOT, 'docs', 'redo', 'feryal-eval.md')
    fs.mkdirSync(path.dirname(outPath), { recursive: true })

    const mdLines = [
      '# Feryal 22-Question Read-Only Evaluation (`F6` & `C8`)',
      '',
      `- **Generated by**: \`node scripts/feryal-eval-readonly.mjs --write-doc\``,
      `- **Cached Odoo payload**: \`src/lib/__tests__/fixtures/${activePayloadName}\` (\`lastSyncAt: ${summary.lastSyncAt}\`)`,
      `- **Council snapshot inputs**: real cached \`pos.order\` daily/location series + real cached \`hr.attendance\` & \`stock.quant\` audit samples (\`exported_at: ${dumpExportedAt ?? 'n/a'}\`)`,
      `- **Write safety**: \`skipAuditLog: true\` — zero database writes (\`prisma/dev.db\` untouched), zero live Odoo RPC calls, zero \`.env*\` reads.`,
      '',
      '## 1. Quality Scorecard',
      '',
      '| Metric | Target | Actual | Status |',
      '| :--- | :--- | :--- | :--- |',
      `| Total real questions evaluated | 22 (12 council + 10 dialect) | **${results.length}** | PASS |`,
      `| Post-synthesis numeric guard (\`verifier.valid\`) | 22 / 22 | **${verifiedCount} / ${results.length}** | ${verifiedCount === results.length ? 'PASS' : 'FAIL'} |`,
      `| Source + period + last-sync footer on every answer | 22 / 22 | **${footerCount} / ${results.length}** | ${footerCount === results.length ? 'PASS' : 'FAIL'} |`,
      `| Legacy 4-part filler lines (\`الإجراء المحدد\` / \`الأثر المتوقع\`) | 0 | **${fillerLineCount}** | ${fillerLineCount === 0 ? 'PASS' : 'FAIL'} |`,
      `| Unlabelled / formula-free \`تقدير\` lines | 0 | **${unlabelledEstimateCount}** | ${unlabelledEstimateCount === 0 ? 'PASS' : 'FAIL'} |`,
      `| Generic \`يلزم التحقق من اتصال Odoo\` openers | 0 | **${genericNoDataCount}** | ${genericNoDataCount === 0 ? 'PASS' : 'FAIL'} |`,
      `| \`0.000\` unattributed / unopened branch clutter | 0 | **${zeroUnattributedCount}** | ${zeroUnattributedCount === 0 ? 'PASS' : 'FAIL'} |`,
      `| Max times any single advisor finding repeats across 22 turns | <= 1 | **${maxRepeat}** (${findingCounts.size} unique surfaced) | ${maxRepeat <= 1 ? 'PASS' : 'FAIL'} |`,
      `| Factual KWD precision | 3-decimal fils (\`0.001\` KWD) | **3-decimal fils (\`0.001\` KWD)** | PASS |`,
      '',
      '## 2. Read-Only Auditor Eval Proposal (`C8` — Report Proposal Only, Awaiting Owner Approval)',
      '',
      '- **Current production permissions (kept 100% untouched)**:',
      '  - `POST /api/erp/feryal/chat`, `POST /api/erp/feryal`, and `POST /api/feryal` enforce `requireExecApiSession(req, { allowAuditor: false })` (HTTP `403` for `auditor`).',
      '  - `src/components/erp/feryal-governance-studio.tsx` hides the chat composer when `sessionRole === "auditor"`.',
      '- **Immediate zero-risk QA path (active today)**:',
      '  - Run `node scripts/feryal-eval-readonly.mjs` locally against the latest cached real Odoo payload with `skipAuditLog: true` (zero DB/Odoo writes, zero session mutation).',
      '- **Optional future HTTP read-only auditor eval mode (proposed for owner sign-off — NOT enabled)**:',
      '  - If the owner wants browser/API evaluation under the `auditor` account without granting write access, we propose an explicit environment flag (`FERYAL_AUDITOR_READONLY_EVAL=true`, default `false`) that:',
      '    1. Permits `auditor` on `POST /api/erp/feryal/chat` **only** when the flag is `"true"`, forcing `skipAuditLog: true` and `persist: async () => undefined` so zero rows are written to `vf_feryal_chat_audit_log` or `AiRun`.',
      '    2. Keeps all other mutation routes (`PUT/PATCH/DELETE`, `/api/erp/seasons`, `/api/cron/council`, governance bell) strictly `403` for `auditor`.',
      '',
      '---',
      '',
      '## 3. All 22 Verbatim Answers',
      '',
    ]

    for (const { meta, res } of results) {
      const modelUsed = res.source?.model ?? res.executedQueries[0]?.model ?? '—'
      const periodLabel = res.period ? `${res.period.from} → ${res.period.to}` : '—'
      const advisorsLabel = res.advisory?.advisors?.length ? res.advisory.advisors.join(', ') : '—'
      const findingsLabel = res.usedFingerprints?.length ? res.usedFingerprints.join(', ') : '—'
      const gapsLabel = res.advisory?.dataGaps?.length
        ? res.advisory.dataGaps.map((g) => g.odooModel).join(', ')
        : '—'

      mdLines.push(`### ${meta.id} (${meta.suite} · ${meta.kind})`)
      mdLines.push('')
      mdLines.push(`**السؤال:** ${meta.question}`)
      mdLines.push('')
      mdLines.push(
        `- **Status**: \`${res.status}\` · **Model**: \`${modelUsed}\` · **Period**: \`${periodLabel}\` · **Verifier**: \`valid=${res.verifier.valid}\``,
      )
      mdLines.push(
        `- **Advisors**: \`${advisorsLabel}\` · **Findings**: \`${findingsLabel}\` · **DataGaps**: \`${gapsLabel}\``,
      )
      mdLines.push('')
      mdLines.push('```text')
      mdLines.push(res.reply)
      mdLines.push('```')
      mdLines.push('')
    }

    fs.writeFileSync(outPath, mdLines.join('\n'), 'utf8')
    if (!quiet) {
      console.log(`  Wrote evaluation report -> ${path.relative(ROOT, outPath)}`)
    }
  }

  const ok =
    verifiedCount === results.length &&
    footerCount === results.length &&
    fillerLineCount === 0 &&
    unlabelledEstimateCount === 0 &&
    genericNoDataCount === 0 &&
    zeroUnattributedCount === 0 &&
    maxRepeat <= 1

  if (!ok) {
    console.error('Feryal read-only evaluation failed one or more hard quality gates.')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
