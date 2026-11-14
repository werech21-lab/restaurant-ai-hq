/**
 * Unified Corporate Executive Authentication & RBAC Barrel (`src/lib/auth.ts`)
 *
 * Roles:
 *   - `'admin'`   : System Admin & Executive Secretary (`abdullah@venturefoodskw.com` / `admin@venturefoodskw.com`)
 *   - `'gm'`      : General Manager (`gm@venturefoodskw.com`)
 *   - `'dgm'`     : Deputy General Manager (`dgm@venturefoodskw.com`)
 *   - `'ops'`     : Operations Manager (`operations@venturefoodskw.com` — `مدير العمليات`)
 *   - `'cfo'`     : Finance Manager / CFO (`cfo@venturefoodskw.com` + alias `finance@venturefoodskw.com` — `المدير المالي`)
 *   - `'auditor'` : External Read-Only Auditor (`auditor@venturefoodskw.com` — `مراجع — قراءة فقط`)
 */

export {
  EXEC_ROLE_PROFILES,
  normalizeExecSessionRole,
  resolveExecRoleProfile,
  toExecApproverRole,
  type ExecApproverRole,
  type ExecRoleProfile,
  type ExecSessionRole,
} from '@/lib/auth/exec-role-meta'

export {
  authenticateExecutiveCredentials,
  createExecSessionToken,
  DEFAULT_ABDULLAH_EMAIL,
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_AUDITOR_EMAIL,
  DEFAULT_CFO_EMAIL,
  DEFAULT_DGM_EMAIL,
  DEFAULT_FINANCE_ALIAS_EMAIL,
  DEFAULT_GM_EMAIL,
  DEFAULT_OPS_EMAIL,
  EXEC_SESSION_COOKIE,
  EXEC_SESSION_MAX_AGE,
  execCookieOptions,
  getExpectedAbdullahEmail,
  getExpectedAuditorEmail,
  getExpectedCfoEmail,
  getExpectedDgmEmail,
  getExpectedExecEmail,
  getExpectedFinanceAliasEmail,
  getExpectedGmEmail,
  getExpectedOpsEmail,
  isSecureRequest,
  sanitizeExecNextPath,
  verifyExecSessionToken,
  verifyExecutiveCredentials,
  type ExecCredentialResult,
  type ExecSessionPayload,
} from '@/lib/auth/exec-session'

export {
  ENTERPRISE_API_SECURITY_HEADERS,
  requireAdminOnlyApiSession,
  requireExecApiSession,
  type ExecApiGuardFailure,
  type ExecApiGuardSuccess,
} from '@/lib/auth/api-guard'
