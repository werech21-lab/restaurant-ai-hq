import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import {
  ENTERPRISE_API_SECURITY_HEADERS,
  requireAdminOnlyApiSession,
} from '@/lib/auth/api-guard'
import {
  EXEC_ROLE_PROFILES,
  type ExecSessionRole,
} from '@/lib/auth/exec-role-meta'
import {
  getExpectedAbdullahEmail,
  getExpectedAuditorEmail,
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
} from '@/lib/auth/exec-session'
import { canTriggerManualOdooSync } from '@/lib/auth/role-access-policy'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export interface ExecutiveDirectoryRoleEntry {
  role: ExecSessionRole
  email: string
  aliasEmail: string | null
  badgeEn: string
  badgeAr: string
  scopeEn: string
  scopeAr: string
  defaultHome: string
  accessTier: 'full_admin' | 'full_exec' | 'scoped_marketing' | 'scoped_supply' | 'readonly_audit'
  odooSyncAllowed: boolean
  terminalMappingAllowed: boolean
  readOnly: boolean
}

function buildRoleDirectoryEntries(): ExecutiveDirectoryRoleEntry[] {
  const specs: Array<{
    role: ExecSessionRole
    email: string
    aliasEmail: string | null
    scopeEn: string
    scopeAr: string
    defaultHome: string
    accessTier: ExecutiveDirectoryRoleEntry['accessTier']
  }> = [
    {
      role: 'admin',
      email: getExpectedAbdullahEmail(),
      aliasEmail: getExpectedExecEmail(),
      scopeEn:
        'Full 13-module ERP governance, Odoo 17 POS terminal auto-discovery & branch mapping, live sync & executive directory',
      scopeAr:
        'كامل شاشات النظام (13 شاشة)، ربط أجهزة نقاط البيع غير المصنّفة، المزامنة المباشرة ودليل الصلاحيات',
      defaultHome: '/erp',
      accessTier: 'full_admin',
    },
    {
      role: 'gm',
      email: getExpectedGmEmail(),
      aliasEmail: null,
      scopeEn:
        'Full 13-module company P&L, approvals, verified digital seal, strategic planning & live Odoo sync',
      scopeAr:
        'كامل الأرباح والخسائر والشاشات الـ 13، الاعتمادات التنفيذية، الختم الرقمي والمزامنة المباشرة',
      defaultHome: '/erp',
      accessTier: 'full_exec',
    },
    {
      role: 'dgm',
      email: getExpectedDgmEmail(),
      aliasEmail: null,
      scopeEn:
        'Full 13-module company P&L, operational governance, verified digital seal & live Odoo sync',
      scopeAr:
        'كامل الأرباح والخسائر والحوكمة التشغيلية عبر الـ 13 شاشة والختم الرقمي والمزامنة المباشرة',
      defaultHome: '/erp',
      accessTier: 'full_exec',
    },
    {
      role: 'ops',
      email: getExpectedOpsEmail(),
      aliasEmail: null,
      scopeEn:
        'All 13 operational, SLA, Ardiya Central Kitchen (EXB) & branch performance modules + live Odoo sync',
      scopeAr:
        'جميع محاور التشغيل والالتزام الزمني والمطبخ المركزي بالعارضية (EXB) والفروع الـ 7 والمزامنة المباشرة',
      defaultHome: '/erp',
      accessTier: 'full_exec',
    },
    {
      role: 'cfo',
      email: getExpectedCfoEmail(),
      aliasEmail: getExpectedFinanceAliasEmail(),
      scopeEn:
        'Full P&L, rent & payroll ledger, aggregator commissions, 90-day financial planning & live Odoo sync',
      scopeAr:
        'كامل الأرباح والخسائر، الإيجارات والرواتب، عمولات المنصات، التخطيط المالي والمزامنة المباشرة',
      defaultHome: '/erp',
      accessTier: 'full_exec',
    },
    {
      role: 'marketing',
      email: getExpectedMarketingEmail(),
      aliasEmail: getExpectedMarketingAliasEmail(),
      scopeEn:
        'Scoped: /erp (Sales, Orders & Quiet Hours — Rent/Payroll/Supplier costs masked), /erp/cores, /erp/weekday-comparison, /erp/before-after, /erp/reviews, /erp/booth & /erp/feryal-ai',
      scopeAr:
        'نطاق مخصّص: المبيعات والطلبات والساعات الهادئة (مع حجب الإيجارات والرواتب وتكاليف الموردين)، المحاور، المقارنة، قبل وبعد، التقييمات، المعارض وفريال',
      defaultHome: '/erp',
      accessTier: 'scoped_marketing',
    },
    {
      role: 'supply',
      email: getExpectedSupplyEmail(),
      aliasEmail: getExpectedSupplyAliasEmail(),
      scopeEn:
        'Scoped: /erp/warehouse-chain (Ardiya Central Kitchen EXB -> 7 active branches), /erp/prep-sla, /erp/delivery-sla & /erp/feryal-ai',
      scopeAr:
        'نطاق مخصّص: سلسلة المطبخ المركزي بالعارضية (EXB) للفروع الـ 7 النشطة، زمن التحضير، زمن التوصيل والمستشارة فريال',
      defaultHome: '/erp/warehouse-chain',
      accessTier: 'scoped_supply',
    },
    {
      role: 'auditor',
      email: getExpectedAuditorEmail(),
      aliasEmail: null,
      scopeEn:
        'Strict Read-Only audit visibility across ERP modules (403 Forbidden on all write, sync & mapping endpoints)',
      scopeAr:
        'مراجعة خارجية للقراءة فقط دون أي صلاحية تعديل أو اعتماد أو مزامنة (403 على كافة نقاط الكتابة)',
      defaultHome: '/erp',
      accessTier: 'readonly_audit',
    },
  ]

  return specs.map((item) => {
    const profile = EXEC_ROLE_PROFILES[item.role]
    return {
      role: item.role,
      email: item.email,
      aliasEmail: item.aliasEmail,
      badgeEn: profile.titleEn,
      badgeAr: profile.titleAr,
      scopeEn: item.scopeEn,
      scopeAr: item.scopeAr,
      defaultHome: item.defaultHome,
      accessTier: item.accessTier,
      odooSyncAllowed: canTriggerManualOdooSync(item.role),
      terminalMappingAllowed: item.role === 'admin',
      readOnly: profile.isAuditor,
    }
  })
}

/**
 * GET `/api/erp/role-directory`
 * Strictly restricted to `role === 'admin'` (`401` unauthenticated, `403` for all 7 other roles).
 * NEVER exposes passwords, salts, or hashes in DOM or JSON responses.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminOnlyApiSession(request)
  if (!auth.ok) {
    return auth.response
  }

  const roles = buildRoleDirectoryEntries()
  return NextResponse.json(
    {
      ok: true,
      count: roles.length,
      roles,
    },
    {
      status: 200,
      headers: {
        ...ENTERPRISE_API_SECURITY_HEADERS,
        'cache-control': 'no-store, max-age=0',
      },
    },
  )
}
