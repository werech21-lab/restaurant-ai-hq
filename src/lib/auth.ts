/**
 * Unified Corporate Executive Authentication & RBAC Barrel (`src/lib/auth.ts`)
 *
 * 8 Corporate Roles:
 *   - `'admin'`     : System Admin & Executive Secretary (`abdullah@venturefoodskw.com` / `admin@venturefoodskw.com`)
 *   - `'gm'`        : General Manager (`gm@venturefoodskw.com`)
 *   - `'dgm'`       : Deputy General Manager (`dgm@venturefoodskw.com`)
 *   - `'ops'`       : Operations Manager (`operations@venturefoodskw.com` — `مدير العمليات`)
 *   - `'cfo'`       : Finance Manager / CFO (`cfo@venturefoodskw.com` + alias `finance@venturefoodskw.com` — `المدير المالي`)
 *   - `'marketing'` : Marketing Lead • GM & DGM Office (`marketing@venturefoodskw.com` + alias `mkt@venturefoodskw.com` — `مسؤول التسويق • مكتب المدير العام ونائبه`)
 *   - `'supply'`    : Central Kitchen & Supply Manager (`supply@venturefoodskw.com` + alias `kitchen@venturefoodskw.com` — `مدير المطبخ المركزي وسلسلة الإمداد`)
 *   - `'auditor'`   : External Read-Only Auditor (`auditor@venturefoodskw.com` — `مراجع — قراءة فقط`)
 *                     and the QA read-only login (`qa-readonly@venturefoodskw.com`, password from `AETHER_QA_PASSWORD` only)
 */

export {
  EXEC_ROLE_PROFILES,
  EXEC_ROLE_WHITELIST,
  isValidExecRole,
  normalizeExecSessionRole,
  resolveExecRoleProfile,
  toExecApproverRole,
  VALID_EXEC_ROLES,
  type ExecApproverRole,
  type ExecRole,
  type ExecRoleProfile,
  type ExecSessionRole,
} from '@/lib/auth/exec-role-meta'

export {
  authenticateExecutiveCredentials,
  createExecSessionToken,
  DEFAULT_ABDULLAH_EMAIL,
  DEFAULT_ABDULLAH_PASSWORD_SHA256,
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD_SHA256,
  DEFAULT_AUDITOR_EMAIL,
  DEFAULT_AUDITOR_PASSWORD_SHA256,
  DEFAULT_QA_EMAIL,
  DEFAULT_CFO_EMAIL,
  DEFAULT_CFO_PASSWORD_SHA256,
  DEFAULT_DGM_EMAIL,
  DEFAULT_DGM_PASSWORD_SHA256,
  DEFAULT_EXEC_APPROVAL_PIN_HASH,
  DEFAULT_FINANCE_ALIAS_EMAIL,
  DEFAULT_GM_EMAIL,
  DEFAULT_GM_PASSWORD_SHA256,
  DEFAULT_MARKETING_ALIAS_EMAIL,
  DEFAULT_MARKETING_EMAIL,
  DEFAULT_MARKETING_PASSWORD_SHA256,
  DEFAULT_OPS_EMAIL,
  DEFAULT_OPS_PASSWORD_SHA256,
  DEFAULT_SUPPLY_ALIAS_EMAIL,
  DEFAULT_SUPPLY_EMAIL,
  DEFAULT_SUPPLY_PASSWORD_SHA256,
  EXEC_SESSION_COOKIE,
  EXEC_SESSION_MAX_AGE,
  execCookieOptions,
  getExpectedAbdullahEmail,
  getExpectedAuditorEmail,
  getExpectedQaEmail,
  getExpectedCfoEmail,
  getExpectedDgmEmail,
  getExpectedExecEmail,
  getExpectedFinanceAliasEmail,
  getExpectedGmEmail,
  getExpectedMarketingAliasEmail,
  getExpectedMarketingEmail,
  getExpectedOpsEmail,
  getExpectedSupplyAliasEmail,
  getExpectedSupplyEmail,
  inferExecRoleFromEmail,
  isSecureRequest,
  sanitizeExecNextPath,
  verifyExecSessionToken,
  verifyExecutiveApprovalPin,
  verifyExecutiveCredentials,
  type ExecCredentialResult,
  type ExecSessionPayload,
} from '@/lib/auth/exec-session'

export {
  canTriggerManualOdooSync,
  isErpRouteAllowedForRole,
  resolveCanonicalErpAlias,
  resolvePostLoginRedirectForRole,
  resolveRoleDefaultHome,
  resolveRoleRedirectForForbiddenRoute,
  shouldMaskInternalCostsForRole,
} from '@/lib/auth/role-access-policy'

export {
  ENTERPRISE_API_SECURITY_HEADERS,
  requireAdminOnlyApiSession,
  requireExecApiSession,
  type ExecApiGuardFailure,
  type ExecApiGuardSuccess,
} from '@/lib/auth/api-guard'
