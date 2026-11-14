'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Link2, RefreshCw, RotateCcw, ShieldCheck, Terminal } from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import type { ExecSessionRole } from '@/lib/auth/exec-role-meta'
import { useI18n } from '@/lib/i18n'

interface BranchDropdownOption {
  id: string
  labelEn: string
  labelAr: string
  code: string
}

interface DiscoveredTerminalRow {
  terminal_id: number
  terminal_name: string
  orders_count: number
  net_sales_kwd: number
  assigned_branch_id: string | null
  assigned_branch_label_en: string | null
  assigned_branch_label_ar: string | null
  updated_at: string | null
  updated_by: string | null
}

interface TerminalMappingsApiResponse {
  ok: boolean
  unmappedLabelAr: string
  unmappedLabelEn: string
  branchOptions: BranchDropdownOption[]
  unmappedTerminals: DiscoveredTerminalRow[]
  mappedTerminals: DiscoveredTerminalRow[]
  companyTotals: {
    netSalesKwd: number
    orders: number
    mappedBranchesNetKwd: number
    mappedBranchesOrders: number
    unmappedTerminalsNetKwd: number
    unmappedTerminalsOrders: number
    reconciledExact: boolean
  }
  liveSummary?: unknown
}

const DEFAULT_BRANCH_OPTIONS: BranchDropdownOption[] = [
  { id: 'salmiya', labelEn: 'Salmiya', labelAr: 'السالمية', code: 'SLM' },
  { id: 'ardiya', labelEn: 'Ardiya', labelAr: 'العارضية', code: 'ARD' },
  { id: 'al-kout', labelEn: 'Al-Kout', labelAr: 'الكوت', code: 'KOT' },
  { id: 'promenade', labelEn: 'Promenade', labelAr: 'بروميناد', code: 'PRM' },
  { id: '360-mall', labelEn: '360', labelAr: 'مول 360', code: '360' },
  { id: 'avenues', labelEn: 'The Avenues', labelAr: 'الأفنيوز', code: 'AVN' },
  { id: 'assima', labelEn: 'Assima', labelAr: 'العاصمة', code: 'ASM' },
]

const fmtInt = (n: number) => Math.round(Number(n) || 0).toLocaleString('en-US')
const fmtKwd = (n: number) =>
  (Number(n) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })

/**
 * Admin-Only Odoo 17 POS Terminal Auto-Discovery & Branch Mapping Panel
 * Strictly visible ONLY when `role === 'admin'`.
 * Lists every unmapped `pos.config` terminal (`terminal_id`, `terminal_name`, `orders_count`, `net_sales_kwd`)
 * alongside a dropdown of the 7 active Venture Foods branches and a 1-click Save button,
 * immediately reallocating sales out of `غير مصنّف — أجهزة غير مربوطة` into the chosen branch
 * while keeping `sum(branches) + unmapped === companyTotals.netSalesKwd`.
 */
