'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Lock, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { StateBlock } from '@/components/ui/state-block'
import type { ExecSessionRole } from '@/lib/auth/exec-role-meta'
import {
  UNAVAILABLE_DASH,
  formatInt,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
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
  const isAr = locale !== 'en'
  const fmtLocale: FormatLocale = isAr ? 'ar' : 'en'
  const unavailableTooltip = getUnavailableTooltip(fmtLocale)
  const { sessionRole, isAuditor } = useGlobalFilter()
  const effectiveRole: ExecSessionRole = isAuditor ? 'auditor' : (role ?? sessionRole)

  const [rows, setRows] = useState<DirectoryRoleRow[]>([])
  const [loading, setLoading] = useState(false)
  const [hasError, setHasError] = useState(false)

  const loadDirectory = useCallback(async () => {
    if (effectiveRole !== 'admin') return
    setLoading(true)
    setHasError(false)
    try {
      const res = await fetch('/api/erp/role-directory', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      })
      if (!res.ok) {
        setHasError(true)
        return
      }
      const payload = (await res.json()) as RoleDirectoryApiResponse
      if (payload?.ok && Array.isArray(payload.roles)) {
        setRows(payload.roles)
      } else {
        setHasError(true)
      }
    } catch {
      setHasError(true)
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
        className="min-w-0 space-y-2 rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-2.5"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-200">
            <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {isAr
                ? 'دليل الوصول التنفيذي (8 أدوار)'
                : 'Executive Access Directory (8 Roles)'}
            </span>
          </span>
          <span
            dir="ltr"
            className="ds-num rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-xs font-bold tabular-nums text-emerald-800 dark:text-emerald-200"
          >
            {formatInt(rows.length || 8, fmtLocale)}
          </span>
        </div>

        {loading && rows.length === 0 ? (
          <StateBlock state="loading" locale={fmtLocale} compact skeletonRows={2} />
        ) : hasError && rows.length === 0 ? (
          <StateBlock
            state="error"
            locale={fmtLocale}
            compact
            onRetry={() => void loadDirectory()}
          />
        ) : rows.length === 0 ? (
          <StateBlock state="empty" locale={fmtLocale} compact />
        ) : (
          <div className="max-h-52 space-y-1.5 overflow-y-auto pe-0.5">
            {rows.map((r) => (
              <div
                key={r.role}
                className="rounded-lg border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-surface)] px-2.5 py-1.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="text-xs font-bold text-[var(--ds-text-primary)]">
                    {isAr ? r.badgeAr : r.badgeEn}
                  </span>
                  <span
                    dir="ltr"
                    className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200"
                  >
                    {r.role}
                  </span>
                </div>
                {r.email ? (
                  <div
                    dir="ltr"
                    className="mt-0.5 break-all font-mono text-xs text-[var(--ds-text-secondary)]"
                  >
                    {r.email}
                    {r.aliasEmail ? ` (${r.aliasEmail})` : ''}
                  </div>
                ) : (
                  <span
                    dir="ltr"
                    title={unavailableTooltip}
                    aria-label={unavailableTooltip}
                    data-unavailable="true"
                    className="ds-num mt-0.5 inline-block text-xs tabular-nums"
                    style={{ color: 'var(--ds-unavailable)' }}
                  >
                    {UNAVAILABLE_DASH}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
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
      className="ae-bento-card ds-surface min-w-0 space-y-4 rounded-2xl p-4 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              aria-hidden
            >
              <Users className="h-4 w-4" />
            </span>
            <h2 className="text-[16px] font-semibold tracking-tight text-[var(--ds-text-primary)] sm:text-[17px]">
              {isAr
                ? 'دليل الصلاحيات والحسابات التنفيذية (8 أدوار مؤسسية)'
                : 'Executive Access Directory (8 Corporate Roles)'}
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                {isAr
                  ? 'مسؤول النظام فقط • بدون كلمات مرور'
                  : 'Admin Only • Zero Passwords Exposed'}
              </span>
            </span>
          </div>
          <p className="text-[13px] font-medium text-[var(--ds-text-muted)]">
            {isAr
              ? 'مصفوفة العزل الأمني المعتمدة لشركة فنتشر فودز (المالك/مسؤول النظام، المدير العام، نائبه، مدير العمليات، المدير المالي، مسؤول التسويق، مدير المطبخ المركزي والإمداد، والمراجع الخارجي).'
              : 'RBAC access matrix across all 8 Venture Foods corporate roles with strict route & API isolation.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadDirectory()}
          disabled={loading}
          aria-label={isAr ? 'تحديث الدليل' : 'Refresh Directory'}
          className="ds-focus-ring inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] px-3.5 text-xs font-semibold text-[var(--ds-text-primary)] transition-colors hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-60 dark:hover:bg-white/[0.08] dark:hover:text-emerald-200"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          <span>{isAr ? 'تحديث الدليل' : 'Refresh Directory'}</span>
        </button>
      </div>

      {loading && rows.length === 0 ? (
        <StateBlock state="loading" locale={fmtLocale} skeletonRows={4} />
      ) : hasError && rows.length === 0 ? (
        <StateBlock
          state="error"
          locale={fmtLocale}
          onRetry={() => void loadDirectory()}
        />
      ) : rows.length === 0 ? (
        <StateBlock state="empty" locale={fmtLocale} />
      ) : (
        <div className="w-full overflow-x-auto rounded-2xl border border-[var(--ds-border-hairline)]">
          <table className="w-full min-w-[760px] border-collapse text-start text-[13px]">
            <thead>
              <tr className="border-b border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] text-xs font-bold text-[var(--ds-text-secondary)]">
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
            <tbody className="divide-y divide-[var(--ds-border-hairline)]">
              {rows.map((row) => (
                <tr
                  key={row.role}
                  data-directory-role={row.role}
                  className="transition-colors hover:bg-[var(--ds-bg-hover)]"
                >
                  <td className="px-3.5 py-3 align-top">
                    {row.email ? (
                      <div
                        dir="ltr"
                        className="font-mono text-[12.5px] font-semibold text-[var(--ds-text-primary)]"
                      >
                        {row.email}
                      </div>
                    ) : (
                      <span
                        dir="ltr"
                        title={unavailableTooltip}
                        aria-label={unavailableTooltip}
                        data-unavailable="true"
                        className="ds-num tabular-nums"
                        style={{ color: 'var(--ds-unavailable)' }}
                      >
                        {UNAVAILABLE_DASH}
                      </span>
                    )}
                    {row.aliasEmail ? (
                      <div
                        dir="ltr"
                        className="mt-0.5 font-mono text-xs text-[var(--ds-text-muted)]"
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
                      className="mt-1 font-mono text-xs text-[var(--ds-text-muted)]"
                    >
                      role: {row.role} • home: {row.defaultHome || UNAVAILABLE_DASH}
                    </div>
                  </td>

                  <td className="whitespace-normal px-3.5 py-3 align-top text-[12.5px] leading-relaxed text-[var(--ds-text-secondary)]">
                    {isAr ? row.scopeAr : row.scopeEn}
                  </td>

                  <td className="px-3.5 py-3 align-top">
                    {row.readOnly ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-500/25 dark:bg-amber-950/60 dark:text-amber-200">
                        <Lock className="h-3 w-3 shrink-0" aria-hidden />
                        <span>{isAr ? 'قراءة فقط (403)' : 'Read-Only (403)'}</span>
                      </span>
                    ) : row.odooSyncAllowed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-200">
                        <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
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
                        <Lock className="h-3 w-3 shrink-0" aria-hidden />
                        <span>{isAr ? 'مزامنة محجوبة (403)' : 'Sync Blocked (403)'}</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
