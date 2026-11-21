'use client'

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  Brain,
  Camera,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Database,
  ExternalLink,
  FileSpreadsheet,
  History,
  ImagePlus,
  Loader2,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  RotateCw,
  Send,
  SlidersHorizontal,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { formatDate } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { publishPageOdooSync } from '@/lib/odoo-page-sync'
import { FeryalStudioMessage, feryalPlainText } from '@/components/aether/FeryalStudioMessage'
import { FeryalMemoryDrawer } from '@/components/aether/FeryalMemoryDrawer'
import { FeryalSidebarNotebooks } from '@/components/aether/FeryalSidebarNotebooks'
import {
  FeryalMediaPickerButton,
  FeryalMessageAttachmentsGallery,
  FeryalPendingAttachmentsTray,
  FeryalVisionCompliancePill,
  rotateMediaAttachment90Client,
  rotateOrNormalizeImageFileClient,
} from '@/components/aether/FeryalMultimodalBar'
import { FeryalDocumentReviewCard } from '@/components/aether/FeryalDocumentReviewCard'
import {
  confirmDocumentIntakeDraft,
  recomputeDocumentIntakeDraft,
  serializePricingRowsToCsv,
  type ConfirmedPriceSheet,
  type DocumentIntakeDraft,
} from '@/lib/feryal/document-intake-types'
import { PartialWarningBanner } from '@/components/ui/partial-warning-banner'
import { StateBlock } from '@/components/ui/state-block'
import {
  UNAVAILABLE_DASH,
  formatDateTime,
  formatInt,
  formatKwd,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
import {
  buildDefaultMediaPrompt,
  callFeryalVisionInspector,
  isSupportedDocumentIntakeFile,
  isSupportedMediaFile,
  processFeryalMediaFile,
  revokeAttachmentObjectUrls,
  toStoredAttachmentMeta,
  type FeryalMediaAttachment,
  type StoredAttachmentMeta,
  type VisionComplianceTier,
} from '@/lib/feryal-multimodal'
import {
  BRAIN_MODE_EVENT,
  getActiveBrainMode,
  getPrimaryModeBadge,
  type BrainMode,
} from '@/lib/dual-heavy-brain'
import {
  autoSaveChatThread,
  getChatIndexSync,
  hydrateFeryalChatStore,
  loadChatThread,
  saveThreadPriceSheetContext,
  type ActivePriceSheetThreadContext,
  type FrozenMessageScope,
  type StoredChatMessage,
} from '@/lib/feryal-chat-store'
import {
  autoLearnFromConversationTurn,
  FERYAL_MEMORY_UPDATED_EVENT,
  getFeryalMemorySync,
  hydrateFeryalMemory,
} from '@/lib/feryal-learning-engine'
import {
  extractFeryalRecommendationMeta,
  FERYAL_EXECUTIVE_AUDIT_CHIPS,
  formatFeryalExecutiveSummary,
  readLiveGovernanceSnapshot,
  submitFeryalRecommendationToBell,
  type QuickAuditChipId,
} from '@/lib/feryal-governance-bridge'
import {
  ALL_FERYAL_BRANCHES,
  APPROVED_FERYAL_BRAND_LIST,
  APPROVED_FERYAL_CHANNEL_LIST,
  buildFeryalChatRequestPayload,
  buildFeryalConnectionErrorOutcome,
  FERYAL_CONNECTION_ERROR_AR,
  parseFeryalChatHttpResponse,
} from '@/lib/feryal-intent'
import {
  FERYAL_DOCUMENT_UPLOAD_CONNECTION_ERROR_AR,
  FERYAL_GOVERNANCE_ALERTS_LOAD_ERROR_AR,
  FERYAL_PRICE_SHEET_EXTRACT_ERROR_AR,
  FERYAL_QUERY_LOG_LOAD_ERROR_AR,
  FERYAL_REMATCH_CONNECTION_ERROR_AR,
  FERYAL_REMATCH_LAST_30_DAYS_ERROR_AR,
  FERYAL_RERUN_SIMULATION_ERROR_AR,
  FERYAL_UNSUPPORTED_INTAKE_FILE_ERROR_AR,
  FERYAL_VISUAL_ATTACHMENT_ERROR_AR,
} from '@/components/erp/feryal-studio-errors'
import {
  isVerifiedOdooGovernanceBreach,
  type ComplianceBreachItem,
} from '@/lib/governance-compliance'

interface ExecutedOdooQueryBadge {
  model: string
  method: string
  domain: unknown[]
  groupby: string[]
  period: { from: string; to: string }
}

interface VerifierBadgeState {
  valid: boolean
  extractedNumbers: number[]
  unverifiedNumbers: number[]
  reason?: string
}

export interface CouncilChip {
  provider: string
  modelId: string
  status: string
  errorCode?: string | null
  offendingNumbers?: string[]
}

export interface CouncilAgreementChip {
  provider: string
  modelId: string
}

export interface ChatUiMessage extends StoredChatMessage {
  userPrompt?: string
  providerBadge?: string
  learnedBadge?: string
  complianceTier?: VisionComplianceTier
  attachments?: StoredAttachmentMeta[]
  executedQueries?: ExecutedOdooQueryBadge[]
  verifier?: VerifierBadgeState
  replyStatus?: string
  council?: CouncilChip[]
  agreed?: CouncilAgreementChip[]
  contradictoryActions?: boolean
}

export interface ServerAuditLogRow {
  id: string
  timestampIso: string
  userSub: string
  userRole: string
  question: string
  status: string
  executedQueries: ExecutedOdooQueryBadge[]
  verifier: VerifierBadgeState
  finalReply: string
}

interface UserFieldNote {
  id: string
  title: string
  detail: string
  createdAt: string
}

const USER_NOTES_STORAGE_KEY = 'vf.feryal.user_notes.clean.v1'

let localUiSeq = 0
function nextUiId(prefix: string): string {
  localUiSeq = (localUiSeq + 1) % 1_000_000
  return `${prefix}-${Date.now()}-${localUiSeq}`
}

function formatClockNow(): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kuwait',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date())
  } catch {
    return '00:00'
  }
}

const LIVE_ODOO_STARTER_QUESTIONS: ReadonlyArray<{
  id: string
  modelBadge: string
  ar: string
  en: string
}> = [
  {
    id: 'yesterday-by-branch',
    modelBadge: 'pos.order',
    ar: 'مبيعات أمس حسب الفرع',
    en: "Yesterday's sales by branch",
  },
  {
    id: 'promenade-yesterday',
    modelBadge: 'pos.order',
    ar: 'مبيعات بروميناد أمس',
    en: 'Promenade branch sales yesterday',
  },
  {
    id: 'top-5-items',
    modelBadge: 'pos.order.line',
    ar: 'أعلى 5 أصناف أمس',
    en: 'Top 5 items sold yesterday',
  },
  {
    id: 'purchase-orders-summary',
    modelBadge: 'purchase.order',
    ar: 'إجمالي أوامر الشراء والموردين هذا الشهر',
    en: 'Confirmed purchase orders & vendors this month',
  },
  {
    id: 'warehouse-transfers',
    modelBadge: 'stock.move / stock.scrap',
    ar: 'حركات التحويل المخزني والهدر هذا الشهر',
    en: 'Warehouse transfers & scrap this month',
  },
  {
    id: 'gl-accounting',
    modelBadge: 'account.move.line',
    ar: 'الإيرادات والمصروفات وصافي الربح في دفتر الأستاذ هذا الشهر',
    en: 'GL revenue, expenses & net profit this month',
  },
]

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export const FERYAL_PROMPT_MAX_VH_RATIO = 0.4

export function computeFeryalPromptResize(
  value: string,
  scrollHeight: number,
  viewportHeight: number,
): { heightStyle: string; overflowScroll: boolean } {
  if (!value) {
    return { heightStyle: '', overflowScroll: false }
  }
  const safeVh = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 800
  const maxPx = Math.floor(safeVh * FERYAL_PROMPT_MAX_VH_RATIO)
  if (!Number.isFinite(scrollHeight) || scrollHeight <= 0) {
    return { heightStyle: 'auto', overflowScroll: false }
  }
  const nextHeight = Math.min(scrollHeight, maxPx)
  return {
    heightStyle: `${nextHeight}px`,
    overflowScroll: scrollHeight > maxPx,
  }
}

export function applyFeryalPromptAutoResize(
  el: (Pick<HTMLTextAreaElement, 'scrollHeight'> & { style: { height: string; overflowY?: string } }) | null,
  value: string,
  viewportHeight?: number,
): boolean {
  if (!el) return false
  if (!value) {
    el.style.height = ''
    if ('overflowY' in el.style) {
      el.style.overflowY = 'hidden'
    }
    return false
  }
  el.style.height = 'auto'
  const maxPx =
    viewportHeight !== undefined && Number.isFinite(viewportHeight) && viewportHeight > 0
      ? Math.floor(viewportHeight * FERYAL_PROMPT_MAX_VH_RATIO)
      : typeof window !== 'undefined' && window.innerHeight > 0
        ? Math.floor(window.innerHeight * FERYAL_PROMPT_MAX_VH_RATIO)
        : 320
  if (el.scrollHeight > 0) {
    const nextHeight = Math.min(el.scrollHeight, maxPx)
    el.style.height = `${nextHeight}px`
    const shouldScroll = el.scrollHeight > maxPx
    if ('overflowY' in el.style) {
      el.style.overflowY = shouldScroll ? 'auto' : 'hidden'
    }
    return shouldScroll
  }
  if ('overflowY' in el.style) {
    el.style.overflowY = 'hidden'
  }
  return false
}

export function shouldSubmitFeryalPromptOnKeyDown(params: {
  key: string
  shiftKey: boolean
  isComposing: boolean
  sending: boolean
  inputText: string
  attachmentCount: number
}): { preventDefault: boolean; shouldSend: boolean } {
  if (params.key !== 'Enter' || params.shiftKey || params.isComposing) {
    return { preventDefault: false, shouldSend: false }
  }
  const hasContent = params.inputText.trim().length > 0 || params.attachmentCount > 0
  return {
    preventDefault: true,
    shouldSend: hasContent && !params.sending,
  }
}

function matchCanonicalVentureBrand(
  rawValue: string | null | undefined,
): { brandId: string; labelEn: string; labelAr: string } | null {
  const cleaned = (rawValue ?? '').trim().toLowerCase()
  if (!cleaned || cleaned === 'all' || cleaned === 'all brands' || cleaned === 'كل العلامات التجارية') {
    return null
  }
  for (const b of APPROVED_FERYAL_BRAND_LIST) {
    if (
      cleaned === b.id ||
      cleaned === b.nameEn.toLowerCase() ||
      cleaned === b.nameAr.toLowerCase() ||
      b.aliases.some((a) => a.toLowerCase() === cleaned || cleaned.includes(a.toLowerCase()))
    ) {
      return { brandId: b.id, labelEn: b.nameEn, labelAr: b.nameAr }
    }
  }
  return null
}

function questionMentionsDifferentBrand(question: string, currentBrandId: string): boolean {
  const norm = question.toLowerCase()
  for (const b of APPROVED_FERYAL_BRAND_LIST) {
    if (b.id === currentBrandId) continue
    if (
      norm.includes(b.id) ||
      norm.includes(b.nameEn.toLowerCase()) ||
      norm.includes(b.nameAr.toLowerCase()) ||
      b.aliases.some((a) => norm.includes(a.toLowerCase()))
    ) {
      return true
    }
  }
  return false
}

export function inferSingleBrandFromConfirmedSheet(
  sheet: ConfirmedPriceSheet | null | undefined,
  fallbackBrandHint?: string | null,
): { brandId: string; labelEn: string; labelAr: string } | null {
  const foundIds = new Map<string, { brandId: string; labelEn: string; labelAr: string }>()
  if (sheet) {
    for (const row of sheet.rows) {
      const m = matchCanonicalVentureBrand(row.brand)
      if (m) {
        foundIds.set(m.brandId, m)
      }
    }
  }
  if (foundIds.size === 1) {
    return Array.from(foundIds.values())[0] ?? null
  }
  if (foundIds.size > 1) {
    return null
  }
  return matchCanonicalVentureBrand(fallbackBrandHint)
}

export function formatPeriodKeyDisplayLabel(periodKey: string, isAr: boolean): string {
  switch (periodKey) {
    case 'today':
      return isAr ? 'اليوم' : 'Today'
    case 'week':
      return isAr ? 'آخر 7 أيام' : 'Last 7 Days'
    case 'month':
      return isAr ? 'آخر 30 يوماً' : 'Last 30 Days'
    case 'year':
      return isAr ? 'السنة' : 'Year'
    case 'custom':
      return isAr ? 'نطاق مخصص' : 'Custom Range'
    default:
      return isAr ? 'آخر 30 يوماً' : 'Last 30 Days'
  }
}

export function captureRequestStartFrozenScope(params: {
  periodKey: string
  dateFrom: string
  dateTo: string
  brandId: string
  branchId: string
  channelId: string
  isAr: boolean
  confirmedSheet?: ConfirmedPriceSheet | null
  activeSheetContext?: ActivePriceSheetThreadContext | null
}): FrozenMessageScope {
  const periodLabel = formatPeriodKeyDisplayLabel(params.periodKey, params.isAr)

  const directBrand = matchCanonicalVentureBrand(params.brandId)
  const inferredSheetBrand =
    directBrand ??
    inferSingleBrandFromConfirmedSheet(
      params.confirmedSheet ?? params.activeSheetContext?.confirmedPriceSheet ?? null,
      params.activeSheetContext?.brandScope ?? null,
    )
  const brandScope = inferredSheetBrand
    ? params.isAr
      ? inferredSheetBrand.labelAr
      : inferredSheetBrand.labelEn
    : params.isAr
      ? 'كل العلامات التجارية'
      : 'All Brands'

  const branchMeta =
    params.branchId && params.branchId !== 'all'
      ? ALL_FERYAL_BRANCHES.find((b) => b.id === params.branchId)
      : undefined
  const branchScope = branchMeta
    ? params.isAr
      ? branchMeta.nameAr
      : branchMeta.nameEn
    : params.isAr
      ? 'كل الفروع'
      : 'All Branches'

  const channelMeta =
    params.channelId && params.channelId !== 'all'
      ? APPROVED_FERYAL_CHANNEL_LIST.find((c) => c.id === params.channelId)
      : undefined
  const channelScope = channelMeta
    ? params.isAr
      ? channelMeta.nameAr
      : channelMeta.nameEn
    : params.isAr
      ? 'كل القنوات'
      : 'All Channels'

  return {
    periodKey: params.periodKey || 'month',
    periodLabel,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    brandScope,
    branchScope,
    channelScope,
  }
}