export function AdminPosTerminalMappingPanel({ role }: { role?: ExecSessionRole }) {
  const { locale } = useI18n()
  const isAr = locale === 'ar'
  const { sessionRole, isAuditor } = useGlobalFilter()
  const effectiveRole: ExecSessionRole = isAuditor ? 'auditor' : (role ?? sessionRole)

  const [data, setData] = useState<TerminalMappingsApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [savingTerminalId, setSavingTerminalId] = useState<number | null>(null)
  const [selectedBranches, setSelectedBranches] = useState<Record<number, string>>({})
  const [savedNoticeId, setSavedNoticeId] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const loadMappings = useCallback(async () => {
    if (effectiveRole !== 'admin') return
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/erp/terminal-mappings', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      })
      if (!res.ok) return
      const payload = (await res.json()) as TerminalMappingsApiResponse
      if (payload?.ok) {
        setData(payload)
        setSelectedBranches((prev) => {
          const next = { ...prev }
          for (const t of payload.unmappedTerminals) {
            if (!next[t.terminal_id]) {
              next[t.terminal_id] = payload.branchOptions[0]?.id ?? 'salmiya'
            }
          }
          return next
        })
      }
    } catch {
      // Keep UI quiet on transient network hiccups
    } finally {
      setLoading(false)
    }
  }, [effectiveRole])

  useEffect(() => {
    if (effectiveRole !== 'admin') return
    void loadMappings()
  }, [effectiveRole, loadMappings])

  const handleSaveTerminal = async (terminalId: number, branchId: string | null) => {
    if (effectiveRole !== 'admin') return
    setSavingTerminalId(terminalId)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/erp/terminal-mappings', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          terminal_id: terminalId,
          branch_id: branchId,
        }),
      })
      if (!res.ok) {
        setErrorMsg(
          isAr
            ? 'تعذّر حفظ ربط جهاز الكاشير. يرجى المحاولة مرة أخرى.'
            : 'Unable to save POS terminal mapping. Please try again.',
        )
        return
      }
      const updated = (await res.json()) as TerminalMappingsApiResponse
      if (updated?.ok) {
        setData(updated)
        setSavedNoticeId(terminalId)
        window.setTimeout(() => {
          setSavedNoticeId((curr) => (curr === terminalId ? null : curr))
        }, 2500)
        if (updated.liveSummary && typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('aether:odoo-sync', { detail: updated.liveSummary }),
          )
        }
      }
    } catch {
      setErrorMsg(
        isAr
          ? 'تعذّر الاتصال بالخادم لحفظ الربط.'
          : 'Network error while saving terminal mapping.',
      )
    } finally {
      setSavingTerminalId(null)
    }
  }

  if (effectiveRole !== 'admin') {
    return null
  }

  const branchOptions = data?.branchOptions ?? DEFAULT_BRANCH_OPTIONS
  const unmappedTerminals = data?.unmappedTerminals ?? []
  const mappedTerminals = data?.mappedTerminals ?? []
  const totals = data?.companyTotals

  return (
    <section
      data-admin-pos-mapping-panel="true"
      dir={isAr ? 'rtl' : 'ltr'}
      aria-label={
        isAr
          ? 'اكتشاف وربط أجهزة نقاط البيع غير المصنّفة'
          : 'Auto-Discovered Unmapped Odoo 17 POS Terminals'
      }
      className="ae-bento-card space-y-4 rounded-2xl bg-white p-4 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.05] dark:bg-[#101815] dark:ring-emerald-400/[0.12]"
    >
      {/* Header Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <Terminal className="h-4 w-4" />
            </span>
            <h2 className="text-[16px] sm:text-[17px] font-semibold tracking-tight text-slate-950 dark:text-white">
              {isAr
                ? 'اكتشاف وربط أجهزة الكاشير غير المصنّفة (أودو 17)'
                : 'Auto-Discovered Unmapped Odoo 17 POS Terminals'}
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span>{isAr ? 'مسؤول النظام فقط' : 'Admin Only'}</span>
            </span>
          </div>
          <p className="text-[13px] font-medium text-slate-600 dark:text-[#8FA39B]">
            {isAr
              ? 'اربط أي جهاز كاشير (pos.config) بأحد الفروع السبعة النشطة لتحويل مبيعاته وطلباته فوراً من «غير مصنّف — أجهزة غير مربوطة» مع بقاء إجمالي الشركة مطابقاً 100%.'
              : 'Assign any auto-discovered Odoo pos.config terminal to one of the 7 active Venture Foods branches with 1 click while preserving exact company sales reconciliation.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadMappings()}
          disabled={loading}
          className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-[#F6F7F8] px-3.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-900/[0.06] transition-colors hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-60 dark:bg-[#141F1B] dark:text-slate-200 dark:ring-emerald-400/[0.12] dark:hover:bg-white/[0.08]"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{isAr ? 'تحديث الاكتشاف' : 'Refresh Discovery'}</span>
        </button>
      </div>

      {/* Live Ledger Reconciliation Strip: sum(branches) + unmapped === companyTotals.netSalesKwd */}
      {totals ? (
        <div className="grid grid-cols-1 gap-3 rounded-2xl bg-[#F6F7F8] p-3.5 ring-1 ring-slate-900/[0.04] sm:grid-cols-3 dark:bg-[#141F1B] dark:ring-emerald-400/[0.09]">
          <div className="space-y-0.5">
            <span className="block text-xs font-semibold text-slate-600 dark:text-[#8FA39B]">
              {isAr ? 'الفروع الـ 7 المربوطة' : '7 Mapped Active Branches'}
            </span>
            <span
              dir="ltr"
              className="block text-[15px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300"
            >
              {fmtKwd(totals.mappedBranchesNetKwd)} KWD ({fmtInt(totals.mappedBranchesOrders)}{' '}
              {isAr ? 'طلب' : 'orders'})
            </span>
          </div>

          <div className="space-y-0.5">
            <span className="block text-xs font-semibold text-amber-800 dark:text-amber-300">
              {isAr
                ? 'غير مصنّف — أجهزة غير مربوطة'
                : 'Unclassified — Unmapped POS Terminals'}
            </span>
            <span
              dir="ltr"
              className="block text-[15px] font-semibold tabular-nums text-amber-700 dark:text-amber-300"
            >
              {fmtKwd(totals.unmappedTerminalsNetKwd)} KWD ({fmtInt(totals.unmappedTerminalsOrders)}{' '}
              {isAr ? 'طلب' : 'orders'})
            </span>
          </div>

          <div className="space-y-0.5">
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              {isAr ? 'إجمالي مبيعات الشركة المطابق' : 'Reconciled Company Net Sales'}
            </span>
            <span
              dir="ltr"
              className="block text-[15px] font-semibold tabular-nums text-slate-950 dark:text-white"
            >
              {fmtKwd(totals.netSalesKwd)} KWD ({fmtInt(totals.orders)}{' '}
              {isAr ? 'طلب' : 'orders'})
            </span>
          </div>
        </div>
      ) : null}

      {errorMsg ? (
        <div
          role="alert"
          className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-500/20 dark:bg-rose-950/40 dark:text-rose-200"
        >
          {errorMsg}
        </div>
      ) : null}

      {/* Unmapped Terminals Table */}
      {unmappedTerminals.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl ring-1 ring-slate-900/[0.06] dark:ring-emerald-400/[0.12]">
          <table className="w-full min-w-[640px] border-collapse text-start text-[13px]">
            <thead>
              <tr className="border-b border-slate-200/80 bg-[#F6F7F8] text-xs font-semibold text-slate-600 dark:border-white/[0.08] dark:bg-[#141F1B] dark:text-[#8FA39B]">
                <th className="px-3.5 py-2.5 text-start">
                  {isAr ? 'معرّف الجهاز' : 'Terminal ID'}
                </th>
                <th className="px-3.5 py-2.5 text-start">
                  {isAr ? 'اسم الكاشير (pos.config)' : 'POS Terminal Name'}
                </th>
                <th className="px-3.5 py-2.5 text-end">
                  {isAr ? 'عدد الطلبات' : 'Orders'}
                </th>
                <th className="px-3.5 py-2.5 text-end">
                  {isAr ? 'صافي المبيعات (د.ك)' : 'Net Sales (KWD)'}
                </th>
                <th className="px-3.5 py-2.5 text-start">
                  {isAr ? 'الفرع المستهدف (7 فروع)' : 'Target Branch (7 Active)'}
                </th>
                <th className="px-3.5 py-2.5 text-end">
                  {isAr ? 'الإجراء' : 'Action'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/[0.06]">
              {unmappedTerminals.map((term) => {
                const chosenBranch =
                  selectedBranches[term.terminal_id] ??
                  branchOptions[0]?.id ??
                  'salmiya'
                const isSaving = savingTerminalId === term.terminal_id
                const justSaved = savedNoticeId === term.terminal_id

                return (
                  <tr
                    key={term.terminal_id}
                    className="transition-colors hover:bg-slate-50/80 dark:hover:bg-white/[0.03]"
                  >
                    <td
                      dir="ltr"
                      className="px-3.5 py-2.5 font-mono text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200"
                    >
                      #{term.terminal_id}
                    </td>
                    <td className="px-3.5 py-2.5 font-semibold text-slate-900 dark:text-white">
                      {term.terminal_name}
                    </td>
                    <td
                      dir="ltr"
                      className="px-3.5 py-2.5 text-end font-mono text-[13px] font-semibold tabular-nums text-slate-700 dark:text-slate-200"
                    >
                      {fmtInt(term.orders_count)}
                    </td>
                    <td
                      dir="ltr"
                      className="px-3.5 py-2.5 text-end font-mono text-[13px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300"
                    >
                      {fmtKwd(term.net_sales_kwd)}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <select
                        aria-label={
                          isAr
                            ? `اختر الفرع لجهاز ${term.terminal_name}`
                            : `Select branch for ${term.terminal_name}`
                        }
                        value={chosenBranch}
                        onChange={(e) =>
                          setSelectedBranches((prev) => ({
                            ...prev,
                            [term.terminal_id]: e.target.value,
                          }))
                        }
                        className="h-9 w-full min-w-[165px] rounded-xl bg-[#F6F7F8] px-3 text-xs font-semibold text-slate-900 ring-1 ring-slate-900/[0.08] outline-none focus:ring-2 focus:ring-emerald-500/40 dark:bg-[#141F1B] dark:text-white dark:ring-emerald-400/20"
                      >
                        {branchOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {isAr
                              ? `${opt.labelAr} (${opt.labelEn})`
                              : `${opt.labelEn} (${opt.labelAr})`}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3.5 py-2.5 text-end">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() =>
                          void handleSaveTerminal(term.terminal_id, chosenBranch)
                        }
                        className="btn-colored inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60 dark:bg-emerald-500 dark:text-[#04130D]"
                      >
                        {justSaved ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Link2 className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {isSaving
                            ? isAr
                              ? 'جارٍ الحفظ...'
                              : 'Saving...'
                            : isAr
                              ? 'حفظ'
                              : 'Save'}
                        </span>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-emerald-50/75 px-4 py-3 text-[13px] font-semibold text-emerald-900 ring-1 ring-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-200 dark:ring-emerald-400/20">
          <div className="inline-flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              {isAr
                ? 'جميع أجهزة نقاط البيع النشطة مربوطة بالكامل على الفروع السبعة (0.000 د.ك غير مصنّف).'
                : 'All discovered Odoo 17 POS terminals are mapped across the 7 active branches (0.000 KWD unclassified).'}
            </span>
          </div>
        </div>
      )}

      {/* Admin-Assigned Overrides List (1-Click Unlink if Admin wishes to reassign) */}
      {mappedTerminals.length > 0 ? (
        <div className="space-y-2 pt-1">
          <div className="text-xs font-semibold text-slate-600 dark:text-[#8FA39B]">
            {isAr
              ? `أجهزة تم ربطها يدوياً بواسطة مسؤول النظام (${mappedTerminals.length})`
              : `Terminals Assigned by System Admin (${mappedTerminals.length})`}
          </div>
          <div className="flex flex-wrap gap-2">
            {mappedTerminals.map((item) => (
              <div
                key={item.terminal_id}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-50/80 px-3 py-1.5 text-xs font-semibold text-emerald-950 ring-1 ring-emerald-500/25 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-400/25"
              >
                <span dir="ltr" className="font-mono font-bold">
                  #{item.terminal_id}
                </span>
                <span>{item.terminal_name}</span>
                <span>→</span>
                <span className="font-bold">
                  {isAr
                    ? item.assigned_branch_label_ar
                    : item.assigned_branch_label_en}
                </span>
                <span dir="ltr" className="font-mono tabular-nums">
                  ({fmtKwd(item.net_sales_kwd)} KWD)
                </span>
                <button
                  type="button"
                  disabled={savingTerminalId === item.terminal_id}
                  onClick={() => void handleSaveTerminal(item.terminal_id, null)}
                  title={isAr ? 'إلغاء الربط' : 'Unlink terminal'}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-white/90 px-2 py-0.5 text-xs font-semibold text-slate-700 hover:text-rose-600 dark:bg-white/10 dark:text-slate-200 dark:hover:text-rose-300"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>{isAr ? 'فك' : 'Unlink'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
