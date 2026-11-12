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
  Lock,
  MessageCircle,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  X,
  XCircle,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { GlobalBranch } from '@/lib/aether/global-filter-engine'
import { ExecutivePinModal } from '@/components/erp/ExecutivePinModal'
import {
  approveRequestById,
  evaluateLiveOdooBreaches,
  freezeBreachById,
  getExecutiveSession,
  GOVERNANCE_UPDATED_EVENT,
  loadGovernanceStore,
  lockExecutiveSession,
  markAllBranchesReceived,
  recordIssuedCircular,
  rejectRequestById,
  retroactivelyApproveBreachById,
  SEEDED_APPROVAL_REQUESTS,
  submitApprovalRequest,
  toggleBranchCircularReceipt,
  unfreezeBreachById,
  type ComplianceBreachItem,
  type ExecutiveSessionState,
  type GovernanceApprovalRequest,
  type GovernanceDomain,
  type PersistedGovernanceStore,
} from '@/lib/governance-compliance'

interface PendingPinRequest {
  titleAr?: string
  titleEn?: string
  mode?: 'verify' | 'change'
  onSuccess?: () => void
}

export interface GovernanceContextValue {
  store: PersistedGovernanceStore
  session: ExecutiveSessionState
  approvals: GovernanceApprovalRequest[]
  pendingApprovals: GovernanceApprovalRequest[]
  breaches: ComplianceBreachItem[]
  activeBreaches: ComplianceBreachItem[]
  liveBadgeCount: number
  drawerOpen: boolean
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
  }) => GovernanceApprovalRequest
  getApprovalByRef: (refKey: string) => GovernanceApprovalRequest | undefined
  approveItemWithPin: (id: string, titleAr: string, titleEn: string) => void
  rejectItemWithPin: (id: string, titleAr: string, titleEn: string) => void
  freezeBreachWithPin: (
    breach: ComplianceBreachItem,
    broadcastDirective?: boolean,
  ) => void
  retroactiveApproveBreachWithPin: (breach: ComplianceBreachItem) => void
  unfreezeBreachWithPin: (breach: ComplianceBreachItem) => void
  toggleBranchReceipt: (circularKey: string, branchId: Exclude<GlobalBranch, 'all'>) => void
  confirmAllBranchesReceipt: (circularKey: string) => void
  issueOfficialCircularWithPin: (opts: {
    circularKey: string
    titleAr: string
    titleEn: string
    circularBodyAr: string
    circularBodyEn: string
    onIssued?: (meta: { sealId: string; issuedAtIso: string }) => void
  }) => void
}

export type DrawerTabId = 'all' | 'approvals' | 'breaches' | 'sealed'

const GovernanceContext = createContext<GovernanceContextValue | null>(null)

const INITIAL_SSR_STORE: PersistedGovernanceStore = {
  approvals: SEEDED_APPROVAL_REQUESTS,
  frozenBreachIds: {},
  resolvedBreachIds: {},
  branchReceipts: {},
  issuedCirculars: {},
}

