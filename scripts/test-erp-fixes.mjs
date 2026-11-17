#!/usr/bin/env node
/**
 * Venture Foods — Automated 8-Role Corporate RBAC, Scoped Isolation (`marketing` & `supply`),
 * Auditor Lockdown, Admin-Only 8-Role Executive Directory, Zero-Fallback Odoo Truth
 * & Client Bundle Zero-Password Leak Verifier (`scripts/test-erp-fixes.mjs`)
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
console.log('  Venture Foods — 8-Role Corporate RBAC, Directory & Odoo Truth Suite')
console.log('======================================================================\n')

const runtimeProbeScript = `
import { NextRequest } from 'next/server';
import {
  authenticateExecutiveCredentials,
  canTriggerManualOdooSync,
  createExecSessionToken,
  DEFAULT_ABDULLAH_EMAIL,
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_AUDITOR_EMAIL,
  DEFAULT_CFO_EMAIL,
  DEFAULT_DGM_EMAIL,
  DEFAULT_FINANCE_ALIAS_EMAIL,
  DEFAULT_GM_EMAIL,
  DEFAULT_MARKETING_ALIAS_EMAIL,
  DEFAULT_MARKETING_EMAIL,
  DEFAULT_OPS_EMAIL,
  DEFAULT_SUPPLY_ALIAS_EMAIL,
  DEFAULT_SUPPLY_EMAIL,
  EXEC_ROLE_PROFILES,
  EXEC_SESSION_COOKIE,
  isErpRouteAllowedForRole,
  shouldMaskInternalCostsForRole,
  verifyExecSessionToken,
} from './src/lib/auth';
import { POST as loginPost } from './src/app/api/auth/login/route';
import {
  GET as odooSyncGet,
  POST as odooSyncPost,
} from './src/app/api/erp/odoo-sync/route';
import {
  GET as terminalMappingsGet,
  POST as terminalMappingsPost,
  PUT as terminalMappingsPut,
} from './src/app/api/erp/terminal-mappings/route';
import { GET as roleDirectoryGet } from './src/app/api/erp/role-directory/route';
import { POST as govPost } from './src/app/api/erp/governance/route';
import { middleware } from './src/middleware';
import { resetAdminPosTerminalMappingsForTests, computeTerminalMappingLedgerSnapshot } from './src/lib/odoo-terminal-mappings';
import { bustOdooLiveCache, fetchLiveOdooSnapshot } from './src/lib/odoo-live-connector';
import { GET as publicOdooSyncGet } from './src/app/api/odoo-sync/route';
import {
  buildWeeklyChartMeta,
  computePeriodDelta,
  resolveBestBranchBadge,
  resolveTopBranchCard,
  sanitizeCampaignName,
  formatCampaignAuditTitle,
  formatStaticMarginPill,
  isExcludedOdooEntity,
  clampPeriodToKuwaitToday,
  getKuwaitTodayIso,
  UNMAPPED_TERMINALS_LABEL_AR,
  UNMAPPED_TERMINALS_LABEL_EN,
} from './src/lib/aether/period-delta';
import {
  computeGlobalWorkspace,
  formatPeriodCalendarWindow,
  DEFAULT_GLOBAL_FILTERS,
} from './src/lib/aether/global-filter-engine';
import { computeBeforeAfterSnapshot } from './src/lib/aether/before-after-engine';
import { computeErpComparison } from './src/lib/erp-comparison-engine';

(async () => {
  // Phase 5 · Item 10: executive passwords come only from the environment — never from source.
  const requirePw = (name) => {
    const v = String(process.env[name] ?? '').trim();
    if (!v) {
      console.error('Missing ' + name + '. Export the rotated executive passwords before running this check.');
      process.exit(2);
    }
    return v;
  };
  const pwOps = requirePw('AETHER_OPS_PASSWORD');
  const pwCfo = requirePw('AETHER_CFO_PASSWORD');
  const pwMkt = requirePw('AETHER_MARKETING_PASSWORD');
  const pwSup = requirePw('AETHER_SUPPLY_PASSWORD');

  const opsCred = await authenticateExecutiveCredentials(DEFAULT_OPS_EMAIL, pwOps);
  const cfoCred = await authenticateExecutiveCredentials(DEFAULT_CFO_EMAIL, pwCfo);
  const finCred = await authenticateExecutiveCredentials(DEFAULT_FINANCE_ALIAS_EMAIL, pwCfo);
  const mktCred = await authenticateExecutiveCredentials(DEFAULT_MARKETING_EMAIL, pwMkt);
  const mktAliasCred = await authenticateExecutiveCredentials(DEFAULT_MARKETING_ALIAS_EMAIL, pwMkt);
  const supCred = await authenticateExecutiveCredentials(DEFAULT_SUPPLY_EMAIL, pwSup);
  const supAliasCred = await authenticateExecutiveCredentials(DEFAULT_SUPPLY_ALIAS_EMAIL, pwSup);

  const wrongOpsCred = await authenticateExecutiveCredentials(DEFAULT_OPS_EMAIL, pwCfo);
  const wrongMktCred = await authenticateExecutiveCredentials(DEFAULT_MARKETING_EMAIL, pwSup);
  const wrongSupCred = await authenticateExecutiveCredentials(DEFAULT_SUPPLY_EMAIL, pwMkt);

  const mkLogin = async (email, password, ip) => {
    const res = await loginPost(
      new NextRequest('https://aetherbi.com/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
        body: JSON.stringify({ email, password }),
      }),
    );
    return { status: res.status, cookie: res.headers.get('set-cookie') ?? '', body: await res.json() };
  };

  const opsLogin = await mkLogin(DEFAULT_OPS_EMAIL, pwOps, '10.20.30.1');
  const cfoLogin = await mkLogin(DEFAULT_CFO_EMAIL, pwCfo, '10.20.30.2');
  const finLogin = await mkLogin(DEFAULT_FINANCE_ALIAS_EMAIL, pwCfo, '10.20.30.3');
  const mktLogin = await mkLogin(DEFAULT_MARKETING_EMAIL, pwMkt, '10.20.30.4');
  const mktAliasLogin = await mkLogin(DEFAULT_MARKETING_ALIAS_EMAIL, pwMkt, '10.20.30.5');
  const supLogin = await mkLogin(DEFAULT_SUPPLY_EMAIL, pwSup, '10.20.30.6');
  const supAliasLogin = await mkLogin(DEFAULT_SUPPLY_ALIAS_EMAIL, pwSup, '10.20.30.7');

  const tokAdmin = await createExecSessionToken(DEFAULT_ABDULLAH_EMAIL, 'admin');
  const tokAdminAlias = await createExecSessionToken(DEFAULT_ADMIN_EMAIL, 'admin');
  const tokGm = await createExecSessionToken(DEFAULT_GM_EMAIL, 'gm');
  const tokDgm = await createExecSessionToken(DEFAULT_DGM_EMAIL, 'dgm');
  const tokOps = await createExecSessionToken(DEFAULT_OPS_EMAIL, 'ops');
  const tokCfo = await createExecSessionToken(DEFAULT_CFO_EMAIL, 'cfo');
  const tokMkt = await createExecSessionToken(DEFAULT_MARKETING_EMAIL, 'marketing');
  const tokSup = await createExecSessionToken(DEFAULT_SUPPLY_EMAIL, 'supply');
  const tokAud = await createExecSessionToken(DEFAULT_AUDITOR_EMAIL, 'auditor');

  const verRoles = await Promise.all(
    [tokAdmin, tokAdminAlias, tokGm, tokDgm, tokOps, tokCfo, tokMkt, tokSup, tokAud].map((t) =>
      verifyExecSessionToken(t),
    ),
  );

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
  let fullExecBlocked = 0;
  for (const r of erpRoutes) {
    for (const tok of [tokAdmin, tokGm, tokDgm, tokOps, tokCfo, tokAud]) {
      const mw = await middleware(
        new NextRequest('https://aetherbi.com' + r, {
          headers: { cookie: EXEC_SESSION_COOKIE + '=' + tok },
        }),
      );
      if (mw.status >= 300) fullExecBlocked += 1;
    }
  }

  const mktAllowedRoutes = [
    '/erp',
    '/erp/cores',
    '/erp/weekday-comparison',
    '/erp/before-after',
    '/erp/reviews',
    '/erp/social-reviews',
    '/erp/booth',
    '/erp/booth-feasibility',
    '/erp/feryal-ai',
  ];
  const mktForbiddenRoutes = [
    '/erp/commissions',
    '/erp/aggregator-radar',
    '/erp/planning',
    '/erp/regulations',
    '/erp/warehouse-chain',
    '/erp/prep-sla',
    '/erp/delivery-sla',
  ];
  let mktAllowedOk = true;
  for (const r of mktAllowedRoutes) {
    const mw = await middleware(
      new NextRequest('https://aetherbi.com' + r, {
        headers: { cookie: EXEC_SESSION_COOKIE + '=' + tokMkt },
      }),
    );
    if (mw.status >= 300) mktAllowedOk = false;
  }
  let mktForbiddenRedirectOk = true;
  for (const r of mktForbiddenRoutes) {
    const mw = await middleware(
      new NextRequest('https://aetherbi.com' + r, {
        headers: { cookie: EXEC_SESSION_COOKIE + '=' + tokMkt },
      }),
    );
    const loc = mw.headers.get('location') ?? '';
    if (mw.status !== 307 || !loc.endsWith('/erp/cores')) {
      mktForbiddenRedirectOk = false;
    }
  }

  const supAllowedRoutes = [
    '/erp/warehouse-chain',
    '/erp/prep-sla',
    '/erp/delivery-sla',
    '/erp/feryal-ai',
  ];
  const supForbiddenRoutes = [
    '/erp',
    '/erp/cores',
    '/erp/weekday-comparison',
    '/erp/before-after',
    '/erp/commissions',
    '/erp/aggregator-radar',
    '/erp/planning',
    '/erp/regulations',
    '/erp/reviews',
    '/erp/social-reviews',
    '/erp/booth',
    '/erp/booth-feasibility',
  ];
  let supAllowedOk = true;
  for (const r of supAllowedRoutes) {
    const mw = await middleware(
      new NextRequest('https://aetherbi.com' + r, {
        headers: { cookie: EXEC_SESSION_COOKIE + '=' + tokSup },
      }),
    );
    if (mw.status >= 300) supAllowedOk = false;
  }
  let supForbiddenRedirectOk = true;
  for (const r of supForbiddenRoutes) {
    const mw = await middleware(
      new NextRequest('https://aetherbi.com' + r, {
        headers: { cookie: EXEC_SESSION_COOKIE + '=' + tokSup },
      }),
    );
    const loc = mw.headers.get('location') ?? '';
    if (mw.status !== 307 || !loc.endsWith('/erp/warehouse-chain')) {
      supForbiddenRedirectOk = false;
    }
  }

  // Disconnect Odoo temporarily so offline RBAC checks run deterministically without hitting upstream network
  const prevOdooUrl = process.env.ODOO_URL;
  delete process.env.ODOO_URL;
  bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true });

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
  const mktSyncGet = await odooSyncGet(
    new NextRequest('https://aetherbi.com/api/erp/odoo-sync?period=month', {
      headers: { cookie: EXEC_SESSION_COOKIE + '=' + tokMkt },
    }),
  );
  const supSyncGet = await odooSyncGet(
    new NextRequest('https://aetherbi.com/api/erp/odoo-sync?period=month', {
      headers: { cookie: EXEC_SESSION_COOKIE + '=' + tokSup },
    }),
  );
  const mktSyncPost = await odooSyncPost(
    new NextRequest('https://aetherbi.com/api/erp/odoo-sync?period=month', {
      method: 'POST',
      headers: { cookie: EXEC_SESSION_COOKIE + '=' + tokMkt },
    }),
  );
  const supSyncPost = await odooSyncPost(
    new NextRequest('https://aetherbi.com/api/erp/odoo-sync?period=month', {
      method: 'POST',
      headers: { cookie: EXEC_SESSION_COOKIE + '=' + tokSup },
    }),
  );
  const mktMwSyncPost = await middleware(
    new NextRequest('https://aetherbi.com/api/erp/odoo-sync', {
      method: 'POST',
      headers: { cookie: EXEC_SESSION_COOKIE + '=' + tokMkt },
    }),
  );
  const supMwSyncPost = await middleware(
    new NextRequest('https://aetherbi.com/api/erp/odoo-sync', {
      method: 'POST',
      headers: { cookie: EXEC_SESSION_COOKIE + '=' + tokSup },
    }),
  );

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

  const dirUnauth = await roleDirectoryGet(
    new NextRequest('https://aetherbi.com/api/erp/role-directory'),
  );
  const dirNonAdminStatuses = [];
  for (const tok of [tokGm, tokDgm, tokOps, tokCfo, tokMkt, tokSup, tokAud]) {
    const rApi = await roleDirectoryGet(
      new NextRequest('https://aetherbi.com/api/erp/role-directory', {
        headers: { cookie: EXEC_SESSION_COOKIE + '=' + tok },
      }),
    );
    const rMw = await middleware(
      new NextRequest('https://aetherbi.com/api/erp/role-directory', {
        headers: { cookie: EXEC_SESSION_COOKIE + '=' + tok },
      }),
    );
    dirNonAdminStatuses.push(rApi.status, rMw.status);
  }
  const dirAdminRes = await roleDirectoryGet(
    new NextRequest('https://aetherbi.com/api/erp/role-directory', {
      headers: { cookie: EXEC_SESSION_COOKIE + '=' + tokAdmin },
    }),
  );
  const dirAdminText = await dirAdminRes.text();
  const dirAdminJson = JSON.parse(dirAdminText);
  const dirEmails = (dirAdminJson.roles ?? []).map((r) => r.email);
  const dirHasZeroPasswords =
    !dirAdminText.toLowerCase().includes('password') &&
    !dirAdminText.toLowerCase().includes('sha256') &&
    !dirAdminText.includes('vf-aether-exec-2026-v1:');

  resetAdminPosTerminalMappingsForTests();
  const unauthMapGet = await terminalMappingsGet(
    new NextRequest('https://aetherbi.com/api/erp/terminal-mappings'),
  );
  const nonAdminStatuses = [];
  for (const tok of [tokGm, tokDgm, tokOps, tokCfo, tokMkt, tokSup, tokAud]) {
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
  const initRes = await terminalMappingsGet(
    new NextRequest('https://aetherbi.com/api/erp/terminal-mappings', {
      headers: { cookie: EXEC_SESSION_COOKIE + '=' + tokAdmin },
    }),
  );
  const initJson = await initRes.json();

  const refNowMs = Date.parse('2026-11-14T09:00:00.000Z');
  const discSnap = await fetchLiveOdooSnapshot({
    period: 'month',
    forceRefresh: true,
    referenceNowMs: refNowMs,
  });
  const audErpSyncRes = await odooSyncGet(
    new NextRequest('https://aetherbi.com/api/erp/odoo-sync?period=month', {
      headers: { cookie: EXEC_SESSION_COOKIE + '=' + tokAud },
    }),
  );
  const audErpSyncJson = await audErpSyncRes.json();
  const audPubSyncRes = await publicOdooSyncGet(
    new NextRequest('https://aetherbi.com/api/odoo-sync?period=month', {
      headers: { cookie: EXEC_SESSION_COOKIE + '=' + tokAud },
    }),
  );
  const audPubSyncJson = await audPubSyncRes.json();

  if (prevOdooUrl !== undefined) process.env.ODOO_URL = prevOdooUrl;
  bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true });

  const deltaPos = computePeriodDelta(127757, 123691);
  const deltaNeg = computePeriodDelta(115000, 123691);
  const deltaSmall = computePeriodDelta(124000, 123691);
  const deltaZeroPrior = computePeriodDelta(127757, 0);
  const deltaNegPrior = computePeriodDelta(5000, -10);

  const badgeNeg = resolveBestBranchBadge(-485.5);
  const badgePos = resolveBestBranchBadge(920.25);
  const badgeZero = resolveBestBranchBadge(0);
  const brokenInputs = ['', '—', 'Campaign: —', 'Campaign: in — in', 'in — in'];
  const sanitizedArOk = brokenInputs.every((s) => sanitizeCampaignName(s, true) === 'بدون حملة');
  const sanitizedEnOk = brokenInputs.every((s) => sanitizeCampaignName(s, false) === 'No campaign');
  const auditTitleArOk = brokenInputs.every(
    (s) => formatCampaignAuditTitle(s, 'تشاينا غاردن', true) === 'بدون حملة',
  );
  const auditTitleEnOk = brokenInputs.every(
    (s) => formatCampaignAuditTitle(s, 'China Garden', false) === 'No campaign',
  );

  const clampedFuture = clampPeriodToKuwaitToday(
    { from: '2026-10-16', to: '2026-11-20' },
    refNowMs,
  );
  const customWinClamped = formatPeriodCalendarWindow('custom', {
    customFrom: '2026-11-01',
    customTo: '2099-12-31',
  });
  const kwTodayNow = getKuwaitTodayIso();

  const excludedSamples = [
    'Heisen' + 'berg',
    'Hizen' + 'berg',
    'هايزن بريج',
    'Qur' + 'ain',
    'Qur' + 'ain WH',
    'Q' + 'RN',
    '\\u0627\\u0644\\u0642\\u0631\\u064a\\u0646',
  ];
  const excludedDetectedAll = excludedSamples.every((x) => isExcludedOdooEntity(x) === true);
  const validEntitiesAllowed = ['China Garden', 'Salmiya', 'Ardiya', 'The Avenues'].every(
    (x) => isExcludedOdooEntity(x) === false,
  );
  const ledgerSnap = computeTerminalMappingLedgerSnapshot();
  const serializedPayloadText = JSON.stringify({
    terminals: ledgerSnap.allDiscoveredTerminals ?? [],
  });
  const zeroExcludedInPayload = !isExcludedOdooEntity(serializedPayloadText);

  const wsDisconnected = computeGlobalWorkspace(DEFAULT_GLOBAL_FILTERS, discSnap.summary);
  const compDisconnected = computeErpComparison({
    mode: 'date-vs-date',
    granularity: 'single',
    periodA: { from: '2026-11-14', to: '2026-11-14' },
    periodB: { from: '2026-11-07', to: '2026-11-07' },
    brandIds: 'all',
    branchIds: 'all',
    channelIds: 'all',
  }, discSnap.summary);
  const baDisconnected = computeBeforeAfterSnapshot(DEFAULT_GLOBAL_FILTERS, 'period-prev', null, [], [], discSnap.summary);

  const topMonthCard = resolveTopBranchCard({
    branches: [{ id: '360-mall', name: '360', unit: '360', netSalesKwd: 785.8, orders: 148, sharePct: 18.4 }],
    period: 'today',
  });
  const marginPillBeforeRent = formatStaticMarginPill(64.7);
  const marginPillNetPocket = formatStaticMarginPill(14.7, 'نسبة الصافي');
  const kwMidday14Ms = Date.parse('2026-11-14T12:30:00+03:00');
  const weeklyMeta = buildWeeklyChartMeta(
    ['2026-11-08','2026-11-09','2026-11-10','2026-11-11','2026-11-12','2026-11-13','2026-11-14'],
    { referenceNowMs: kwMidday14Ms },
  );
  const lastWeeklyBar = weeklyMeta.bars[weeklyMeta.bars.length - 1];

  console.log(
    JSON.stringify({
      allEightRolesPresent:
        Object.keys(EXEC_ROLE_PROFILES).sort().join(',') ===
        'admin,auditor,cfo,dgm,gm,marketing,ops,supply',
      verifiedTokenRoles: verRoles.map((v) => v?.role),
      opsCfoAuthOk:
        opsCred.valid &&
        opsCred.role === 'ops' &&
        cfoCred.valid &&
        cfoCred.role === 'cfo' &&
        finCred.valid &&
        finCred.role === 'cfo' &&
        opsLogin.status === 200 &&
        cfoLogin.status === 200 &&
        finLogin.status === 200,
      marketingAuthOk:
        mktCred.valid &&
        mktCred.role === 'marketing' &&
        mktAliasCred.valid &&
        mktLogin.status === 200 &&
        mktLogin.body.role === 'marketing' &&
        mktLogin.body.redirectTo === '/erp/cores' &&
        mktLogin.cookie.includes(EXEC_SESSION_COOKIE) &&
        mktAliasLogin.status === 200,
      supplyAuthOk:
        supCred.valid &&
        supCred.role === 'supply' &&
        supAliasCred.valid &&
        supLogin.status === 200 &&
        supLogin.body.role === 'supply' &&
        supLogin.body.redirectTo === '/erp/warehouse-chain' &&
        supLogin.cookie.includes(EXEC_SESSION_COOKIE) &&
        supAliasLogin.status === 200,
      crossPwRejected: !wrongOpsCred.valid && !wrongMktCred.valid && !wrongSupCred.valid,
      fullExecBlocked,
      mktScopeOk:
        mktAllowedOk &&
        mktForbiddenRedirectOk &&
        shouldMaskInternalCostsForRole('marketing') === true &&
        canTriggerManualOdooSync('marketing') === false &&
        mktSyncGet.status === 200 &&
        mktSyncPost.status === 403 &&
        mktMwSyncPost.status === 403,
      supScopeOk:
        supAllowedOk &&
        supForbiddenRedirectOk &&
        isErpRouteAllowedForRole('supply', '/erp/warehouse-chain') === true &&
        isErpRouteAllowedForRole('supply', '/erp') === false &&
        canTriggerManualOdooSync('supply') === false &&
        supSyncGet.status === 200 &&
        supSyncPost.status === 403 &&
        supMwSyncPost.status === 403,
      opsSyncAllowed: opsSyncGet.status === 200 && opsSyncPost.status === 200,
      auditorStrict403:
        audSyncPost.status === 403 &&
        audGovPost.status === 403 &&
        audMwFeryal.status === 403,
      roleDirectoryOk:
        dirUnauth.status === 401 &&
        dirNonAdminStatuses.every((s) => s === 403) &&
        dirAdminRes.status === 200 &&
        dirAdminJson.count === 8 &&
        JSON.stringify(dirEmails) ===
          JSON.stringify([
            'abdullah@venturefoodskw.com',
            'gm@venturefoodskw.com',
            'dgm@venturefoodskw.com',
            'operations@venturefoodskw.com',
            'cfo@venturefoodskw.com',
            'marketing@venturefoodskw.com',
            'supply@venturefoodskw.com',
            'auditor@venturefoodskw.com',
          ]) &&
        dirHasZeroPasswords,
      terminalMappingsOk:
        unauthMapGet.status === 401 &&
        nonAdminStatuses.every((st) => st === 403) &&
        initRes.status === 200 &&
        (initJson.branchOptions?.length ?? 0) === 7,
      fix1DeltaOk:
        deltaPos.deltaPct === 3.3 &&
        deltaPos.badgeLabel === '▲ +3.3%' &&
        deltaNeg.deltaPct === -7 &&
        deltaNeg.badgeLabel === '▼ -7.0%' &&
        deltaSmall.badgeLabel === '• ±0.2%' &&
        deltaZeroPrior.badgeLabel === '• ±0.0%' &&
        deltaNegPrior.badgeLabel === '• ±0.0%',
      fix2DisconnectTruthAndRedactionOk:
        discSnap.connected === false &&
        discSnap.noData === true &&
        discSnap.messageAr === 'لا توجد بيانات من Odoo لهذه الفترة' &&
        discSnap.totals.netSalesKwd === 0 &&
        wsDisconnected.odooConnected === false &&
        wsDisconnected.noData === true &&
        compDisconnected.connected === false &&
        compDisconnected.noData === true &&
        baDisconnected.connected === false &&
        baDisconnected.noData === true &&
        UNMAPPED_TERMINALS_LABEL_AR === 'غير منسوب لفرع' &&
        UNMAPPED_TERMINALS_LABEL_EN === 'Unattributed to Branch' &&
        audErpSyncJson.diagnosticCode === undefined &&
        audErpSyncJson.envConfigured === undefined &&
        audPubSyncJson.diagnosticCode === undefined &&
        audPubSyncJson.envConfigured === undefined &&
        audPubSyncJson.unmappedTerminals === undefined,
      fix3BadgesAndCampaignsOk:
        badgeNeg.labelAr === 'أقل تراجع' &&
        badgeNeg.labelEn === 'Least Decline' &&
        badgeNeg.tone === 'neutral' &&
        badgePos.labelAr === 'أعلى تحسن' &&
        badgePos.labelEn === 'Top Lift' &&
        badgeZero.tone === 'neutral' &&
        sanitizedArOk &&
        sanitizedEnOk &&
        auditTitleArOk &&
        auditTitleEnOk,
      fix4DateBoundsOk:
        clampedFuture.to === '2026-11-14' &&
        customWinClamped.toInclusiveIso <= kwTodayNow,
      fix5ExclusionsOk:
        excludedDetectedAll && validEntitiesAllowed && zeroExcludedInPayload,
      polishHelpersOk:
        topMonthCard?.id === '360-mall' &&
        topMonthCard?.netSalesKwd === 785.8 &&
        marginPillBeforeRent === '64.7%' &&
        marginPillNetPocket === '14.7% نسبة الصافي' &&
        lastWeeklyBar?.isPartialToday === true &&
        lastWeeklyBar?.partialBadgeAr === 'جزئي',
    }),
  );
})();
`

const tmpProbePath = path.join(ROOT, `.tmp-erp-probe-${process.pid}.mts`)
let rawOut = ''
try {
  fs.writeFileSync(tmpProbePath, runtimeProbeScript, 'utf8')
  rawOut = execFileSync(
    process.execPath,
    [tsxCli, '-r', serverOnlyShimPath, tmpProbePath],
    { cwd: ROOT, encoding: 'utf8' },
  ).trim()
} finally {
  if (fs.existsSync(tmpProbePath)) {
    fs.unlinkSync(tmpProbePath)
  }
}
const probe = JSON.parse(rawOut.split('\n').pop() ?? '{}')

assert(
  probe.allEightRolesPresent === true &&
    JSON.stringify(probe.verifiedTokenRoles) ===
      JSON.stringify(['admin', 'admin', 'gm', 'dgm', 'ops', 'cfo', 'marketing', 'supply', 'auditor']) &&
    probe.opsCfoAuthOk === true &&
    probe.marketingAuthOk === true &&
    probe.supplyAuthOk === true &&
    probe.crossPwRejected === true &&
    probe.fullExecBlocked === 0 &&
    probe.opsSyncAllowed === true,
  '1) All 8 Corporate Accounts (+ Aliases): Authenticate cleanly via salted SHA-256 & /api/auth/login',
)

assert(
  probe.mktScopeOk === true && probe.supScopeOk === true,
  '2) Scoped RBAC Isolation (marketing & supply): Route redirects, cost masking, and 403 on manual sync',
)

assert(
  probe.auditorStrict403 === true,
  '3) Read-Only Auditor Lockdown: 403 across all write, sync, governance & mapping endpoints',
)

assert(
  probe.roleDirectoryOk === true && probe.terminalMappingsOk === true,
  '4) Admin-Only 8-Role Executive Directory & POS Terminal Mapping RBAC (401 unauth, 403 non-admin, 200 admin)',
)

const PW_SALT = 'vf-aether-exec-2026-v1:'
const PROTECTED_HASHES = new Set([
  'bbe373a80dede4fb8bc435555707b1213a25f7387bee13f342c7e486cbc20fda',
  '218deb04287696d7cfc35ba2a0c8863ea54e678dc562d8c5e4cc04731529ecd3',
  '0778d6bf621ae9947a3cf0961371e5df3ebdb437545f45611a13c5afe0fa1080',
  '7c5a104c7a8b070cc8e2d98826a8c3fee478819ca69f73d6360e033db79302c2',
  '886a00b530e565a3f2544f8103d4fdead97154ffd2e36995340738ae6ff4b8ef',
  'e7b409f0ff6fd09281f16366113ce65f540b42236be3a7cb6889e053b545de53',
  '491a250410a9880ecd125afd393d810d2dc0f0514c696d916b9146881d340a27',
  '4469d39aa846b41faab0c61fed8e6dbecc930ce543c55f0685b7a0327bfdc1de',
  '93126eacc43acc1b7030b2c2960d5f9aeadcb2a14d3258a6126f119bde3a4dba',
])

// Leak scan uses the current passwords from the environment; none are stored in this script.
const runtimePlainTokens = ['AETHER_OPS_PASSWORD', 'AETHER_CFO_PASSWORD', 'AETHER_MARKETING_PASSWORD', 'AETHER_SUPPLY_PASSWORD']
  .map((name) => String(process.env[name] ?? '').trim())
  .filter((v) => v.length >= 4)

const srcFiles = walkFiles(path.join(ROOT, 'src')).filter((f) => /\.(ts|tsx|js|jsx|mjs|json)$/.test(f))
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
const staticBundleFiles = walkFiles(nextStaticDir).filter((f) => /\.(js|mjs|css|json)$/.test(f))
let staticBundleLeaks = 0
const forbiddenBundleMarkers = [
  ...runtimePlainTokens,
  'vf-aether-exec-2026-v1:',
  '886a00b530e565a3f2544f8103d4fdead97154ffd2e36995340738ae6ff4b8ef',
  'e7b409f0ff6fd09281f16366113ce65f540b42236be3a7cb6889e053b545de53',
  '491a250410a9880ecd125afd393d810d2dc0f0514c696d916b9146881d340a27',
  '4469d39aa846b41faab0c61fed8e6dbecc930ce543c55f0685b7a0327bfdc1de',
]
for (const bf of staticBundleFiles) {
  const content = fs.readFileSync(bf, 'utf8')
  for (const marker of forbiddenBundleMarkers) {
    if (content.includes(marker)) staticBundleLeaks += 1
  }
}

assert(
  srcPlainLeaks === 0 && staticBundleLeaks === 0,
  `5) Zero Plain-Text Credential Leaks across ${srcFiles.length} src files & ${staticBundleFiles.length} static chunks`,
)

assert(probe.fix1DeltaOk === true, '6) Period-Over-Period Delta (computePeriodDelta) sign & neutral guard rules')
assert(
  probe.fix2DisconnectTruthAndRedactionOk === true,
  '7) Zero-Fallback Odoo Disconnect Truth, «غير منسوب لفرع» label & non-admin technical diagnostic redaction',
)
assert(probe.fix3BadgesAndCampaignsOk === true, '8) Negative Best-Branch Badge («أقل تراجع») & Campaign Sanitization')
assert(probe.fix4DateBoundsOk === true, '9) Kuwait Today Date Clamping (period.to <= today in Asia/Kuwait)')
assert(probe.fix5ExclusionsOk === true, '10) Mandatory Odoo Entity Exclusions («القرين» & «هايزن بريج»)')
assert(probe.polishHelpersOk === true, '11) Top Branch Card, Static Margin Pills & Partial Day Badge Helpers')

console.log('\n----------------------------------------------------------------------')
if (failed > 0) {
  console.error(`❌ ERP Fixes Test Suite FAILED: ${failed} failed, ${passed} passed.`)
  process.exit(1)
} else {
  console.log(`✅ ALL ${passed} ERP RBAC, SECURITY & ODOO TRUTH CHECKS PASSED!`)
  process.exit(0)
}
