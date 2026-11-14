'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Lock, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import type { ExecSessionRole } from '@/lib/auth/exec-role-meta'
import { useI18n } from '@/lib/i18n'

interface DirectoryRoleRow {
  role: ExecSessionRole
  email: string
  aliasEmail: string | null
  badgeEn: string
  badgeAr: string
  scopeEn: string
  scopeAr: string
  defaultHome: string
  accessTier:
    | 'full_admin'
    | 'full_exec'
    | 'scoped_marketing'
    | 'scoped_supply'
    | 'readonly_audit'
  odooSyncAllowed: boolean
  terminalMappingAllowed: boolean
  readOnly: boolean
}

interface RoleDirectoryApiResponse {
  ok: boolean
  count: number
  roles: DirectoryRoleRow[]
}

function resolveTierPillStyle(tier: DirectoryRoleRow['accessTier']): string {
  switch (tier) {
    case 'full_admin':
      return 'bg-emerald-500/15 text-emerald-800 ring-emerald-500/30 dark:text-emerald-200'
    case 'full_exec':
      return 'bg-emerald-50 text-emerald-900 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-200'
    case 'scoped_marketing':
      return 'bg-sky-50 text-sky-900 ring-sky-500/25 dark:bg-sky-950/55 dark:text-sky-200'
    case 'scoped_supply':
      return 'bg-purple-50 text-purple-900 ring-purple-500/25 dark:bg-purple-950/55 dark:text-purple-200'
    case 'readonly_audit':
      return 'bg-amber-50 text-amber-900 ring-amber-500/25 dark:bg-amber-950/55 dark:text-amber-200'
  }
}

/**
 * Admin-Only 8-Role Executive Access Directory Card (`src/components/erp/AdminExecutiveDirectoryCard.tsx`)
 * Strictly rendered ONLY when `effectiveRole === 'admin'`.
 * Loads corporate accounts from the admin-gated server endpoint `/api/erp/role-directory`
 * so ZERO corporate emails or credentials ever appear in client bundle source or non-admin DOM,
 * and ZERO passwords are ever transmitted or rendered.
 */
