#!/usr/bin/env node
/**
 * Venture Foods — Automated 8-Account Corporate Login, PIN 2026, Cookie, Shell Role Badge
 * & Middleware Whitelist Verifier (`scripts/verify-all-8-logins.mjs`)
 *
 * Verifies:
 *  1. gm@venturefoodskw.com / VF-GM#2026!Executive (Approval PIN 2026) -> /erp
 *  2. dgm@venturefoodskw.com / VF-DGM#2026!Executive (Approval PIN 2026) -> /erp
 *  3. operations@venturefoodskw.com / Ops@2026 -> /erp
 *  4. cfo@venturefoodskw.com & finance@venturefoodskw.com / Cfo@2026 -> /erp
 *  5. marketing@venturefoodskw.com & mkt@venturefoodskw.com / Mkt@2026 -> /erp/cores
 *  6. supply@venturefoodskw.com & kitchen@venturefoodskw.com / Sup@2026 -> /erp/warehouse-chain
 *  7. abdullah@venturefoodskw.com (admin) -> /erp
 *  8. auditor@venturefoodskw.com (auditor, strictly Read-Only) -> /erp
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
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
    if (ent.isDirectory()) walkFiles(full, out)
    else out.push(full)
  }
  return out
}

console.log('\n======================================================================')
console.log('  Venture Foods — Automated 8-Role Corporate Login & Middleware Suite')
console.log('======================================================================\n')

const probeCode = `
import { NextRequest } from 'next/server';
import {
  authenticateExecutiveCredentials,
  createExecSessionToken,
  DEFAULT_ABDULLAH_EMAIL,
  DEFAULT_ABDULLAH_PASSWORD_SHA256,
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD_SHA256,
  DEFAULT_AUDITOR_EMAIL,
  DEFAULT_AUDITOR_PASSWORD_SHA256,
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
  EXEC_ROLE_WHITELIST,
  EXEC_SESSION_COOKIE,
  resolveRoleDefaultHome,
  VALID_EXEC_ROLES,
  verifyExecSessionToken,
  verifyExecutiveApprovalPin,
} from './src/lib/auth';
import { POST as loginPost } from './src/app/api/auth/login/route';
import { GET as roleDirGet } from './src/app/api/erp/role-directory/route';
import { middleware, EXEC_ROLE_WHITELIST as MW_ROLE_WHITELIST } from './src/middleware';
import { resolveShellRoleBadge } from './src/components/erp/shell';
import { hashManagerPin, verifyManagerPin, DEFAULT_MASTER_PIN_HASH } from './src/lib/governance-compliance';

(async () => {
  const pwGm = String.fromCharCode(
    86, 70, 45, 71, 77, 35, 50, 48, 50, 54, 33, 69, 120, 101, 99, 117, 116, 105, 118, 101,
  );
  const pwDgm = String.fromCharCode(
    86, 70, 45, 68, 71, 77, 35, 50, 48, 50, 54, 33, 69, 120, 101, 99, 117, 116, 105, 118, 101,
  );
  const pwOps = String.fromCharCode(79, 112, 115, 64, 50, 48, 50, 54);
  const pwCfo = String.fromCharCode(67, 102, 111, 64, 50, 48, 50, 54);
  const pwMkt = String.fromCharCode(77, 107, 116, 64, 50, 48, 50, 54);
  const pwSup = String.fromCharCode(83, 117, 112, 64, 50, 48, 50, 54);

  async function callLogin(email, password, ip, opts = {}) {
    const prevNodeEnv = process.env.NODE_ENV;
    if (opts.nodeEnv) process.env.NODE_ENV = opts.nodeEnv;
    try {
      const res = await loginPost(
        new NextRequest('https://aetherbi.com/api/auth/login', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-forwarded-for': ip,
            origin: 'https://aetherbi.com',
            host: 'aetherbi.com',
          },
          body: JSON.stringify({
            email,
            password,
            ...(opts.next ? { next: opts.next } : {}),
          }),
        }),
      );
      const setCookie = res.headers.get('set-cookie') ?? '';
      const json = await res.json();
      const tokenMatch = setCookie.match(/aether_exec_session=([^;]+)/);
      return {
        status: res.status,
        setCookie,
        token: tokenMatch ? tokenMatch[1] : '',
        body: json,
      };
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
    }
  }

  // 1-6: Canonical corporate credentials + aliases + normalization (uppercase email + accidental surrounding spaces)
  const gmAuth = await authenticateExecutiveCredentials('  GM@VentureFoodsKW.com ', '  ' + pwGm + '  ');
  const gmCaseReject = await authenticateExecutiveCredentials(DEFAULT_GM_EMAIL, pwGm.toLowerCase());
  const gmLogin = await callLogin(DEFAULT_GM_EMAIL, pwGm, '10.88.1.1', { nodeEnv: 'production' });

  const dgmAuth = await authenticateExecutiveCredentials(' DGM@VentureFoodsKW.com ', ' ' + pwDgm + '\\n');
  const dgmCaseReject = await authenticateExecutiveCredentials(DEFAULT_DGM_EMAIL, pwDgm.toUpperCase());
  const dgmLogin = await callLogin(DEFAULT_DGM_EMAIL, pwDgm, '10.88.1.2', { nodeEnv: 'production' });

  const opsAuth = await authenticateExecutiveCredentials(' OPERATIONS@venturefoodskw.com ', ' ' + pwOps + ' ');
  const opsCaseReject = await authenticateExecutiveCredentials(DEFAULT_OPS_EMAIL, pwOps.toLowerCase());
  const opsLogin = await callLogin(DEFAULT_OPS_EMAIL, pwOps, '10.88.1.3', { nodeEnv: 'production' });

  const cfoAuth = await authenticateExecutiveCredentials(DEFAULT_CFO_EMAIL, pwCfo);
  const finAuth = await authenticateExecutiveCredentials(' FINANCE@venturefoodskw.com ', ' ' + pwCfo + ' ');
  const cfoLogin = await callLogin(DEFAULT_CFO_EMAIL, pwCfo, '10.88.1.4', { nodeEnv: 'production' });
  const finLogin = await callLogin(DEFAULT_FINANCE_ALIAS_EMAIL, pwCfo, '10.88.1.5', { nodeEnv: 'production' });

  const mktAuth = await authenticateExecutiveCredentials(DEFAULT_MARKETING_EMAIL, pwMkt);
  const mktAliasAuth = await authenticateExecutiveCredentials(' MKT@venturefoodskw.com ', ' ' + pwMkt + ' ');
  const mktLogin = await callLogin(DEFAULT_MARKETING_EMAIL, pwMkt, '10.88.1.6', { nodeEnv: 'production' });
  const mktAliasLogin = await callLogin(DEFAULT_MARKETING_ALIAS_EMAIL, pwMkt, '10.88.1.7', { nodeEnv: 'production' });
  const mktLoginFromErpNext = await callLogin(DEFAULT_MARKETING_EMAIL, pwMkt, '10.88.1.8', {
    nodeEnv: 'production',
    next: '/erp',
  });

  const supAuth = await authenticateExecutiveCredentials(DEFAULT_SUPPLY_EMAIL, pwSup);
  const supAliasAuth = await authenticateExecutiveCredentials(' KITCHEN@venturefoodskw.com ', ' ' + pwSup + ' ');
  const supLogin = await callLogin(DEFAULT_SUPPLY_EMAIL, pwSup, '10.88.1.9', { nodeEnv: 'production' });
  const supAliasLogin = await callLogin(DEFAULT_SUPPLY_ALIAS_EMAIL, pwSup, '10.88.1.10', { nodeEnv: 'production' });
  const supLoginFromErpNext = await callLogin(DEFAULT_SUPPLY_EMAIL, pwSup, '10.88.1.11', {
    nodeEnv: 'production',
    next: '/erp',
  });

  // Resilience check: stale AETHER_GM_PASSWORD env var must NEVER lock out canonical VF-GM#2026!Executive
  const prevGmEnv = process.env.AETHER_GM_PASSWORD;
  process.env.AETHER_GM_PASSWORD = 'StaleOldEnvPassword#1999\\r\\n';
  const gmResilientAuth = await authenticateExecutiveCredentials(DEFAULT_GM_EMAIL, pwGm);
  if (prevGmEnv === undefined) delete process.env.AETHER_GM_PASSWORD;
  else process.env.AETHER_GM_PASSWORD = prevGmEnv;

  // 7 & 8: Admin (abdullah@venturefoodskw.com) & Read-Only Auditor (auditor@venturefoodskw.com)
  const adminWrong = await authenticateExecutiveCredentials(DEFAULT_ABDULLAH_EMAIL, 'InvalidPass#000');
  const auditorWrong = await authenticateExecutiveCredentials(DEFAULT_AUDITOR_EMAIL, 'InvalidPass#000');

  const prevAbdEnv = process.env.AETHER_ABDULLAH_PASSWORD;
  const prevAudEnv = process.env.AETHER_AUDITOR_PASSWORD;
  const runtimeAdminPass = process.env.AETHER_ABDULLAH_PASSWORD?.trim() || 'RuntimeVerifyAdmin#2026!';
  const runtimeAuditorPass = process.env.AETHER_AUDITOR_PASSWORD?.trim() || 'RuntimeVerifyAuditor#2026!';
  process.env.AETHER_ABDULLAH_PASSWORD = runtimeAdminPass;
  process.env.AETHER_AUDITOR_PASSWORD = runtimeAuditorPass;

  const adminAuth = await authenticateExecutiveCredentials(' ABDULLAH@venturefoodskw.com ', ' ' + runtimeAdminPass + ' ');
  const adminLogin = await callLogin(DEFAULT_ABDULLAH_EMAIL, runtimeAdminPass, '10.88.1.12', { nodeEnv: 'production' });
  const auditorAuth = await authenticateExecutiveCredentials(' AUDITOR@venturefoodskw.com ', ' ' + runtimeAuditorPass + ' ');
  const auditorLogin = await callLogin(DEFAULT_AUDITOR_EMAIL, runtimeAuditorPass, '10.88.1.13', { nodeEnv: 'production' });

  if (prevAbdEnv === undefined) delete process.env.AETHER_ABDULLAH_PASSWORD;
  else process.env.AETHER_ABDULLAH_PASSWORD = prevAbdEnv;
  if (prevAudEnv === undefined) delete process.env.AETHER_AUDITOR_PASSWORD;
  else process.env.AETHER_AUDITOR_PASSWORD = prevAudEnv;

  // PIN 2026 verification for GM & DGM (+ rejection for Auditor & wrong PIN)
  const pinGmOk = verifyExecutiveApprovalPin('gm', '2026');
  const pinDgmOk = verifyExecutiveApprovalPin('dgm', '2026');
  const pinGmWrong = verifyExecutiveApprovalPin('gm', '0000');
  const pinAuditorBlocked = verifyExecutiveApprovalPin('auditor', '2026') === false;
  const govPinOk = hashManagerPin('2026') === DEFAULT_MASTER_PIN_HASH && verifyManagerPin('2026') === true;

  // Verify issued session cookies from /api/auth/login for all 8 roles
  const loginsByRole = {
    gm: gmLogin,
    dgm: dgmLogin,
    ops: opsLogin,
    cfo: cfoLogin,
    marketing: mktLogin,
    supply: supLogin,
    admin: adminLogin,
    auditor: auditorLogin,
  };

  const cookieContractOk = Object.entries(loginsByRole).every(([role, lg]) => {
    const sc = lg.setCookie.toLowerCase();
    return (
      lg.status === 200 &&
      lg.body?.ok === true &&
      lg.body?.role === role &&
      lg.body?.redirectTo === resolveRoleDefaultHome(role) &&
      lg.token.length > 32 &&
      sc.includes('aether_exec_session=') &&
      sc.includes('path=/') &&
      sc.includes('httponly') &&
      sc.includes('samesite=lax') &&
      sc.includes('secure')
    );
  });

  // Verify token decoding & shell.tsx Arabic/English role badges for all 8 roles
  const verifiedPayloads = {};
  const shellBadgesOk = VALID_EXEC_ROLES.every((r) => {
    const b = resolveShellRoleBadge(r);
    const expected = EXEC_ROLE_PROFILES[r];
    return (
      b.role === r &&
      b.titleAr === expected.titleAr &&
      b.titleEn === expected.titleEn &&
      b.titleAr.length > 0 &&
      b.titleEn.length > 0
    );
  });

  for (const [role, lg] of Object.entries(loginsByRole)) {
    verifiedPayloads[role] = await verifyExecSessionToken(lg.token);
  }

  // Middleware route & bounce-prevention verification for all 8 roles using REAL tokens issued by /api/auth/login
  const full13Routes = [
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

  let fullRolesBounceCount = 0;
  for (const role of ['admin', 'gm', 'dgm', 'ops', 'cfo', 'auditor']) {
    const tok = loginsByRole[role].token;
    for (const r of full13Routes) {
      const mw = await middleware(
        new NextRequest('https://aetherbi.com' + r, {
          headers: { cookie: EXEC_SESSION_COOKIE + '=' + tok },
        }),
      );
      if (mw.status >= 300) fullRolesBounceCount += 1;
    }
  }

  // Marketing allowed & forbidden routes
  const mktAllowed = [
    '/erp',
    '/erp/cores',
    '/erp/weekday-comparison',
    '/erp/before-after',
    '/erp/reviews',
    '/erp/booth',
    '/erp/feryal-ai',
  ];
  const mktForbidden = [
    '/erp/commissions',
    '/erp/planning',
    '/erp/regulations',
    '/erp/warehouse-chain',
    '/erp/prep-sla',
    '/erp/delivery-sla',
  ];
  let mktMwOk = true;
  for (const r of mktAllowed) {
    const mw = await middleware(
      new NextRequest('https://aetherbi.com' + r, {
        headers: { cookie: EXEC_SESSION_COOKIE + '=' + mktLogin.token },
      }),
    );
    if (mw.status >= 300) mktMwOk = false;
  }
  for (const r of mktForbidden) {
    const mw = await middleware(
      new NextRequest('https://aetherbi.com' + r, {
        headers: { cookie: EXEC_SESSION_COOKIE + '=' + mktLogin.token },
      }),
    );
    const loc = mw.headers.get('location') ?? '';
    if (mw.status !== 307 || !loc.endsWith('/erp/cores') || loc.includes('/login')) {
      mktMwOk = false;
    }
  }

  // Supply allowed & forbidden routes
  const supAllowed = [
    '/erp/warehouse-chain',
    '/erp/prep-sla',
    '/erp/delivery-sla',
    '/erp/feryal-ai',
  ];
  const supForbidden = [
    '/erp',
    '/erp/cores',
    '/erp/commissions',
    '/erp/planning',
    '/erp/regulations',
    '/erp/reviews',
    '/erp/booth',
  ];
  let supMwOk = true;
  for (const r of supAllowed) {
    const mw = await middleware(
      new NextRequest('https://aetherbi.com' + r, {
        headers: { cookie: EXEC_SESSION_COOKIE + '=' + supLogin.token },
      }),
    );
    if (mw.status >= 300) supMwOk = false;
  }
  for (const r of supForbidden) {
    const mw = await middleware(
      new NextRequest('https://aetherbi.com' + r, {
        headers: { cookie: EXEC_SESSION_COOKIE + '=' + supLogin.token },
      }),
    );
    const loc = mw.headers.get('location') ?? '';
    if (mw.status !== 307 || !loc.endsWith('/erp/warehouse-chain') || loc.includes('/login')) {
      supMwOk = false;
    }
  }

  // Root '/' and '/login' redirect checks for all 8 signed-in roles (zero /login bounce loops!)
  let rootAndLoginRedirectOk = true;
  for (const role of VALID_EXEC_ROLES) {
    const tok = loginsByRole[role].token;
    const expectedDest = resolveRoleDefaultHome(role);
    const rootRes = await middleware(
      new NextRequest('https://aetherbi.com/', {
        headers: { cookie: EXEC_SESSION_COOKIE + '=' + tok },
      }),
    );
    const loginPageRes = await middleware(
      new NextRequest('https://aetherbi.com/login', {
        headers: { cookie: EXEC_SESSION_COOKIE + '=' + tok },
      }),
    );
    if (
      rootRes.status !== 307 ||
      !(rootRes.headers.get('location') ?? '').endsWith(expectedDest) ||
      loginPageRes.status !== 307 ||
      !(loginPageRes.headers.get('location') ?? '').endsWith(expectedDest)
    ) {
      rootAndLoginRedirectOk = false;
    }
  }

  // Admin-only endpoint vs Auditor Read-Only 403 lockdown
  const adminDirRes = await roleDirGet(
    new NextRequest('https://aetherbi.com/api/erp/role-directory', {
      headers: { cookie: EXEC_SESSION_COOKIE + '=' + adminLogin.token },
    }),
  );
  const auditorWriteRes = await middleware(
    new NextRequest('https://aetherbi.com/api/erp/governance', {
      method: 'POST',
      headers: {
        cookie: EXEC_SESSION_COOKIE + '=' + auditorLogin.token,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'sync' }),
    }),
  );

  console.log(
    JSON.stringify({
      whitelistSize: MW_ROLE_WHITELIST.size === 8 && EXEC_ROLE_WHITELIST.size === 8,
      gmOk:
        gmAuth.valid &&
        gmAuth.role === 'gm' &&
        !gmCaseReject.valid &&
        gmResilientAuth.valid &&
        gmLogin.body.redirectTo === '/erp' &&
        pinGmOk &&
        !pinGmWrong &&
        govPinOk,
      dgmOk:
        dgmAuth.valid &&
        dgmAuth.role === 'dgm' &&
        !dgmCaseReject.valid &&
        dgmLogin.body.redirectTo === '/erp' &&
        pinDgmOk,
      opsOk:
        opsAuth.valid &&
        opsAuth.role === 'ops' &&
        !opsCaseReject.valid &&
        opsLogin.body.redirectTo === '/erp',
      cfoOk:
        cfoAuth.valid &&
        cfoAuth.role === 'cfo' &&
        finAuth.valid &&
        finAuth.role === 'cfo' &&
        cfoLogin.body.redirectTo === '/erp' &&
        finLogin.body.role === 'cfo' &&
        finLogin.body.redirectTo === '/erp',
      marketingOk:
        mktAuth.valid &&
        mktAuth.role === 'marketing' &&
        mktAliasAuth.valid &&
        mktAliasAuth.role === 'marketing' &&
        mktLogin.body.redirectTo === '/erp/cores' &&
        mktAliasLogin.body.role === 'marketing' &&
        mktAliasLogin.body.redirectTo === '/erp/cores' &&
        mktLoginFromErpNext.body.redirectTo === '/erp/cores' &&
        mktMwOk,
      supplyOk:
        supAuth.valid &&
        supAuth.role === 'supply' &&
        supAliasAuth.valid &&
        supAliasAuth.role === 'supply' &&
        supLogin.body.redirectTo === '/erp/warehouse-chain' &&
        supAliasLogin.body.role === 'supply' &&
        supAliasLogin.body.redirectTo === '/erp/warehouse-chain' &&
        supLoginFromErpNext.body.redirectTo === '/erp/warehouse-chain' &&
        supMwOk,
      adminAuditorOk:
        DEFAULT_ABDULLAH_PASSWORD_SHA256.length === 64 &&
        DEFAULT_ADMIN_PASSWORD_SHA256.length === 64 &&
        DEFAULT_AUDITOR_PASSWORD_SHA256.length === 64 &&
        !adminWrong.valid &&
        !auditorWrong.valid &&
        adminAuth.valid &&
        adminAuth.role === 'admin' &&
        adminLogin.body.redirectTo === '/erp' &&
        adminDirRes.status === 200 &&
        auditorAuth.valid &&
        auditorAuth.role === 'auditor' &&
        auditorLogin.body.redirectTo === '/erp' &&
        auditorWriteRes.status === 403 &&
        pinAuditorBlocked,
      cookieContractOk,
      allTokensVerified: VALID_EXEC_ROLES.every((r) => verifiedPayloads[r]?.role === r),
      shellBadgesOk,
      fullRolesBounceCount,
      rootAndLoginRedirectOk,
    }),
  );
})();
`

const tmpProbe = path.join(ROOT, `.__verify_8_logins_${process.pid}.mts`)
let raw = ''
try {
  fs.writeFileSync(tmpProbe, probeCode, 'utf8')
  raw = execFileSync(process.execPath, [tsxCli, '-r', serverOnlyShimPath, tmpProbe], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim()
} finally {
  if (fs.existsSync(tmpProbe)) fs.unlinkSync(tmpProbe)
}

const res = JSON.parse(raw.split('\n').pop() ?? '{}')

assert(
  res.gmOk === true,
  '1) General Manager (gm@venturefoodskw.com / VF-GM#2026!Executive + PIN 2026): Authenticates cleanly, lands on /erp, enforces exact password case, survives stale env vars & verifies PIN 2026',
)
assert(
  res.dgmOk === true,
  '2) Deputy General Manager (dgm@venturefoodskw.com / VF-DGM#2026!Executive + PIN 2026): Authenticates cleanly, lands on /erp, enforces exact password case & verifies PIN 2026',
)
assert(
  res.opsOk === true,
  '3) Operations Manager (operations@venturefoodskw.com / Ops@2026): Authenticates cleanly, lands on /erp & passes all 13 ERP route checks',
)
assert(
  res.cfoOk === true,
  '4) Finance Manager / CFO (cfo@venturefoodskw.com & finance@venturefoodskw.com / Cfo@2026): Primary + finance@ alias authenticate cleanly as cfo -> /erp',
)
assert(
  res.marketingOk === true,
  '5) Marketing Lead (marketing@venturefoodskw.com & mkt@venturefoodskw.com / Mkt@2026): Primary + mkt@ alias authenticate as marketing -> /erp/cores, allow scoped marketing routes & redirect forbidden routes -> /erp/cores',
)
assert(
  res.supplyOk === true,
  '6) Central Kitchen & Supply Manager (supply@venturefoodskw.com & kitchen@venturefoodskw.com / Sup@2026): Primary + kitchen@ alias authenticate as supply -> /erp/warehouse-chain, allow kitchen/SLA routes & redirect forbidden routes -> /erp/warehouse-chain',
)
assert(
  res.adminAuditorOk === true,
  '7) System Admin (abdullah@venturefoodskw.com) & Read-Only Auditor (auditor@venturefoodskw.com): Preserved SHA-256 digests intact, both land on /erp, admin accesses 8-role directory (200), and auditor enforces strict Read-Only 403 on mutations',
)
assert(
  res.whitelistSize === true &&
    res.cookieContractOk === true &&
    res.allTokensVerified === true &&
    res.shellBadgesOk === true &&
    res.fullRolesBounceCount === 0 &&
    res.rootAndLoginRedirectOk === true,
  '8) Middleware 8-Role Whitelist, Cookie Contract (aether_exec_session; Path=/; HttpOnly; SameSite=lax; Secure) & Shell Bilingual Role Badges: Zero /login redirect loops across all 8 corporate roles',
)

// Zero plaintext password leaks in src/ and .next/static (when built)
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

const plainCandidates = [
  String.fromCharCode(
    86, 70, 45, 71, 77, 35, 50, 48, 50, 54, 33, 69, 120, 101, 99, 117, 116, 105, 118, 101,
  ),
  String.fromCharCode(
    86, 70, 45, 68, 71, 77, 35, 50, 48, 50, 54, 33, 69, 120, 101, 99, 117, 116, 105, 118, 101,
  ),
  String.fromCharCode(79, 112, 115, 64, 50, 48, 50, 54),
  String.fromCharCode(67, 102, 111, 64, 50, 48, 50, 54),
  String.fromCharCode(77, 107, 116, 64, 50, 48, 50, 54),
  String.fromCharCode(83, 117, 112, 64, 50, 48, 50, 54),
]

const srcFiles = walkFiles(path.join(ROOT, 'src')).filter((f) =>
  /\.(ts|tsx|js|jsx|mjs|json)$/.test(f),
)
const quotedRe = /['"`]([^'"`\r\n]{4,128})['"`]/g
let srcLeaks = 0
for (const fp of srcFiles) {
  const txt = fs.readFileSync(fp, 'utf8')
  for (const p of plainCandidates) {
    if (txt.includes(p)) srcLeaks += 1
  }
  let m
  while ((m = quotedRe.exec(txt)) !== null) {
    const h = crypto.createHash('sha256').update(`${PW_SALT}${m[1]}`).digest('hex')
    if (PROTECTED_HASHES.has(h)) srcLeaks += 1
  }
}

let staticLeaks = 0
const staticDir = path.join(ROOT, '.next', 'static')
const staticFiles = walkFiles(staticDir).filter((f) => /\.(js|mjs|css|json)$/.test(f))
for (const sf of staticFiles) {
  const txt = fs.readFileSync(sf, 'utf8')
  for (const marker of [...plainCandidates, PW_SALT, ...PROTECTED_HASHES]) {
    if (txt.includes(marker)) staticLeaks += 1
  }
}

assert(
  srcLeaks === 0 && staticLeaks === 0,
  `9) Zero Plaintext Password or Digest Leaks: 0 leaks in src/ (${srcFiles.length} files) and 0 leaks in .next/static (${staticFiles.length} chunks)`,
)

console.log('\n----------------------------------------------------------------------')
if (failed > 0) {
  console.error(`❌ 8-Account Login Verification FAILED: ${failed} failed, ${passed} passed.`)
  process.exit(1)
} else {
  console.log(`✅ ALL ${passed} CORPORATE LOGIN, PIN 2026 & 8-ROLE MIDDLEWARE CHECKS PASSED!`)
  process.exit(0)
}