export function GovernanceProvider({ children }: { children: React.ReactNode }) {
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
  const [toastMsg, setToastMsg] = useState<{ ar: string; en: string } | null>(null)
  const pendingCallbackRef = useRef<(() => void) | undefined>(undefined)

  const syncFromStorage = useCallback(() => {
    setStore(loadGovernanceStore())
    setSession(getExecutiveSession())
  }, [])

  useEffect(() => {
    syncFromStorage()
    const onGovUpdate = () => syncFromStorage()
    const onStorage = () => syncFromStorage()
    window.addEventListener(GOVERNANCE_UPDATED_EVENT, onGovUpdate)
    window.addEventListener('storage', onStorage)
    const tick = window.setInterval(() => {
      setSession(getExecutiveSession())
    }, 1000)
    return () => {
      window.removeEventListener(GOVERNANCE_UPDATED_EVENT, onGovUpdate)
      window.removeEventListener('storage', onStorage)
      window.clearInterval(tick)
    }
  }, [syncFromStorage])

  const showToast = useCallback((ar: string, en: string) => {
    setToastMsg({ ar, en })
    window.setTimeout(() => {
      setToastMsg((cur) => (cur?.ar === ar ? null : cur))
    }, 3200)
  }, [])

  const requireManagerPin = useCallback((opts: PendingPinRequest) => {
    const liveSession = getExecutiveSession()
    if (liveSession.active && opts.mode !== 'change') {
      opts.onSuccess?.()
      return
    }
    pendingCallbackRef.current = opts.onSuccess
    setPinPrompt(opts)
  }, [])

  const lockSession = useCallback(() => {
    lockExecutiveSession()
    setSession(getExecutiveSession())
    showToast('تم قفل صلاحية المدير التنفيذي 🔒', 'Executive Session locked 🔒')
  }, [showToast])

  const requestApproval = useCallback(
    (input: Parameters<typeof submitApprovalRequest>[0]) => {
      const created = submitApprovalRequest(input)
      syncFromStorage()
      showToast(
        'تم رفع طلب موافقة المدير إلى جرس الاعتماد 🔔',
        'Approval request sent to Manager Bell 🔔',
      )
      return created
    },
    [showToast, syncFromStorage],
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
          const item = approveRequestById(id)
          syncFromStorage()
          if (item?.seal) {
            showToast(
              `تم الاعتماد بالختم الرقمي (${item.seal.sealId}) ✅`,
              `Approved with Digital Seal (${item.seal.sealId}) ✅`,
            )
          }
        },
      })
    },
    [requireManagerPin, showToast, syncFromStorage],
  )

  const rejectItemWithPin = useCallback(
    (id: string, titleAr: string, titleEn: string) => {
      requireManagerPin({
        titleAr: `رفض الطلب: ${titleAr}`,
        titleEn: `Reject Request: ${titleEn}`,
        onSuccess: () => {
          rejectRequestById(id)
          syncFromStorage()
          showToast('تم رفض الطلب وتسجيل القرار ❌', 'Request rejected & logged ❌')
        },
      })
    },
    [requireManagerPin, showToast, syncFromStorage],
  )

  const freezeBreachWithPin = useCallback(
    (breach: ComplianceBreachItem, broadcastDirective = false) => {
      requireManagerPin({
        titleAr: broadcastDirective
          ? 'إيقاف المخالفة وتعميم أمر إيقاف فوري ⛔'
          : 'إيقاف المخالفة وتجميد الصرف فوراً ⛔',
        titleEn: 'Stop Breach & Freeze Spend Immediately ⛔',
        onSuccess: () => {
          freezeBreachById(breach.id)
          syncFromStorage()
          if (broadcastDirective && typeof navigator !== 'undefined' && navigator.clipboard) {
            const isDocAr =
              typeof document !== 'undefined' ? document.documentElement.lang !== 'en' : true
            void navigator.clipboard
              .writeText(isDocAr ? breach.stopDirectiveAr : breach.stopDirectiveEn)
              .catch(() => {})
            showToast(
              'تم تجميد الصرف ونسخ أمر الإيقاف الرسمي للتعميم ⛔📋',
              'Spend frozen & official stop directive copied ⛔📋',
            )
          } else {
            showToast(
              'تم إيقاف المخالفة وتجميد الصرف ⛔',
              'Compliance breach stopped & spend frozen ⛔',
            )
          }
        },
      })
    },
    [requireManagerPin, showToast, syncFromStorage],
  )

  const retroactiveApproveBreachWithPin = useCallback(
    (breach: ComplianceBreachItem) => {
      requireManagerPin({
        titleAr: 'اعتماد استثنائي بأثر رجعي وختم التجاوز ✅',
        titleEn: 'Retroactive Executive Approval & Digital Seal ✅',
        onSuccess: () => {
          const seal = retroactivelyApproveBreachById(breach)
          syncFromStorage()
          showToast(
            `تم الاعتماد الاستثنائي بأثر رجعي بالختم (${seal.sealId}) ✅`,
            `Retroactive approval sealed (${seal.sealId}) ✅`,
          )
        },
      })
    },
    [requireManagerPin, showToast, syncFromStorage],
  )

  const unfreezeBreachWithPin = useCallback(
    (breach: ComplianceBreachItem) => {
      requireManagerPin({
        titleAr: 'فك التجميد بعد التصحيح والمطابقة 🔓',
        titleEn: 'Unfreeze After Verified Correction 🔓',
        onSuccess: () => {
          unfreezeBreachById(breach.id)
          syncFromStorage()
          showToast(
            'تم فك التجميد بعد التحقق من التصحيح 🔓',
            'Unfrozen after verified correction 🔓',
          )
        },
      })
    },
    [requireManagerPin, showToast, syncFromStorage],
  )

  const toggleBranchReceipt = useCallback(
    (circularKey: string, branchId: Exclude<GlobalBranch, 'all'>) => {
      toggleBranchCircularReceipt(circularKey, branchId)
      syncFromStorage()
    },
    [syncFromStorage],
  )

  const confirmAllBranchesReceipt = useCallback(
    (circularKey: string) => {
      markAllBranchesReceived(circularKey)
      syncFromStorage()
    },
    [syncFromStorage],
  )

  const issueOfficialCircularWithPin = useCallback(
    (opts: {
      circularKey: string
      titleAr: string
      titleEn: string
      circularBodyAr: string
      circularBodyEn: string
      onIssued?: (meta: { sealId: string; issuedAtIso: string }) => void
    }) => {
      requireManagerPin({
        titleAr: `تعميم رسمي مختوم: ${opts.titleAr}`,
        titleEn: `Issue Stamped Circular: ${opts.titleEn}`,
        onSuccess: () => {
          const meta = recordIssuedCircular(opts.circularKey, opts.titleAr, opts.titleEn)
          syncFromStorage()
          if (typeof navigator !== 'undefined' && navigator.clipboard) {
            const isDocAr =
              typeof document !== 'undefined' ? document.documentElement.lang !== 'en' : true
            const stampedText = isDocAr
              ? `${opts.circularBodyAr}\n\n🔐 الختم التنفيذي الرقمي: ${meta.sealId} · ${meta.issuedAtIso.slice(0, 16).replace('T', ' ')}`
              : `${opts.circularBodyEn}\n\n🔐 Digital Executive Seal: ${meta.sealId} · ${meta.issuedAtIso.slice(0, 16).replace('T', ' ')}`
            void navigator.clipboard.writeText(stampedText).catch(() => {})
          }
          opts.onIssued?.(meta)
          showToast(
            `تم إصدار التعميم بالختم (${meta.sealId}) ونسخه 📋`,
            `Official circular sealed (${meta.sealId}) & copied 📋`,
          )
        },
      })
    },
    [requireManagerPin, showToast, syncFromStorage],
  )

  const approvals = store.approvals
  const pendingApprovals = useMemo(
    () => approvals.filter((a) => a.status === 'pending'),
    [approvals],
  )
  const breaches = useMemo(() => evaluateLiveOdooBreaches(store), [store])
  const activeBreaches = useMemo(() => breaches.filter((b) => !b.frozen), [breaches])
  const liveBadgeCount = pendingApprovals.length + activeBreaches.length

  const openDrawer = useCallback((initialTab: DrawerTabId = 'all') => {
    setDrawerTab(initialTab)
    setDrawerOpen(true)
  }, [])

  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  const value = useMemo<GovernanceContextValue>(
    () => ({
      store,
      session,
      approvals,
      pendingApprovals,
      breaches,
      activeBreaches,
      liveBadgeCount,
      drawerOpen,
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
    }),
    [
      activeBreaches,
      approvals,
      approveItemWithPin,
      breaches,
      closeDrawer,
      confirmAllBranchesReceipt,
      drawerOpen,
      freezeBreachWithPin,
      getApprovalByRef,
      issueOfficialCircularWithPin,
      liveBadgeCount,
      lockSession,
      openDrawer,
      pendingApprovals,
      rejectItemWithPin,
      requestApproval,
      requireManagerPin,
      retroactiveApproveBreachWithPin,
      session,
      store,
      toggleBranchReceipt,
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
      className="fixed bottom-5 start-1/2 z-[70] -translate-x-1/2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-neutral-900 shadow-[0_8px_28px_rgba(15,23,42,0.16)] ring-1 ring-emerald-500/25 dark:bg-neutral-900 dark:text-emerald-200"
    >
      {isAr ? ar : en}
    </div>,
    document.body,
  )
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

/**
 * Topbar Executive Session Pill + Live Governance & Odoo Breach Bell (`🔔`).
 * Replaces the legacy static `99+` NotificationBell in `shell.tsx`.
 */
export function GovernanceBellTrigger() {
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
    <div className="flex items-center gap-1.5">
      {/* Executive Session Status + 1-Click Lock / Unlock */}
      {session.active ? (
        <div className="hidden items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:inline-flex dark:bg-emerald-950/60 dark:text-emerald-200">
          <span>{isAr ? 'وضع المدير نشط 🔓' : 'Manager Active 🔓'}</span>
          <span dir="ltr" className="font-mono text-[11px] tabular-nums opacity-80">
            {formatCountdown(session.remainingSeconds)}
          </span>
          <button
            type="button"
            onClick={lockSession}
            title={isAr ? 'قفل الصلاحية فوراً' : 'Lock Executive Session'}
            className="ms-1 cursor-pointer rounded-full bg-white px-2 py-0.5 text-[10.5px] font-semibold text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors duration-150 hover:bg-rose-50 hover:text-rose-700 dark:bg-neutral-900 dark:text-slate-200"
          >
            {isAr ? 'قفل الصلاحية 🔒' : 'Lock 🔒'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() =>
            requireManagerPin({
              titleAr: 'تفعيل وضع المدير لمدة ١٥ دقيقة',
              titleEn: 'Unlock 15-Minute Manager Session',
            })
          }
          title={
            isAr
              ? 'فتح صلاحية المدير بالرمز السري (٤ أرقام)'
              : 'Unlock Manager Session (4-digit PIN)'
          }
          className="ae-capsule hidden cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors duration-150 sm:inline-flex"
        >
          <Lock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="hidden lg:inline">{isAr ? 'صلاحية المدير' : 'Manager PIN'}</span>
        </button>
      )}

      {/* Live Governance & Odoo Compliance Bell (Zero static 99+!) */}
      <button
        type="button"
        onClick={() => openDrawer('all')}
        aria-label={
          isAr
            ? `جرس الاعتماد والرقابة (${liveBadgeCount})`
            : `Approvals & Compliance Bell (${liveBadgeCount})`
        }
        title={
          isAr
            ? `${pendingApprovals.length} بانتظار الموافقة · ${activeBreaches.length} مخالفات أودو حية`
            : `${pendingApprovals.length} Pending Approvals · ${activeBreaches.length} Active Odoo Breaches`
        }
        className="ae-capsule relative inline-flex h-9 cursor-pointer items-center gap-1.5 px-3 text-xs font-semibold transition-all duration-150 active:scale-95"
      >
        <Bell
          className={`h-4 w-4 ${
            activeBreaches.length > 0
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-emerald-600 dark:text-emerald-400'
          }`}
        />
        {liveBadgeCount > 0 ? (
          <span
            dir="ltr"
            style={{ color: '#FFFFFF' }}
            className={`btn-colored inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums text-white ${
              activeBreaches.length > 0 ? 'bg-rose-600' : 'bg-emerald-600'
            }`}
          >
            {liveBadgeCount}
          </span>
        ) : (
          <span
            dir="ltr"
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-50 px-1.5 text-[11px] font-semibold tabular-nums text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
          >
            0
          </span>
        )}
      </button>
    </div>
  )
}

