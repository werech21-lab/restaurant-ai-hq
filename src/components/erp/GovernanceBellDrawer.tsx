'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Lock,
  MessageCircle,
  RefreshCw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Unlock,
  X,
  XCircle,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { formatDateTime, formatKwd, type FormatLocale } from '@/lib/format'
import {
  normalizeExecSessionRole,
  type ExecSessionRole,
} from '@/lib/auth/exec-role-meta'
import type { GlobalBranch } from '@/lib/aether/global-filter-engine'
import { ExecutivePinModal } from '@/components/erp/ExecutivePinModal'
import { OfficialCircularPrintModal } from '@/components/erp/OfficialCircularPrintModal'
import {
  approveRequestById,
  buildCircularSerialRef,
  createInitialGovernanceStore,
  evaluateLiveOdooBreaches,
  flagDecisionRegressionInStore,
  freezeBreachById,
  getExecutiveSession,
  GOVERNANCE_UPDATED_EVENT,
  isExecutiveGovernanceRole,
  isVerifiedOdooGovernanceBreach,
  loadGovernanceStore,
  lockExecutiveSession,
  markAllBranchesReceived,
  pushGovernancePatchToServer,
  recordIssuedCircular,
  rejectRequestById,
  retroactivelyApproveBreachById,
  submitApprovalRequest,
  syncGovernanceFromServer,
  toggleBranchCircularReceipt,
  unfreezeBreachById,
  type ComplianceBreachItem,
  type ExecutiveSessionState,
  type FlaggedDecisionRegression,
  type GovernanceAdminThresholds,
  type GovernanceApprovalMeta,
  type GovernanceApprovalRequest,
  type GovernanceDomain,
  type OfficialCircularDocument,
  type OfficialCircularKind,
  type PersistedGovernanceStore,
} from '@/lib/governance-compliance'

interface PendingPinRequest {
  titleAr?: string
  titleEn?: string
  mode?: 'verify' | 'change'
  onSuccess?: () => void
}

export interface GovernanceContextValue {
  isAuditor: boolean
  sessionRole: ExecSessionRole
  store: PersistedGovernanceStore
  session: ExecutiveSessionState
  approvals: GovernanceApprovalRequest[]
  pendingApprovals: GovernanceApprovalRequest[]
  breaches: ComplianceBreachItem[]
  activeBreaches: ComplianceBreachItem[]
  liveBadgeCount: number
  drawerOpen: boolean
  syncingCrossDevice: boolean
  triggerCrossDeviceSync: () => Promise<void>
  openDrawer: (initialTab?: DrawerTabId) => void
  closeDrawer: () => void
  requireManagerPin: (opts: PendingPinRequest) => void
  lockSession: () => void
  requestApproval: (input: {
    refKey: string
    domain: GovernanceDomain
    titleAr: string
    titleEn: string
    summaryAr: string
    summaryEn: string
    departmentAr: string
    departmentEn: string
    budgetOrCostKwd: number
    expectedMonthlyReturnKwd: number
    href: string
    meta?: GovernanceApprovalMeta
  }) => GovernanceApprovalRequest
  getApprovalByRef: (refKey: string) => GovernanceApprovalRequest | undefined
  approveItemWithPin: (id: string, titleAr: string, titleEn: string) => void
  rejectItemWithPin: (id: string, titleAr: string, titleEn: string) => void
  freezeBreachWithPin: (breach: ComplianceBreachItem, broadcastDirective?: boolean) => void
  retroactiveApproveBreachWithPin: (breach: ComplianceBreachItem) => void
  unfreezeBreachWithPin: (breach: ComplianceBreachItem) => void
  toggleBranchReceipt: (circularKey: string, branchId: Exclude<GlobalBranch, 'all'>) => void
  confirmAllBranchesReceipt: (circularKey: string) => void
  issueOfficialCircularWithPin: (opts: {
    circularKey: string
    kind?: OfficialCircularKind
    titleAr: string
    titleEn: string
    circularBodyAr: string
    circularBodyEn: string
    scopeAr?: string
    scopeEn?: string
    mandatoryRulesAr?: string[]
    mandatoryRulesEn?: string[]
    financialSummaryAr?: string
    financialSummaryEn?: string
    effectiveWindow?: string
    onIssued?: (meta: { sealId: string; issuedAtIso: string; serialRef: string }) => void
  }) => void
  openCircularPrintModal: (doc: OfficialCircularDocument) => void
  openBreachStopCircularPrint: (breach: ComplianceBreachItem) => void
  flagRegressionToWatchdog: (input: Omit<FlaggedDecisionRegression, 'flaggedAtIso'>) => void
}

export type DrawerTabId = 'all' | 'approvals' | 'breaches' | 'sealed'
export const OPEN_GOV_DRAWER_EVENT = 'aether:open-gov-drawer'
export const AUDITOR_ROLE_EVENT = 'aether:auditor-role'

const GovernanceContext = createContext<GovernanceContextValue | null>(null)

const INITIAL_SSR_STORE: PersistedGovernanceStore = createInitialGovernanceStore()

export function buildStopDirectiveCircularDoc(
  breach: ComplianceBreachItem,
  store: PersistedGovernanceStore,
): OfficialCircularDocument {
  const circularKey = `stop-circular:${breach.id}`
  const issued = store.issuedCirculars[circularKey]
  const frozenIso = breach.frozenAtIso || issued?.issuedAtIso || new Date().toISOString()
  return {
    circularKey,
    serialRef: issued?.serialRef || buildCircularSerialRef(circularKey),
    kind: 'stop-directive',
    titleAr: `أمر إيقاف مخالفة وتجميد صرف فوري ⛔ — ${breach.approvedDecisionTitleAr}`,
    titleEn: `Immediate Stop-Violation & Spend Freeze Order ⛔ — ${breach.approvedDecisionTitleEn}`,
    classificationAr: 'أمر إيقاف تنفيذي عاجل ⛔',
    classificationEn: 'Urgent Executive Stop-Violation Directive ⛔',
    scopeAr: breach.affectedScopeAr,
    scopeEn: breach.affectedScopeEn,
    issuedAtIso: frozenIso,
    sealId: issued?.sealId || (breach.frozen ? `VF-STOP-${frozenIso.slice(0, 4)}-2026` : undefined),
    approverRole: issued?.approverRole,
    approverRoleAr: issued?.approverRoleAr,
    approverRoleEn: issued?.approverRoleEn,
    approvedByAr: issued?.approvedByAr,
    approvedByEn: issued?.approvedByEn,
    financialSummaryAr: `أثر التجاوز المحسوب من Odoo: ${formatKwd(breach.monthlyLeakKwd, { locale: 'ar' })}`,
    financialSummaryEn: `Odoo computed overrun impact: ${formatKwd(breach.monthlyLeakKwd, { locale: 'en' })}`,
    mandatoryRulesAr: [
      breach.approvedRuleLimitAr,
      `مرجع Odoo (${breach.odooModel}): ${breach.odooMetricProofAr}`,
      'تجميد الصرف المخالف لحين التصحيح وفك التجميد بتأكيد تنفيذي مسجل على الخادم.',
    ],
    mandatoryRulesEn: [
      breach.approvedRuleLimitEn,
      `Odoo Reference (${breach.odooModel}): ${breach.odooMetricProofEn}`,
      'Freeze non-compliant spend until corrected and unfrozen with server-logged executive confirmation.',
    ],
    bodyAr: breach.stopDirectiveAr,
    bodyEn: breach.stopDirectiveEn,
    odooRecordUrl: breach.odooRecordUrl,
    odooModel: breach.odooModel,
    adminThreshold: breach.adminThreshold,
    computedValue: breach.computedValue,
  }
}