export function AdminExecutiveDirectoryCard({
  role,
  compact = false,
}: {
  role?: ExecSessionRole
  compact?: boolean
}) {
  const { locale } = useI18n()
  const isAr = locale === 'ar'
  const { sessionRole, isAuditor } = useGlobalFilter()
  const effectiveRole: ExecSessionRole = isAuditor ? 'auditor' : (role ?? sessionRole)

  const [rows, setRows] = useState<DirectoryRoleRow[]>([])
  const [loading, setLoading] = useState(false)

  const loadDirectory = useCallback(async () => {
    if (effectiveRole !== 'admin') return
    setLoading(true)
    try {
      const res = await fetch('/api/erp/role-directory', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      })
      if (!res.ok) return
      const payload = (await res.json()) as RoleDirectoryApiResponse
      if (payload?.ok && Array.isArray(payload.roles)) {
        setRows(payload.roles)
      }
    } catch {
      // Keep UI calm on transient network hiccups
    } finally {
      setLoading(false)
    }
  }, [effectiveRole])

  useEffect(() => {
    if (effectiveRole !== 'admin') return
    void loadDirectory()
  }, [effectiveRole, loadDirectory])

  if (effectiveRole !== 'admin') {
    return null
  }

  if (compact) {
    return (
      <div
        data-admin-role-directory-compact="true"
        dir={isAr ? 'rtl' : 'ltr'}
        className="space-y-2 rounded-xl bg-[#F6F7F8] p-2.5 ring-1 ring-slate-900/[0.05] dark:bg-[#09110E] dark:ring-emerald-500/15"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-200">
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span>
              {isAr
                ? 'دليل الوصول التنفيذي (8 أدوار)'
                : 'Executive Access Directory (8 Roles)'}
            </span>
          </span>
          <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-xs font-bold tabular-nums text-emerald-800 dark:text-emerald-200">
            {rows.length || 8}
          </span>
        </div>

        <div className="max-h-52 space-y-1.5 overflow-y-auto pe-0.5">
          {rows.map((r) => (
            <div
              key={r.role}
              className="rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-white/[0.06]"
            >
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {isAr ? r.badgeAr : r.badgeEn}
                </span>
                <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">
                  {r.role}
                </span>
              </div>
              <div
                dir="ltr"
                className="mt-0.5 break-all font-mono text-xs text-slate-600 dark:text-slate-300"
              >
                {r.email}
                {r.aliasEmail ? ` (${r.aliasEmail})` : ''}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <section
      id="admin-role-directory"
      data-admin-role-directory="true"
      dir={isAr ? 'rtl' : 'ltr'}
      aria-label={
        isAr
          ? 'دليل الصلاحيات والحسابات التنفيذية — 8 أدوار'
          : 'Executive Access Directory — 8 Active Corporate Roles'
      }
      className="ae-bento-card space-y-4 rounded-2xl bg-white p-4 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.05] dark:bg-[#101815] dark:ring-emerald-400/[0.12]"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <Users className="h-4 w-4" />
            </span>
            <h2 className="text-[16px] sm:text-[17px] font-semibold tracking-tight text-slate-950 dark:text-white">
              {isAr
                ? 'دليل الصلاحيات والحسابات التنفيذية (8 أدوار مؤسسية)'
                : 'Executive Access Directory (8 Corporate Roles)'}
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span>{isAr ? 'مسؤول النظام فقط • بدون كلمات مرور' : 'Admin Only • Zero Passwords Exposed'}</span>
            </span>
          </div>
          <p className="text-[13px] font-medium text-slate-600 dark:text-[#8FA39B]">
            {isAr
              ? 'مصفوفة العزل الأمني المعتمدة لشركة فنتشر فودز (المالك/مسؤول النظام، المدير العام، نائبه، مدير العمليات، المدير المالي، مسؤول التسويق، مدير المطبخ المركزي والإمداد، والمراجع الخارجي).'
              : 'Verified RBAC access matrix across all 8 Venture Foods corporate roles with strict route & API isolation.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadDirectory()}
          disabled={loading}
          className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-[#F6F7F8] px-3.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-900/[0.06] transition-colors hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-60 dark:bg-[#141F1B] dark:text-slate-200 dark:ring-emerald-400/[0.12] dark:hover:bg-white/[0.08]"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{isAr ? 'تحديث الدليل' : 'Refresh Directory'}</span>
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl ring-1 ring-slate-900/[0.05] dark:ring-emerald-400/[0.1]">
        <table className="w-full min-w-[760px] border-collapse text-start text-[13px]">
          <thead>
            <tr className="border-b border-slate-200/80 bg-[#F6F7F8] text-xs font-bold text-slate-700 dark:border-white/[0.08] dark:bg-[#141F1B] dark:text-slate-200">
              <th className="px-3.5 py-2.5 text-start">
                {isAr ? 'البريد المؤسسي والبديل' : 'Corporate Email & Alias'}
              </th>
              <th className="px-3.5 py-2.5 text-start">
                {isAr ? 'المسمّى والشارة' : 'Role & Executive Badge'}
              </th>
              <th className="px-3.5 py-2.5 text-start">
                {isAr ? 'نطاق الوصول المعزول' : 'Scoped Access & Isolation'}
              </th>
              <th className="px-3.5 py-2.5 text-start">
                {isAr ? 'مزامنة أودو / التعديل' : 'Odoo Sync / Write'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70 dark:divide-white/[0.06]">
            {rows.map((row) => (
              <tr
                key={row.role}
                data-directory-role={row.role}
                className="transition-colors hover:bg-[#F6F7F8]/70 dark:hover:bg-white/[0.03]"
              >
                <td className="px-3.5 py-3 align-top">
                  <div
                    dir="ltr"
                    className="font-mono text-[12.5px] font-semibold text-slate-900 dark:text-white"
                  >
                    {row.email}
                  </div>
                  {row.aliasEmail ? (
                    <div
                      dir="ltr"
                      className="mt-0.5 font-mono text-xs text-slate-600 dark:text-[#8FA39B]"
                    >
                      {isAr ? 'بديل: ' : 'alias: '}
                      {row.aliasEmail}
                    </div>
                  ) : null}
                </td>

                <td className="px-3.5 py-3 align-top">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${resolveTierPillStyle(row.accessTier)}`}
                  >
                    <span>{isAr ? row.badgeAr : row.badgeEn}</span>
                  </span>
                  <div
                    dir="ltr"
                    className="mt-1 font-mono text-xs text-slate-500 dark:text-[#8FA39B]"
                  >
                    role: {row.role} • home: {row.defaultHome}
                  </div>
                </td>

                <td className="px-3.5 py-3 align-top whitespace-normal text-[12.5px] leading-relaxed text-slate-700 dark:text-slate-200">
                  {isAr ? row.scopeAr : row.scopeEn}
                </td>

                <td className="px-3.5 py-3 align-top">
                  {row.readOnly ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-500/25 dark:bg-amber-950/60 dark:text-amber-200">
                      <Lock className="h-3 w-3 shrink-0" />
                      <span>{isAr ? 'قراءة فقط (403)' : 'Read-Only (403)'}</span>
                    </span>
                  ) : row.odooSyncAllowed ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-200">
                      <CheckCircle2 className="h-3 w-3 shrink-0" />
                      <span>
                        {row.terminalMappingAllowed
                          ? isAr
                            ? 'مزامنة + ربط الكاشير'
                            : 'Sync + POS Mapping'
                          : isAr
                            ? 'مزامنة أودو مفعّلة'
                            : 'Odoo Sync Allowed'}
                      </span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-900/10 dark:bg-white/[0.06] dark:text-slate-300 dark:ring-white/10">
                      <Lock className="h-3 w-3 shrink-0" />
                      <span>{isAr ? 'مزامنة محجوبة (403)' : 'Sync Blocked (403)'}</span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
