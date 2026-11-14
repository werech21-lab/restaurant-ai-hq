#!/usr/bin/env node
/**
 * Venture Foods — Automated RBAC (`ops` & `cfo`), Auditor Lockdown,
 * Admin-Only POS Terminal Auto-Discovery & Client Bundle Leak Verifier
 * (`scripts/test-erp-fixes.mjs`)
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const tsxCli = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const serverOnlyShimPath = path.join(__dirname, 'tsx-server-only-shim.cjs')

let passed = 0
let failed = 0

function assert(condition, label, detail = '') {
  if (condition) {
    passed += 1
    console.log(`  ✅ PASS: ${label}${detail ? ` (${detail})` : ''}`)
  } else {
    failed += 1
    console.error(`  ❌ FAIL: ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      walkFiles(full, out)
    } else {
      out.push(full)
    }
  }
  return out
}

console.log('\n======================================================================')
console.log('  Venture Foods — RBAC (ops/cfo) & POS Terminal Discovery Test Suite')
console.log('======================================================================\n')

const runtimeProbeScript = `
import { NextRequest } from 'next/server';
import {
  authenticateExecutiveCredentials,
  createExecSessionToken,
  DEFAULT_ABDULLAH_EMAIL,
  DEFAULT_AUDITOR_EMAIL,
  DEFAULT_CFO_EMAIL,
  DEFAULT_DGM_EMAIL,
  DEFAULT_FINANCE_ALIAS_EMAIL,
  DEFAULT_GM_EMAIL,
  DEFAULT_OPS_EMAIL,
  EXEC_ROLE_PROFILES,
  EXEC_SESSION_COOKIE,
  verifyExecSessionToken,
} from './src/lib/auth';
import { POST as loginPost } from './src/app/api/auth/login/route';
import {
  GET as odooSyncGet,
  POST as odooSyncPost,
} from './src/app/api/erp/odoo-sync/route';
import {
  DELETE as terminalMappingsDelete,
  GET as terminalMappingsGet,
  POST as terminalMappingsPost,
  PUT as terminalMappingsPut,
} from './src/app/api/erp/terminal-mappings/route';
import { POST as govPost } from './src/app/api/erp/governance/route';
import { middleware } from './src/middleware';
import { resetAdminPosTerminalMappingsForTests } from './src/lib/odoo-terminal-mappings';
import { bustOdooLiveCache } from './src/lib/odoo-live-connector';

(async () => {
  const pwOps = String.fromCharCode(79, 112, 115, 64, 50, 48, 50, 54);
  const pwCfo = String.fromCharCode(67, 102, 111, 64, 50, 48, 50, 54);

  // 1) Direct credential verification + /api/auth/login round-trip for ops, cfo & finance alias
  const opsCred = await authenticateExecutiveCredentials(DEFAULT_OPS_EMAIL, pwOps);
  const cfoCred = await authenticateExecutiveCredentials(DEFAULT_CFO_EMAIL, pwCfo);
  const finCred = await authenticateExecutiveCredentials(DEFAULT_FINANCE_ALIAS_EMAIL, pwCfo);
  const wrongOpsCred = await authenticateExecutiveCredentials(DEFAULT_OPS_EMAIL, pwCfo);
  const wrongCfoCred = await authenticateExecutiveCredentials(DEFAULT_CFO_EMAIL, pwOps);

  const opsLoginRes = await loginPost(
    new NextRequest('https://aetherbi.com/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '10.20.30.1',
      },
      body: JSON.stringify({ email: DEFAULT_OPS_EMAIL, password: pwOps }),
    }),
  );
  const opsLoginJson = await opsLoginRes.json();
  const opsSetCookie = opsLoginRes.headers.get('set-cookie') ?? '';

  const cfoLoginRes = await loginPost(
    new NextRequest('https://aetherbi.com/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '10.20.30.2',
      },
      body: JSON.stringify({ email: DEFAULT_CFO_EMAIL, password: pwCfo }),
    }),
  );
  const cfoLoginJson = await cfoLoginRes.json();
  const cfoSetCookie = cfoLoginRes.headers.get('set-cookie') ?? '';

  const finLoginRes = await loginPost(
    new NextRequest('https://aetherbi.com/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '10.20.30.3',
      },
      body: JSON.stringify({ email: DEFAULT_FINANCE_ALIAS_EMAIL, password: pwCfo }),
    }),
  );
  const finLoginJson = await finLoginRes.json();

  // Issue signed tokens for all 6 roles
  const tokAdmin = await createExecSessionToken(DEFAULT_ABDULLAH_EMAIL, 'admin');
  const tokGm = await createExecSessionToken(DEFAULT_GM_EMAIL, 'gm');
  const tokDgm = await createExecSessionToken(DEFAULT_DGM_EMAIL, 'dgm');
  const tokOps = await createExecSessionToken(DEFAULT_OPS_EMAIL, 'ops');
  const tokCfo = await createExecSessionToken(DEFAULT_CFO_EMAIL, 'cfo');
  const tokAud = await createExecSessionToken(DEFAULT_AUDITOR_EMAIL, 'auditor');

  const verOps = await verifyExecSessionToken(tokOps);
  const verCfo = await verifyExecSessionToken(tokCfo);

  // Check all 13 ERP routes allowed in middleware for ops & cfo
  const erpRoutes = [
    '/erp',
    '/erp/cores',
    '/erp/prep-sla',
    '/erp/delivery-sla',
    '/erp/warehouse-chain',
    '/erp/social-reviews',
    '/erp/weekday-comparison',
    '/erp/before-after',
    '/erp/aggregator-radar',
    '/erp/booth-feasibility',
    '/erp/planning',
    '/erp/regulations',
    '/erp/feryal-ai',
  ];
  let opsBlockedRoutes = 0;
  let cfoBlockedRoutes = 0;
  for (const r of erpRoutes) {
    const mOps = await middleware(
      new NextRequest('https://aetherbi.com' + r, {
        headers: { cookie: EXEC_SESSION_COOKIE + '=' + tokOps },
      }),
    );
    const mCfo = await middleware(
      new NextRequest('https://aetherbi.com' + r, {
        headers: { cookie: EXEC_SESSION_COOKIE + '=' + tokCfo },
      }),
    );
    if (mOps.status >= 300) opsBlockedRoutes += 1;
    if (mCfo.status >= 300) cfoBlockedRoutes += 1;
  }

  // ops & cfo allowed on Odoo sync GET & POST
  bustOdooLiveCache({ resetCooldown: true });
  const opsSyncGet = await odooSyncGet(
    new NextRequest('https://aetherbi.com/api/erp/odoo-sync?period=month', {
      headers: { cookie: EXEC_SESSION_COOKIE + '=' + tokOps },
    }),
  );
  const opsSyncPost = await odooSyncPost(
    new NextRequest('https://aetherbi.com/api/erp/odoo-sync?period=month', {
      method: 'POST',
      headers: { cookie: EXEC_SESSION_COOKIE + '=' + tokOps },
    }),
  );
  const cfoSyncGet = await odooSyncGet(
    new NextRequest('https://aetherbi.com/api/erp/odoo-sync?period=month', {
      headers: { cookie: EXEC_SESSION_COOKIE + '=' + tokCfo },
    }),
  );

  // 2) Auditor strict 403 across sync, governance & terminal mappings
  const audSyncPost = await odooSyncPost(
    new NextRequest('https://aetherbi.com/api/erp/odoo-sync?period=month', {
      method: 'POST',
      headers: { cookie: EXEC_SESSION_COOKIE + '=' + tokAud },
    }),
  );
  const audGovPost = await govPost(
    new NextRequest('https://aetherbi.com/api/erp/governance', {
      method: 'POST',
      headers: {
        cookie: EXEC_SESSION_COOKIE + '=' + tokAud,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'reset' }),
    }),
  );
  const audMwFeryal = await middleware(
    new NextRequest('https://aetherbi.com/api/erp/feryal', {
      method: 'POST',
      headers: { cookie: EXEC_SESSION_COOKIE + '=' + tokAud },
    }),
  );

  // 3) /api/erp/terminal-mappings RBAC: 401 unauth, 403 non-admin, 200 admin + exact reallocation math
  resetAdminPosTerminalMappingsForTests();
  bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true });

  const unauthMapGet = await terminalMappingsGet(
    new NextRequest('https://aetherbi.com/api/erp/terminal-mappings'),
  );
  const nonAdminStatuses = [];
  for (const [, tok] of [
    ['gm', tokGm],
    ['dgm', tokDgm],
    ['ops', tokOps],
    ['cfo', tokCfo],
    ['auditor', tokAud],
  ]) {
    const gRes = await terminalMappingsGet(
      new NextRequest('https://aetherbi.com/api/erp/terminal-mappings', {
        headers: { cookie: EXEC_SESSION_COOKIE + '=' + tok },
      }),
    );
    const pRes = await terminalMappingsPost(
      new NextRequest('https://aetherbi.com/api/erp/terminal-mappings', {
        method: 'POST',
        headers: {
          cookie: EXEC_SESSION_COOKIE + '=' + tok,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ terminal_id: 26, branch_id: 'salmiya' }),
      }),
    );
    const uRes = await terminalMappingsPut(
      new NextRequest('https://aetherbi.com/api/erp/terminal-mappings', {
        method: 'PUT',
        headers: {
          cookie: EXEC_SESSION_COOKIE + '=' + tok,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ terminal_id: 26, branch_id: 'salmiya' }),
      }),
    );
    const mwRes = await middleware(
      new NextRequest('https://aetherbi.com/api/erp/terminal-mappings', {
        method: 'POST',
        headers: { cookie: EXEC_SESSION_COOKIE + '=' + tok },
      }),
    );
    nonAdminStatuses.push(gRes.status, pRes.status, uRes.status, mwRes.status);
  }

  // Admin GET initial auto-discovered state
  const initRes = await terminalMappingsGet(
    new NextRequest('https://aetherbi.com/api/erp/terminal-mappings', {
      headers: { cookie: EXEC_SESSION_COOKIE + '=' + tokAdmin },
    }),
  );
  const initJson = await initRes.json();
  const targetTerm = initJson.unmappedTerminals?.[0];
  const salmiyaBefore =
    initJson.branches?.find((b) => b.id === 'salmiya')?.netSalesKwd ?? 0;
  const unmappedBefore = initJson.companyTotals?.unmappedTerminalsNetKwd ?? 0;
  const companyTotalBefore = initJson.companyTotals?.netSalesKwd ?? 0;
  const initSumBranches = Math.round(
    (initJson.branches ?? []).reduce((s, b) => s + b.netSalesKwd, 0) * 1000,
  ) / 1000;
  const initEquationOk =
    Math.abs(
      Math.round((initSumBranches + unmappedBefore) * 1000) / 1000 -
        companyTotalBefore,
    ) === 0;

  // Admin POST 1-click Save: map targetTerm -> 'salmiya'
  const saveRes = await terminalMappingsPost(
    new NextRequest('https://aetherbi.com/api/erp/terminal-mappings', {
      method: 'POST',
      headers: {
        cookie: EXEC_SESSION_COOKIE + '=' + tokAdmin,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        terminal_id: targetTerm.terminal_id,
        branch_id: 'salmiya',
      }),
    }),
  );
  const saveJson = await saveRes.json();
  const salmiyaAfter =
    saveJson.branches?.find((b) => b.id === 'salmiya')?.netSalesKwd ?? 0;
  const unmappedAfter = saveJson.companyTotals?.unmappedTerminalsNetKwd ?? 0;
  const companyTotalAfter = saveJson.companyTotals?.netSalesKwd ?? 0;
  const afterSumBranches = Math.round(
    (saveJson.branches ?? []).reduce((s, b) => s + b.netSalesKwd, 0) * 1000,
  ) / 1000;

  const salmiyaIncreasedExact =
    Math.round((salmiyaAfter - salmiyaBefore) * 1000) / 1000 ===
    targetTerm.net_sales_kwd;
  const unmappedDecreasedExact =
    Math.round((unmappedBefore - unmappedAfter) * 1000) / 1000 ===
    targetTerm.net_sales_kwd;
  const afterEquationOk =
    companyTotalAfter === companyTotalBefore &&
    Math.abs(
      Math.round((afterSumBranches + unmappedAfter) * 1000) / 1000 -
        companyTotalAfter,
    ) === 0;

  // Clean up test override via DELETE
  const delRes = await terminalMappingsDelete(
    new NextRequest(
      'https://aetherbi.com/api/erp/terminal-mappings?terminal_id=' +
        targetTerm.terminal_id,
      {
        method: 'DELETE',
        headers: { cookie: EXEC_SESSION_COOKIE + '=' + tokAdmin },
      },
    ),
  );
  resetAdminPosTerminalMappingsForTests();
  bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true });

  console.log(
    JSON.stringify({
      allSixRolesPresent:
        Object.keys(EXEC_ROLE_PROFILES).sort().join(',') ===
        'admin,auditor,cfo,dgm,gm,ops',
      opsAuthOk:
        opsCred.valid === true &&
        opsCred.role === 'ops' &&
        opsCred.titleEn === 'Operations Manager' &&
        opsCred.titleAr === 'مدير العمليات' &&
        opsLoginRes.status === 200 &&
        opsLoginJson.role === 'ops' &&
        opsLoginJson.titleEn === 'Operations Manager' &&
        opsLoginJson.titleAr === 'مدير العمليات' &&
        opsSetCookie.includes(EXEC_SESSION_COOKIE) &&
        opsSetCookie.toLowerCase().includes('httponly') &&
        verOps?.role === 'ops',
      cfoAuthOk:
        cfoCred.valid === true &&
        cfoCred.role === 'cfo' &&
        cfoCred.titleEn === 'Finance Manager (CFO)' &&
        cfoCred.titleAr === 'المدير المالي' &&
        finCred.valid === true &&
        finCred.role === 'cfo' &&
        cfoLoginRes.status === 200 &&
        cfoLoginJson.role === 'cfo' &&
        cfoLoginJson.titleEn === 'Finance Manager (CFO)' &&
        cfoLoginJson.titleAr === 'المدير المالي' &&
        cfoSetCookie.includes(EXEC_SESSION_COOKIE) &&
        finLoginRes.status === 200 &&
        finLoginJson.role === 'cfo' &&
        verCfo?.role === 'cfo',
      crossPwRejected: !wrongOpsCred.valid && !wrongCfoCred.valid,
      erpRoutesFullAccess: opsBlockedRoutes === 0 && cfoBlockedRoutes === 0,
      opsCfoSyncAllowed:
        opsSyncGet.status === 200 &&
        opsSyncPost.status === 200 &&
        cfoSyncGet.status === 200,
      auditorStrict403:
        audSyncPost.status === 403 &&
        audGovPost.status === 403 &&
        audMwFeryal.status === 403,
      unauthMapStatus: unauthMapGet.status,
      allNonAdmin403: nonAdminStatuses.every((st) => st === 403),
      branchDropdownCount: initJson.branchOptions?.length ?? 0,
      branchLabelsEn: (initJson.branchOptions ?? []).map((b) => b.labelEn),
      discoveredUnmappedCount: initJson.unmappedTerminals?.length ?? 0,
      hasTerminalFields:
        typeof targetTerm?.terminal_id === 'number' &&
        typeof targetTerm?.terminal_name === 'string' &&
        typeof targetTerm?.orders_count === 'number' &&
        typeof targetTerm?.net_sales_kwd === 'number',
      reallocationExact:
        initRes.status === 200 &&
        saveRes.status === 200 &&
        delRes.status === 200 &&
        initEquationOk &&
        salmiyaIncreasedExact &&
        unmappedDecreasedExact &&
        afterEquationOk,
      companyTotalKwd: companyTotalAfter,
    }),
  );
})();
`

const rawOut = execFileSync(
  process.execPath,
  [tsxCli, '-r', serverOnlyShimPath, '-e', runtimeProbeScript],
  { cwd: ROOT, encoding: 'utf8' },
).trim()
const probe = JSON.parse(rawOut.split('\n').pop() ?? '{}')

assert(
  probe.allSixRolesPresent === true &&
    probe.opsAuthOk === true &&
    probe.cfoAuthOk === true &&
    probe.crossPwRejected === true &&
    probe.erpRoutesFullAccess === true &&
    probe.opsCfoSyncAllowed === true,
  '1) Executive Accounts (ops & cfo + finance@ alias): Authenticate cleanly via salted SHA-256 & /api/auth/login, resolve exact bilingual role titles (Operations Manager / مدير العمليات & Finance Manager (CFO) / المدير المالي), and access all 13 ERP routes + Odoo sync',
)

assert(
  probe.auditorStrict403 === true,
  '2) Read-Only Auditor Lockdown: auditor@venturefoodskw.com remains strictly blocked (403) across Odoo sync, governance, Feryal AI & POS terminal mapping mutations',
)

const expectedBranches = [
  'Salmiya',
  'Ardiya',
  'Al-Kout',
  'Promenade',
  '360',
  'The Avenues',
  'Assima',
]
assert(
  probe.unauthMapStatus === 401 &&
    probe.allNonAdmin403 === true &&
    probe.branchDropdownCount === 7 &&
    JSON.stringify(probe.branchLabelsEn) === JSON.stringify(expectedBranches) &&
    probe.discoveredUnmappedCount >= 1 &&
    probe.hasTerminalFields === true &&
    probe.reallocationExact === true,
  '3) Admin-Only /api/erp/terminal-mappings & POS Discovery: Blocks unauthenticated (401) & gm/dgm/ops/cfo/auditor (403), auto-discovers unmapped pos.config terminals across 7 branches, and reallocates sales with 0.000 KWD drift (sum(branches) + unmapped === companyTotals.netSalesKwd)',
  `discovered=${probe.discoveredUnmappedCount}, companyTotal=${probe.companyTotalKwd} KWD`,
)

// 4) Zero plain-text credentials in src/ AND .next/static client bundles
const PW_SALT = 'vf-aether-exec-2026-v1:'
const PROTECTED_HASHES = new Set([
  'bbe373a80dede4fb8bc435555707b1213a25f7387bee13f342c7e486cbc20fda', // abdullah@
  '218deb04287696d7cfc35ba2a0c8863ea54e678dc562d8c5e4cc04731529ecd3', // admin@
  '0778d6bf621ae9947a3cf0961371e5df3ebdb437545f45611a13c5afe0fa1080', // gm@
  '7c5a104c7a8b070cc8e2d98826a8c3fee478819ca69f73d6360e033db79302c2', // dgm@
  '886a00b530e565a3f2544f8103d4fdead97154ffd2e36995340738ae6ff4b8ef', // operations@
  'e7b409f0ff6fd09281f16366113ce65f540b42236be3a7cb6889e053b545de53', // cfo@ / finance@
  '93126eacc43acc1b7030b2c2960d5f9aeadcb2a14d3258a6126f119bde3a4dba', // auditor@
])

const runtimePlainTokens = [
  String.fromCharCode(79, 112, 115, 64, 50, 48, 50, 54),
  String.fromCharCode(67, 102, 111, 64, 50, 48, 50, 54),
]

const srcFiles = walkFiles(path.join(ROOT, 'src')).filter((f) =>
  /\.(ts|tsx|js|jsx|mjs|json)$/.test(f),
)
const quotedRe = /['"`]([^'"`\r\n]{4,128})['"`]/g
let srcPlainLeaks = 0
for (const fp of srcFiles) {
  const txt = fs.readFileSync(fp, 'utf8')
  for (const tok of runtimePlainTokens) {
    if (txt.includes(tok)) srcPlainLeaks += 1
  }
  let m
  while ((m = quotedRe.exec(txt)) !== null) {
    const h = crypto.createHash('sha256').update(`${PW_SALT}${m[1]}`).digest('hex')
    if (PROTECTED_HASHES.has(h)) srcPlainLeaks += 1
  }
}

const nextStaticDir = path.join(ROOT, '.next', 'static')
const staticBundleFiles = walkFiles(nextStaticDir).filter((f) =>
  /\.(js|mjs|css|json)$/.test(f),
)
let staticBundleLeaks = 0
const forbiddenBundleMarkers = [
  ...runtimePlainTokens,
  'vf-aether-exec-2026-v1:',
  '886a00b530e565a3f2544f8103d4fdead97154ffd2e36995340738ae6ff4b8ef',
  'e7b409f0ff6fd09281f16366113ce65f540b42236be3a7cb6889e053b545de53',
]
for (const bf of staticBundleFiles) {
  const content = fs.readFileSync(bf, 'utf8')
  for (const marker of forbiddenBundleMarkers) {
    if (content.includes(marker)) {
      staticBundleLeaks += 1
    }
  }
}

assert(
  srcPlainLeaks === 0 && staticBundleLeaks === 0,
  `4) Zero Plain-Text Credential Leaks: 0 plaintext passwords in src/ (${srcFiles.length} files) and 0 credential/digest leaks in .next/static (${staticBundleFiles.length} built chunks scanned)`,
)

console.log('\n----------------------------------------------------------------------')
if (failed > 0) {
  console.error(`❌ ERP Fixes Test Suite FAILED: ${failed} failed, ${passed} passed.`)
  process.exit(1)
} else {
  console.log(`✅ ALL ${passed} RBAC & POS DISCOVERY CHECKS PASSED!`)
  process.exit(0)
}