export function GovernanceProvider({
  children,
  isAuditor = false,
  sessionRole,
}: {
  children: React.ReactNode
  isAuditor?: boolean
  sessionRole?: ExecSessionRole
}) {
  const resolvedRole: ExecSessionRole = isAuditor
    ? 'auditor'
    : (normalizeExecSessionRole(sessionRole) ?? 'admin')
  const [store, setStore] = useState<PersistedGovernanceStore>(INITIAL_SSR_STORE)
  const [session, setSession] = useState<ExecutiveSessionState>({
    active: false,
    unlockedAt: null,
    expiresAt: null,
    remainingSeconds: 0,
  })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerTab, setDrawerTab] = useState<DrawerTabId>('all')
  const [pinPrompt, setPinPrompt] = useState<PendingPinRequest | null>(null)
  const [printDoc, setPrintDoc] = useState<OfficialCircularDocument | null>(null)
  const [syncingCrossDevice, setSyncingCrossDevice] = useState(false)
  const [toastMsg, setToastMsg] = useState<{ ar: string; en: string } | null>(null)
  const pendingCallbackRef = useRef<(() => void) | undefined>(undefined)

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.auditor = isAuditor ? 'true' : 'false'
      document.documentElement.dataset.sessionRole = resolvedRole
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(AUDITOR_ROLE_EVENT, { detail: isAuditor }))
    }
  }, [isAuditor, resolvedRole])

  const syncFromStorage = useCallback(() => {
    setStore(loadGovernanceStore())
    setSession(
      isAuditor
        ? { active: false, unlockedAt: null, expiresAt: null, remainingSeconds: 0 }
        : getExecutiveSession(),
    )
  }, [isAuditor])

  const pullReadOnlyServerStore = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/erp/governance', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      })
      if (!res.ok) return false
      const json = (await res.json()) as { ok?: boolean; store?: PersistedGovernanceStore }
      if (json?.ok && json.store) {
        setStore(json.store)
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  const triggerCrossDeviceSync = useCallback(async () => {
    setSyncingCrossDevice(true)
    try {
      if (isAuditor) {
        await pullReadOnlyServerStore()
      } else {
        const changed = await syncGovernanceFromServer()
        if (changed) syncFromStorage()
      }
    } finally {
      setSyncingCrossDevice(false)
    }
  }, [isAuditor, pullReadOnlyServerStore, syncFromStorage])

  useEffect(() => {
    syncFromStorage()
    void triggerCrossDeviceSync()

    const onGovUpdate = () => syncFromStorage()
    const onStorage = () => syncFromStorage()
    const onExternalOpen = (e: Event) => {
      const requestedTab = (e as CustomEvent<DrawerTabId | undefined>).detail ?? 'all'
      setDrawerTab(requestedTab)
      setDrawerOpen(true)
    }
    const onFocusOrVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        if (isAuditor) {
          void pullReadOnlyServerStore()
        } else {
          void syncGovernanceFromServer().then((changed) => {
            if (changed) syncFromStorage()
          })
        }
      }
    }

    window.addEventListener(GOVERNANCE_UPDATED_EVENT, onGovUpdate)
    window.addEventListener('storage', onStorage)
    window.addEventListener(OPEN_GOV_DRAWER_EVENT, onExternalOpen)
    window.addEventListener('focus', onFocusOrVisible)
    document.addEventListener('visibilitychange', onFocusOrVisible)

    const sessionTick = window.setInterval(() => {
      if (!isAuditor) {
        setSession(getExecutiveSession())
      }
    }, 1000)

    const crossDevicePoll = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        if (isAuditor) {
          void pullReadOnlyServerStore()
        } else {
          void syncGovernanceFromServer().then((changed) => {
            if (changed) syncFromStorage()
          })
        }
      }
    }, 12000)

    return () => {
      window.removeEventListener(GOVERNANCE_UPDATED_EVENT, onGovUpdate)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(OPEN_GOV_DRAWER_EVENT, onExternalOpen)
      window.removeEventListener('focus', onFocusOrVisible)
      document.removeEventListener('visibilitychange', onFocusOrVisible)
      window.clearInterval(sessionTick)
      window.clearInterval(crossDevicePoll)
    }
  }, [isAuditor, pullReadOnlyServerStore, syncFromStorage, triggerCrossDeviceSync])

  const showToast = useCallback((ar: string, en: string) => {
    setToastMsg({ ar, en })
    window.setTimeout(() => {
      setToastMsg((cur) => (cur?.ar === ar ? null : cur))
    }, 3200)
  }, [])

  const notifyAuditorReadOnly = useCallback(() => {
    showToast(
      'وضع المراجع الخارجي — قراءة فقط • الاعتمادات والتعديلات مقفلة 🔒',
      'Read-Only Session • Approvals & mutations are disabled 🔒',
    )
  }, [showToast])

  const requireManagerPin = useCallback(
    (opts: PendingPinRequest) => {
      if (isAuditor) {
        notifyAuditorReadOnly()
        return
      }
      const liveSession = getExecutiveSession()
      if (liveSession.active && opts.mode !== 'change') {
        opts.onSuccess?.()
        return
      }
      pendingCallbackRef.current = opts.onSuccess
      setPinPrompt(opts)
    },
    [isAuditor, notifyAuditorReadOnly],
  )

  const lockSession = useCallback(() => {
    if (isAuditor) return
    lockExecutiveSession()
    setSession(getExecutiveSession())
    showToast('تم قفل صلاحية المدير التنفيذي 🔒', 'Executive Session locked 🔒')
  }, [isAuditor, showToast])

  const requestApproval = useCallback(
    (input: Parameters<typeof submitApprovalRequest>[0]) => {
      if (isAuditor) {
        notifyAuditorReadOnly()
        const existing = store.approvals.find((a) => a.refKey === input.refKey)
        if (existing) return existing
        return {
          id: `readonly-${input.refKey}`,
          refKey: input.refKey,
          domain: input.domain,
          titleAr: input.titleAr,
          titleEn: input.titleEn,
          summaryAr: input.summaryAr,
          summaryEn: input.summaryEn,
          departmentAr: input.departmentAr,
          departmentEn: input.departmentEn,
          budgetOrCostKwd: input.budgetOrCostKwd,
          expectedMonthlyReturnKwd: input.expectedMonthlyReturnKwd,
          href: input.href,
          createdAtIso: new Date().toISOString(),
          status: 'pending' as const,
          meta: input.meta,
        } satisfies GovernanceApprovalRequest
      }
      const created = submitApprovalRequest(input)
      syncFromStorage()
      showToast(
        'تم رفع الطلب ومزامنته مع جرس المدير عبر الأجهزة 🔔',
        'Approval request synced to Manager Bell across devices 🔔',
      )
      return created
    },
    [isAuditor, notifyAuditorReadOnly, showToast, store.approvals, syncFromStorage],
  )

  const getApprovalByRef = useCallback(
    (refKey: string) => store.approvals.find((a) => a.refKey === refKey),
    [store.approvals],
  )

  const approveItemWithPin = useCallback(
    (id: string, titleAr: string, titleEn: string) => {
      requireManagerPin({
        titleAr: `اعتماد وختم: ${titleAr}`,
        titleEn: `Approve & Seal: ${titleEn}`,
        onSuccess: () => {
          const item = approveRequestById(id, resolvedRole)
          void pushGovernancePatchToServer({
            action: 'approve',
            approvalId: id,
            confirmedByExecutive: true,
          })
          syncFromStorage()
          if (item?.seal) {
            const roleAr = item.seal.approverRoleAr ?? 'مسؤول النظام'
            const roleEn = item.seal.approverRoleEn ?? 'System Admin'
            showToast(
              `تم الاعتماد بصفة (${roleAr}) بالختم الرقمي (${item.seal.sealId}) ✅`,
              `Approved as (${roleEn}) with Digital Seal (${item.seal.sealId}) ✅`,
            )
          }
        },
      })
    },
    [requireManagerPin, resolvedRole, showToast, syncFromStorage],
  )

  const rejectItemWithPin = useCallback(
    (id: string, titleAr: string, titleEn: string) => {
      requireManagerPin({
        titleAr: `رفض الطلب: ${titleAr}`,
        titleEn: `Reject Request: ${titleEn}`,
        onSuccess: () => {
          rejectRequestById(id)
          void pushGovernancePatchToServer({
            action: 'reject',
            approvalId: id,
            confirmedByExecutive: true,
          })
          syncFromStorage()
          showToast('تم رفض الطلب وتسجيل القرار ❌', 'Request rejected & logged ❌')
        },
      })
    },
    [requireManagerPin, showToast, syncFromStorage],
  )

  const breaches = useMemo(() => evaluateLiveOdooBreaches(store), [store])
  const activeBreaches = useMemo(() => breaches.filter((b) => !b.frozen), [breaches])

  const freezeBreachWithPin = useCallback(
    (breach: ComplianceBreachItem, broadcastDirective = false) => {
      if (!isExecutiveGovernanceRole(resolvedRole) || !isVerifiedOdooGovernanceBreach(breach)) {
        showToast(
          'الإيقاف والتعميم معطّل حتى تتوفر مخالفة حقيقية من Odoo بسقف محفوظ من الأدمن',
          'Freeze & circular are disabled until a real Odoo breach with admin-saved threshold exists',
        )
        return
      }
      requireManagerPin({
        titleAr: broadcastDirective
          ? 'إيقاف المخالفة وتعميم أمر إيقاف فوري ⛔'
          : 'إيقاف المخالفة وتجميد الصرف فوراً ⛔',
        titleEn: 'Stop Breach & Freeze Spend Immediately ⛔',
        onSuccess: () => {
          void (async () => {
            const res = await pushGovernancePatchToServer({
              action: 'freezeBreach',
              breachId: breach.id,
              confirmedByExecutive: true,
            })
            if (!res.ok) {
              showToast(
                res.error ?? 'تعذر تسجيل أمر التجميد على الخادم',
                res.error ?? 'Server rejected freeze directive',
              )
              return
            }
            freezeBreachById(breach.id)
            const circularKey = `stop-circular:${breach.id}`
            const meta = recordIssuedCircular(
              circularKey,
              `أمر إيقاف مخالفة: ${breach.approvedDecisionTitleAr}`,
              `Stop-Violation Order: ${breach.approvedDecisionTitleEn}`,
              {
                kind: 'stop-directive',
                scopeAr: breach.affectedScopeAr,
                scopeEn: breach.affectedScopeEn,
                bodyAr: breach.stopDirectiveAr,
                bodyEn: breach.stopDirectiveEn,
              },
              resolvedRole,
            )
            await pushGovernancePatchToServer({
              action: 'issueCircular',
              circularKey,
              confirmedByExecutive: true,
              circularRecord: {
                issuedAtIso: meta.issuedAtIso,
                sealId: meta.sealId,
                serialRef: meta.serialRef,
                kind: 'stop-directive',
                titleAr: `أمر إيقاف مخالفة: ${breach.approvedDecisionTitleAr}`,
                titleEn: `Stop-Violation Order: ${breach.approvedDecisionTitleEn}`,
                scopeAr: breach.affectedScopeAr,
                scopeEn: breach.affectedScopeEn,
                bodyAr: breach.stopDirectiveAr,
                bodyEn: breach.stopDirectiveEn,
              },
            })
            syncFromStorage()
            if (broadcastDirective && typeof navigator !== 'undefined' && navigator.clipboard) {
              const isDocAr =
                typeof document !== 'undefined' ? document.documentElement.lang !== 'en' : true
              void navigator.clipboard
                .writeText(isDocAr ? breach.stopDirectiveAr : breach.stopDirectiveEn)
                .catch(() => {})
            }
            showToast(
              'تم تسجيل أمر التجميد بتأكيد تنفيذي في سجل الخادم ⛔',
              'Freeze directive logged in server executive register ⛔',
            )
          })()
        },
      })
    },
    [requireManagerPin, resolvedRole, showToast, syncFromStorage],
  )

  const retroactiveApproveBreachWithPin = useCallback(
    (breach: ComplianceBreachItem) => {
      if (!isVerifiedOdooGovernanceBreach(breach)) return
      requireManagerPin({
        titleAr: 'اعتماد استثنائي بأثر رجعي وختم التجاوز ✅',
        titleEn: 'Retroactive Executive Approval & Digital Seal ✅',
        onSuccess: () => {
          const seal = retroactivelyApproveBreachById(breach, resolvedRole)
          syncFromStorage()
          showToast(
            `تم الاعتماد الاستثنائي بصفة (${seal.approverRoleAr ?? 'مسؤول النظام'}) بالختم (${seal.sealId}) ✅`,
            `Retroactive approval sealed by (${seal.approverRoleEn ?? 'System Admin'}) (${seal.sealId}) ✅`,
          )
        },
      })
    },
    [requireManagerPin, resolvedRole, showToast, syncFromStorage],
  )

  const unfreezeBreachWithPin = useCallback(
    (breach: ComplianceBreachItem) => {
      requireManagerPin({
        titleAr: 'فك التجميد بعد التصحيح والمطابقة 🔓',
        titleEn: 'Unfreeze After Correction 🔓',
        onSuccess: () => {
          void pushGovernancePatchToServer({
            action: 'unfreezeBreach',
            breachId: breach.id,
            confirmedByExecutive: true,
          })
          unfreezeBreachById(breach.id)
          syncFromStorage()
          showToast('تم فك التجميد وتسجيل الإجراء 🔓', 'Unfrozen & logged on server 🔓')
        },
      })
    },
    [requireManagerPin, showToast, syncFromStorage],
  )

  const toggleBranchReceipt = useCallback(
    (circularKey: string, branchId: Exclude<GlobalBranch, 'all'>) => {
      if (isAuditor) {
        notifyAuditorReadOnly()
        return
      }
      toggleBranchCircularReceipt(circularKey, branchId)
      syncFromStorage()
    },
    [isAuditor, notifyAuditorReadOnly, syncFromStorage],
  )

  const confirmAllBranchesReceipt = useCallback(
    (circularKey: string) => {
      if (isAuditor) {
        notifyAuditorReadOnly()
        return
      }
      markAllBranchesReceived(circularKey)
      syncFromStorage()
    },
    [isAuditor, notifyAuditorReadOnly, syncFromStorage],
  )

  const issueOfficialCircularWithPin = useCallback(
    (opts: {
      circularKey: string
      kind?: OfficialCircularKind
      titleAr: string
      titleEn: string
      circularBodyAr: string
      circularBodyEn: string
      scopeAr?: string
      scopeEn?: string
      mandatoryRulesAr?: string[]
      mandatoryRulesEn?: string[]
      financialSummaryAr?: string
      financialSummaryEn?: string
      effectiveWindow?: string
      onIssued?: (meta: { sealId: string; issuedAtIso: string; serialRef: string }) => void
    }) => {
      if (!isExecutiveGovernanceRole(resolvedRole) || breaches.length === 0) {
        showToast(
          'إصدار التعميم الرسمي معطّل حتى تتوفر تنبيهات مبنية من Odoo بسقوف يحفظها الأدمن',
          'Official circulars are disabled until Odoo alerts with admin-saved thresholds exist',
        )
        return
      }
      requireManagerPin({
        titleAr: `تعميم رسمي مختوم: ${opts.titleAr}`,
        titleEn: `Issue Stamped Circular: ${opts.titleEn}`,
        onSuccess: () => {
          void (async () => {
            const meta = recordIssuedCircular(
              opts.circularKey,
              opts.titleAr,
              opts.titleEn,
              {
                kind: opts.kind,
                scopeAr: opts.scopeAr,
                scopeEn: opts.scopeEn,
                mandatoryRulesAr: opts.mandatoryRulesAr,
                mandatoryRulesEn: opts.mandatoryRulesEn,
                financialSummaryAr: opts.financialSummaryAr,
                financialSummaryEn: opts.financialSummaryEn,
                effectiveWindow: opts.effectiveWindow,
                bodyAr: opts.circularBodyAr,
                bodyEn: opts.circularBodyEn,
              },
              resolvedRole,
            )
            const res = await pushGovernancePatchToServer({
              action: 'issueCircular',
              circularKey: opts.circularKey,
              confirmedByExecutive: true,
              circularRecord: {
                issuedAtIso: meta.issuedAtIso,
                sealId: meta.sealId,
                serialRef: meta.serialRef,
                kind: opts.kind,
                titleAr: opts.titleAr,
                titleEn: opts.titleEn,
                scopeAr: opts.scopeAr,
                scopeEn: opts.scopeEn,
                mandatoryRulesAr: opts.mandatoryRulesAr,
                mandatoryRulesEn: opts.mandatoryRulesEn,
                financialSummaryAr: opts.financialSummaryAr,
                financialSummaryEn: opts.financialSummaryEn,
                effectiveWindow: opts.effectiveWindow,
                bodyAr: opts.circularBodyAr,
                bodyEn: opts.circularBodyEn,
              },
            })
            if (!res.ok) {
              showToast(
                res.error ?? 'تعذر تسجيل التعميم على الخادم',
                res.error ?? 'Failed to log circular on server',
              )
              return
            }
            syncFromStorage()
            opts.onIssued?.(meta)
            showToast(
              `تم إصدار التعميم (${meta.serialRef}) وتسجيله في الخادم 📋`,
              `Official circular (${meta.serialRef}) issued & logged on server 📋`,
            )
          })()
        },
      })
    },
    [breaches.length, requireManagerPin, resolvedRole, showToast, syncFromStorage],
  )

  const openCircularPrintModal = useCallback(
    (doc: OfficialCircularDocument) => {
      if (breaches.length === 0 && !doc.odooRecordUrl) {
        showToast(
          'طباعة التعميم معطّلة حتى تتوفر تنبيهات مبنية من Odoo بسقوف يحفظها الأدمن',
          'Circular printing is disabled until Odoo alerts with admin-saved thresholds exist',
        )
        return
      }
      setPrintDoc(doc)
    },
    [breaches.length, showToast],
  )

  const openBreachStopCircularPrint = useCallback(
    (breach: ComplianceBreachItem) => {
      if (!isVerifiedOdooGovernanceBreach(breach)) return
      const liveStore = isAuditor ? store : loadGovernanceStore()
      setPrintDoc(buildStopDirectiveCircularDoc(breach, liveStore))
    },
    [isAuditor, store],
  )

  const flagRegressionToWatchdog = useCallback(
    (input: Omit<FlaggedDecisionRegression, 'flaggedAtIso'>) => {
      if (isAuditor) {
        notifyAuditorReadOnly()
        return
      }
      flagDecisionRegressionInStore(input)
      syncFromStorage()
      showToast(
        'تم حفظ الملاحظة للمراجعة الإدارية 🔔',
        'Flagged note saved for executive review 🔔',
      )
    },
    [isAuditor, notifyAuditorReadOnly, showToast, syncFromStorage],
  )

  const approvals = store.approvals
  const pendingApprovals = useMemo(
    () => approvals.filter((a) => a.status === 'pending'),
    [approvals],
  )
  const liveBadgeCount = pendingApprovals.length + activeBreaches.length

  const openDrawer = useCallback((initialTab: DrawerTabId = 'all') => {
    setDrawerTab(initialTab)
    setDrawerOpen(true)
  }, [])

  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  const value = useMemo<GovernanceContextValue>(
    () => ({
      isAuditor,
      sessionRole: resolvedRole,
      store,
      session,
      approvals,
      pendingApprovals,
      breaches,
      activeBreaches,
      liveBadgeCount,
      drawerOpen,
      syncingCrossDevice,
      triggerCrossDeviceSync,
      openDrawer,
      closeDrawer,
      requireManagerPin,
      lockSession,
      requestApproval,
      getApprovalByRef,
      approveItemWithPin,
      rejectItemWithPin,
      freezeBreachWithPin,
      retroactiveApproveBreachWithPin,
      unfreezeBreachWithPin,
      toggleBranchReceipt,
      confirmAllBranchesReceipt,
      issueOfficialCircularWithPin,
      openCircularPrintModal,
      openBreachStopCircularPrint,
      flagRegressionToWatchdog,
    }),
    [
      activeBreaches,
      approvals,
      approveItemWithPin,
      breaches,
      closeDrawer,
      confirmAllBranchesReceipt,
      drawerOpen,
      flagRegressionToWatchdog,
      freezeBreachWithPin,
      getApprovalByRef,
      isAuditor,
      issueOfficialCircularWithPin,
      liveBadgeCount,
      lockSession,
      openBreachStopCircularPrint,
      openCircularPrintModal,
      openDrawer,
      pendingApprovals,
      rejectItemWithPin,
      requestApproval,
      requireManagerPin,
      resolvedRole,
      retroactiveApproveBreachWithPin,
      session,
      store,
      syncingCrossDevice,
      toggleBranchReceipt,
      triggerCrossDeviceSync,
      unfreezeBreachWithPin,
    ],
  )

  return (
    <GovernanceContext.Provider value={value}>
      {children}
      <GovernanceSlideOverDrawer
        open={drawerOpen}
        tab={drawerTab}
        onTabChange={setDrawerTab}
        onClose={closeDrawer}
      />
      <OfficialCircularPrintModal
        open={Boolean(printDoc)}
        doc={printDoc}
        store={store}
        onClose={() => setPrintDoc(null)}
        onToggleBranchReceipt={isAuditor ? undefined : toggleBranchReceipt}
        onConfirmAllBranches={isAuditor ? undefined : confirmAllBranchesReceipt}
        onSealNow={
          isAuditor
            ? undefined
            : (docToSeal) => {
                issueOfficialCircularWithPin({
                  circularKey: docToSeal.circularKey,
                  kind: docToSeal.kind,
                  titleAr: docToSeal.titleAr,
                  titleEn: docToSeal.titleEn,
                  circularBodyAr: docToSeal.bodyAr ?? docToSeal.titleAr,
                  circularBodyEn: docToSeal.bodyEn ?? docToSeal.titleEn,
                  scopeAr: docToSeal.scopeAr,
                  scopeEn: docToSeal.scopeEn,
                  mandatoryRulesAr: docToSeal.mandatoryRulesAr,
                  mandatoryRulesEn: docToSeal.mandatoryRulesEn,
                  financialSummaryAr: docToSeal.financialSummaryAr,
                  financialSummaryEn: docToSeal.financialSummaryEn,
                  effectiveWindow: docToSeal.effectiveWindow,
                  onIssued: (meta) => {
                    setPrintDoc((prev) =>
                      prev
                        ? {
                            ...prev,
                            sealId: meta.sealId,
                            serialRef: meta.serialRef,
                            issuedAtIso: meta.issuedAtIso,
                          }
                        : null,
                    )
                  },
                })
              }
        }
      />
      <ExecutivePinModal
        open={Boolean(pinPrompt)}
        actionTitleAr={pinPrompt?.titleAr}
        actionTitleEn={pinPrompt?.titleEn}
        initialMode={pinPrompt?.mode ?? 'verify'}
        onClose={() => {
          pendingCallbackRef.current = undefined
          setPinPrompt(null)
        }}
        onVerified={() => {
          const fn = pendingCallbackRef.current
          pendingCallbackRef.current = undefined
          setSession(getExecutiveSession())
          fn?.()
        }}
      />
      {toastMsg ? <GovernanceToast ar={toastMsg.ar} en={toastMsg.en} /> : null}
    </GovernanceContext.Provider>
  )
}