export function resolveServerOrFallbackFrozenScope(
  rawResponseJson: unknown,
  fallbackScope: FrozenMessageScope,
): FrozenMessageScope {
  if (!rawResponseJson || typeof rawResponseJson !== 'object' || Array.isArray(rawResponseJson)) {
    return fallbackScope
  }
  const payload = rawResponseJson as {
    frozenScope?: unknown
    period?: { from?: unknown; to?: unknown; labelAr?: unknown; labelEn?: unknown }
  }
  if (
    payload.frozenScope &&
    typeof payload.frozenScope === 'object' &&
    !Array.isArray(payload.frozenScope)
  ) {
    const fs = payload.frozenScope as Record<string, unknown>
    const periodLabel =
      typeof fs.periodLabel === 'string' && fs.periodLabel.trim()
        ? fs.periodLabel.trim()
        : fallbackScope.periodLabel
    const dateFrom =
      typeof fs.dateFrom === 'string' && fs.dateFrom.trim()
        ? fs.dateFrom.trim()
        : fallbackScope.dateFrom
    const dateTo =
      typeof fs.dateTo === 'string' && fs.dateTo.trim()
        ? fs.dateTo.trim()
        : fallbackScope.dateTo
    const brandScope =
      typeof fs.brandScope === 'string' && fs.brandScope.trim()
        ? fs.brandScope.trim()
        : fallbackScope.brandScope
    const branchScope =
      typeof fs.branchScope === 'string' && fs.branchScope.trim()
        ? fs.branchScope.trim()
        : fallbackScope.branchScope
    const channelScope =
      typeof fs.channelScope === 'string' && fs.channelScope.trim()
        ? fs.channelScope.trim()
        : fallbackScope.channelScope
    const periodKey =
      typeof fs.periodKey === 'string' && fs.periodKey.trim()
        ? fs.periodKey.trim()
        : fallbackScope.periodKey

    return {
      periodKey,
      periodLabel,
      dateFrom,
      dateTo,
      brandScope,
      branchScope,
      channelScope,
    }
  }

  if (payload.period && typeof payload.period === 'object') {
    const from =
      typeof payload.period.from === 'string' && payload.period.from.trim()
        ? payload.period.from.trim()
        : fallbackScope.dateFrom
    const to =
      typeof payload.period.to === 'string' && payload.period.to.trim()
        ? payload.period.to.trim()
        : fallbackScope.dateTo
    return {
      ...fallbackScope,
      dateFrom: from,
      dateTo: to,
    }
  }

  return fallbackScope
}

export function buildFeryalStudioTurnPostBody(params: {
  question: string
  filters: {
    period: string
    branch: string
    brand: string
    channel: string
    customFrom?: string
    customTo?: string
  }
  urlSearch?: string
  explicitConfirmedSheet?: ConfirmedPriceSheet | null
  activePriceSheetContext?: ActivePriceSheetThreadContext | null
  periodLabel?: string | null
}): Record<string, unknown> {
  const isFollowUpOnSheet =
    !params.explicitConfirmedSheet && Boolean(params.activePriceSheetContext?.confirmedPriceSheet)
  const effectiveSheet =
    params.explicitConfirmedSheet ?? params.activePriceSheetContext?.confirmedPriceSheet ?? undefined

  let effectiveBrand = params.filters.brand || 'all'
  if (effectiveBrand === 'all' && effectiveSheet) {
    const singleBrand = inferSingleBrandFromConfirmedSheet(
      effectiveSheet,
      params.activePriceSheetContext?.brandScope ?? null,
    )
    if (singleBrand && !questionMentionsDifferentBrand(params.question, singleBrand.brandId)) {
      effectiveBrand = singleBrand.brandId
    }
  }

  const basePayload = buildFeryalChatRequestPayload(
    params.question,
    {
      ...params.filters,
      brand: effectiveBrand,
    },
    params.urlSearch,
    effectiveSheet,
  )

  const resolvedPeriodLabel =
    params.periodLabel ?? params.activePriceSheetContext?.periodLabel ?? null

  if (isFollowUpOnSheet && params.activePriceSheetContext) {
    return {
      ...basePayload,
      confirmedPriceSheet: params.activePriceSheetContext.confirmedPriceSheet,
      isFollowUpOnConfirmedSheet: true,
      activePriceSheetSummary: params.activePriceSheetContext.summaryMarkdown ?? null,
      periodLabel: resolvedPeriodLabel,
    }
  }

  if (params.explicitConfirmedSheet) {
    return {
      ...basePayload,
      ...(resolvedPeriodLabel ? { periodLabel: resolvedPeriodLabel } : {}),
    }
  }

  return {
    ...basePayload,
    ...(resolvedPeriodLabel ? { periodLabel: resolvedPeriodLabel } : {}),
  }
}

export function isTechnicalProviderBadge(badge: string | undefined): boolean {
  if (!badge) return false
  return /anthropic|google|xai|openai|claude|gemini|grok|timeout|rate_limit|http_|guard_rejected|connection error|تعذّر الاتصال|analysis failed|تعذّر التحليل|\berror\b|\//i.test(
    badge,
  )
}

export interface FeryalGovernanceStudioProps {
  sessionRole?: string
  initialMainTab?: 'chat' | 'today-notes' | 'alerts' | 'audit'
  initialMessages?: ChatUiMessage[]
  initialBreaches?: ComplianceBreachItem[]
  initialAuditLogs?: ServerAuditLogRow[]
  initialBreachesError?: boolean
  initialAuditError?: boolean
  initialSending?: boolean
  initialPendingDraft?: DocumentIntakeDraft | null
  initialTodaySimulationSheet?: ConfirmedPriceSheet | null
  initialActivePriceSheetContext?: ActivePriceSheetThreadContext | null
  initialOpenDiagnosticsIds?: string[]
}

