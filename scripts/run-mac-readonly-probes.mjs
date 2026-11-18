#!/usr/bin/env node
/**
 * Unified Read-Only Owner Runner for Mac Live Odoo Captures (`scripts/run-mac-readonly-probes.mjs`)
 *
 *   node scripts/run-mac-readonly-probes.mjs
 *
 * Strictly read-only (`fields_get`, `search_count`, `search_read`, `read_group`, `read` ONLY).
 * Never prints, logs, or commits credentials, URLs, usernames, or API keys.
 *
 * Captures in one deterministic pass when `.env.local` is present on the owner's Mac:
 *   (a) Booth-era `OdooLiveSummary` fixture (`src/lib/__tests__/fixtures/dashboard-booth-era-live.json`)
 *   (b) Qurain Central Kitchen double-count audit (`docs/phase-5/qurain-audit-2026-11-01_2026-11-17.{json,md}` + current month)
 *   (c) 1–17 Nov POS reconciliation vs owner reference `66,487.04 KWD` (`docs/redo/reconciliation-1-17-nov.md`)
 *   (d) Phase 2.1 Live Odoo Model Probe (`docs/redo/odoo-model-probe.md` + `.json`, shared with `scripts/probe-odoo-models.mjs`)
 *
 * If `.env.local` / Odoo credentials are absent, exits cleanly (code 0 unless `--require-env`)
 * with step-by-step owner instructions.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runQurainAuditCli } from './audit-qurain-double-count.mjs'
import { runPosVarianceCli } from './audit-pos-variance.mjs'
import {
  ALLOWED_ODOO_METHODS,
  assertReadOnlyOdooMethod,
  loadEnvLocal,
  renderModelProbeMarkdown,
  runLiveOdooModelProbe,
} from './probe-odoo-models.mjs'

export { ALLOWED_ODOO_METHODS, assertReadOnlyOdooMethod, renderModelProbeMarkdown }

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const KUWAIT_OFFSET_MS = 3 * 3600_000

function getKuwaitTodayIso(nowMs = Date.now()) {
  return new Date(nowMs + KUWAIT_OFFSET_MS).toISOString().slice(0, 10)
}

function captureBoothEraSummaryFixture({ env, redact }) {
  const tsxCli = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs')
  const serverOnlyShim = path.join(__dirname, 'tsx-server-only-shim.cjs')
  const outFixturePath = path.join(ROOT, 'src', 'lib', '__tests__', 'fixtures', 'dashboard-booth-era-live.json')
  const tmpScript = path.join(ROOT, `.tmp-booth-fixture-${process.pid}.mts`)

  const code = `
import fs from 'node:fs';
import { bustOdooLiveCache, fetchLiveOdooSnapshot } from './src/lib/odoo-live-connector';
(async () => {
  bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true });
  const snap = await fetchLiveOdooSnapshot({
    period: 'custom',
    customFrom: '2026-11-01',
    customTo: '2026-11-17',
    forceRefresh: true,
  });
  if (!snap.connected || !snap.summary) {
    throw new Error('Live Odoo snapshot returned disconnected');
  }
  fs.writeFileSync(${JSON.stringify(outFixturePath)}, JSON.stringify(snap.summary, null, 2) + '\\n');
})();
`
  try {
    fs.writeFileSync(tmpScript, code, 'utf8')
    execFileSync(process.execPath, [tsxCli, '-r', serverOnlyShim, tmpScript], {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: 'pipe',
    })
    const sanitized = redact(fs.readFileSync(outFixturePath, 'utf8'))
    fs.writeFileSync(outFixturePath, sanitized)
    return outFixturePath
  } finally {
    if (fs.existsSync(tmpScript)) fs.unlinkSync(tmpScript)
  }
}

async function main() {
  const requireEnv = process.argv.includes('--require-env')
  const env = { ...loadEnvLocal(ROOT), ...process.env }
  const baseUrl = String(env.ODOO_URL || '').trim().replace(/\/+$/, '')
  const db = String(env.ODOO_DB || '').trim()
  const login = String(env.ODOO_USERNAME || env.ODOO_LOGIN || env.ODOO_USER || '').trim()
  const apiKey = String(env.ODOO_API_KEY || env.ODOO_PASSWORD || '').trim()
  const password = String(env.ODOO_PASSWORD || '').trim()

  const redact = (msg) => {
    let s = String(msg || '')
    for (const secret of [apiKey, password, login, db, baseUrl]) {
      if (secret && secret.length >= 3) s = s.split(secret).join('[REDACTED]')
    }
    return s.replace(/https?:\/\/[^\s"'<>]+/gi, '[REDACTED_URL]')
  }

  if (!baseUrl || !db || !login || !apiKey) {
    console.log(
      [
        '======================================================================',
        '  AetherBI — Read-Only Mac Odoo Probes (SKIPPED: .env.local absent)',
        '======================================================================',
        '',
        'No live Odoo credentials were found in `.env.local` or process environment.',
        'Per Owner Rule (ANTIGRAVITY-MASTER-PROMPT.md line 73 & 83), nothing was estimated',
        'or invented, and Qurain POS sales remain «غير متاح» until this probe runs.',
        '',
        'Owner steps on the Mac with `.env.local`:',
        '  1. Confirm `.env.local` is in the repo root (untracked by git) with:',
        '     ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY',
        '  2. Run this single read-only command:',
        '     node scripts/run-mac-readonly-probes.mjs',
        '     (or standalone Phase 2.1 model probe: node scripts/probe-odoo-models.mjs)',
        '  3. Inspect generated files before committing (zero secrets/PII):',
        '     - src/lib/__tests__/fixtures/dashboard-booth-era-live.json',
        '     - docs/phase-5/qurain-audit-2026-11-01_2026-11-17.{json,md}',
        '     - docs/phase-5/qurain-audit-<month-start>_<today>.{json,md}',
        '     - docs/redo/reconciliation-1-17-nov.md',
        '     - docs/redo/odoo-model-probe.{md,json}',
        '',
      ].join('\n'),
    )
    process.exit(requireEnv ? 2 : 0)
  }

  const todayIso = getKuwaitTodayIso()
  const monthStartIso = `${todayIso.slice(0, 7)}-01`

  console.log('1/4 Capturing booth-era OdooLiveSummary fixture (read-only)...')
  const fixturePath = captureBoothEraSummaryFixture({ env, redact })
  console.log(`  Wrote ${path.relative(ROOT, fixturePath)}`)

  console.log('2/4 Running Qurain Central Kitchen double-count audits (read-only)...')
  const q1 = await runQurainAuditCli({ fromIso: '2026-11-01', toIso: '2026-11-17', envIn: env })
  console.log(`  Wrote ${path.relative(ROOT, q1.outBase)}.{json,md}`)
  if (monthStartIso !== '2026-11-01' || todayIso !== '2026-11-17') {
    const q2 = await runQurainAuditCli({ fromIso: monthStartIso, toIso: todayIso, envIn: env })
    console.log(`  Wrote ${path.relative(ROOT, q2.outBase)}.{json,md}`)
  }

  console.log('3/4 Running 1–17 Nov POS reconciliation vs 66,487.04 KWD (read-only)...')
  const rec = await runPosVarianceCli({
    fromIso: '2026-11-01',
    toIso: '2026-11-17',
    ownerRefKwd: 66487.04,
    writeRedoDoc: true,
    envIn: env,
  })
  console.log(`  Wrote ${path.relative(ROOT, rec.redoDocPath)}`)

  console.log('4/4 Running Phase 2.1 Odoo model coverage probe (read-only)...')
  await runLiveOdooModelProbe({ baseUrl, db, login, apiKey, redact, rootDir: ROOT })
  console.log('  Wrote docs/redo/odoo-model-probe.{md,json}')
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isDirectRun) {
  main().catch((err) => {
    console.error('Read-only Mac probe failed:', err?.message || err)
    process.exit(1)
  })
}
