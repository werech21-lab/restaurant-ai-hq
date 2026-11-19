#!/usr/bin/env node
/**
 * Venture Foods — Live Odoo 17 Truth, Zero Invented Data & Governance Integrity Verifier
 * (`scripts/verify-brain-integrity.mjs`)
 *
 * Verifies in one deterministic pass:
 *   1. Secret hygiene (.env.local untracked, zero raw API keys in Git, zero PIN leaks)
 *   2. Permanent purge of legacy static snapshots & OdooAuditCertificateModal
 *   3. Strict 6-Brand & 7-Branch + standalone «غير منسوب لفرع» + Delivery (Qurain) included; Heisenberg and Jahra excluded
 *   4. Static production scan (0 Math.random, faker, OdooAuditCertificate, فارق 0.000, or Hawally UI strings)
 *   5. Runtime disconnect truth & multi-period reactivity (today/week/month/year, غير مُرحَّل بعد, قيود غير مكتملة لهذه الفترة)
 *   6. Feryal Live Odoo Agent 5 acceptance invariants & Executive Governance / Printable A4 Circulars
 */

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const tsxCli = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const serverOnlyShimPath = path.join(__dirname, 'tsx-server-only-shim.cjs')

let passed = 0
let failed = 0

function assert(condition, label, detail = '') {
  if (condition) {
    passed++
    console.log(`  ✅ PASS: ${label}${detail ? ` (${detail})` : ''}`)
  } else {
    failed++
    console.error(`  ❌ FAIL: ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function walkProductionTsFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (ent.name === '__tests__' || ent.name === 'node_modules' || ent.name === '.next') continue
      walkProductionTsFiles(full, out)
    } else if (/\.(ts|tsx)$/.test(ent.name)) {
      out.push(full)
    }
  }
  return out
}

console.log('\n======================================================================')
console.log('  Venture Foods — Live Odoo 17 Truth & Zero Invented Data Verifier')
console.log('======================================================================\n')

// 1. Secret Hygiene
console.log('1) Security & Secret Hygiene:')
const trackedEnv = execSync('git ls-files .env.local', { cwd: ROOT, encoding: 'utf8' }).trim()
assert(trackedEnv === '', '.env.local is NOT tracked in Git')

const secretPrefixes = [
  ['x', 'a', 'i', '-'].join(''),
  ['s', 'k', '-', 'a', 'n', 't'].join(''),
  ['c2st', 'YW50'].join(''),
  ['A', 'Q', '.', 'A', 'b', '8'].join(''),
  ['A', 'b', '8', 'R', 'N', '6'].join(''),
  ['A', 'I', 'z', 'a'].join(''),
]

function countGitGrep(pat) {
  try {
    const out = execSync(`git grep -F "${pat}"`, { cwd: ROOT, encoding: 'utf8' }).trim()
    return out ? out.split('\n').length : 0
  } catch {
    return 0
  }
}

for (const pat of secretPrefixes) {
  const hits = countGitGrep(pat)
  assert(hits === 0, `Zero raw secret prefix "${pat.slice(0, 3)}..." in tracked files`, `matches=${hits}`)
}

const pinUiLeakPattern = ['(', '2026', ')'].join('')
assert(countGitGrep(pinUiLeakPattern) === 0, 'Zero exposed Manager PIN label leaks across tracked files')

// 2. Permanent Purge of Legacy Static Snapshots from Active Runtime Engines & Fake Certificate
console.log('\n2) Purge of Static Snapshot Fallbacks & Fake Audit Certificate:')
assert(
  !fs.existsSync(path.join(ROOT, 'src/components/aether/OdooAuditCertificateModal.tsx')),
  'Legacy fake OdooAuditCertificateModal.tsx permanently removed',
)
for (const snapRel of [
  'src/lib/odoo-live-snapshot.json',
  'src/lib/odoo/delivery-receipts-proof.json',
  'src/lib/odoo/odoo-journey.json',
  'src/lib/odoo/odoo-intel.json',
]) {
  assert(!fs.existsSync(path.join(ROOT, snapRel)), `Snapshot JSON ${snapRel} permanently deleted`)
}

const activeRuntimeFiles = [
  'src/lib/odoo-live-connector.ts',
  'src/lib/aether/global-filter-engine.ts',
  'src/lib/erp-comparison-engine.ts',
  'src/lib/aether/before-after-engine.ts',
  'src/lib/warehouse-prep-engine.ts',
  'src/lib/aether/cores-hub-engine.ts',
  'src/lib/aether/planning-engine.ts',
  'src/lib/reports/enterprise-reports-registry.ts',
  'src/lib/feryal-odoo-agent.ts',
  'src/app/api/odoo-sync/route.ts',
  'src/app/api/erp/odoo-sync/route.ts',
]
const staticImportRe =
  /(?:from|import)\s+['"][^'"]*(?:odoo-live-snapshot|odoo-dataset|odoo-journey|delivery-receipts-proof)/
for (const rel of activeRuntimeFiles) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
  const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
  assert(!staticImportRe.test(codeOnly), `Zero static snapshot imports in ${rel}`)
}

// 3. Production Static Scan
console.log('\n3) Production Static Scan (src/app, src/components, src/lib, src/modules, src/services):')
const prodRoots = ['src/app', 'src/components', 'src/lib', 'src/modules', 'src/services']
const prodFiles = prodRoots.flatMap((r) => walkProductionTsFiles(path.join(ROOT, r)))
const hawallyRe = /\u062d\u0648\u0644\u064a|hawally|hawalli/i
const fakeBadgeRe = /OdooAuditCertificate|\u0641\u0627\u0631\u0642\s*0\.000/
const mathRandomRe = /\bMath\.random\s*\(/
const fakerRe = /\bfaker\b|@faker-js/i

let badFiles = []
for (const fp of prodFiles) {
  const raw = fs.readFileSync(fp, 'utf8')
  const noComments = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
  const rel = path.relative(ROOT, fp).replace(/\\/g, '/')
  if (mathRandomRe.test(noComments)) badFiles.push(`${rel}: Math.random`)
  if (fakerRe.test(noComments)) badFiles.push(`${rel}: faker`)
  if (fakeBadgeRe.test(raw)) badFiles.push(`${rel}: OdooAuditCertificate/0.000`)
  if (hawallyRe.test(raw)) badFiles.push(`${rel}: Hawally/حولي`)
}
assert(
  badFiles.length === 0,
  `Zero Math.random, faker, OdooAuditCertificate, فارق 0.000, or Hawally across ${prodFiles.length} production files`,
  badFiles.slice(0, 5).join('; '),
)

// 4. Runtime Probe (Whitelist, Exclusions, Disconnect Truth, Period Reactivity & Feryal)
console.log('\n4) Runtime Odoo Truth, Disconnect Honesty & Feryal Acceptance Probe:')
const runtimeScript = `
import {
  APPROVED_BRAND_IDS,
  APPROVED_BRANCH_IDS,
  computeGlobalWorkspace,
  DEFAULT_GLOBAL_FILTERS,
} from './src/lib/aether/global-filter-engine';
import { isExcludedOdooEntity, UNMAPPED_TERMINALS_LABEL_AR } from './src/lib/aether/period-delta';
import { computeStrategicPlanning } from './src/lib/aether/planning-engine';
import { computeErpComparison } from './src/lib/erp-comparison-engine';
import { computeBeforeAfterSnapshot } from './src/lib/aether/before-after-engine';
import { computeWarehouseDailyChain } from './src/lib/warehouse-prep-engine';
import { bustOdooLiveCache, fetchLiveOdooSnapshot } from './src/lib/odoo-live-connector';
import { askFeryalOdooAgent, FERYAL_COMPETITOR_REFUSAL, FERYAL_NO_ODOO_DATA_REPLY } from './src/lib/feryal-odoo-agent';

(async () => {
  const keys = ['ODOO_URL', 'ODOO_DB', 'ODOO_USERNAME', 'ODOO_LOGIN', 'ODOO_API_KEY', 'ODOO_PASSWORD'];
  const saved = {};
  for (const k of keys) { saved[k] = process.env[k]; delete process.env[k]; }
  bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true });

  const discEnv = await fetchLiveOdooSnapshot({ period: 'month', forceRefresh: true });
  const wsDisc = computeGlobalWorkspace(DEFAULT_GLOBAL_FILTERS, discEnv.summary);
  const compDisc = computeErpComparison({
    mode: 'date-vs-date',
    granularity: 'single',
    periodA: { from: '2026-11-14', to: '2026-11-14' },
    periodB: { from: '2026-11-07', to: '2026-11-07' },
    brandIds: 'all',
    branchIds: 'all',
    channelIds: 'all',
  }, discEnv.summary);
  const baDisc = computeBeforeAfterSnapshot(DEFAULT_GLOBAL_FILTERS, 'period-prev', null, [], [], discEnv.summary);
  const whDisc = computeWarehouseDailyChain(DEFAULT_GLOBAL_FILTERS, undefined, 'all', discEnv.summary);
  const planDisc = computeStrategicPlanning(DEFAULT_GLOBAL_FILTERS, discEnv.summary);
  const feryalDisc = await askFeryalOdooAgent({ question: 'مبيعات أمس حسب الفرع' });
  const feryalComp = await askFeryalOdooAgent({ question: 'كم مبيعات منافس مطعم بيك؟' });

  for (const k of keys) {
    if (saved[k] !== undefined) process.env[k] = saved[k];
  }

  console.log(JSON.stringify({
    brandsOk: JSON.stringify([...APPROVED_BRAND_IDS].sort()) === JSON.stringify(['china-garden','farm-brown','franks','karak-cafeteria','noodle-bar','tahina']),
    branchesOk: JSON.stringify([...APPROVED_BRANCH_IDS].sort()) === JSON.stringify(['360-mall','al-kout','ardiya','assima','avenues','promenade','salmiya']),
    unmappedLabelOk: UNMAPPED_TERMINALS_LABEL_AR === 'غير منسوب لفرع',
    exclusionsOk: !isExcludedOdooEntity('القرين') && !isExcludedOdooEntity('Delivery (Qurain)') && isExcludedOdooEntity('هايزن بريج') && isExcludedOdooEntity('Jahra') && !isExcludedOdooEntity('Promenade'),
    disconnectOk:
      discEnv.connected === false &&
      discEnv.noData === true &&
      wsDisc.odooConnected === false &&
      wsDisc.noData === true &&
      wsDisc.salesKwd === 0 &&
      compDisc.connected === false &&
      compDisc.noData === true &&
      baDisc.connected === false &&
      baDisc.noData === true &&
      whDisc.connected === false &&
      whDisc.noData === true &&
      planDisc.odooConnected === false &&
      planDisc.noData === true,
    feryalHonestyOk:
      feryalDisc.reply.startsWith(FERYAL_NO_ODOO_DATA_REPLY) &&
      feryalDisc.verifier.valid === true &&
      feryalComp.reply === FERYAL_COMPETITOR_REFUSAL &&
      feryalComp.reply === 'لا أعرف',
  }));
})();
`

const tmpFile = path.join(ROOT, `.tmp-verify-brain-${process.pid}.mts`)
let probeOut = ''
try {
  fs.writeFileSync(tmpFile, runtimeScript, 'utf8')
  probeOut = execFileSync(process.execPath, [tsxCli, '-r', serverOnlyShimPath, tmpFile], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim()
} finally {
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
}

const probe = JSON.parse(probeOut.split('\n').pop() ?? '{}')
assert(probe.brandsOk === true, 'Strictly ONLY the 6 approved Venture Foods brands')
assert(probe.branchesOk === true, 'Strictly ONLY the 7 approved Venture Foods operating branches')
assert(probe.unmappedLabelOk === true, '8th unattributed bucket labeled «غير منسوب لفرع»')
assert(probe.exclusionsOk === true, 'Delivery (Qurain) is included; Heisenberg and Jahra stay excluded')
assert(
  probe.disconnectOk === true,
  'Zero-fallback disconnect truth across Snapshot, Workspace, Comparison, Before/After, Warehouse & Planning',
)
assert(
  probe.feryalHonestyOk === true,
  'Feryal returns «لا أملك بيانات من Odoo عن هذا» when disconnected and «لا أعرف» for competitors',
)

// 5. Governance & Printable Circulars Check
console.log('\n5) Governance & Printable Official Circulars:')
const govApiSrc = fs.readFileSync(path.join(ROOT, 'src/app/api/erp/governance/route.ts'), 'utf8')
const circularModalSrc = fs.readFileSync(
  path.join(ROOT, 'src/components/erp/OfficialCircularPrintModal.tsx'),
  'utf8',
)
assert(
  govApiSrc.includes('export async function GET') &&
    govApiSrc.includes('export async function POST') &&
    circularModalSrc.includes('Venture Foods Co.') &&
    circularModalSrc.includes('@media print'),
  'Governance API (/api/erp/governance) & Printable A4 Official Circulars active',
)

console.log('\n----------------------------------------------------------------------')
if (failed > 0) {
  console.error(`❌ Integrity Verification FAILED: ${failed} failed, ${passed} passed.`)
  process.exit(1)
} else {
  console.log(`✅ ALL ${passed} ODOO 17 TRUTH & INTEGRITY CHECKS PASSED!`)
  process.exit(0)
}