function GovernanceToast({ ar, en }: { ar: string; en: string }) {
  const { locale } = useI18n()
  const isAr = locale === 'ar'
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="fixed bottom-5 start-1/2 z-[140] -translate-x-1/2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-neutral-900 shadow-[0_8px_28px_rgba(15,23,42,0.16)] ring-1 ring-emerald-500/25 dark:bg-neutral-900 dark:text-emerald-200"
    >
      {isAr ? ar : en}
    </div>,
    document.body,
  )
}

export function useOptionalGovernance(): GovernanceContextValue | null {
  return useContext(GovernanceContext)
}

export function useGovernance(): GovernanceContextValue {
  const ctx = useContext(GovernanceContext)
  if (!ctx) {
    throw new Error('useGovernance must be used within GovernanceProvider')
  }
  return ctx
}

function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function GovernanceBellTrigger(props: { showInlinePin?: boolean }) {
  const showInlinePin = props?.showInlinePin ?? false
  const { locale } = useI18n()
  const isAr = locale === 'ar'
  const {
    session,
    pendingApprovals,
    activeBreaches,
    liveBadgeCount,
    openDrawer,
    requireManagerPin,
    lockSession,
  } = useGovernance()

  return (
    <div className="inline-flex items-center gap-1.5">
      {showInlinePin ? (
        session.active ? (
          <div className="hidden items-center gap-1 rounded-xl bg-emerald-50 px-2.5 py-1 text-[13px] font-semibold text-emerald-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] lg:inline-flex dark:bg-emerald-950/60 dark:text-emerald-200">
            <span>{isAr ? 'وضع المدير نشط 🔓' : 'Manager Active 🔓'}</span>
            <span dir="ltr" className="font-mono text-xs tabular-nums opacity-80">
              {formatCountdown(session.remainingSeconds)}
            </span>
            <button
              type="button"
              onClick={lockSession}
              title={isAr ? 'قفل الصلاحية فوراً' : 'Lock Executive Session'}
              className="ms-1 cursor-pointer rounded-lg bg-white px-2 py-0.5 text-xs font-semibold text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors duration-150 hover:bg-rose-50 hover:text-rose-700 dark:bg-[#101C17] dark:text-slate-200"
            >
              {isAr ? 'قفل الصلاحية 🔒' : 'Lock 🔒'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() =>
              requireManagerPin({
                titleAr: 'تفعيل وضع المدير لمدة 15 دقيقة',
                titleEn: 'Unlock 15-Minute Manager Session',
              })
            }
            title={
              isAr
                ? 'فتح صلاحية المدير بالرمز السري (4 أرقام)'
                : 'Unlock Manager Session (4-digit PIN)'
            }
            className="ae-capsule hidden h-9 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors duration-150 lg:inline-flex"
          >
            <Lock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{isAr ? 'صلاحية المدير' : 'Manager PIN'}</span>
          </button>
        )
      ) : null}

      <button
        type="button"
        onClick={() => openDrawer('all')}
        aria-label={
          isAr
            ? `جرس الحوكمة والاعتماد (${liveBadgeCount})`
            : `Governance & Approvals Bell (${liveBadgeCount})`
        }
        title={
          isAr
            ? `${pendingApprovals.length} طلبات معلقة · ${activeBreaches.length} مخالفات Odoo`
            : `${pendingApprovals.length} Pending Approvals · ${activeBreaches.length} Odoo Breaches`
        }
        className="ae-capsule relative inline-flex h-8 cursor-pointer items-center gap-1 rounded-xl px-2.5 text-xs font-semibold transition-all duration-[160ms] active:scale-95 lg:inline-flex lg:h-9 lg:gap-1.5 lg:px-3"
      >
        <Bell
          className={`h-4 w-4 shrink-0 ${
            activeBreaches.length > 0
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-emerald-600 dark:text-emerald-400'
          }`}
        />
        {liveBadgeCount > 0 ? (
          <span
            dir="ltr"
            style={{ color: '#FFFFFF' }}
            className={`btn-colored inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums text-white lg:h-5 lg:min-w-5 lg:text-xs ${
              activeBreaches.length > 0 ? 'bg-rose-600' : 'bg-emerald-600'
            }`}
          >
            {liveBadgeCount}
          </span>
        ) : (
          <span
            dir="ltr"
            className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-emerald-50 px-1.5 text-xs font-semibold tabular-nums text-emerald-700 lg:h-5 lg:min-w-5 lg:text-xs dark:bg-emerald-950/60 dark:text-emerald-300"
          >
            0
          </span>
        )}
      </button>
    </div>
  )
}