function GovernanceSlideOverDrawer({
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
  const isAr = locale === 'ar'
  const [mounted, setMounted] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const {
    session,
    approvals,
    pendingApprovals,
    breaches,
    activeBreaches,
    requireManagerPin,
    lockSession,
    approveItemWithPin,
    rejectItemWithPin,
    freezeBreachWithPin,
    retroactiveApproveBreachWithPin,
    unfreezeBreachWithPin,
  } = useGovernance()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [onClose, open])

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

  if (!mounted || !open) return null

  const tabs: { id: DrawerTabId; ar: string; en: string; count: number }[] = [
    {
      id: 'all',
      ar: 'الكل',
      en: 'All Live',
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
      ar: 'مخالفات أودو 🚨',
      en: 'Odoo Breaches 🚨',
      count: activeBreaches.length,
    },
    {
      id: 'sealed',
      ar: 'المختوم ✅',
      en: 'Sealed ✅',
      count: sealedHistory.length,
    },
  ]

  return createPortal(
    <div
      id="vf-gov-drawer-backdrop"
      dir={isAr ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex justify-end bg-neutral-950/35 backdrop-blur-[2px] transition-opacity duration-200"
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
        aria-label={isAr ? 'مركز اعتماد المدير ورقابة أودو الحية' : 'Executive Approval & Odoo Watchdog'}
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
                  {isAr
                    ? 'اعتماد المدير ورقابة التزام أودو ١٧'
                    : 'Executive Approvals & Live Odoo 17 Watchdog'}
                </h2>
                <p className="mt-0.5 text-xs text-neutral-400">
                  {isAr
                    ? `${pendingApprovals.length} طلب بانتظار الختم · ${activeBreaches.length} مخالفة لقرارات معتمدة`
                    : `${pendingApprovals.length} awaiting PIN seal · ${activeBreaches.length} active policy breaches`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={isAr ? 'إغلاق' : 'Close'}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition-colors duration-150 hover:bg-neutral-200/80 dark:bg-white/[0.06] dark:text-slate-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Executive Session Control Bar */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#F7F7F8] px-3.5 py-2.5 text-xs dark:bg-neutral-950">
            {session.active ? (
              <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
                <Unlock className="h-4 w-4" />
                <span>{isAr ? 'وضع المدير نشط 🔓' : 'Executive Session Active 🔓'}</span>
                <span
                  dir="ltr"
                  className="rounded-full bg-emerald-100/80 px-2 py-0.5 font-mono text-[11px] tabular-nums text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                >
                  {formatCountdown(session.remainingSeconds)}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 font-medium text-neutral-600 dark:text-slate-300">
                <Lock className="h-4 w-4 text-neutral-400" />
                <span>
                  {isAr
                    ? 'الاعتماد وإيقاف الصرف يتطلب رمز المدير (٤ أرقام)'
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
                      titleAr: 'فتح صلاحية المدير لمدة ١٥ دقيقة',
                      titleEn: 'Unlock 15-Minute Executive Session',
                    })
                  }
                  className="ae-btn-primary cursor-pointer rounded-full px-3 py-1 font-semibold"
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
                className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-white px-2.5 py-1 font-medium text-neutral-600 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors duration-150 hover:text-neutral-950 dark:bg-neutral-900 dark:text-slate-300"
              >
                <Settings className="h-3.5 w-3.5" />
                <span>{isAr ? 'تغيير رمز المدير ⚙️' : 'PIN ⚙️'}</span>
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tabs.map((t) => {
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTabChange(t.id)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                    active
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-[#F7F7F8] text-neutral-600 hover:bg-neutral-200/70 dark:bg-white/[0.05] dark:text-slate-300'
                  }`}
                >
                  <span>{isAr ? t.ar : t.en}</span>
                  <span
                    dir="ltr"
                    className={`rounded-full px-1.5 py-0.2 text-[10.5px] tabular-nums ${
                      active
                        ? 'bg-white/20 text-white'
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
          {/* 1. Live Odoo Compliance Breaches */}
          {(tab === 'all' || tab === 'breaches') && breaches.length > 0 ? (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
                  <ShieldAlert className="h-4 w-4" />
                  <span>
                    {isAr
                      ? 'مراقب أودو ١٧ للقرارات المعتمدة (مباشر)'
                      : 'Continuous Odoo 17 Compliance Watchdog'}
                  </span>
                </span>
                <span className="text-[11px] tabular-nums text-neutral-400">
                  {activeBreaches.length} {isAr ? 'نشطة' : 'active'}
                </span>
              </div>

              {breaches.map((b) => {
                const directiveText = isAr ? b.stopDirectiveAr : b.stopDirectiveEn
                const waUrl = `https://wa.me/?text=${encodeURIComponent(directiveText)}`
                const isProceduralOverrun = b.breachKind === 'procedural-cap-overrun'
                return (
                  <article
                    key={b.id}
                    className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-150 dark:bg-neutral-900"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          b.frozen
                            ? 'bg-neutral-100 text-neutral-700 dark:bg-white/10 dark:text-slate-300'
                            : isProceduralOverrun
                              ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                        }`}
                      >
                        <AlertTriangle className="h-3 w-3" />
                        <span>
                          {b.frozen
                            ? isAr
                              ? 'مجمد بأمر المدير ⛔'
                              : 'Spend Frozen by Manager ⛔'
                            : isProceduralOverrun
                              ? isAr
                                ? '⚠️ تجاوز سقف بدون إذن مسبق'
                                : '⚠️ Unapproved Cap Overrun'
                              : isAr
                                ? '🚨 مخالفة لقرار معتمد'
                                : '🚨 Approved Decision Breach'}
                        </span>
                      </span>

                      {isProceduralOverrun ? (
                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                          {isAr
                            ? (b.badgeLabelAr ??
                              `+${(b.capOverrunKwd ?? b.monthlyLeakKwd).toLocaleString('en-US')} د.ك تجاوز سقف بدون إذن مسبق`)
                            : (b.badgeLabelEn ??
                              `+${(b.capOverrunKwd ?? b.monthlyLeakKwd).toLocaleString('en-US')} KWD unapproved cap overrun`)}
                        </span>
                      ) : (
                        <span
                          dir="ltr"
                          className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                        >
                          -{b.monthlyLeakKwd.toLocaleString('en-US')} {isAr ? 'د.ك/شهر' : 'KWD/mo'}
                        </span>
                      )}
                    </div>

                    <h3 className="mt-2 text-[14px] font-semibold leading-snug text-neutral-950 dark:text-white">
                      {isAr ? b.breachHeadlineAr : b.breachHeadlineEn}
                    </h3>
                    <p className="mt-1 text-xs text-neutral-500 dark:text-slate-300">
                      {isAr ? b.odooMetricProofAr : b.odooMetricProofEn}
                    </p>
                    <div className="mt-2 rounded-xl bg-[#F7F7F8] px-3 py-2 text-[11.5px] text-neutral-600 dark:bg-neutral-950 dark:text-slate-300">
                      {isAr ? b.approvedRuleLimitAr : b.approvedRuleLimitEn}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      {!b.frozen ? (
                        <>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => freezeBreachWithPin(b, true)}
                              style={{ color: '#FFFFFF' }}
                              className="btn-colored inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-rose-600 px-3.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-rose-700"
                            >
                              <span>
                                {isAr
                                  ? 'إيقاف فوري وتعميم أمر تجميد ⛔'
                                  : 'Immediate Stop & Broadcast Freeze ⛔'}
                              </span>
                            </button>

                            {b.retroactiveApprovalEligible ? (
                              <button
                                type="button"
                                onClick={() => retroactiveApproveBreachWithPin(b)}
                                style={{ color: '#FFFFFF' }}
                                className="btn-colored inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors duration-150 hover:bg-emerald-700"
                              >
                                <span>
                                  {isAr
                                    ? 'اعتماد استثنائي بأثر رجعي ✅'
                                    : 'Retroactive Approval ✅'}
                                </span>
                              </button>
                            ) : (
                              <Link
                                href={b.href}
                                onClick={onClose}
                                className="inline-flex h-8 items-center gap-1 rounded-full bg-neutral-100 px-3 text-xs font-medium text-neutral-700 transition-colors duration-150 hover:bg-neutral-200/80 hover:text-neutral-950 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15"
                              >
                                <span>
                                  {isAr ? 'فتح المصدر للمراجعة ↗' : 'Review Source ↗'}
                                </span>
                              </Link>
                            )}
                          </div>

                          {b.retroactiveApprovalEligible ? (
                            <Link
                              href={b.href}
                              onClick={onClose}
                              className="text-xs font-medium text-neutral-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                            >
                              {isAr ? 'فتح المصدر للمراجعة ↗' : 'Review Source ↗'}
                            </Link>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => unfreezeBreachWithPin(b)}
                              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 transition-colors duration-150 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-200"
                            >
                              <span>
                                {isAr ? 'فك التجميد بعد التصحيح 🔓' : 'Unfreeze After Fix 🔓'}
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

                          <Link
                            href={b.href}
                            onClick={onClose}
                            className="text-xs font-medium text-neutral-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                          >
                            {isAr ? 'فتح المصدر للمراجعة ↗' : 'Review Source ↗'}
                          </Link>
                        </>
                      )}
                    </div>
                  </article>
                )
              })}
            </section>
          ) : null}

          {/* 2. Pending Department Approval Requests */}
          {(tab === 'all' || tab === 'approvals') ? (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-neutral-700 dark:text-slate-200">
                  {isAr ? 'طلبات بانتظار موافقة المدير 🔔' : 'Pending Manager Approvals 🔔'}
                </span>
                <span className="text-[11px] tabular-nums text-neutral-400">
                  {pendingApprovals.length}
                </span>
              </div>

              {pendingApprovals.length === 0 ? (
                <div className="rounded-2xl bg-white p-4 text-center text-xs text-neutral-400 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-neutral-900">
                  {isAr
                    ? 'لا توجد طلبات معلقة حالياً — جميع القرارات معتمدة ومختومة ✅'
                    : 'Zero pending requests — all department items are reviewed ✅'}
                </div>
              ) : (
                pendingApprovals.map((req) => (
                  <article
                    key={req.id}
                    className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-neutral-900"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-700 dark:bg-emerald-950/60 dark:text-emerald-200">
                        {isAr ? req.departmentAr : req.departmentEn}
                      </span>
                      <div dir="ltr" className="flex items-center gap-2 text-[11px] font-semibold tabular-nums">
                        {req.budgetOrCostKwd > 0 ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                            {isAr ? `التكلفة: ${req.budgetOrCostKwd} د.ك` : `Cost: ${req.budgetOrCostKwd} KWD`}
                          </span>
                        ) : null}
                        {req.expectedMonthlyReturnKwd > 0 ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            +{req.expectedMonthlyReturnKwd} {isAr ? 'د.ك/شهر' : 'KWD/mo'}
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

          {/* 3. Sealed Executive Decisions History */}
          {tab === 'sealed' ? (
            <section className="space-y-2.5">
              {sealedHistory.length === 0 ? (
                <div className="rounded-2xl bg-white p-5 text-center text-xs text-neutral-400 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-neutral-900">
                  {isAr ? 'لم يتم ختم قرارات جديدة بعد في هذه الجلسة.' : 'No sealed decisions recorded yet.'}
                </div>
              ) : (
                sealedHistory.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-neutral-900"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
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
                        <span dir="ltr" className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          {item.seal.sealId}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-2 text-[13.5px] font-semibold text-neutral-950 dark:text-white">
                      {isAr ? item.titleAr : item.titleEn}
                    </h3>
                    {item.seal ? (
                      <p dir="ltr" className="mt-1 text-[11px] tabular-nums text-neutral-400">
                        {item.seal.approvedAtIso.slice(0, 16).replace('T', ' ')} UTC
                      </p>
                    ) : null}
                  </article>
                ))
              )}
            </section>
          ) : null}
        </div>
      </aside>
    </div>,
    document.body,
  )
}