export function FeryalGovernanceStudio(props: FeryalGovernanceStudioProps) {
  const {
    sessionRole,
    initialMainTab = 'chat',
    initialMessages,
    initialBreaches,
    initialAuditLogs,
    initialBreachesError = false,
    initialAuditError = false,
    initialSending = false,
    initialPendingDraft = null,
    initialTodaySimulationSheet = null,
    initialActivePriceSheetContext = null,
    initialOpenDiagnosticsIds,
  } = props ?? {}
  const { locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  const isAr = fmtLocale === 'ar'
  const isAuditor = sessionRole === 'auditor'
  const { workspace, liveSummary, filters: contextFilters, setPeriod } = useGlobalFilter()
  const activePeriod = contextFilters?.period ?? workspace.filters.period
  // A brand order count Odoo could not supply is unknown (—), never 0.
  const ordersUnknown = !workspace.odooConnected || workspace.nullableOrders === null
  const [chatSyncAt, setChatSyncAt] = useState<string | null>(null)

  useEffect(() => {
    const fromWorkspace = Boolean(workspace.odooConnected && workspace.lastSyncAt)
    const lastSyncAt = fromWorkspace ? workspace.lastSyncAt : chatSyncAt
    publishPageOdooSync(
      lastSyncAt
        ? {
            connected: true,
            lastSyncAt,
            source: fromWorkspace ? 'odoo-sync' : 'feryal-chat',
          }
        : null,
    )
    return () => publishPageOdooSync(null)
  }, [chatSyncAt, workspace.lastSyncAt, workspace.odooConnected])

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarTab, setSidebarTab] = useState<'chats' | 'notes'>('chats')
  const [mainTab, setMainTab] = useState<'chat' | 'today-notes' | 'alerts' | 'audit'>(
    initialMainTab,
  )
  const [memoryDrawerOpen, setMemoryDrawerOpen] = useState(false)
  const [savedNotesCount, setSavedNotesCount] = useState(0)

  const [activeChatId, setActiveChatId] = useState<string>(() => nextUiId('chat'))
  const [activeNotebookId, setActiveNotebookId] = useState<string>('all')
  const [messages, setMessages] = useState<ChatUiMessage[]>(initialMessages ?? [])
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(initialSending)
  const [activeQuickChipId, setActiveQuickChipId] = useState<QuickAuditChipId | null>(null)
  const [activeMode, setActiveMode] = useState<BrainMode>('triple')

  // Live Governance Alerts strictly from `/api/erp/governance` (ZERO static alerts)
  const [liveBreaches, setLiveBreaches] = useState<ComplianceBreachItem[]>(
    initialBreaches ?? [],
  )
  const [loadingBreaches, setLoadingBreaches] = useState(false)
  const [breachesError, setBreachesError] = useState(initialBreachesError)

  // Transparent Server Audit Log from `GET /api/erp/feryal/chat`
  const [auditLogs, setAuditLogs] = useState<ServerAuditLogRow[]>(initialAuditLogs ?? [])
  const [loadingAudit, setLoadingAudit] = useState(false)
  const [auditError, setAuditError] = useState(initialAuditError)

  // Clean user-entered notes (ZERO pre-populated cards)
  const [userNotes, setUserNotes] = useState<UserFieldNote[]>([])
  const [noteTitle, setNoteTitle] = useState('')
  const [noteDetail, setNoteDetail] = useState('')

  // Multimodal attachments & Document Intake Human Confirmation Gate + Persistent Sheet Context
  const [pendingAttachments, setPendingAttachments] = useState<FeryalMediaAttachment[]>([])
  const [processingMedia, setProcessingMedia] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [pendingIntakeDraft, setPendingIntakeDraft] = useState<DocumentIntakeDraft | null>(
    initialPendingDraft,
  )
  const [todaySimulationSheet, setTodaySimulationSheet] = useState<ConfirmedPriceSheet | null>(
    initialTodaySimulationSheet,
  )
  const [activePriceSheetContext, setActivePriceSheetContext] =
    useState<ActivePriceSheetThreadContext | null>(initialActivePriceSheetContext)
  const [intakeRotationDegrees, setIntakeRotationDegrees] = useState<0 | 90 | 180 | 270>(0)
  const [lastIntakeWasImage, setLastIntakeWasImage] = useState(false)
  const [rematchingLast30Days, setRematchingLast30Days] = useState(false)
  const [uploadingIntake, setUploadingIntake] = useState(false)
  const [intakeError, setIntakeError] = useState<string | null>(null)
  const lastIntakeFileRef = useRef<File | null>(null)
  const prevPeriodRef = useRef<string>(activePeriod)
  const openPickerRef = useRef<(() => void) | null>(null)
  const openCameraRef = useRef<(() => void) | null>(null)

  // Diagnostics disclosure & voice/clipboard UI state
  const [openDiagnosticsIds, setOpenDiagnosticsIds] = useState<Record<string, boolean>>(() => {
    if (!initialOpenDiagnosticsIds || initialOpenDiagnosticsIds.length === 0) return {}
    const initMap: Record<string, boolean> = {}
    for (const id of initialOpenDiagnosticsIds) initMap[id] = true
    return initMap
  })
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [submittedBellIds, setSubmittedBellIds] = useState<Record<string, boolean>>({})
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [recordingVoice, setRecordingVoice] = useState(false)
  const [promptOverflowScroll, setPromptOverflowScroll] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const userInteractedRef = useRef(Boolean(initialMessages && initialMessages.length > 0))

  const fetchServerGovernanceBreaches = useCallback(async () => {
    setLoadingBreaches(true)
    setBreachesError(false)
    try {
      const res = await fetch('/api/erp/governance', {
        method: 'GET',
        cache: 'no-store',
      })
      if (res.ok) {
        const data = (await res.json()) as { breaches?: ComplianceBreachItem[] }
        const verified = Array.isArray(data.breaches)
          ? data.breaches.filter((b) => isVerifiedOdooGovernanceBreach(b))
          : []
        setLiveBreaches(verified)
      } else {
        setLiveBreaches([])
        setBreachesError(true)
      }
    } catch {
      setLiveBreaches([])
      setBreachesError(true)
    } finally {
      setLoadingBreaches(false)
    }
  }, [])

  const fetchServerAuditLogs = useCallback(async () => {
    setLoadingAudit(true)
    setAuditError(false)
    try {
      const res = await fetch('/api/erp/feryal/chat?limit=50', {
        method: 'GET',
        cache: 'no-store',
      })
      if (res.ok) {
        const data = (await res.json()) as { auditLogs?: ServerAuditLogRow[] }
        setAuditLogs(Array.isArray(data.auditLogs) ? data.auditLogs : [])
      } else {
        setAuditError(true)
      }
    } catch {
      setAuditError(true)
    } finally {
      setLoadingAudit(false)
    }
  }, [])

  useEffect(() => {
    setActiveMode(getActiveBrainMode())
    const onMode = () => setActiveMode(getActiveBrainMode())
    window.addEventListener(BRAIN_MODE_EVENT, onMode)
    return () => window.removeEventListener(BRAIN_MODE_EVENT, onMode)
  }, [])

  useEffect(() => {
    void hydrateFeryalMemory().then((m) => setSavedNotesCount(m.rules.length))
    const onMem = () => setSavedNotesCount(getFeryalMemorySync().rules.length)
    window.addEventListener(FERYAL_MEMORY_UPDATED_EVENT, onMem)
    return () => window.removeEventListener(FERYAL_MEMORY_UPDATED_EVENT, onMem)
  }, [])

  const mapStoredToUiMessages = useCallback((storedList: readonly StoredChatMessage[]): ChatUiMessage[] => {
    return storedList.map((m) => ({
      ...m,
      frozenScope: m.frozenScope,
      providerBadge: m.engineLabelAr,
      learnedBadge: m.statusNoteAr,
      complianceTier: m.visionCompliance,
      attachments: m.attachmentsMeta,
      userPrompt: m.userPrompt,
      executedQueries: m.executedQueries,
      verifier: m.verifier,
      replyStatus: m.replyStatus,
      council: m.council,
      agreed: m.agreed,
      contradictoryActions: m.contradictoryActions,
    }))
  }, [])

  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) return
    void hydrateFeryalChatStore().then(({ chats }) => {
      if (userInteractedRef.current) return
      const idx = chats.length > 0 ? chats : getChatIndexSync()
      if (idx.length > 0) {
        const latest = idx[0]
        setActiveChatId(latest.id)
        void loadChatThread(latest.id).then((thread) => {
          if (!userInteractedRef.current && thread) {
            if (thread.messages.length > 0) {
              setMessages(mapStoredToUiMessages(thread.messages))
            }
            if (thread.activePriceSheetContext !== undefined) {
              setActivePriceSheetContext(thread.activePriceSheetContext ?? null)
            }
          }
        })
      }
    })
  }, [initialMessages, mapStoredToUiMessages])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(USER_NOTES_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as unknown
        if (Array.isArray(parsed)) {
          setUserNotes(
            parsed.filter(
              (n): n is UserFieldNote =>
                typeof n === 'object' &&
                n !== null &&
                typeof (n as UserFieldNote).id === 'string' &&
                typeof (n as UserFieldNote).title === 'string',
            ),
          )
        }
      }
    } catch {
      // ignore storage read error
    }
  }, [])

  useEffect(() => {
    if (initialBreaches === undefined && !initialBreachesError) {
      void fetchServerGovernanceBreaches()
    }
    if (initialAuditLogs === undefined && !initialAuditError) {
      void fetchServerAuditLogs()
    }
  }, [
    fetchServerAuditLogs,
    fetchServerGovernanceBreaches,
    initialAuditError,
    initialAuditLogs,
    initialBreaches,
    initialBreachesError,
  ])

  useEffect(() => {
    if (typeof window === 'undefined' || isAuditor) return
    try {
      const sp = new URLSearchParams(window.location.search)
      const urlPrompt = sp.get('prompt')?.trim()
      if (urlPrompt) {
        setInputText((prev) => prev || urlPrompt)
      }
    } catch {
      // ignore URL parse error
    }
  }, [isAuditor])

  useIsomorphicLayoutEffect(() => {
    const shouldScroll = applyFeryalPromptAutoResize(promptTextareaRef.current, inputText)
    setPromptOverflowScroll(shouldScroll)
  }, [inputText, mainTab, isAuditor])

  useEffect(() => {
    if (!inputText) return
    const onResize = () => {
      const shouldScroll = applyFeryalPromptAutoResize(promptTextareaRef.current, inputText)
      setPromptOverflowScroll(shouldScroll)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [inputText])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  useEffect(() => {
    return () => {
      revokeAttachmentObjectUrls(pendingAttachments)
    }
  }, [pendingAttachments])

  const persistMessages = useCallback(
    async (
      chatId: string,
      nextMsgs: ChatUiMessage[],
      sheetCtxOverride?: ActivePriceSheetThreadContext | null,
    ) => {
      const stored: StoredChatMessage[] = nextMsgs.map((m) => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        time: m.time,
        ...(m.frozenScope ? { frozenScope: m.frozenScope } : {}),
        engineLabelAr: m.providerBadge,
        statusNoteAr: m.learnedBadge,
        visionCompliance: m.complianceTier,
        attachmentsMeta: m.attachments,
        userPrompt: m.userPrompt,
        executedQueries: m.executedQueries,
        verifier: m.verifier,
        replyStatus: m.replyStatus,
        council: m.council,
        agreed: m.agreed,
        contradictoryActions: m.contradictoryActions,
      }))
      await autoSaveChatThread({
        chatId,
        messages: stored,
        lang: isAr ? 'ar' : 'en',
        preferredNotebookId: activeNotebookId !== 'all' ? activeNotebookId : undefined,
        filterLabel: isAr ? workspace.subtitleAr : workspace.subtitleEn,
        ...(sheetCtxOverride !== undefined ? { activePriceSheetContext: sheetCtxOverride } : {}),
      })
    },
    [activeNotebookId, isAr, workspace.subtitleAr, workspace.subtitleEn],
  )

  useEffect(() => {
    if (prevPeriodRef.current === 'today' && activePeriod !== 'today') {
      setTodaySimulationSheet(null)
    }
    prevPeriodRef.current = activePeriod
  }, [activePeriod])

  const handleStartNewChat = useCallback(() => {
    userInteractedRef.current = true
    const freshId = nextUiId('chat')
    setActiveChatId(freshId)
    setMessages([])
    setInputText('')
    setPendingIntakeDraft(null)
    setTodaySimulationSheet(null)
    setActivePriceSheetContext(null)
    setIntakeRotationDegrees(0)
    setLastIntakeWasImage(false)
    setOpenDiagnosticsIds({})
    setIntakeError(null)
    lastIntakeFileRef.current = null
    applyFeryalPromptAutoResize(promptTextareaRef.current, '')
    setPromptOverflowScroll(false)
    setMainTab('chat')
  }, [])

  const handleSelectChat = useCallback(
    async (chatId: string) => {
      userInteractedRef.current = true
      setActiveChatId(chatId)
      setPendingIntakeDraft(null)
      setTodaySimulationSheet(null)
      setIntakeRotationDegrees(0)
      setLastIntakeWasImage(false)
      setOpenDiagnosticsIds({})
      setIntakeError(null)
      lastIntakeFileRef.current = null
      setMainTab('chat')
      const thread = await loadChatThread(chatId)
      if (thread) {
        setMessages(mapStoredToUiMessages(thread.messages))
        setActivePriceSheetContext(thread.activePriceSheetContext ?? null)
      } else {
        setMessages([])
        setActivePriceSheetContext(null)
      }
    },
    [mapStoredToUiMessages],
  )

  const handleDetachActivePriceSheet = useCallback(() => {
    setActivePriceSheetContext(null)
    setTodaySimulationSheet(null)
    void saveThreadPriceSheetContext({
      chatId: activeChatId,
      activePriceSheetContext: null,
      lang: isAr ? 'ar' : 'en',
      filterLabel: isAr ? workspace.subtitleAr : workspace.subtitleEn,
    })
  }, [activeChatId, isAr, workspace.subtitleAr, workspace.subtitleEn])

  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      if (isAuditor) return
      const valid = files.filter(isSupportedMediaFile).slice(0, 4)
      if (valid.length === 0) return
      setProcessingMedia(true)
      setMediaError(null)
      try {
        const processed: FeryalMediaAttachment[] = []
        for (const f of valid) {
          processed.push(await processFeryalMediaFile(f))
        }
        setPendingAttachments((prev) => [...prev, ...processed].slice(0, 4))
      } catch {
        setMediaError(FERYAL_VISUAL_ATTACHMENT_ERROR_AR)
      } finally {
        setProcessingMedia(false)
      }
    },
    [isAuditor],
  )

  const handleRemoveAttachment = useCallback((id: string) => {
    setPendingAttachments((prev) => {
      const target = prev.find((a) => a.id === id)
      if (target) revokeAttachmentObjectUrls([target])
      return prev.filter((a) => a.id !== id)
    })
  }, [])

  const handleClearAllAttachments = useCallback(() => {
    setPendingAttachments((prev) => {
      revokeAttachmentObjectUrls(prev)
      return []
    })
    setMediaError(null)
  }, [])

  const handleRotateMediaAttachment = useCallback(async (id: string) => {
    const target = pendingAttachments.find((a) => a.id === id)
    if (!target || target.kind !== 'image') return
    setProcessingMedia(true)
    try {
      const rotated = await rotateMediaAttachment90Client(target)
      setPendingAttachments((prev) => prev.map((a) => (a.id === id ? rotated : a)))
    } finally {
      setProcessingMedia(false)
    }
  }, [pendingAttachments])

  const submitIntakeFileWithRotation = useCallback(
    async (rawFile: File, rotationDeg: 0 | 90 | 180 | 270) => {
      if (isAuditor || uploadingIntake || sending) return
      const isImageUpload =
        (rawFile.type || '').toLowerCase().startsWith('image/') ||
        /\.(jpe?g|png|webp)$/i.test(rawFile.name || '')
      setLastIntakeWasImage(isImageUpload)
      setUploadingIntake(true)
      setIntakeError(null)
      setMainTab('chat')
      try {
        const preparedFile = isImageUpload
          ? await rotateOrNormalizeImageFileClient(rawFile, rotationDeg)
          : rawFile

        const fd = new FormData()
        fd.append('file', preparedFile)
        fd.append('period', activePeriod || 'month')
        if (rotationDeg > 0) {
          fd.append('rotationDegrees', String(rotationDeg))
        }
        if (workspace.filters.customFrom) {
          fd.append('customFrom', workspace.filters.customFrom)
        }
        if (workspace.filters.customTo) {
          fd.append('customTo', workspace.filters.customTo)
        }
        if (workspace.filters.brand && workspace.filters.brand !== 'all') {
          fd.append('brand', workspace.filters.brand)
        }
        if (workspace.filters.branch && workspace.filters.branch !== 'all') {
          fd.append('branch', workspace.filters.branch)
        }

        const res = await fetch('/api/erp/feryal/document-intake', {
          method: 'POST',
          body: fd,
        })
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean
          draft?: DocumentIntakeDraft
          error?: string
        } | null

        setIntakeRotationDegrees(rotationDeg)
        if (!res.ok || !data?.ok || !data.draft) {
          setIntakeError(FERYAL_PRICE_SHEET_EXTRACT_ERROR_AR)
          return
        }
        setPendingIntakeDraft(data.draft)
      } catch {
        setIntakeError(FERYAL_DOCUMENT_UPLOAD_CONNECTION_ERROR_AR)
      } finally {
        setUploadingIntake(false)
      }
    },
    [
      activePeriod,
      isAuditor,
      sending,
      uploadingIntake,
      workspace.filters.branch,
      workspace.filters.brand,
      workspace.filters.customFrom,
      workspace.filters.customTo,
    ],
  )

  const handleIntakeFileSelected = useCallback(
    async (file: File) => {
      if (isAuditor || uploadingIntake || sending) return
      if (!isSupportedDocumentIntakeFile(file)) {
        setIntakeError(FERYAL_UNSUPPORTED_INTAKE_FILE_ERROR_AR)
        return
      }
      lastIntakeFileRef.current = file
      setIntakeRotationDegrees(0)
      await submitIntakeFileWithRotation(file, 0)
    },
    [isAuditor, sending, submitIntakeFileWithRotation, uploadingIntake],
  )

  const handleRotateIntakeImageAndRescan = useCallback(async () => {
    if (isAuditor || uploadingIntake || sending || rematchingLast30Days) return
    const rawFile = lastIntakeFileRef.current
    if (!rawFile) return
    const nextDeg = ((intakeRotationDegrees + 90) % 360) as 0 | 90 | 180 | 270
    await submitIntakeFileWithRotation(rawFile, nextDeg)
  }, [
    intakeRotationDegrees,
    isAuditor,
    rematchingLast30Days,
    sending,
    submitIntakeFileWithRotation,
    uploadingIntake,
  ])

  const requestLast30DaysIntakeDraft = useCallback(
    async (params: {
      csvFileName: string
      rowsForCsv: ReadonlyArray<{
        brand?: string | null
        itemName: string
        currentPriceKwd?: string | null
        sheetCurrentPriceKwd?: string | null
        proposedOptions: DocumentIntakeDraft['rows'][number]['proposedOptions']
        excluded?: boolean
      }>
      fallbackFile?: File | null
    }): Promise<DocumentIntakeDraft | null> => {
      const csvText = serializePricingRowsToCsv(params.rowsForCsv)
      const hasActiveCsvRows = params.rowsForCsv.some(
        (r) => !r.excluded && r.itemName.trim().length > 0,
      )
      const safeCsvName = params.csvFileName.replace(/\.[a-z0-9]+$/i, '') + '-30d.csv'
      const fileToSend = hasActiveCsvRows
        ? new File([csvText], safeCsvName, { type: 'text/csv' })
        : params.fallbackFile ?? null
      if (!fileToSend) return null

      const fd = new FormData()
      fd.append('file', fileToSend)
      fd.append('period', 'month')
      if (workspace.filters.brand && workspace.filters.brand !== 'all') {
        fd.append('brand', workspace.filters.brand)
      }
      if (workspace.filters.branch && workspace.filters.branch !== 'all') {
        fd.append('branch', workspace.filters.branch)
      }

      const res = await fetch('/api/erp/feryal/document-intake', {
        method: 'POST',
        body: fd,
      })
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean
        draft?: DocumentIntakeDraft
      } | null
      return res.ok && data?.ok && data.draft ? data.draft : null
    },
    [workspace.filters.branch, workspace.filters.brand],
  )

  const handleSwitchAndRematchDraftLast30Days = useCallback(async () => {
    if (isAuditor || sending || uploadingIntake || rematchingLast30Days || !pendingIntakeDraft) {
      return
    }
    setRematchingLast30Days(true)
    setIntakeError(null)
    if (typeof setPeriod === 'function') {
      setPeriod('month')
    }
    try {
      const activeSourceRows = pendingIntakeDraft.rows.filter(
        (row) => !row.excluded && row.itemName.trim().length > 0,
      )
      const monthDraft = await requestLast30DaysIntakeDraft({
        csvFileName: pendingIntakeDraft.fileName,
        rowsForCsv: activeSourceRows,
        fallbackFile: lastIntakeFileRef.current,
      })
      if (!monthDraft) {
        setIntakeError(FERYAL_REMATCH_LAST_30_DAYS_ERROR_AR)
        return
      }
      setPendingIntakeDraft(recomputeDocumentIntakeDraft(monthDraft))
    } catch {
      setIntakeError(FERYAL_REMATCH_CONNECTION_ERROR_AR)
    } finally {
      setRematchingLast30Days(false)
    }
  }, [
    isAuditor,
    pendingIntakeDraft,
    rematchingLast30Days,
    requestLast30DaysIntakeDraft,
    sending,
    setPeriod,
    uploadingIntake,
  ])

  const sendQuestion = useCallback(
    async (
      overridePrompt?: string,
      confirmedPriceSheet?: ConfirmedPriceSheet,
      options?: {
        periodOverride?: 'month'
        draftScope?: { brand?: string | null; dateFrom?: string | null; dateTo?: string | null }
      },
    ) => {
      if (isAuditor || sending) return
      const rawPrompt = (overridePrompt ?? inputText).trim()
      const hasMedia = !confirmedPriceSheet && pendingAttachments.length > 0

      if (!rawPrompt && !hasMedia && !confirmedPriceSheet) return

      const effectivePrompt =
        rawPrompt || buildDefaultMediaPrompt(pendingAttachments, isAr ? 'ar' : 'en')

      const attachmentMetas: StoredAttachmentMeta[] = hasMedia
        ? pendingAttachments.map(toStoredAttachmentMeta)
        : []
      const attachmentsSnapshot = hasMedia ? [...pendingAttachments] : []

      // Capture immutable scope snapshot at request start (NEVER reactive live filter state!)
      const effectiveFilters = options?.periodOverride
        ? { ...workspace.filters, period: options.periodOverride }
        : { ...workspace.filters }
      const capturedDateFrom =
        options?.draftScope?.dateFrom ||
        (options?.periodOverride === 'month' && liveSummary?.buckets?.month?.from
          ? liveSummary.buckets.month.from
          : workspace.dateRange.from)
      const capturedDateTo = options?.draftScope?.dateTo || workspace.dateRange.to
      const requestStartFrozenScope = captureRequestStartFrozenScope({
        periodKey: effectiveFilters.period,
        dateFrom: capturedDateFrom,
        dateTo: capturedDateTo,
        brandId: effectiveFilters.brand,
        branchId: effectiveFilters.branch,
        channelId: effectiveFilters.channel,
        isAr,
        confirmedSheet: confirmedPriceSheet ?? null,
        activeSheetContext: activePriceSheetContext,
      })

      let nextSheetContextForTurn: ActivePriceSheetThreadContext | undefined
      if (confirmedPriceSheet) {
        const singleBrand = inferSingleBrandFromConfirmedSheet(
          confirmedPriceSheet,
          options?.draftScope?.brand ?? null,
        )
        nextSheetContextForTurn = {
          confirmedPriceSheet,
          confirmedAtIso: confirmedPriceSheet.confirmedAtIso,
          fileName: confirmedPriceSheet.fileName,
          brandScope: singleBrand
            ? isAr
              ? singleBrand.labelAr
              : singleBrand.labelEn
            : requestStartFrozenScope.brandScope,
          periodLabel: requestStartFrozenScope.periodLabel,
          dateFrom: requestStartFrozenScope.dateFrom,
          dateTo: requestStartFrozenScope.dateTo,
          matchedSkuCount: confirmedPriceSheet.rows.filter((r) => r.matchedOdooProductId != null)
            .length,
          summaryMarkdown: null,
        }
        setActivePriceSheetContext(nextSheetContextForTurn)
      }

      const userMsg: ChatUiMessage = {
        id: nextUiId('u'),
        sender: 'user',
        text: effectivePrompt,
        time: formatClockNow(),
        ...(attachmentMetas.length > 0 ? { attachments: attachmentMetas } : {}),
      }

      userInteractedRef.current = true
      const optimisticList = [...messages, userMsg]
      setMessages(optimisticList)
      void persistMessages(activeChatId, optimisticList, nextSheetContextForTurn)
      if (!overridePrompt || confirmedPriceSheet) {
        setInputText('')
        applyFeryalPromptAutoResize(promptTextareaRef.current, '')
        setPromptOverflowScroll(false)
      }
      if (hasMedia) handleClearAllAttachments()
      setSending(true)
      setMainTab('chat')

      try {
        // 1. Authenticated Multimodal Vision Inspector (`POST /api/erp/feryal/vision`)
        if (attachmentsSnapshot.length > 0) {
          const visionRes = await callFeryalVisionInspector({
            prompt: effectivePrompt,
            lang: isAr ? 'ar' : 'en',
            workspaceContext: isAr ? workspace.subtitleAr : workspace.subtitleEn,
            brand: effectiveFilters.brand !== 'all' ? effectiveFilters.brand : undefined,
            branch: effectiveFilters.branch !== 'all' ? effectiveFilters.branch : undefined,
            period: effectiveFilters.period,
            attachments: attachmentsSnapshot,
          })

          const replyText =
            visionRes?.reply || FERYAL_CONNECTION_ERROR_AR
          const tier: VisionComplianceTier | undefined = visionRes?.complianceTier
          const badgeLabel = visionRes
            ? isAr
              ? visionRes.engineLabelAr
              : visionRes.engineLabelEn
            : 'تعذّر الاتصال'

          const feryalMsg: ChatUiMessage = {
            id: nextUiId('f'),
            sender: 'feryal',
            text: replyText,
            time: formatClockNow(),
            frozenScope: requestStartFrozenScope,
            userPrompt: effectivePrompt,
            providerBadge: badgeLabel,
            complianceTier: tier,
            replyStatus: visionRes?.ok ? 'vision_analyzed' : 'connection_error',
          }
          const updated = [...optimisticList, feryalMsg]
          setMessages(updated)
          await persistMessages(activeChatId, updated)
          return
        }

        // 2. Exclusive Odoo 17 Tool-Calling & 3-Model Council Engine (`POST /api/erp/feryal/chat`)
        const urlSearch =
          options?.periodOverride || typeof window === 'undefined'
            ? undefined
            : window.location.search
        const chatRequestBody = buildFeryalStudioTurnPostBody({
          question: effectivePrompt,
          filters: effectiveFilters,
          urlSearch,
          explicitConfirmedSheet: confirmedPriceSheet ?? null,
          activePriceSheetContext,
          periodLabel: requestStartFrozenScope.periodLabel,
        })
        const res = await fetch('/api/erp/feryal/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chatRequestBody),
        })

        let rawResponseJson: unknown = undefined
        let jsonParseSucceeded = false
        if (res.ok) {
          try {
            rawResponseJson = await res.json()
            jsonParseSucceeded = true
          } catch {
            jsonParseSucceeded = false
          }
        }

        const parsedOutcome = await parseFeryalChatHttpResponse<
          ExecutedOdooQueryBadge,
          VerifierBadgeState,
          CouncilChip,
          CouncilAgreementChip
        >(
          {
            ok: res.ok && jsonParseSucceeded,
            json: async () => rawResponseJson,
          },
          isAr,
        )
        const {
          replyText,
          modelBadge,
          replyStatus,
          executedQueries,
          verifier,
          council,
          agreedList,
        } = parsedOutcome
        const finalFrozenScope = resolveServerOrFallbackFrozenScope(
          rawResponseJson,
          requestStartFrozenScope,
        )

        if (replyStatus !== 'no_odoo_data' && replyStatus !== 'connection_error') {
          setChatSyncAt(new Date().toISOString())
        }

        const learnRes =
          replyStatus !== 'connection_error'
            ? await autoLearnFromConversationTurn(effectivePrompt, replyText)
            : { learnedFact: undefined }

        const feryalMsg: ChatUiMessage = {
          id: nextUiId('f'),
          sender: 'feryal',
          text: replyText,
          time: formatClockNow(),
          frozenScope: finalFrozenScope,
          userPrompt: effectivePrompt,
          providerBadge: modelBadge,
          learnedBadge: learnRes.learnedFact,
          executedQueries,
          verifier,
          replyStatus,
          council,
          agreed: agreedList,
        }

        let persistedSheetContext: ActivePriceSheetThreadContext | undefined =
          nextSheetContextForTurn
        if (
          replyStatus !== 'connection_error' &&
          (nextSheetContextForTurn || activePriceSheetContext)
        ) {
          const baseCtx = nextSheetContextForTurn ?? activePriceSheetContext
          if (baseCtx) {
            const rawSummaryMeta =
              rawResponseJson &&
              typeof rawResponseJson === 'object' &&
              !Array.isArray(rawResponseJson)
                ? (rawResponseJson as { activePriceSheetSummary?: unknown }).activePriceSheetSummary
                : undefined
            const serverMatchedRows =
              rawSummaryMeta &&
              typeof rawSummaryMeta === 'object' &&
              !Array.isArray(rawSummaryMeta) &&
              typeof (rawSummaryMeta as { matchedRows?: unknown }).matchedRows === 'number'
                ? ((rawSummaryMeta as { matchedRows: number }).matchedRows)
                : undefined
            persistedSheetContext = {
              ...baseCtx,
              brandScope: finalFrozenScope.brandScope || baseCtx.brandScope,
              periodLabel: finalFrozenScope.periodLabel || baseCtx.periodLabel,
              dateFrom: finalFrozenScope.dateFrom || baseCtx.dateFrom,
              dateTo: finalFrozenScope.dateTo || baseCtx.dateTo,
              ...(serverMatchedRows !== undefined ? { matchedSkuCount: serverMatchedRows } : {}),
              summaryMarkdown: nextSheetContextForTurn
                ? replyText.slice(0, 8000)
                : baseCtx.summaryMarkdown || replyText.slice(0, 8000),
            }
            setActivePriceSheetContext(persistedSheetContext)
          }
        }

        const updated = [...optimisticList, feryalMsg]
        setMessages(updated)
        await persistMessages(activeChatId, updated, persistedSheetContext)
        if (replyStatus !== 'connection_error') {
          void fetchServerAuditLogs()
        }
      } catch {
        const connectionError = buildFeryalConnectionErrorOutcome(isAr)
        const fallbackMsg: ChatUiMessage = {
          id: nextUiId('f'),
          sender: 'feryal',
          text: connectionError.replyText,
          time: formatClockNow(),
          frozenScope: requestStartFrozenScope,
          userPrompt: effectivePrompt,
          providerBadge: connectionError.modelBadge,
          replyStatus: connectionError.replyStatus,
        }
        const updated = [...optimisticList, fallbackMsg]
        setMessages(updated)
        await persistMessages(activeChatId, updated, nextSheetContextForTurn)
      } finally {
        setSending(false)
        setActiveQuickChipId(null)
      }
    },
    [
      activeChatId,
      activePriceSheetContext,
      fetchServerAuditLogs,
      handleClearAllAttachments,
      inputText,
      isAr,
      isAuditor,
      liveSummary?.buckets?.month?.from,
      messages,
      pendingAttachments,
      persistMessages,
      sending,
      workspace.dateRange.from,
      workspace.dateRange.to,
      workspace.filters,
      workspace.subtitleAr,
      workspace.subtitleEn,
    ],
  )

  const handleRerunSimulationLast30Days = useCallback(async () => {
    if (isAuditor || sending || uploadingIntake || rematchingLast30Days || !todaySimulationSheet) {
      return
    }
    const sourceSheet = todaySimulationSheet
    setRematchingLast30Days(true)
    setIntakeError(null)
    if (typeof setPeriod === 'function') {
      setPeriod('month')
    }
    try {
      const monthDraft = await requestLast30DaysIntakeDraft({
        csvFileName: sourceSheet.fileName,
        rowsForCsv: sourceSheet.rows,
        fallbackFile: lastIntakeFileRef.current,
      })
      const rematchedSheet: ConfirmedPriceSheet = monthDraft
        ? confirmDocumentIntakeDraft(monthDraft)
        : {
            ...sourceSheet,
            confirmedAtIso: new Date().toISOString(),
            rows: sourceSheet.rows.map((row) => ({ ...row, matchedOdooProductId: null })),
          }
      setTodaySimulationSheet(null)
      setRematchingLast30Days(false)
      const prompt30d = isAr
        ? `أعيدي تشغيل محاكاة جدول الأسعار المؤكد (${rematchedSheet.fileName} — ${rematchedSheet.rows.length} صنفاً) على فترة آخر 30 يوماً وقدّمي القرار التنفيذي وخطة الأصناف.`
        : `Re-run the 3-scenario executive pricing simulation on confirmed price sheet (${rematchedSheet.fileName} — ${rematchedSheet.rows.length} SKUs) over Last 30 Days and deliver the executive verdict and SKU playbook.`
      await sendQuestion(prompt30d, rematchedSheet, {
        periodOverride: 'month',
        draftScope: monthDraft
          ? {
              brand: monthDraft.brand,
              dateFrom: monthDraft.period.from,
              dateTo: monthDraft.period.to,
            }
          : undefined,
      })
    } catch {
      setRematchingLast30Days(false)
      setIntakeError(FERYAL_RERUN_SIMULATION_ERROR_AR)
    }
  }, [
    isAr,
    isAuditor,
    rematchingLast30Days,
    requestLast30DaysIntakeDraft,
    sendQuestion,
    sending,
    setPeriod,
    todaySimulationSheet,
    uploadingIntake,
  ])

  const handleQuickAuditChip = useCallback(
    (chipId: QuickAuditChipId) => {
      if (isAuditor || sending) return
      const snap = readLiveGovernanceSnapshot(workspace)
      const promptMap: Record<QuickAuditChipId, string> = {
        'open-violations': 'مبيعات أمس حسب الفرع',
        'seven-branch-plan': 'أعلى 5 أصناف أمس',
        'odoo-growth-plan': 'إجمالي أوامر الشراء والموردين هذا الشهر',
        'regulatory-readiness': 'حركات التحويل المخزني والهدر هذا الشهر',
      }
      const q = promptMap[chipId]
      void snap
      setActiveQuickChipId(chipId)
      void sendQuestion(q)
    },
    [isAuditor, sendQuestion, sending, workspace],
  )

  const handleCopyReply = useCallback(
    async (msg: ChatUiMessage) => {
      const meta = extractFeryalRecommendationMeta(msg.text, msg.userPrompt, workspace)
      const formatted =
        msg.replyStatus === 'answered'
          ? formatFeryalExecutiveSummary(msg.text, meta, workspace, isAr)
          : feryalPlainText(msg.text)
      try {
        await navigator.clipboard.writeText(formatted)
        setCopiedId(msg.id)
        window.setTimeout(() => setCopiedId(null), 2000)
      } catch {
        // ignore clipboard error
      }
    },
    [isAr, workspace],
  )

  const handleEscalateToBell = useCallback(
    (msg: ChatUiMessage) => {
      if (isAuditor) return
      const meta = extractFeryalRecommendationMeta(msg.text, msg.userPrompt, workspace)
      submitFeryalRecommendationToBell(meta)
      setSubmittedBellIds((prev) => ({ ...prev, [msg.id]: true }))
    },
    [isAuditor, workspace],
  )

  const handleSpeakMessage = useCallback(
    async (msg: ChatUiMessage) => {
      if (speakingId === msg.id) {
        audioRef.current?.pause()
        setSpeakingId(null)
        return
      }
      try {
        setSpeakingId(msg.id)
        const res = await fetch('/api/feryal/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: feryalPlainText(msg.text),
            lang: isAr ? 'ar' : 'en',
            format: 'json',
          }),
        })
        if (res.ok) {
          const data = (await res.json()) as { audioDataUrl?: string }
          if (data.audioDataUrl) {
            const audio = new Audio(data.audioDataUrl)
            audioRef.current = audio
            audio.onended = () => setSpeakingId(null)
            audio.onerror = () => setSpeakingId(null)
            await audio.play()
            return
          }
        }
        setSpeakingId(null)
      } catch {
        setSpeakingId(null)
      }
    },
    [isAr, speakingId],
  )

  const handleToggleVoiceInput = useCallback(async () => {
    if (isAuditor) return
    if (recordingVoice && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      setRecordingVoice(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks: BlobPart[] = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        if (blob.size === 0) return
        const fd = new FormData()
        fd.append('file', blob, 'recording.webm')
        fd.append('lang', isAr ? 'ar' : 'en')
        try {
          const sttRes = await fetch('/api/feryal/stt', { method: 'POST', body: fd })
          if (sttRes.ok) {
            const data = (await sttRes.json()) as { transcript?: string }
            if (data.transcript?.trim()) {
              setInputText((prev) =>
                prev ? `${prev} ${data.transcript!.trim()}` : data.transcript!.trim(),
              )
            }
          }
        } catch {
          // ignore STT error
        }
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecordingVoice(true)
    } catch {
      setRecordingVoice(false)
    }
  }, [isAr, isAuditor, recordingVoice])

  const handleAddUserNote = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (isAuditor) return
      const cleanTitle = noteTitle.trim()
      const cleanDetail = noteDetail.trim()
      if (!cleanTitle) return
      const entry: UserFieldNote = {
        id: nextUiId('note'),
        title: cleanTitle,
        detail: cleanDetail,
        createdAt: formatDate(new Date(), 'en'),
      }
      const next = [entry, ...userNotes].slice(0, 50)
      setUserNotes(next)
      setNoteTitle('')
      setNoteDetail('')
      try {
        window.localStorage.setItem(USER_NOTES_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignore storage write error
      }
    },
    [isAuditor, noteDetail, noteTitle, userNotes],
  )

  const handleDeleteUserNote = useCallback(
    (id: string) => {
      if (isAuditor) return
      const next = userNotes.filter((n) => n.id !== id)
      setUserNotes(next)
      try {
        window.localStorage.setItem(USER_NOTES_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignore storage write error
      }
    },
    [isAuditor, userNotes],
  )

  const modeBadgeLabel = useMemo(
    () => getPrimaryModeBadge(activeMode, isAr ? 'ar' : 'en'),
    [activeMode, isAr],
  )

  const unavailableTooltip = getUnavailableTooltip(fmtLocale)
  const rankedBranches = useMemo(() => {
    if (!workspace.odooConnected) return []
    const branchOptById = new Map(
      workspace.cascadingOptions.branches.map((b) => [String(b.id), b]),
    )
    const canUseRawBucket =
      workspace.filters.brand === 'all' &&
      workspace.filters.channel === 'all' &&
      workspace.filters.kuwaitSlice === 'all'
    if (canUseRawBucket) {
      const periodKey = workspace.filters.period
      const bucketLoc =
        periodKey === 'custom'
          ? liveSummary?.customBucket?.mappedByLocation ?? liveSummary?.customBucket?.byLocation
          : liveSummary?.buckets?.[periodKey]?.mappedByLocation ??
            liveSummary?.buckets?.[periodKey]?.byLocation
      if (bucketLoc) {
        const liveRows = Object.entries(bucketLoc)
          .filter(([id, row]) => {
            const norm = id.trim()
            return (
              norm !== 'all' &&
              norm !== 'unattributed' &&
              row &&
              typeof row.netKwd === 'number' &&
              Number.isFinite(row.netKwd) &&
              row.netKwd > 0
            )
          })
          .map(([id, row]) => {
            const opt = branchOptById.get(id)
            const liveMeta = liveSummary?.branches?.find((b) => b.id === id)
            return {
              id,
              ar: opt?.ar ?? liveMeta?.unit ?? liveMeta?.name ?? id,
              en: opt?.en ?? liveMeta?.name ?? id,
              salesKwd: row.netKwd,
            }
          })
          .sort((a, b) => b.salesKwd - a.salesKwd)
        if (liveRows.length > 0) return liveRows
      }
      if (
        liveSummary?.branches &&
        liveSummary.branches.length > 0 &&
        workspace.filters.period === 'month'
      ) {
        const branchRows = liveSummary.branches
          .filter(
            (b) =>
              String(b.id) !== 'all' &&
              String(b.id) !== 'unattributed' &&
              typeof b.netSalesKwd === 'number' &&
              Number.isFinite(b.netSalesKwd) &&
              b.netSalesKwd > 0,
          )
          .map((b) => {
            const opt = branchOptById.get(b.id)
            return {
              id: b.id,
              ar: opt?.ar ?? b.unit ?? b.name,
              en: opt?.en ?? b.name,
              salesKwd: b.netSalesKwd,
            }
          })
          .sort((a, b) => b.salesKwd - a.salesKwd)
        if (branchRows.length > 0) return branchRows
      }
    }
    return workspace.cascadingOptions.branches
      .filter(
        (b) =>
          b.id !== 'all' &&
          String(b.id) !== 'unattributed' &&
          typeof b.salesKwd === 'number' &&
          Number.isFinite(b.salesKwd) &&
          b.salesKwd > 0,
      )
      .sort((a, b) => (b.salesKwd ?? 0) - (a.salesKwd ?? 0))
  }, [
    liveSummary,
    workspace.cascadingOptions.branches,
    workspace.filters.brand,
    workspace.filters.channel,
    workspace.filters.kuwaitSlice,
    workspace.filters.period,
    workspace.odooConnected,
  ])

  const bestBranch = rankedBranches[0] ?? null
  const worstBranch = rankedBranches.length > 1 ? rankedBranches[rankedBranches.length - 1] : null

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="flex min-h-[560px] lg:h-[calc(100vh-108px)] lg:max-h-[calc(100vh-108px)] w-full min-w-0 flex-col lg:flex-row gap-3 rounded-3xl bg-[#F6F7F8] p-2.5 sm:p-3 dark:bg-[#090E0C]"
    >
      {/* Left / Side Chat History Rail */}
      {sidebarOpen && (
        <aside className="w-full max-h-[360px] lg:max-h-none lg:h-full lg:w-[280px] xl:w-[300px] shrink-0 flex min-h-0 flex-col rounded-2xl bg-white shadow-xs ring-1 ring-slate-900/[0.05] dark:bg-[#101815] dark:ring-white/10 overflow-hidden">
          {sidebarTab === 'chats' ? (
            <FeryalSidebarNotebooks
              isAr={isAr}
              isAuditor={isAuditor}
              activeTab={sidebarTab}
              onTabChange={setSidebarTab}
              activeChatId={activeChatId}
              activeNotebookId={activeNotebookId}
              onSelectNotebook={setActiveNotebookId}
              onSelectChat={handleSelectChat}
              onNewChat={handleStartNewChat}
              workspace={workspace}
              isCopilotThinking={sending}
              onRunNotePrompt={(prompt) => void sendQuestion(prompt)}
              panelClassName=""
            />
          ) : (
            <div className="flex h-full flex-col p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div
                  role="tablist"
                  aria-label={isAr ? 'تبويبات القائمة الجانبية' : 'Sidebar tabs'}
                  className="flex items-center gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-white/[0.06]"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={false}
                    onClick={() => setSidebarTab('chats')}
                    className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:text-slate-300"
                  >
                    {isAr ? 'المحادثات' : 'Chats'}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected
                    onClick={() => setSidebarTab('notes')}
                    className="cursor-pointer rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:bg-emerald-500/20 dark:text-emerald-200"
                  >
                    {isAr ? 'ملاحظات المستخدم' : 'User Notes'}
                  </button>
                </div>
              </div>

              {!isAuditor && (
                <form
                  onSubmit={handleAddUserNote}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 space-y-2 dark:border-white/10 dark:bg-[#141F1B]"
                >
                  <input
                    type="text"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    aria-label={isAr ? 'عنوان الملاحظة' : 'Note title'}
                    placeholder={isAr ? 'عنوان الملاحظة...' : 'Note title...'}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-white/15 dark:bg-[#090E0C] dark:text-white"
                  />
                  <textarea
                    rows={2}
                    value={noteDetail}
                    onChange={(e) => setNoteDetail(e.target.value)}
                    aria-label={isAr ? 'تفاصيل الملاحظة الفعليّة' : 'Factual note details'}
                    placeholder={isAr ? 'تفاصيل الملاحظة الفعليّة...' : 'Factual note details...'}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-white/15 dark:bg-[#090E0C] dark:text-white"
                  />
                  <button
                    type="submit"
                    className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    <span>{isAr ? 'إضافة ملاحظة' : 'Add Note'}</span>
                  </button>
                </form>
              )}

              <div className="flex-1 overflow-y-auto space-y-2">
                {userNotes.length === 0 ? (
                  <StateBlock
                    state="empty"
                    compact
                    locale={fmtLocale}
                    title={isAr ? 'لا توجد ملاحظات مسجلة حالياً.' : 'No notes recorded yet.'}
                    description={
                      isAr
                        ? 'أضف ملاحظة ميدانية لمتابعتها مع فريال.'
                        : 'Add a field note to track alongside Feryal insights.'
                    }
                  />
                ) : (
                  userNotes.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-xl border border-slate-200/80 bg-white p-2.5 space-y-1 dark:border-white/10 dark:bg-[#141F1B]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {n.title}
                        </span>
                        {!isAuditor && (
                          <button
                            type="button"
                            onClick={() => handleDeleteUserNote(n.id)}
                            aria-label={isAr ? `حذف الملاحظة ${n.title}` : `Delete note ${n.title}`}
                            className="cursor-pointer rounded p-0.5 text-slate-400 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        )}
                      </div>
                      {n.detail ? (
                        <p className="text-xs text-slate-600 dark:text-slate-300">{n.detail}</p>
                      ) : null}
                      <div dir="ltr" className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                        {n.createdAt}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </aside>
      )}

      {/* Main Studio Area */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl bg-white shadow-xs ring-1 ring-slate-900/[0.05] dark:bg-[#101815] dark:ring-white/10 overflow-hidden">
        {/* Partial Data Warning */}
        {liveSummary?.partial ? (
          <PartialWarningBanner summary={liveSummary} isAr={isAr} className="mx-3.5 mt-2.5 shrink-0" />
        ) : null}

        {/* Crisp Executive Top Bar */}
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 px-3.5 py-2.5 dark:border-white/10">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label={isAr ? 'إظهار/إخفاء القائمة الجانبية' : 'Toggle sidebar'}
              title={isAr ? 'إظهار/إخفاء القائمة الجانبية' : 'Toggle sidebar'}
              className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-2.5 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:bg-white/[0.06] dark:text-slate-200"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <>
                  <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="whitespace-nowrap">{isAr ? 'السجل' : 'History'}</span>
                </>
              )}
            </button>

            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="min-w-0 break-words text-[15px] sm:text-[16px] font-black text-slate-900 dark:text-white">
                {isAr ? 'فريال — الذكاء التنفيذي' : 'Ferial — Executive AI'}
              </h2>
              <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 ring-1 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-200">
                <Database className="h-3 w-3 shrink-0" aria-hidden />
                <span>{modeBadgeLabel}</span>
              </span>
            </div>
          </div>

          {/* View Switcher: Chat | Today's Notes | Odoo Governance Alerts | Odoo Query Log */}
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <div
              role="tablist"
              aria-label={isAr ? 'أقسام استوديو فريال' : 'Feryal Studio Views'}
              className="flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto no-scrollbar rounded-xl bg-slate-100 p-1 dark:bg-white/[0.06]"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mainTab === 'chat'}
                onClick={() => setMainTab('chat')}
                className={`shrink-0 whitespace-nowrap cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
                  mainTab === 'chat'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                }`}
              >
                {isAr ? 'المحادثة' : 'Chat'}
              </button>

              <button
                type="button"
                role="tab"
                data-studio-tab="today-notes"
                aria-selected={mainTab === 'today-notes'}
                onClick={() => setMainTab('today-notes')}
                className={`inline-flex shrink-0 whitespace-nowrap cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
                  mainTab === 'today-notes'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                }`}
              >
                <span>{isAr ? 'ملاحظات اليوم ⚡' : "Today's Notes ⚡"}</span>
                {workspace.feryalNotes.length > 0 ? (
                  <span
                    dir="ltr"
                    className="shrink-0 rounded-md bg-white/20 px-1.5 py-0.5 text-xs font-bold tabular-nums"
                  >
                    {workspace.feryalNotes.length}
                  </span>
                ) : null}
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={mainTab === 'alerts'}
                onClick={() => {
                  setMainTab('alerts')
                  void fetchServerGovernanceBreaches()
                }}
                className={`inline-flex shrink-0 whitespace-nowrap cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
                  mainTab === 'alerts'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{isAr ? 'تنبيهات الحوكمة الفعلية' : 'Odoo Governance Alerts'}</span>
                {liveBreaches.length > 0 && (
                  <span dir="ltr" className="shrink-0 rounded-full bg-rose-600 px-1.5 py-0.5 text-xs font-black tabular-nums text-white">
                    {liveBreaches.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={mainTab === 'audit'}
                onClick={() => {
                  setMainTab('audit')
                  void fetchServerAuditLogs()
                }}
                className={`inline-flex shrink-0 whitespace-nowrap cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
                  mainTab === 'audit'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                }`}
              >
                <History className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  {isAr
                    ? `سجل الأسئلة والاستعلامات (${auditLogs.length})`
                    : `Odoo Query Log (${auditLogs.length})`}
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setMemoryDrawerOpen(true)}
              className="inline-flex shrink-0 whitespace-nowrap cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-white/15 dark:bg-[#141F1B] dark:text-slate-200"
            >
              <Brain className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
              <span>
                {isAr
                  ? savedNotesCount > 0
                    ? `الملاحظات (${savedNotesCount})`
                    : 'سجل الملاحظات'
                  : savedNotesCount > 0
                    ? `Notes (${savedNotesCount})`
                    : 'Notes Log'}
              </span>
            </button>
          </div>
        </header>

        {/* Tab 1: Live Odoo Chat */}
        {mainTab === 'chat' && (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Quick Odoo Query Chips */}
            {!isAuditor && (
              <div className="flex shrink-0 flex-nowrap items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-slate-100 px-3.5 py-2 dark:border-white/[0.05]">
                {FERYAL_EXECUTIVE_AUDIT_CHIPS.map((chip) => {
                  const isActiveChip = sending && activeQuickChipId === chip.id
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      disabled={sending}
                      onClick={() => handleQuickAuditChip(chip.id)}
                      className="inline-flex shrink-0 whitespace-nowrap cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/90 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50/70 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:cursor-wait disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-emerald-950/50"
                    >
                      {isActiveChip ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-emerald-600 dark:text-emerald-400" aria-hidden />
                      ) : null}
                      <span>{isAr ? chip.labelAr : chip.labelEn}</span>
                      <span dir="ltr" className="shrink-0 rounded-md bg-emerald-600/10 px-1.5 py-0.5 font-mono text-xs font-bold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                        {isAr ? chip.badgeAr : chip.badgeEn}
                      </span>
                    </button>
                  )
                })}
                {sending ? (
                  <span
                    data-feryal-inflight-spinner="true"
                    role="status"
                    aria-live="polite"
                    className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-xl bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-200"
                  >
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                    <span>{isAr ? 'جارٍ المعالجة...' : 'Working...'}</span>
                  </span>
                ) : null}
              </div>
            )}

            {/* Conversation Stream */}
            <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5 space-y-3.5">
              {messages.length === 0 ? (
                <div className="mx-auto flex h-full max-w-2xl flex-col justify-center py-2 space-y-3.5">
                  <div className="space-y-1 text-center">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                      {isAr ? 'كيف يمكنني مساعدتك اليوم؟' : 'How can I help you today?'}
                    </h3>
                    <p className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400">
                      {isAr
                        ? 'استعلامات Odoo 17 المباشرة • محاكاة جداول الأسعار • فحص بصري للصور والفيديو'
                        : 'Odoo 17 analytics • Price sheet simulations • Camera, photo & video inspection'}
                    </p>
                  </div>

                  {!isAuditor && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {LIVE_ODOO_STARTER_QUESTIONS.map((q) => (
                          <button
                            key={q.id}
                            type="button"
                            disabled={sending}
                            onClick={() => void sendQuestion(isAr ? q.ar : q.en)}
                            className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-[#F8FAF9] px-3 py-2.5 text-start transition hover:border-emerald-400 hover:bg-emerald-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-white/10 dark:bg-[#141F1B] dark:hover:border-emerald-500/40"
                          >
                            <span className="min-w-0 break-words text-[13px] font-bold text-slate-900 dark:text-white">
                              {isAr ? q.ar : q.en}
                            </span>
                            <span dir="ltr" className="shrink-0 whitespace-nowrap rounded-md bg-white px-1.5 py-0.5 font-mono text-xs font-semibold text-emerald-700 ring-1 ring-slate-200/70 dark:bg-white/[0.06] dark:text-emerald-300 dark:ring-white/10">
                              {q.modelBadge}
                            </span>
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-2 pt-0.5">
                        <button
                          type="button"
                          disabled={sending}
                          onClick={() => openCameraRef.current?.()}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-emerald-400 hover:text-emerald-800 dark:border-white/10 dark:bg-[#141F1B] dark:text-slate-200"
                        >
                          <Camera className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                          <span>{isAr ? 'التقاط بالكاميرا' : 'Camera Capture'}</span>
                        </button>
                        <button
                          type="button"
                          disabled={sending}
                          onClick={() => openPickerRef.current?.()}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-emerald-400 hover:text-emerald-800 dark:border-white/10 dark:bg-[#141F1B] dark:text-slate-200"
                        >
                          <ImagePlus className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                          <span>{isAr ? 'رفع صورة أو فيديو' : 'Upload Photo / Video'}</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                messages.map((msg) => {
                  const councilParticipants = msg.council ?? []
                  const agreedChips =
                    msg.agreed ??
                    councilParticipants
                      .filter((item) => item.status === 'ok' && item.modelId)
                      .map((item) => ({ provider: item.provider, modelId: item.modelId }))
                  const agreedCount = agreedChips.length
                  const councilTotal = Math.max(councilParticipants.length, agreedCount, 3)
                  const hasConsensus =
                    agreedCount >= 2 && msg.replyStatus !== 'council_failed' && !msg.contradictoryActions
                  const nonMissingCouncil = councilParticipants.filter(
                    (item) => item.errorCode !== 'MISSING_API_KEY',
                  )
                  const hasContradictionOrDispute =
                    msg.replyStatus !== 'vision_analyzed' &&
                    (Boolean(msg.contradictoryActions) ||
                      msg.replyStatus === 'council_failed' ||
                      (msg.replyStatus !== 'answered' && nonMissingCouncil.length >= 2 && agreedCount < 2) ||
                      /لا اتفاق|متنازع|disputed/i.test(msg.text))

                  const isDiagnosticsOpen = Boolean(openDiagnosticsIds[msg.id])
                  const showCleanProviderBadge =
                    Boolean(msg.providerBadge) && !isTechnicalProviderBadge(msg.providerBadge)
                  const hasDiagnosticsTelemetry =
                    councilParticipants.length > 0 ||
                    Boolean(msg.providerBadge) ||
                    Boolean(msg.verifier) ||
                    Boolean(msg.executedQueries && msg.executedQueries.length > 0)

                  return (
                    <div
                      key={msg.id}
                      className={`flex min-w-0 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`min-w-0 max-w-full lg:max-w-4xl rounded-2xl px-4 py-3.5 ${
                          msg.sender === 'user'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'w-full bg-[#F8FAF9] text-slate-900 ring-1 ring-slate-900/[0.06] dark:bg-[#141F1B] dark:text-slate-100 dark:ring-white/10'
                        }`}
                      >
                        {msg.sender === 'feryal' && (
                          <>
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-2 dark:border-white/[0.07]">
                              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                <span className="shrink-0 whitespace-nowrap text-xs font-black text-emerald-800 dark:text-emerald-300">
                                  {isAr ? 'فريال' : 'Feryal'}
                                </span>
                                {showCleanProviderBadge && msg.providerBadge && (
                                  <span
                                    dir="ltr"
                                    className="shrink-0 whitespace-nowrap rounded-md bg-emerald-50 px-2 py-0.5 font-mono text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  >
                                    {msg.providerBadge}
                                  </span>
                                )}
                                {hasConsensus ? (
                                  <span
                                    data-feryal-consensus="agreed"
                                    className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-900 ring-1 ring-emerald-500/25 dark:bg-emerald-900/60 dark:text-emerald-100"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                    <span>
                                      {isAr ? 'إجماع المجلس' : '2-of-3 Consensus'}{' '}
                                      <span dir="ltr" className="tabular-nums">
                                        ({agreedCount}/{councilTotal})
                                      </span>
                                    </span>
                                  </span>
                                ) : hasContradictionOrDispute ? (
                                  <span
                                    data-feryal-contradiction="true"
                                    role="status"
                                    className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-950 ring-1 ring-amber-500/30 dark:bg-amber-950/60 dark:text-amber-200"
                                  >
                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                    <span>
                                      {isAr
                                        ? 'تعارض / عدم إجماع — لم يُعتمد رأي'
                                        : 'Contradictory / No Consensus — Withheld'}
                                    </span>
                                  </span>
                                ) : null}
                                {msg.complianceTier && (
                                  <FeryalVisionCompliancePill tier={msg.complianceTier} isAr={isAr} />
                                )}
                                {msg.verifier?.valid &&
                                  msg.executedQueries &&
                                  msg.executedQueries.length > 0 && (
                                    <span className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 rounded-md bg-emerald-100/80 px-2 py-0.5 text-xs font-bold text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200">
                                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                      <span>{isAr ? 'أرقام مطابقة لـ Odoo' : 'Odoo-Matched Numbers'}</span>
                                    </span>
                                  )}
                              </div>

                              <div className="flex shrink-0 items-center gap-2">
                                {hasDiagnosticsTelemetry ? (
                                  <button
                                    type="button"
                                    data-feryal-diagnostics-toggle="true"
                                    aria-expanded={isDiagnosticsOpen}
                                    onClick={() =>
                                      setOpenDiagnosticsIds((prev) => ({
                                        ...prev,
                                        [msg.id]: !prev[msg.id],
                                      }))
                                    }
                                    className="inline-flex shrink-0 whitespace-nowrap cursor-pointer items-center gap-1 rounded-lg bg-white/90 px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200/80 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:bg-white/[0.06] dark:text-slate-300 dark:ring-white/10 dark:hover:bg-white/10"
                                  >
                                    <SlidersHorizontal className="h-3 w-3 shrink-0" aria-hidden />
                                    <span>{isAr ? 'التشخيص' : 'Diagnostics'}</span>
                                  </button>
                                ) : null}
                                <span
                                  dir="ltr"
                                  className="shrink-0 whitespace-nowrap text-xs tabular-nums text-slate-500 dark:text-slate-400"
                                >
                                  {msg.time}
                                </span>
                              </div>
                            </div>

                            {isDiagnosticsOpen ? (
                              <div
                                data-feryal-diagnostics-panel="true"
                                className="mb-3 space-y-2 rounded-xl border border-slate-200/80 bg-white/90 p-2.5 text-xs text-slate-700 dark:border-slate-700/80 dark:bg-[#090E0C] dark:text-slate-200"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2 font-bold text-slate-800 dark:text-slate-100">
                                  <span>
                                    {isAr
                                      ? 'تشخيص النماذج وفحص الأرقام'
                                      : 'Provider Telemetry & Verifier Diagnostics'}
                                  </span>
                                  {msg.replyStatus ? (
                                    <span
                                      dir="ltr"
                                      className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600 dark:bg-white/10 dark:text-slate-300"
                                    >
                                      status: {msg.replyStatus}
                                    </span>
                                  ) : null}
                                </div>

                                {msg.providerBadge ? (
                                  <div dir="ltr" className="font-mono text-xs text-slate-600 dark:text-slate-300">
                                    engine: {msg.providerBadge}
                                  </div>
                                ) : null}

                                {councilParticipants.length > 0 ? (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {councilParticipants.map((chip) => (
                                      <span
                                        key={`${chip.provider}-${chip.modelId}-${chip.status}`}
                                        dir="ltr"
                                        className={`[overflow-wrap:anywhere] rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${
                                          chip.status === 'ok'
                                            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100'
                                            : 'bg-amber-100 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100'
                                        }`}
                                      >
                                        {chip.provider}
                                        {chip.modelId ? `/${chip.modelId}` : ''} · {chip.status}
                                        {chip.errorCode ? ` · ${chip.errorCode}` : ''}
                                        {chip.offendingNumbers && chip.offendingNumbers.length > 0
                                          ? ` · ${isAr ? 'رقم مرفوض خارج الحقائق' : 'Unverified figure'}: ${chip.offendingNumbers.join(' ')}`
                                          : ''}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}

                                {msg.verifier ? (
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                    <span>
                                      {msg.verifier.valid
                                        ? isAr
                                          ? 'فحص مطابقة الأرقام: ناجح'
                                          : 'Numeric Grounding Guard: Passed'
                                        : isAr
                                          ? 'فحص مطابقة الأرقام: مرفوض'
                                          : 'Numeric Grounding Guard: Flagged'}
                                    </span>
                                    <span dir="ltr" className="font-mono tabular-nums">
                                      checked={msg.verifier.extractedNumbers.length} | unverified=
                                      {msg.verifier.unverifiedNumbers.length}
                                    </span>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </>
                        )}

                        {msg.attachments && msg.attachments.length > 0 && (
                          <FeryalMessageAttachmentsGallery
                            attachmentsMeta={msg.attachments}
                            isAr={isAr}
                          />
                        )}

                        {msg.sender === 'user' ? (
                          <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed font-medium">
                            {msg.text}
                          </p>
                        ) : (
                          <FeryalStudioMessage
                            text={msg.text}
                            frozenScope={msg.frozenScope}
                            isAr={isAr}
                          />
                        )}

                        {/* Executed Odoo Queries Provenance Strip */}
                        {msg.sender === 'feryal' &&
                          msg.executedQueries &&
                          msg.executedQueries.length > 0 && (
                            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-200/70 pt-2.5 text-xs text-slate-600 dark:border-white/[0.07] dark:text-slate-300">
                              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                              <span className="font-semibold">
                                {isAr ? 'الاستعلام المنفذ:' : 'Executed Query:'}
                              </span>
                              {msg.executedQueries.map((q, idx) => (
                                <span
                                  key={`${q.model}-${idx}`}
                                  dir="ltr"
                                  className="rounded-md bg-white px-2 py-0.5 font-mono text-xs text-slate-700 ring-1 ring-slate-200 dark:bg-[#090E0C] dark:text-slate-200 dark:ring-white/15"
                                >
                                  {q.model}.{q.method} ({q.period.from}
                                  {q.period.to !== q.period.from ? `..${q.period.to}` : ''})
                                </span>
                              ))}
                            </div>
                          )}

                        {/* Action Footer */}
                        {msg.sender === 'feryal' && (
                          <div className="mt-3 flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => void handleCopyReply(msg)}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:bg-[#090E0C] dark:text-slate-200 dark:ring-white/15"
                            >
                              {copiedId === msg.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                              ) : (
                                <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
                              )}
                              <span>
                                {copiedId === msg.id
                                  ? isAr
                                    ? 'تم النسخ'
                                    : 'Copied'
                                  : isAr
                                    ? 'نسخ الرد'
                                    : 'Copy'}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleSpeakMessage(msg)}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:bg-[#090E0C] dark:text-slate-200 dark:ring-white/15"
                            >
                              {speakingId === msg.id ? (
                                <VolumeX className="h-3.5 w-3.5 text-rose-600" aria-hidden />
                              ) : (
                                <Volume2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                              )}
                              <span>
                                {speakingId === msg.id
                                  ? isAr
                                    ? 'إيقاف الصوت'
                                    : 'Stop'
                                  : isAr
                                    ? 'استماع'
                                    : 'Listen'}
                              </span>
                            </button>

                            {!isAuditor && msg.replyStatus === 'answered' && (
                              <button
                                type="button"
                                disabled={Boolean(submittedBellIds[msg.id])}
                                onClick={() => handleEscalateToBell(msg)}
                                className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:bg-emerald-800/60"
                              >
                                <Bell className="h-3.5 w-3.5" aria-hidden />
                                <span>
                                  {submittedBellIds[msg.id]
                                    ? isAr
                                      ? 'تم الرفع لجرس المدير'
                                      : 'Sent to Manager Bell'
                                    : isAr
                                      ? 'رفع التوصية لجرس المدير'
                                      : 'Send to Manager Bell'}
                                </span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}

              {sending && (
                <div role="status" aria-live="polite" className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  <span>
                    {isAr
                      ? 'جارٍ استعلام Odoo 17 ومطابقة الأرقام...'
                      : 'Querying Odoo 17 & checking reply numbers...'}
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Composer — Pinned Visible at Bottom */}
            {!isAuditor ? (
              <div className="shrink-0 border-t border-slate-200/80 bg-white p-2.5 sm:p-3 dark:border-white/10 dark:bg-[#101815]">
                {intakeError ? (
                  <div
                    role="alert"
                    className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 ring-1 ring-rose-500/25 dark:bg-rose-950/60 dark:text-rose-200"
                  >
                    <span>{intakeError}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      {lastIntakeWasImage && lastIntakeFileRef.current ? (
                        <button
                          type="button"
                          data-feryal-rotate-rescan="true"
                          disabled={uploadingIntake || sending}
                          onClick={() => void handleRotateIntakeImageAndRescan()}
                          className="inline-flex shrink-0 whitespace-nowrap cursor-pointer items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-slate-800 ring-1 ring-rose-300 transition hover:bg-emerald-50 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-55 dark:bg-[#090E0C] dark:text-slate-100 dark:ring-white/20"
                        >
                          {uploadingIntake ? (
                            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                          ) : (
                            <RotateCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          )}
                          <span>
                            {isAr ? 'تدوير 90° وإعادة المسح' : 'Rotate 90° & Re-Scan'}
                          </span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setIntakeError(null)}
                        aria-label={isAr ? 'إغلاق التنبيه' : 'Dismiss alert'}
                        className="cursor-pointer rounded px-1.5 py-0.5 text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-900/60"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ) : null}

                {!pendingIntakeDraft && todaySimulationSheet ? (
                  <div
                    role="status"
                    data-feryal-today-period-warning="true"
                    data-feryal-simulation-period-guard="true"
                    className="mb-3 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-amber-400/80 bg-amber-50/90 px-3.5 py-2.5 text-xs text-amber-950 shadow-2xs dark:border-amber-500/35 dark:bg-amber-950/60 dark:text-amber-100"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      <AlertTriangle
                        className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300"
                        aria-hidden
                      />
                      <p className="min-w-0 break-words font-semibold leading-relaxed">
                        {isAr
                          ? `تم تشغيل محاكاة الأسعار (${todaySimulationSheet.fileName}) على فترة «اليوم» ذات المبيعات الجزئية ليوم واحد — نوصي بإعادة التشغيل على «آخر 30 يوماً» للحصول على كميات ومطابقة شاملة.`
                          : `Price-sheet simulation (${todaySimulationSheet.fileName}) ran on "Today" (partial single-day POS volume). We recommend re-running on "Last 30 Days" for complete SKU velocity and KWD impact.`}
                      </p>
                    </div>
                    <button
                      type="button"
                      data-rerun-simulation-30d="true"
                      disabled={sending || uploadingIntake || rematchingLast30Days}
                      onClick={() => void handleRerunSimulationLast30Days()}
                      className="inline-flex shrink-0 whitespace-nowrap cursor-pointer items-center gap-1.5 rounded-xl bg-amber-900 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/60 disabled:cursor-not-allowed disabled:opacity-55 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400"
                    >
                      {rematchingLast30Days || sending ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      )}
                      <span>
                        {isAr ? 'إعادة التشغيل على آخر 30 يوماً' : 'Re-run on Last 30 Days'}
                      </span>
                    </button>
                  </div>
                ) : null}

                {pendingIntakeDraft ? (
                  <FeryalDocumentReviewCard
                    draft={pendingIntakeDraft}
                    isAr={isAr}
                    activePeriod={activePeriod}
                    submitting={sending}
                    rematchingLast30Days={rematchingLast30Days}
                    rescanningRotatedImage={uploadingIntake}
                    currentRotationDegrees={intakeRotationDegrees}
                    onDraftChange={setPendingIntakeDraft}
                    onSwitchAndRematchLast30Days={() => void handleSwitchAndRematchDraftLast30Days()}
                    onRotateImageAndRescan={() => void handleRotateIntakeImageAndRescan()}
                    onCancel={() => {
                      setPendingIntakeDraft(null)
                      setIntakeError(null)
                    }}
                    onConfirmAndRun={(confirmedSheet, reviewedDraft) => {
                      const ranOnSingleDay =
                        activePeriod === 'today' ||
                        (Boolean(reviewedDraft.period.from) &&
                          reviewedDraft.period.from === reviewedDraft.period.to)
                      setTodaySimulationSheet(ranOnSingleDay ? confirmedSheet : null)
                      const typed = inputText.trim()
                      const promptForAnalysis =
                        typed ||
                        (isAr
                          ? `حلّلي جدول الأسعار المؤكد (${confirmedSheet.fileName} — ${confirmedSheet.rows.length} صنفاً) عبر السيناريوهات الثلاثة وقدّمي القرار التنفيذي وخطة الأصناف.`
                          : `Run the 3-scenario executive pricing simulation on confirmed price sheet (${confirmedSheet.fileName} — ${confirmedSheet.rows.length} SKUs) and deliver the executive verdict and SKU playbook.`)
                      setPendingIntakeDraft(null)
                      setIntakeError(null)
                      void sendQuestion(promptForAnalysis, confirmedSheet, {
                        draftScope: {
                          brand: reviewedDraft.brand,
                          dateFrom: reviewedDraft.period.from,
                          dateTo: reviewedDraft.period.to,
                        },
                      })
                    }}
                  />
                ) : null}

                {!pendingIntakeDraft && activePriceSheetContext ? (
                  <div
                    data-active-price-sheet-pill="true"
                    className="mb-2.5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-950/45 dark:text-emerald-100"
                  >
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <span className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 font-bold text-emerald-900 dark:text-emerald-200">
                        <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden />
                        <span>
                          {isAr ? 'سياق جدول الأسعار النشط:' : 'Active Price Sheet Context:'}
                        </span>
                      </span>
                      <span
                        className="min-w-0 max-w-[240px] overflow-hidden text-ellipsis whitespace-nowrap rounded-md bg-white px-2 py-0.5 font-semibold text-slate-900 ring-1 ring-emerald-500/20 dark:bg-[#090E0C] dark:text-white"
                        title={
                          activePriceSheetContext.fileName ??
                          activePriceSheetContext.confirmedPriceSheet.fileName
                        }
                      >
                        {activePriceSheetContext.fileName ??
                          activePriceSheetContext.confirmedPriceSheet.fileName}
                      </span>
                      <span className="shrink-0 whitespace-nowrap rounded-md bg-emerald-600/15 px-2 py-0.5 font-bold tabular-nums text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200">
                        {isAr
                          ? `${activePriceSheetContext.confirmedPriceSheet.rows.length} صنف`
                          : `${activePriceSheetContext.confirmedPriceSheet.rows.length} SKUs`}
                      </span>
                      {activePriceSheetContext.brandScope ? (
                        <span className="shrink-0 whitespace-nowrap rounded-md bg-white/80 px-2 py-0.5 font-semibold text-slate-700 ring-1 ring-slate-200/80 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/10">
                          {activePriceSheetContext.brandScope}
                        </span>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      data-detach-price-sheet="true"
                      disabled={sending}
                      onClick={handleDetachActivePriceSheet}
                      aria-label={
                        isAr ? 'إلغاء ربط جدول الأسعار النشط' : 'Detach active price sheet context'
                      }
                      title={
                        isAr ? 'إلغاء ربط جدول الأسعار النشط' : 'Detach active price sheet context'
                      }
                      className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-white text-slate-600 ring-1 ring-slate-200/90 transition hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-50 dark:bg-[#090E0C] dark:text-slate-300 dark:ring-white/15"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                ) : null}

                <FeryalPendingAttachmentsTray
                  isAr={isAr}
                  attachments={pendingAttachments}
                  processing={processingMedia}
                  errorText={mediaError}
                  onRemove={handleRemoveAttachment}
                  onRotateAttachment={(id) => void handleRotateMediaAttachment(id)}
                  onClearAll={handleClearAllAttachments}
                  onApplyPresetPrompt={(p) => {
                    setInputText(p)
                    const shouldScroll = applyFeryalPromptAutoResize(promptTextareaRef.current, p)
                    setPromptOverflowScroll(shouldScroll)
                  }}
                />

                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void sendQuestion()
                  }}
                  className="flex flex-col rounded-2xl border border-slate-200/90 bg-[#F6F7F8] p-2.5 shadow-2xs transition focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/40 dark:border-white/15 dark:bg-[#090E0C] dark:focus-within:bg-[#0D1512]"
                >
                  <textarea
                    ref={promptTextareaRef}
                    rows={1}
                    data-feryal-chat-input="true"
                    data-feryal-auto-textarea="true"
                    value={inputText}
                    onChange={(e) => {
                      const nextVal = e.target.value
                      setInputText(nextVal)
                      const shouldScroll = applyFeryalPromptAutoResize(e.currentTarget, nextVal)
                      setPromptOverflowScroll(shouldScroll)
                    }}
                    aria-label={isAr ? 'سؤال لفريال عن بيانات Odoo 17' : 'Ask Feryal about Odoo 17 data'}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                        const decision = shouldSubmitFeryalPromptOnKeyDown({
                          key: e.key,
                          shiftKey: e.shiftKey,
                          isComposing: Boolean(e.nativeEvent.isComposing),
                          sending,
                          inputText,
                          attachmentCount: pendingAttachments.length,
                        })
                        if (decision.preventDefault) {
                          e.preventDefault()
                        }
                        if (decision.shouldSend) {
                          void sendQuestion()
                        }
                      }
                    }}
                    placeholder={
                      isAr
                        ? 'اسأل فريال، أو أرفق صورة / فيديو / جدول أسعار...'
                        : 'Ask Ferial, or attach a photo, video, or price sheet...'
                    }
                    style={{ overflowY: promptOverflowScroll ? 'auto' : 'hidden' }}
                    className={`min-h-[40px] max-h-[40vh] w-full min-w-0 resize-none border-0 bg-transparent px-1.5 py-1 text-[14.5px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white ${
                      promptOverflowScroll ? 'overflow-y-auto' : 'overflow-y-hidden'
                    }`}
                  />

                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-2 dark:border-white/10">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <FeryalMediaPickerButton
                        isAr={isAr}
                        size="sm"
                        disabled={sending}
                        processing={processingMedia}
                        uploadingIntake={uploadingIntake}
                        attachmentCount={pendingAttachments.length}
                        onFilesSelected={handleFilesSelected}
                        onIntakeFileSelected={(file) => void handleIntakeFileSelected(file)}
                        openPickerRef={openPickerRef}
                        openCameraRef={openCameraRef}
                      />

                      <button
                        type="button"
                        disabled={sending}
                        onClick={() => void handleToggleVoiceInput()}
                        aria-label={
                          recordingVoice
                            ? isAr
                              ? 'إيقاف التسجيل الصوتي'
                              : 'Stop voice recording'
                            : isAr
                              ? 'إدخال صوتي'
                              : 'Voice input'
                        }
                        title={isAr ? 'إدخال صوتي' : 'Voice input'}
                        className={`inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-2xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
                          recordingVoice
                            ? 'bg-rose-600 text-white animate-pulse'
                            : 'bg-white text-slate-700 ring-1 ring-slate-900/[0.06] hover:bg-emerald-50 hover:text-emerald-800 dark:bg-[#101815] dark:text-slate-200 dark:ring-white/10'
                        }`}
                      >
                        {recordingVoice ? <Square className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
                      </button>
                    </div>

                    <div className="ms-auto flex items-center gap-2.5">
                      <span className="hidden whitespace-nowrap text-xs text-slate-400 xl:inline dark:text-slate-500">
                        {isAr ? 'Enter للإرسال • Shift+Enter لسطر جديد' : 'Enter to send • Shift+Enter for newline'}
                      </span>
                      <button
                        type="submit"
                        disabled={sending || (!inputText.trim() && pendingAttachments.length === 0)}
                        className="inline-flex h-9 shrink-0 whitespace-nowrap cursor-pointer items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 text-xs sm:text-sm font-bold text-white shadow-xs transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-45"
                      >
                        <Send className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span>{isAr ? 'إرسال' : 'Send'}</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            ) : (
              <div className="border-t border-slate-200/80 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-[#090E0C] dark:text-slate-300">
                {isAr
                  ? 'وضع المراجع الخارجي (للقراءة فقط) — يمكنك مراجعة التنبيهات وسجل الأسئلة والاستعلامات الكامل لـ Odoo 17.'
                  : 'Read-only External Reviewer Mode — inspect Odoo 17 alerts and the full Odoo query log.'}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Today's Notes ⚡ & Executive Summary */}
        {mainTab === 'today-notes' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="min-w-0 break-words text-[15px] font-black text-slate-900 dark:text-white">
                  {isAr ? 'ملخص اليوم وآخر التنبيهات' : "Today's Executive Summary & Latest Alerts"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isAr ? workspace.subtitleAr : workspace.subtitleEn}
                </p>
              </div>
              <span className="shrink-0 whitespace-nowrap rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                {isAr ? workspace.periodCalendarWindowAr : workspace.periodCalendarWindowEn}
              </span>
            </div>

            {/* Live Odoo KPI Strip (strictly nullable — renders "—" + Unavailable when null/disconnected) */}
            <div
              className={`grid gap-3 ${
                workspace.odooConnected && bestBranch && !worstBranch
                  ? 'grid-cols-1 sm:grid-cols-3'
                  : 'grid-cols-2 lg:grid-cols-4'
              }`}
            >
              <article className="relative overflow-visible min-w-0 rounded-2xl border border-slate-200/80 bg-[#F8FAF9] p-3.5 dark:border-white/10 dark:bg-[#141F1B]">
                <div className="min-w-0 break-words text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {isAr ? 'صافي المبيعات' : 'Net Sales'}
                </div>
                <div
                  dir="ltr"
                  data-unavailable={
                    !workspace.odooConnected || workspace.nullableSalesKwd === null
                      ? 'true'
                      : undefined
                  }
                  title={
                    !workspace.odooConnected || workspace.nullableSalesKwd === null
                      ? unavailableTooltip
                      : undefined
                  }
                  aria-label={
                    !workspace.odooConnected || workspace.nullableSalesKwd === null
                      ? unavailableTooltip
                      : undefined
                  }
                  className="mt-1.5 whitespace-nowrap text-lg font-extrabold tabular-nums text-slate-900 dark:text-white"
                >
                  {workspace.odooConnected
                    ? formatKwd(workspace.nullableSalesKwd, { locale: fmtLocale })
                    : UNAVAILABLE_DASH}
                </div>
              </article>

              <article className="relative overflow-visible min-w-0 rounded-2xl border border-slate-200/80 bg-[#F8FAF9] p-3.5 dark:border-white/10 dark:bg-[#141F1B]">
                <div className="min-w-0 break-words text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {isAr ? 'عدد الطلبات' : 'Orders'}
                </div>
                <div
                  dir="ltr"
                  data-feryal-orders="value"
                  data-unavailable={ordersUnknown ? 'true' : undefined}
                  title={ordersUnknown ? unavailableTooltip : undefined}
                  aria-label={ordersUnknown ? unavailableTooltip : undefined}
                  className="mt-1.5 whitespace-nowrap text-lg font-extrabold tabular-nums text-slate-900 dark:text-white"
                >
                  {ordersUnknown ? UNAVAILABLE_DASH : formatInt(workspace.nullableOrders, { locale: fmtLocale })}
                </div>
              </article>

              <article className="relative overflow-visible min-w-0 rounded-2xl border border-slate-200/80 bg-[#F8FAF9] p-3.5 dark:border-white/10 dark:bg-[#141F1B]">
                <div className="min-w-0 break-words text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {isAr ? 'أعلى فرع مبيعاً' : 'Best Branch'}
                </div>
                <div className="mt-1 min-w-0 break-words text-sm font-bold text-emerald-700 dark:text-emerald-300">
                  {bestBranch ? (isAr ? bestBranch.ar : bestBranch.en) : UNAVAILABLE_DASH}
                </div>
                <div
                  dir="ltr"
                  data-unavailable={!bestBranch ? 'true' : undefined}
                  title={!bestBranch ? unavailableTooltip : undefined}
                  aria-label={!bestBranch ? unavailableTooltip : undefined}
                  className="mt-0.5 whitespace-nowrap text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300"
                >
                  {bestBranch
                    ? formatKwd(bestBranch.salesKwd, { locale: fmtLocale })
                    : UNAVAILABLE_DASH}
                </div>
              </article>

              {!(workspace.odooConnected && bestBranch && !worstBranch) ? (
                <article className="relative overflow-visible min-w-0 rounded-2xl border border-slate-200/80 bg-[#F8FAF9] p-3.5 dark:border-white/10 dark:bg-[#141F1B]">
                  <div className="min-w-0 break-words text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {isAr ? 'أقل فرع مبيعاً' : 'Lowest Branch'}
                  </div>
                  <div className="mt-1 min-w-0 break-words text-sm font-bold text-amber-700 dark:text-amber-300">
                    {worstBranch ? (isAr ? worstBranch.ar : worstBranch.en) : UNAVAILABLE_DASH}
                  </div>
                  <div
                    dir="ltr"
                    data-unavailable={!worstBranch ? 'true' : undefined}
                    title={!worstBranch ? unavailableTooltip : undefined}
                    aria-label={!worstBranch ? unavailableTooltip : undefined}
                    className="mt-0.5 whitespace-nowrap text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300"
                  >
                    {worstBranch
                      ? formatKwd(worstBranch.salesKwd, { locale: fmtLocale })
                      : UNAVAILABLE_DASH}
                  </div>
                </article>
              ) : null}
            </div>

            {/* Live Feryal Notes */}
            {workspace.feryalNotes.length === 0 ? (
              <StateBlock
                state={!workspace.odooConnected ? 'unlinked' : 'empty'}
                compact
                locale={fmtLocale}
                title={
                  !workspace.odooConnected
                    ? isAr
                      ? 'الاتصال المباشر مع Odoo غير متاح حالياً'
                      : 'Odoo live connection is unavailable'
                    : isAr
                      ? 'لا توجد ملاحظات يومية متاحة لهذه الشريحة'
                      : 'No daily notes available for this slice'
                }
                description={
                  isAr
                    ? 'تُبنى الملاحظات اليومية تلقائياً من أرقام Odoo 17 الفعلية فقط دون أي بطاقات ثابتة.'
                    : 'Daily notes are derived strictly from Odoo 17 metrics with zero static placeholders.'
                }
              />
            ) : (
              <div
                className={`grid grid-cols-1 gap-3 ${
                  workspace.feryalNotes.length === 1 ? 'md:grid-cols-1' : 'md:grid-cols-2'
                }`}
              >
                {workspace.feryalNotes.map((note) => (
                  <article
                    key={note.id}
                    className="flex min-w-0 flex-col justify-between space-y-2.5 rounded-2xl border border-slate-200/80 bg-[#F8FAF9] p-4 dark:border-white/10 dark:bg-[#141F1B]"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="min-w-0 flex-1 break-words text-[14px] font-bold text-slate-900 dark:text-white">
                          {isAr ? note.titleAr : note.titleEn}
                        </h4>
                        <span
                          dir="ltr"
                          className="shrink-0 whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                        >
                          {isAr ? note.benefitAr : note.benefitEn}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {isAr ? note.summaryAr : note.summaryEn}
                      </p>
                    </div>
                    {!isAuditor ? (
                      <button
                        type="button"
                        disabled={sending}
                        onClick={() => void sendQuestion(isAr ? note.promptAr : note.promptEn)}
                        className="w-full cursor-pointer rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-600/20 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-50 dark:bg-emerald-950/60 dark:text-emerald-200"
                      >
                        {isAr ? 'اسأل فريال' : 'Ask Feryal'}
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Real Odoo Governance Breaches ONLY (`/api/erp/governance`) */}
        {mainTab === 'alerts' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="min-w-0 break-words text-[15px] font-black text-slate-900 dark:text-white">
                  {isAr
                    ? 'تنبيهات الحوكمة الفعلية من Odoo 17'
                    : 'Odoo 17 Governance Alerts'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isAr
                    ? 'تُعرض فقط المخالفات الناتجة فعلياً عن استعلام Odoo 17 مقابل السقوف المحفوظة من مسؤول النظام.'
                    : 'Displays strictly real breaches computed from Odoo 17 records against admin-saved server thresholds.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void fetchServerGovernanceBreaches()}
                className="inline-flex shrink-0 whitespace-nowrap cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-white/15 dark:bg-[#141F1B] dark:text-slate-200"
              >
                <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${loadingBreaches ? 'animate-spin' : ''}`} aria-hidden />
                <span>{isAr ? 'تحديث من Odoo' : 'Refresh'}</span>
              </button>
            </div>

            {loadingBreaches ? (
              <StateBlock
                state="loading"
                locale={fmtLocale}
                skeletonRows={3}
                title={isAr ? 'جارٍ فحص قواعد الحوكمة على Odoo 17...' : 'Evaluating Odoo 17 governance rules...'}
              />
            ) : breachesError ? (
              <StateBlock
                state="error"
                locale={fmtLocale}
                onRetry={() => void fetchServerGovernanceBreaches()}
                title={FERYAL_GOVERNANCE_ALERTS_LOAD_ERROR_AR}
              />
            ) : liveBreaches.length === 0 ? (
              <StateBlock
                state="empty"
                locale={fmtLocale}
                title={
                  isAr
                    ? 'لا توجد مخالفات فعلية مسجلة من Odoo 17 حالياً'
                    : 'No active Odoo 17 governance breaches'
                }
                description={
                  isAr
                    ? 'لا يتم عرض أي تنبيه افتراضي أو ثابت عند عدم وجود تجاوز فعلي في بيانات Odoo 17.'
                    : 'Zero static or synthetic alerts are shown when no Odoo 17 threshold is breached.'
                }
              />
            ) : (
              <div className="space-y-3">
                {liveBreaches.map((b) => (
                  <div
                    key={b.id}
                    className="min-w-0 rounded-2xl border border-rose-200 bg-rose-50/40 p-4 space-y-2 dark:border-rose-900/50 dark:bg-rose-950/20"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span dir="ltr" className="shrink-0 whitespace-nowrap rounded-md bg-rose-600 px-2 py-0.5 font-mono text-xs font-bold text-white">
                        {b.odooModel}
                      </span>
                      <span dir="ltr" className="shrink-0 whitespace-nowrap text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                        {b.period.from} → {b.period.to}
                      </span>
                    </div>
                    <div className="text-[14px] font-black text-slate-900 dark:text-white">
                      {isAr ? b.breachHeadlineAr : b.breachHeadlineEn}
                    </div>
                    <div className="text-xs text-slate-700 dark:text-slate-300">
                      {isAr ? b.odooMetricProofAr : b.odooMetricProofEn}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                      <span className="font-semibold text-rose-800 dark:text-rose-300">
                        {isAr ? b.approvedRuleLimitAr : b.approvedRuleLimitEn}
                      </span>
                      {b.odooRecordUrl && (
                        <a
                          href={b.odooRecordUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 rounded font-bold text-emerald-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:text-emerald-300"
                        >
                          <span>{isAr ? 'فتح السجل في Odoo' : 'Open in Odoo'}</span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Transparent Odoo Query & Numeric Verifier Audit Log */}
        {mainTab === 'audit' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="min-w-0 break-words text-[15px] font-black text-slate-900 dark:text-white">
                  {isAr
                    ? 'سجل الأسئلة والاستعلامات لفريال'
                    : 'Feryal Odoo Query Log'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isAr
                    ? 'يوثق كل سؤال، ودور المستخدم، والطابع الزمني، واستعلامات Odoo 17 المنفذة، ونتيجة فحص الأرقام، والإجابة النهائية.'
                    : 'Records every question, user role, timestamp, executed Odoo 17 queries, numeric verifier status, and final answer.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void fetchServerAuditLogs()}
                className="inline-flex shrink-0 whitespace-nowrap cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-white/15 dark:bg-[#141F1B] dark:text-slate-200"
              >
                <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${loadingAudit ? 'animate-spin' : ''}`} aria-hidden />
                <span>{isAr ? 'تحديث السجل' : 'Refresh Log'}</span>
              </button>
            </div>

            {loadingAudit ? (
              <StateBlock
                state="loading"
                locale={fmtLocale}
                skeletonRows={3}
                title={isAr ? 'جارٍ تحميل سجل الاستعلامات...' : 'Loading Odoo query log...'}
              />
            ) : auditError ? (
              <StateBlock
                state="error"
                locale={fmtLocale}
                onRetry={() => void fetchServerAuditLogs()}
                title={FERYAL_QUERY_LOG_LOAD_ERROR_AR}
              />
            ) : auditLogs.length === 0 ? (
              <StateBlock
                state="empty"
                locale={fmtLocale}
                title={
                  isAr
                    ? 'لا توجد استعلامات مسجلة في سجل الأسئلة والاستعلامات حتى الآن.'
                    : 'No queries recorded in the Odoo query log yet.'
                }
                description={
                  isAr
                    ? 'سيُوثق هنا كل سؤال يُرسل إلى فريال مع استعلام Odoo 17 المنفذ ونتيجة الفحص.'
                    : 'Every query sent to Feryal will be logged here alongside executed Odoo 17 queries.'
                }
              />
            ) : (
              <div className="space-y-3">
                {auditLogs.map((entry) => (
                  <div
                    key={entry.id}
                    className="min-w-0 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 space-y-2.5 dark:border-white/10 dark:bg-[#141F1B]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="shrink-0 whitespace-nowrap rounded-md bg-slate-200/80 px-2 py-0.5 font-bold text-slate-800 dark:bg-white/10 dark:text-slate-200">
                          {entry.userRole}
                        </span>
                        {!isAuditor && (
                          <span dir="ltr" className="min-w-0 [overflow-wrap:anywhere] font-mono text-xs text-slate-500 dark:text-slate-400">
                            {entry.userSub}
                          </span>
                        )}
                        <span
                          className={`shrink-0 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-bold ${
                            entry.verifier?.valid
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                        >
                          {entry.verifier?.valid
                            ? isAr
                              ? 'فحص الأرقام: مطابق'
                              : 'Verifier: Passed'
                            : isAr
                              ? 'فحص الأرقام: مرفوض'
                              : 'Verifier: Rejected'}
                        </span>
                      </div>
                      <span dir="ltr" className="shrink-0 whitespace-nowrap font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                        {formatDateTime(entry.timestampIso, { locale: fmtLocale, showZone: true })}
                      </span>
                    </div>

                    <div className="text-[13.5px] font-bold text-slate-900 dark:text-white">
                      {isAr ? 'السؤال: ' : 'Q: '}
                      {entry.question}
                    </div>

                    {entry.executedQueries.length > 0 && (
                      <div className="space-y-1 overflow-x-auto rounded-xl bg-white p-2.5 text-xs ring-1 ring-slate-200/70 dark:bg-[#090E0C] dark:ring-white/10">
                        {entry.executedQueries.map((q, qi) => (
                          <div key={`${entry.id}-q-${qi}`} dir="ltr" className="whitespace-nowrap font-mono text-slate-700 dark:text-slate-300">
                            model={q.model} | groupby={JSON.stringify(q.groupby)} | period={q.period.from}..{q.period.to} | domain={JSON.stringify(q.domain)}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="whitespace-pre-wrap [overflow-wrap:anywhere] rounded-xl bg-white/80 p-3 text-xs leading-relaxed text-slate-700 ring-1 ring-slate-200/60 dark:bg-[#090E0C] dark:text-slate-200 dark:ring-white/10">
                      {entry.finalReply}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <FeryalMemoryDrawer
        open={memoryDrawerOpen}
        onClose={() => setMemoryDrawerOpen(false)}
        isAr={isAr}
        isAuditor={isAuditor}
      />
    </div>
  )
}