export function GovernanceSlideOverDrawer({
  open,
  tab,
  onTabChange,
  onClose,
}: {
  open: boolean
  tab: DrawerTabId
  onTabChange: (t: DrawerTabId) => void
  onClose: () => void
}) {
  const { locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  const isAr = fmtLocale !== 'en'
  const [mounted, setMounted] = useState(false)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const lastFocusedRef = useRef<HTMLElement | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [execConfirmedIds, setExecConfirmedIds] = useState<Record<string, boolean>>({})
  const [thresholdsOpen, setThresholdsOpen] = useState(false)
  const [savingThresholds, setSavingThresholds] = useState(false)
  const [discEnabled, setDiscEnabled] = useState(false)
  const [discCap, setDiscCap] = useState('')
  const [poEnabled, setPoEnabled] = useState(false)
  const [poCap, setPoCap] = useState('')
  const [commEnabled, setCommEnabled] = useState(false)
  const [commCap, setCommCap] = useState('')

  const {
    isAuditor,
    sessionRole,
    store,
    session,
    approvals,
    pendingApprovals,
    breaches,
    activeBreaches,
    syncingCrossDevice,
    triggerCrossDeviceSync,
    requireManagerPin,
    lockSession,
    approveItemWithPin,
    rejectItemWithPin,
    freezeBreachWithPin,
    unfreezeBreachWithPin,
    openBreachStopCircularPrint,
  } = useGovernance()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const t = store.adminThresholds ?? {}
    setDiscEnabled(Boolean(t.posDiscountPctCap?.enabled))
    setDiscCap(
      t.posDiscountPctCap?.thresholdValue !== undefined
        ? String(t.posDiscountPctCap.thresholdValue)
        : '',
    )
    setPoEnabled(Boolean(t.supplierOrderTotalCapKwd?.enabled))
    setPoCap(
      t.supplierOrderTotalCapKwd?.thresholdValue !== undefined
        ? String(t.supplierOrderTotalCapKwd.thresholdValue)
        : '',
    )
    setCommEnabled(Boolean(t.aggregatorCommissionPctCap?.enabled))
    setCommCap(
      t.aggregatorCommissionPctCap?.thresholdValue !== undefined
        ? String(t.aggregatorCommissionPctCap.thresholdValue)
        : '',
    )
  }, [store.adminThresholds])

  useEffect(() => {
    if (!open) {
      if (lastFocusedRef.current && typeof lastFocusedRef.current.focus === 'function') {
        lastFocusedRef.current.focus()
        lastFocusedRef.current = null
      }
      return
    }
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      lastFocusedRef.current = document.activeElement
    }
    const raf = window.requestAnimationFrame(() => {
      closeBtnRef.current?.focus()
    })
    void triggerCrossDeviceSync()
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onEsc)
    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onEsc)
    }
  }, [onClose, open, triggerCrossDeviceSync])

  const sealedHistory = useMemo(
    () => approvals.filter((a) => a.status === 'approved' || a.status === 'rejected'),
    [approvals],
  )

  const copyDirective = useCallback((id: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => {})
      setCopiedId(id)
      window.setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000)
    }
  }, [])

  const handleSaveThresholds = useCallback(() => {
    if (sessionRole !== 'admin' || isAuditor) return
    requireManagerPin({
      titleAr: 'حفظ سقوف تنبيهات Odoo الإدارية على الخادم',
      titleEn: 'Save Server Admin Odoo Alert Thresholds',
      onSuccess: () => {
        void (async () => {
          setSavingThresholds(true)
          try {
            const payload: Partial<GovernanceAdminThresholds> = {}
            if (discCap.trim() !== '') {
              payload.posDiscountPctCap = {
                enabled: discEnabled,
                thresholdValue: Number(discCap),
                odooModel: 'pos.order.line',
                updatedAtIso: new Date().toISOString(),
                updatedBySub: 'admin',
                updatedByRole: 'admin',
              }
            }
            if (poCap.trim() !== '') {
              payload.supplierOrderTotalCapKwd = {
                enabled: poEnabled,
                thresholdValue: Number(poCap),
                odooModel: 'purchase.order.line',
                updatedAtIso: new Date().toISOString(),
                updatedBySub: 'admin',
                updatedByRole: 'admin',
              }
            }
            if (commCap.trim() !== '') {
              payload.aggregatorCommissionPctCap = {
                enabled: commEnabled,
                thresholdValue: Number(commCap),
                odooModel: 'account.move.line',
                updatedAtIso: new Date().toISOString(),
                updatedBySub: 'admin',
                updatedByRole: 'admin',
              }
            }
            await pushGovernancePatchToServer({
              action: 'saveThresholds',
              adminThresholds: payload,
              confirmedByExecutive: true,
            })
            await triggerCrossDeviceSync()
          } finally {
            setSavingThresholds(false)
          }
        })()
      },
    })
  }, [
    commCap,
    commEnabled,
    discCap,
    discEnabled,
    isAuditor,
    poCap,
    poEnabled,
    requireManagerPin,
    sessionRole,
    triggerCrossDeviceSync,
  ])

  if (!mounted || !open) return null

  const canExecAct = isExecutiveGovernanceRole(sessionRole) && !isAuditor

  const tabs: { id: DrawerTabId; ar: string; en: string; count: number }[] = [
    {
      id: 'all',
      ar: 'الكل',
      en: 'All',
      count: pendingApprovals.length + activeBreaches.length,
    },
    {
      id: 'approvals',
      ar: 'طلبات الموافقة 🔔',
      en: 'Pending 🔔',
      count: pendingApprovals.length,
    },
    {
      id: 'breaches',
      ar: 'مخالفات Odoo',
      en: 'Odoo Alerts',
      count: activeBreaches.length,
    },
    {
      id: 'sealed',
      ar: 'المختوم ✅',
      en: 'Sealed ✅',
      count: sealedHistory.length,
    },
  ]

  const disabledButtonsNotice = isAr
    ? 'معطّل حتى تتوفر تنبيهات مبنية فعلياً من استعلامات Odoo حقيقية مع سقوف يحفظها الأدمن على الخادم'
    : 'Disabled until alerts are built from real Odoo queries with admin-saved server thresholds'

  return createPortal(
    <div
      id="vf-gov-drawer-backdrop"
      dir={isAr ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex justify-end bg-[#09110E]/35 backdrop-blur-[2px] transition-opacity duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <style>{`
        #vf-gov-drawer-backdrop {
          background-color: rgba(10, 10, 10, 0.35) !important;
          -webkit-backdrop-filter: blur(2px) !important;
          backdrop-filter: blur(2px) !important;
        }
        @keyframes vfBellDrawerSlideRtl {
          from { transform: translateX(-100%); opacity: 0.96; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes vfBellDrawerSlideLtr {
          from { transform: translateX(100%); opacity: 0.96; }
          to { transform: translateX(0); opacity: 1; }
        }
        .vf-bell-drawer-rtl {
          animation: vfBellDrawerSlideRtl 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .vf-bell-drawer-ltr {
          animation: vfBellDrawerSlideLtr 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
      `}</style>

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={isAr ? 'مركز اعتماد المدير وتنبيهات Odoo' : 'Executive Approval & Odoo Alerts'}
        className={`flex h-full w-full max-w-[480px] flex-col bg-[#F7F7F8] shadow-2xl dark:bg-neutral-950 dark:ring-1 dark:ring-white/[0.08] ${
          isAr ? 'vf-bell-drawer-rtl' : 'vf-bell-drawer-ltr'
        }`}
      >
        {/* Drawer Header */}
        <div className="bg-white px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-neutral-900">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-[17px] font-semibold tracking-tight text-neutral-950 dark:text-white">
                  {isAr ? 'مركز الحوكمة وتنبيهات Odoo' : 'Executive Governance & Odoo Alerts'}
                </h2>
                <p className="mt-0.5 text-xs text-neutral-400">
                  {isAr
                    ? `${pendingApprovals.length} طلب بانتظار الختم · ${activeBreaches.length} مخالفة مسجلة`
                    : `${pendingApprovals.length} awaiting PIN seal · ${activeBreaches.length} active alerts`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {sessionRole === 'admin' && !isAuditor ? (
                <button
                  type="button"
                  onClick={() => setThresholdsOpen((v) => !v)}
                  aria-label={isAr ? 'إعداد سقوف التنبيهات على الخادم' : 'Server Alert Thresholds'}
                  aria-expanded={thresholdsOpen}
                  title={isAr ? 'إعداد سقوف التنبيهات على الخادم (للأدمن)' : 'Server Alert Thresholds (Admin)'}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition-colors duration-150 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:bg-white/[0.06] dark:text-slate-300"
                >
                  <Sliders className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => void triggerCrossDeviceSync()}
                aria-label={isAr ? 'مزامنة فورية مع الخادم' : 'Sync with server'}
                title={isAr ? 'مزامنة فورية مع الخادم' : 'Sync with server'}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition-colors duration-150 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:bg-white/[0.06] dark:text-slate-300"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncingCrossDevice ? 'animate-spin text-emerald-600' : ''}`} aria-hidden />
              </button>

              <button
                ref={closeBtnRef}
                type="button"
                onClick={onClose}
                aria-label={isAr ? 'إغلاق' : 'Close'}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition-colors duration-150 hover:bg-neutral-200/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:bg-white/[0.06] dark:text-slate-300"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>

          {/* Executive Session Control Bar */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#F7F7F8] px-3.5 py-2.5 text-xs dark:bg-neutral-950">
            {isAuditor ? (
              <>
                <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
                  <Lock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    {isAr
                      ? 'وضع المراجع الخارجي — قراءة فقط (الاعتماد والتجميد مقفل)'
                      : 'External Reviewer — Read-Only (PIN & Mutations Disabled)'}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900 ring-1 ring-amber-500/25 dark:bg-amber-950/60 dark:text-amber-200">
                  {isAr ? 'وضع المراجع الخارجي' : 'Read-Only Session'}
                </span>
              </>
            ) : (
              <>
                {session.active ? (
                  <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
                    <Unlock className="h-4 w-4" />
                    <span>{isAr ? 'وضع المدير نشط 🔓' : 'Executive Session Active 🔓'}</span>
                    <span
                      dir="ltr"
                      className="rounded-full bg-emerald-100/80 px-2 py-0.5 font-mono text-xs tabular-nums text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                    >
                      {formatCountdown(session.remainingSeconds)}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 font-medium text-neutral-600 dark:text-slate-300">
                    <Lock className="h-4 w-4 text-neutral-400" />
                    <span>
                      {isAr
                        ? 'الاعتماد وإيقاف الصرف يتطلب رمز المدير (4 أرقام)'
                        : 'Approvals & freezes require 4-digit Manager PIN'}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  {session.active ? (
                    <button
                      type="button"
                      onClick={lockSession}
                      className="cursor-pointer rounded-full bg-white px-3 py-1 font-semibold text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors duration-150 hover:bg-rose-50 hover:text-rose-700 dark:bg-neutral-900 dark:text-slate-200"
                    >
                      {isAr ? 'قفل الصلاحية 🔒' : 'Lock Session 🔒'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        requireManagerPin({
                          titleAr: 'فتح صلاحية المدير لمدة 15 دقيقة',
                          titleEn: 'Unlock 15-Minute Executive Session',
                        })
                      }
                      className="btn-colored cursor-pointer rounded-xl bg-emerald-600 px-3 py-1 font-semibold text-white transition-colors duration-150 hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#04130D]"
                    >
                      {isAr ? 'فتح الصلاحية 🔓' : 'Unlock PIN 🔓'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      requireManagerPin({
                        mode: 'change',
                        titleAr: 'تغيير رمز المدير السري',
                        titleEn: 'Change Manager PIN',
                      })
                    }
                    title={isAr ? 'تغيير رمز المدير ⚙️' : 'Change Manager PIN ⚙️'}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-white px-2.5 py-1 font-medium text-neutral-600 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors duration-150 hover:text-neutral-950 dark:bg-[#101C17] dark:text-slate-300"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    <span>{isAr ? 'تغيير رمز المدير ⚙️' : 'PIN ⚙️'}</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {thresholdsOpen && sessionRole === 'admin' && !isAuditor ? (
            <div className="mt-3 space-y-2.5 rounded-2xl bg-neutral-50 p-3.5 text-xs ring-1 ring-slate-200 dark:bg-neutral-950 dark:ring-white/10">
              <div className="font-semibold text-neutral-900 dark:text-white">
                {isAr
                  ? 'إعداد سقوف التنبيهات على الخادم (للأدمن فقط — لا توجد ثوابت في الكود)'
                  : 'Server-Saved Alert Thresholds (Admin Only — Zero Code Constants)'}
              </div>

              <div className="grid grid-cols-1 gap-2">
                <label className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-neutral-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={discEnabled}
                      onChange={(e) => setDiscEnabled(e.target.checked)}
                    />
                    <span>{isAr ? 'سقف خصومات pos.order.line (%)' : 'POS Discount Cap (%)'}</span>
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={discCap}
                    onChange={(e) => setDiscCap(e.target.value)}
                    placeholder="—"
                    className="h-7 w-24 rounded-lg bg-white px-2 text-end tabular-nums ring-1 ring-slate-300 dark:bg-neutral-900 dark:ring-white/15"
                  />
                </label>

                <label className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-neutral-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={poEnabled}
                      onChange={(e) => setPoEnabled(e.target.checked)}
                    />
                    <span>
                      {isAr ? 'سقف مشتريات purchase.order.line (د.ك)' : 'Purchase Order Cap (KWD)'}
                    </span>
                  </span>
                  <input
                    type="number"
                    step="10"
                    min="0"
                    value={poCap}
                    onChange={(e) => setPoCap(e.target.value)}
                    placeholder="—"
                    className="h-7 w-24 rounded-lg bg-white px-2 text-end tabular-nums ring-1 ring-slate-300 dark:bg-neutral-900 dark:ring-white/15"
                  />
                </label>

                <label className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-neutral-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={commEnabled}
                      onChange={(e) => setCommEnabled(e.target.checked)}
                    />
                    <span>
                      {isAr
                        ? 'سقف عمولة المنصات المرحّلة account.move.line (%)'
                        : 'Posted Aggregator Commission Cap (%)'}
                    </span>
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={commCap}
                    onChange={(e) => setCommCap(e.target.value)}
                    placeholder="—"
                    className="h-7 w-24 rounded-lg bg-white px-2 text-end tabular-nums ring-1 ring-slate-300 dark:bg-neutral-900 dark:ring-white/15"
                  />
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={savingThresholds}
                  onClick={handleSaveThresholds}
                  className="btn-colored cursor-pointer rounded-xl bg-emerald-600 px-3.5 py-1.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {savingThresholds
                    ? isAr
                      ? 'جارٍ الحفظ...'
                      : 'Saving...'
                    : isAr
                      ? 'حفظ السقوف على الخادم'
                      : 'Save Server Thresholds'}
                </button>
              </div>
            </div>
          ) : null}

          {/* Filter Pills */}
          <div
            role="tablist"
            aria-label={isAr ? 'تصفية تنبيهات الحوكمة' : 'Filter governance alerts'}
            className="mt-3 flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar rounded-2xl bg-neutral-100/90 p-1 dark:bg-white/[0.06]"
          >
            {tabs.map((t) => {
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onTabChange(t.id)}
                  className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
                    active
                      ? 'btn-colored bg-emerald-600 text-white shadow-xs dark:bg-emerald-500 dark:text-[#04130D]'
                      : 'text-neutral-600 hover:bg-white hover:text-neutral-950 dark:text-slate-300 dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <span>{isAr ? t.ar : t.en}</span>
                  <span
                    dir="ltr"
                    className={`rounded-lg px-1.5 py-0.2 text-xs tabular-nums ${
                      active
                        ? 'bg-white/20 text-white dark:bg-black/15 dark:text-[#04130D]'
                        : 'bg-white text-neutral-700 dark:bg-white/10 dark:text-slate-200'
                    }`}
                  >
                    {t.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-3.5 overflow-y-auto p-4 sm:p-5">
          {/* 1. Odoo Governance Alerts */}
          {tab === 'all' || tab === 'breaches' ? (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-800 dark:text-slate-200">
                  <ShieldAlert className="h-4 w-4 text-emerald-600" />
                  <span>
                    {isAr
                      ? 'تنبيهات الحوكمة من استعلامات Odoo'
                      : 'Odoo Query Governance Alerts'}
                  </span>
                </span>
                <span dir="ltr" className="text-xs tabular-nums text-neutral-400">
                  {activeBreaches.length}
                </span>
              </div>

              {breaches.length === 0 ? (
                <div className="space-y-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-neutral-900">
                  <p className="text-xs leading-relaxed text-neutral-600 dark:text-slate-300">
                    {isAr
                      ? 'لا توجد مخالفات مسجلة من Odoo حالياً (0 مخالفات). لا تظهر التنبيهات إلا عند تجاوز قيمة محسوبة من Odoo لسقف يحفظه الأدمن على الخادم.'
                      : '0 Odoo breaches currently active. Alerts appear only when a real Odoo query exceeds an admin-saved server threshold.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled
                      title={disabledButtonsNotice}
                      className="inline-flex h-8 cursor-not-allowed items-center gap-1 rounded-full bg-neutral-200 px-3.5 text-xs font-semibold text-neutral-500 opacity-65 dark:bg-white/10 dark:text-slate-400"
                    >
                      <span>
                        {isAr
                          ? 'إيقاف فوري وتعميم أمر تجميد ⛔'
                          : 'Immediate Stop & Broadcast Freeze ⛔'}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled
                      title={disabledButtonsNotice}
                      className="inline-flex h-8 cursor-not-allowed items-center gap-1 rounded-full bg-neutral-200 px-3 text-xs font-semibold text-neutral-500 opacity-65 dark:bg-white/10 dark:text-slate-400"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>
                        {isAr ? 'طباعة / تصدير تعميم رسمي 📄' : 'Print / Export Official Circular 📄'}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                breaches.map((b) => {
                  const verified = isVerifiedOdooGovernanceBreach(b)
                  const confirmed = Boolean(execConfirmedIds[b.id])
                  const actionEnabled = verified && canExecAct && confirmed
                  const directiveText = isAr ? b.stopDirectiveAr : b.stopDirectiveEn
                  const waUrl = `https://wa.me/?text=${encodeURIComponent(directiveText)}`

                  return (
                    <article
                      key={b.id}
                      className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-150 dark:bg-neutral-900"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            b.frozen
                              ? 'bg-neutral-100 text-neutral-700 dark:bg-white/10 dark:text-slate-300'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                        >
                          <AlertTriangle className="h-3 w-3" />
                          <span>
                            {b.frozen
                              ? isAr
                                ? 'مجمد بتأكيد تنفيذي ⛔'
                                : 'Frozen by Executive ⛔'
                              : isAr
                                ? 'تجاوز سقف محفوظ على الخادم'
                                : 'Server Threshold Exceeded'}
                          </span>
                        </span>

                        <span
                          dir="ltr"
                          title={`Odoo Domain: ${JSON.stringify(b.odooDomain)}`}
                          className="rounded-full bg-neutral-100 px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-neutral-700 dark:bg-white/10 dark:text-slate-200"
                        >
                          {b.odooModel} · {b.computedValue} &gt; {b.adminThreshold}
                        </span>
                      </div>

                      <h3 className="mt-2 text-[14px] font-semibold leading-snug text-neutral-950 dark:text-white">
                        {isAr ? b.breachHeadlineAr : b.breachHeadlineEn}
                      </h3>
                      <p className="mt-1 text-xs text-neutral-500 dark:text-slate-300">
                        {isAr ? b.odooMetricProofAr : b.odooMetricProofEn}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F7F7F8] px-3 py-2 text-xs text-neutral-700 dark:bg-neutral-950 dark:text-slate-300">
                        <span dir="ltr" className="tabular-nums">
                          {b.period.from} → {b.period.to}
                        </span>
                        <a
                          href={b.odooRecordUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>{isAr ? 'فتح السجل في Odoo' : 'Open Record in Odoo'}</span>
                        </a>
                      </div>

                      {!isAuditor && canExecAct && !b.frozen ? (
                        <label className="mt-2.5 flex cursor-pointer items-center gap-2 rounded-xl bg-amber-50/70 px-3 py-2 text-xs font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                          <input
                            type="checkbox"
                            checked={confirmed}
                            onChange={(e) =>
                              setExecConfirmedIds((prev) => ({
                                ...prev,
                                [b.id]: e.target.checked,
                              }))
                            }
                          />
                          <span>
                            {isAr
                              ? 'أؤكد بصفتي التنفيذية مراجعة سجل Odoo واعتماد التجميد / التعميم في سجل الخادم'
                              : 'I explicitly confirm reviewing the Odoo record and logging this action on the server'}
                          </span>
                        </label>
                      ) : null}

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        {!b.frozen ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              disabled={!actionEnabled}
                              title={!actionEnabled ? disabledButtonsNotice : undefined}
                              onClick={() => actionEnabled && freezeBreachWithPin(b, true)}
                              style={{ color: '#FFFFFF' }}
                              className="btn-colored inline-flex h-8 items-center gap-1 rounded-full bg-rose-600 px-3.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <span>
                                {isAr
                                  ? 'إيقاف فوري وتعميم أمر تجميد ⛔'
                                  : 'Immediate Stop & Broadcast Freeze ⛔'}
                              </span>
                            </button>

                            <button
                              type="button"
                              disabled={!actionEnabled}
                              title={!actionEnabled ? disabledButtonsNotice : undefined}
                              onClick={() => actionEnabled && openBreachStopCircularPrint(b)}
                              className="inline-flex h-8 items-center gap-1 rounded-full bg-[#F7F7F8] px-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-200/70 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10 dark:text-slate-200"
                            >
                              <FileText className="h-3.5 w-3.5 text-emerald-600" />
                              <span>
                                {isAr ? 'طباعة / تصدير تعميم رسمي 📄' : 'Print Circular 📄'}
                              </span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              disabled={!canExecAct || !verified}
                              onClick={() => canExecAct && verified && unfreezeBreachWithPin(b)}
                              className="inline-flex h-8 items-center gap-1 rounded-full bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 transition-colors duration-150 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-950/60 dark:text-emerald-200"
                            >
                              <span>
                                {isAr ? 'فك التجميد بعد التصحيح 🔓' : 'Unfreeze After Fix 🔓'}
                              </span>
                            </button>

                            <button
                              type="button"
                              disabled={!verified}
                              onClick={() => verified && openBreachStopCircularPrint(b)}
                              className="inline-flex h-8 items-center gap-1 rounded-full bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-950/60 dark:text-emerald-200"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span>
                                {isAr ? 'طباعة / تصدير تعميم رسمي 📄' : 'Print Official Circular 📄'}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => copyDirective(b.id, directiveText)}
                              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-neutral-100 px-2.5 text-xs font-medium text-neutral-800 dark:bg-white/10 dark:text-slate-200"
                            >
                              {copiedId === b.id ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>{isAr ? 'تم النسخ' : 'Copied'}</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5" />
                                  <span>{isAr ? 'نسخ الأمر' : 'Copy Order'}</span>
                                </>
                              )}
                            </button>

                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#FFFFFF' }}
                              className="btn-colored inline-flex h-8 items-center gap-1 rounded-full bg-emerald-600 px-2.5 text-xs font-semibold text-white hover:bg-emerald-700"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              <span>{isAr ? 'واتساب' : 'WhatsApp'}</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </article>
                  )
                })
              )}
            </section>
          ) : null}

          {/* 2. Pending Department Approval Requests */}
          {tab === 'all' || tab === 'approvals' ? (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-neutral-700 dark:text-slate-200">
                  {isAr ? 'طلبات بانتظار موافقة المدير 🔔' : 'Pending Manager Approvals 🔔'}
                </span>
                <span className="text-xs tabular-nums text-neutral-400">
                  {pendingApprovals.length}
                </span>
              </div>

              {pendingApprovals.length === 0 ? (
                <div className="rounded-2xl bg-white p-4 text-center text-xs text-neutral-400 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-neutral-900">
                  {isAr ? 'لا توجد طلبات معلقة حالياً.' : 'Zero pending requests.'}
                </div>
              ) : (
                pendingApprovals.map((req) => (
                  <article
                    key={req.id}
                    className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-neutral-900"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700 dark:bg-emerald-950/60 dark:text-emerald-200">
                        {isAr ? req.departmentAr : req.departmentEn}
                      </span>
                      <div dir="ltr" className="flex items-center gap-2 text-xs font-semibold tabular-nums">
                        {req.budgetOrCostKwd > 0 ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                            {isAr ? 'التكلفة:' : 'Cost:'}{' '}
                            {formatKwd(req.budgetOrCostKwd, { locale: fmtLocale })}
                          </span>
                        ) : null}
                        {req.expectedMonthlyReturnKwd > 0 ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            {formatKwd(req.expectedMonthlyReturnKwd, {
                              locale: fmtLocale,
                              signed: true,
                            })}
                            {isAr ? '/شهر' : '/mo'}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <h3 className="mt-2 text-[14px] font-semibold text-neutral-950 dark:text-white">
                      {isAr ? req.titleAr : req.titleEn}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-slate-300">
                      {isAr ? req.summaryAr : req.summaryEn}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      {isAuditor ? (
                        <span className="inline-flex h-8 items-center gap-1 rounded-xl bg-amber-50 px-3 text-xs font-semibold text-amber-900 ring-1 ring-amber-500/20 dark:bg-amber-950/60 dark:text-amber-200">
                          <Lock className="h-3 w-3 shrink-0" />
                          <span>
                            {isAr ? 'وضع المراجع الخارجي — قراءة فقط' : 'Read-Only Session'}
                          </span>
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => approveItemWithPin(req.id, req.titleAr, req.titleEn)}
                            className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-emerald-600 px-3.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>{isAr ? 'موافقة واعتماد ✅' : 'Approve & Seal ✅'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => rejectItemWithPin(req.id, req.titleAr, req.titleEn)}
                            className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-neutral-100 px-3 text-xs font-medium text-neutral-700 transition-colors duration-150 hover:bg-rose-50 hover:text-rose-700 dark:bg-white/10 dark:text-slate-200"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span>{isAr ? 'رفض ❌' : 'Reject ❌'}</span>
                          </button>
                        </div>
                      )}

                      <Link
                        href={req.href}
                        onClick={onClose}
                        className="text-xs font-medium text-neutral-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                      >
                        {isAr ? 'عرض المصدر ↗' : 'View Source ↗'}
                      </Link>
                    </div>
                  </article>
                ))
              )}
            </section>
          ) : null}

          {/* 3. Sealed Executive Decisions & Server Log */}
          {tab === 'sealed' ? (
            <section className="space-y-2.5">
              {sealedHistory.length === 0 && (store.auditLog?.length ?? 0) === 0 ? (
                <div className="rounded-2xl bg-white p-5 text-center text-xs text-neutral-400 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-neutral-900">
                  {isAr ? 'لا توجد قرارات مختومة بعد.' : 'No sealed decisions recorded yet.'}
                </div>
              ) : (
                <>
                  {sealedHistory.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-neutral-900"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            item.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                        >
                          {item.status === 'approved'
                            ? isAr
                              ? 'معتمد ومختوم ✅'
                              : 'Approved & Sealed ✅'
                            : isAr
                              ? 'مرفوض ❌'
                              : 'Rejected ❌'}
                        </span>
                        {item.seal ? (
                          <span
                            dir="ltr"
                            className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                          >
                            {item.seal.sealId}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-2 text-[13.5px] font-semibold text-neutral-950 dark:text-white">
                        {isAr ? item.titleAr : item.titleEn}
                      </h3>
                      {item.seal ? (
                        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50/80 px-2 py-0.5 font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                            <span>
                              {isAr ? 'صفة المعتمد:' : 'Approver Role:'}{' '}
                              {isAr
                                ? (item.seal.approverRoleAr ?? item.seal.approvedByAr)
                                : (item.seal.approverRoleEn ?? item.seal.approvedByEn)}
                            </span>
                          </span>
                          <span dir="ltr" className="tabular-nums text-neutral-500 dark:text-slate-400">
                            {formatDateTime(item.seal.approvedAtIso, {
                              locale: fmtLocale,
                              showZone: true,
                            })}
                          </span>
                        </div>
                      ) : null}
                    </article>
                  ))}

                  {(store.auditLog ?? []).length > 0 ? (
                    <div className="space-y-1.5 rounded-2xl bg-white p-3.5 text-xs dark:bg-neutral-900">
                      <div className="font-semibold text-neutral-800 dark:text-slate-200">
                        {isAr ? 'سجل الإجراءات الخادمي' : 'Server Executive Action Log'}
                      </div>
                      {(store.auditLog ?? []).slice(0, 10).map((entry) => (
                        <div
                          key={entry.id}
                          className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-1.5 dark:border-white/10"
                        >
                          <span className="text-neutral-700 dark:text-slate-300">
                            {isAr ? entry.summaryAr : entry.summaryEn} ({entry.actorRole})
                          </span>
                          <span dir="ltr" className="tabular-nums text-neutral-500 dark:text-slate-400">
                            {formatDateTime(entry.timestampIso, {
                              locale: fmtLocale,
                              showZone: true,
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </section>
          ) : null}
        </div>
      </aside>
    </div>,
    document.body,
  )
}
