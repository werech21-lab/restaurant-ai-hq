'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  Brain,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Database,
  ExternalLink,
  FileSpreadsheet,
  History,
  Loader2,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Square,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { FeryalStudioMessage, feryalPlainText } from '@/components/aether/FeryalStudioMessage'
import { FeryalMemoryDrawer } from '@/components/aether/FeryalMemoryDrawer'
import { FeryalSidebarNotebooks } from '@/components/aether/FeryalSidebarNotebooks'
import {
  FeryalMediaPickerButton,
  FeryalMessageAttachmentsGallery,
  FeryalPendingAttachmentsTray,
  FeryalVisionCompliancePill,
} from '@/components/aether/FeryalMultimodalBar'
import {
  buildDefaultMediaPrompt,
  callFeryalVisionInspector,
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
  FERYAL_CHATS_UPDATED_EVENT,
  getChatIndexSync,
  hydrateFeryalChatStore,
  loadChatThread,
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

interface ChatUiMessage extends StoredChatMessage {
  userPrompt?: string
  providerBadge?: string
  learnedBadge?: string
  complianceTier?: VisionComplianceTier
  attachments?: StoredAttachmentMeta[]
  executedQueries?: ExecutedOdooQueryBadge[]
  verifier?: VerifierBadgeState
  replyStatus?: string
}

interface ServerAuditLogRow {
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
    return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
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
    en: 'مبيعات أمس حسب الفرع',
  },
  {
    id: 'promenade-yesterday',
    modelBadge: 'pos.order',
    ar: 'مبيعات بروميناد أمس',
    en: 'مبيعات بروميناد أمس',
  },
  {
    id: 'top-5-items',
    modelBadge: 'pos.order.line',
    ar: 'أعلى 5 أصناف أمس',
    en: 'أعلى 5 أصناف أمس',
  },
  {
    id: 'purchase-orders-summary',
    modelBadge: 'purchase.order',
    ar: 'إجمالي أوامر الشراء والموردين هذا الشهر',
    en: 'إجمالي أوامر الشراء والموردين هذا الشهر',
  },
  {
    id: 'warehouse-transfers',
    modelBadge: 'stock.move / stock.scrap',
    ar: 'حركات التحويل المخزني والهدر هذا الشهر',
    en: 'حركات التحويل المخزني والهدر هذا الشهر',
  },
  {
    id: 'gl-accounting',
    modelBadge: 'account.move.line',
    ar: 'الإيرادات والمصروفات وصافي الربح في دفتر الأستاذ هذا الشهر',
    en: 'الإيرادات والمصروفات وصافي الربح في دفتر الأستاذ هذا الشهر',
  },
]

export function FeryalGovernanceStudio({
  sessionRole,
}: {
  sessionRole?: string
} = {}) {
  const { locale } = useI18n()
  const isAr = locale === 'ar'
  const isAuditor = sessionRole === 'auditor'
  const { workspace } = useGlobalFilter()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarTab, setSidebarTab] = useState<'chats' | 'notes'>('chats')
  const [mainTab, setMainTab] = useState<'chat' | 'alerts' | 'audit'>('chat')
  const [memoryDrawerOpen, setMemoryDrawerOpen] = useState(false)
  const [savedNotesCount, setSavedNotesCount] = useState(0)

  const [activeChatId, setActiveChatId] = useState<string>(() => nextUiId('chat'))
  const [activeNotebookId, setActiveNotebookId] = useState<string>('all')
  const [messages, setMessages] = useState<ChatUiMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [activeMode, setActiveMode] = useState<BrainMode>('triple')

  // Live Governance Alerts strictly from `/api/erp/governance` (ZERO static alerts)
  const [liveBreaches, setLiveBreaches] = useState<ComplianceBreachItem[]>([])
  const [loadingBreaches, setLoadingBreaches] = useState(false)

  // Transparent Server Audit Log from `GET /api/erp/feryal/chat`
  const [auditLogs, setAuditLogs] = useState<ServerAuditLogRow[]>([])
  const [loadingAudit, setLoadingAudit] = useState(false)

  // Clean user-entered notes (ZERO pre-populated cards)
  const [userNotes, setUserNotes] = useState<UserFieldNote[]>([])
  const [noteTitle, setNoteTitle] = useState('')
  const [noteDetail, setNoteDetail] = useState('')

  // Multimodal attachments
  const [pendingAttachments, setPendingAttachments] = useState<FeryalMediaAttachment[]>([])
  const [processingMedia, setProcessingMedia] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const openPickerRef = useRef<(() => void) | null>(null)
  const openCameraRef = useRef<(() => void) | null>(null)

  // Voice & clipboard UI state
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [submittedBellIds, setSubmittedBellIds] = useState<Record<string, boolean>>({})
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [recordingVoice, setRecordingVoice] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const fetchServerGovernanceBreaches = useCallback(async () => {
    setLoadingBreaches(true)
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
      }
    } catch {
      setLiveBreaches([])
    } finally {
      setLoadingBreaches(false)
    }
  }, [])

  const fetchServerAuditLogs = useCallback(async () => {
    setLoadingAudit(true)
    try {
      const res = await fetch('/api/erp/feryal/chat?limit=50', {
        method: 'GET',
        cache: 'no-store',
      })
      if (res.ok) {
        const data = (await res.json()) as { auditLogs?: ServerAuditLogRow[] }
        setAuditLogs(Array.isArray(data.auditLogs) ? data.auditLogs : [])
      }
    } catch {
      // keep existing audit list on network error
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

  useEffect(() => {
    void hydrateFeryalChatStore().then(() => {
      const idx = getChatIndexSync()
      if (idx.length > 0) {
        const latest = idx[0]
        setActiveChatId(latest.id)
        void loadChatThread(latest.id).then((thread) => {
          if (thread && thread.messages.length > 0) {
            setMessages(thread.messages)
          }
        })
      }
    })
  }, [])

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
    void fetchServerGovernanceBreaches()
    void fetchServerAuditLogs()
  }, [fetchServerGovernanceBreaches, fetchServerAuditLogs])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  useEffect(() => {
    return () => {
      revokeAttachmentObjectUrls(pendingAttachments)
    }
  }, [pendingAttachments])

  const persistMessages = useCallback(
    async (chatId: string, nextMsgs: ChatUiMessage[]) => {
      const stored: StoredChatMessage[] = nextMsgs.map((m) => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        time: m.time,
        engineLabelAr: m.providerBadge,
        statusNoteAr: m.learnedBadge,
        visionCompliance: m.complianceTier,
        attachmentsMeta: m.attachments,
      }))
      await autoSaveChatThread({
        chatId,
        messages: stored,
        lang: isAr ? 'ar' : 'en',
        preferredNotebookId: activeNotebookId !== 'all' ? activeNotebookId : undefined,
        filterLabel: isAr ? workspace.subtitleAr : workspace.subtitleEn,
      })
    },
    [activeNotebookId, isAr, workspace.subtitleAr, workspace.subtitleEn],
  )

  const handleStartNewChat = useCallback(() => {
    const freshId = nextUiId('chat')
    setActiveChatId(freshId)
    setMessages([])
    setInputText('')
    setMainTab('chat')
  }, [])

  const handleSelectChat = useCallback(async (chatId: string) => {
    setActiveChatId(chatId)
    setMainTab('chat')
    const thread = await loadChatThread(chatId)
    if (thread) {
      setMessages(
        thread.messages.map((m) => ({
          ...m,
          providerBadge: m.engineLabelAr,
          learnedBadge: m.statusNoteAr,
          complianceTier: m.visionCompliance,
          attachments: m.attachmentsMeta,
        })),
      )
    } else {
      setMessages([])
    }
  }, [])

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
        setMediaError(
          isAr ? 'تعذر تجهيز المرفق البصري.' : 'Could not process visual attachment.',
        )
      } finally {
        setProcessingMedia(false)
      }
    },
    [isAr, isAuditor],
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

  const sendQuestion = useCallback(
    async (overridePrompt?: string) => {
      if (isAuditor || sending) return
      const rawPrompt = (overridePrompt ?? inputText).trim()
      const hasMedia = pendingAttachments.length > 0

      if (!rawPrompt && !hasMedia) return

      const effectivePrompt =
        rawPrompt || buildDefaultMediaPrompt(pendingAttachments, isAr ? 'ar' : 'en')

      const attachmentMetas: StoredAttachmentMeta[] = pendingAttachments.map(
        toStoredAttachmentMeta,
      )
      const attachmentsSnapshot = [...pendingAttachments]

      const userMsg: ChatUiMessage = {
        id: nextUiId('u'),
        sender: 'user',
        text: effectivePrompt,
        time: formatClockNow(),
        ...(attachmentMetas.length > 0 ? { attachments: attachmentMetas } : {}),
      }

      const optimisticList = [...messages, userMsg]
      setMessages(optimisticList)
      if (!overridePrompt) setInputText('')
      if (hasMedia) handleClearAllAttachments()
      setSending(true)
      setMainTab('chat')

      try {
        // 1. Visual attachment inspection via `/api/erp/feryal/vision` ONLY when media is attached
        if (attachmentsSnapshot.length > 0) {
          const visionRes = await callFeryalVisionInspector({
            prompt: effectivePrompt,
            lang: isAr ? 'ar' : 'en',
            workspaceContext: isAr ? workspace.subtitleAr : workspace.subtitleEn,
            attachments: attachmentsSnapshot,
          })

          const replyText =
            visionRes?.reply ||
            (isAr ? 'لا أملك بيانات من Odoo عن هذا' : 'لا أملك بيانات من Odoo عن هذا')
          const tier: VisionComplianceTier | undefined = visionRes?.complianceTier

          const feryalMsg: ChatUiMessage = {
            id: nextUiId('f'),
            sender: 'feryal',
            text: replyText,
            time: formatClockNow(),
            userPrompt: effectivePrompt,
            providerBadge: isAr ? 'فحص الصور والفيديو' : 'Vision Inspector',
            complianceTier: tier,
          }
          const updated = [...optimisticList, feryalMsg]
          setMessages(updated)
          await persistMessages(activeChatId, updated)
          return
        }

        // 2. Exclusive Odoo 17 Live Tool-Calling Engine (`POST /api/erp/feryal/chat`)
        const res = await fetch('/api/erp/feryal/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: effectivePrompt }),
        })

        let replyText = 'لا أملك بيانات من Odoo عن هذا'
        let modelBadge = 'Odoo'
        let executedQueries: ExecutedOdooQueryBadge[] = []
        let verifier: VerifierBadgeState | undefined
        let replyStatus = 'no_odoo_data'

        if (res.ok) {
          const payload = (await res.json()) as {
            ok?: boolean
            reply?: string
            status?: string
            model?: string
            executedQueries?: ExecutedOdooQueryBadge[]
            verifier?: VerifierBadgeState
          }
          if (payload.ok && typeof payload.reply === 'string') {
            replyText = payload.reply
            replyStatus = payload.status || 'answered'
            modelBadge = payload.model ? `Odoo (${payload.model})` : 'Odoo'
            executedQueries = Array.isArray(payload.executedQueries) ? payload.executedQueries : []
            verifier = payload.verifier
          }
        }

        const learnRes = await autoLearnFromConversationTurn(effectivePrompt, replyText)

        const feryalMsg: ChatUiMessage = {
          id: nextUiId('f'),
          sender: 'feryal',
          text: replyText,
          time: formatClockNow(),
          userPrompt: effectivePrompt,
          providerBadge: modelBadge,
          learnedBadge: learnRes.learnedFact,
          executedQueries,
          verifier,
          replyStatus,
        }

        const updated = [...optimisticList, feryalMsg]
        setMessages(updated)
        await persistMessages(activeChatId, updated)
        void fetchServerAuditLogs()
      } catch {
        const fallbackMsg: ChatUiMessage = {
          id: nextUiId('f'),
          sender: 'feryal',
          text: 'لا أملك بيانات من Odoo عن هذا',
          time: formatClockNow(),
          userPrompt: effectivePrompt,
          providerBadge: 'Odoo',
          replyStatus: 'no_odoo_data',
        }
        const updated = [...optimisticList, fallbackMsg]
        setMessages(updated)
        await persistMessages(activeChatId, updated)
      } finally {
        setSending(false)
      }
    },
    [
      activeChatId,
      fetchServerAuditLogs,
      handleClearAllAttachments,
      inputText,
      isAr,
      isAuditor,
      messages,
      pendingAttachments,
      persistMessages,
      sending,
      workspace.subtitleAr,
      workspace.subtitleEn,
    ],
  )

  const handleQuickAuditChip = useCallback(
    (chipId: QuickAuditChipId) => {
      if (isAuditor) return
      const snap = readLiveGovernanceSnapshot(workspace)
      const promptMap: Record<QuickAuditChipId, string> = {
        'open-violations': 'مبيعات أمس حسب الفرع',
        'seven-branch-plan': 'أعلى 5 أصناف أمس',
        'odoo-growth-plan': 'إجمالي أوامر الشراء والموردين هذا الشهر',
        'regulatory-readiness': 'حركات التحويل المخزني والهدر هذا الشهر',
      }
      const q = promptMap[chipId]
      void snap
      void sendQuestion(q)
    },
    [isAuditor, sendQuestion, workspace],
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
        createdAt: new Date().toISOString().slice(0, 10),
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

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="flex min-h-[calc(100vh-120px)] w-full flex-col lg:flex-row gap-4 rounded-3xl bg-[#F6F7F8] p-3 sm:p-4 dark:bg-[#08100D]"
    >
      {/* Sidebar: Saved Chats & User-Only Field Notes (Zero Static Cards) */}
      {sidebarOpen && (
        <aside className="w-full lg:w-[300px] xl:w-[320px] shrink-0 flex flex-col rounded-2xl bg-white shadow-xs ring-1 ring-slate-900/[0.05] dark:bg-[#0D1713] dark:ring-emerald-500/15 overflow-hidden">
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
                <div className="flex items-center gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setSidebarTab('chats')}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-neutral-600 dark:text-slate-300"
                  >
                    {isAr ? 'المحادثات' : 'Chats'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarTab('notes')}
                    className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-2xs dark:bg-emerald-500/20 dark:text-emerald-200"
                  >
                    {isAr ? 'ملاحظات المستخدم' : 'User Notes'}
                  </button>
                </div>
              </div>

              {!isAuditor && (
                <form
                  onSubmit={handleAddUserNote}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 space-y-2 dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <input
                    type="text"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder={isAr ? 'عنوان الملاحظة...' : 'Note title...'}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <textarea
                    rows={2}
                    value={noteDetail}
                    onChange={(e) => setNoteDetail(e.target.value)}
                    placeholder={isAr ? 'تفاصيل الملاحظة الفعليّة...' : 'Factual note details...'}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {isAr ? 'إضافة ملاحظة' : 'Add Note'}
                  </button>
                </form>
              )}

              <div className="flex-1 overflow-y-auto space-y-2">
                {userNotes.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    {isAr
                      ? 'لا توجد ملاحظات مسجلة حالياً.'
                      : 'No notes recorded yet.'}
                  </div>
                ) : (
                  userNotes.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-xl border border-slate-200/80 bg-white p-2.5 space-y-1 dark:border-slate-800 dark:bg-slate-900/70"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {n.title}
                        </span>
                        {!isAuditor && (
                          <button
                            type="button"
                            onClick={() => handleDeleteUserNote(n.id)}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {n.detail ? (
                        <p className="text-xs text-slate-600 dark:text-slate-300">{n.detail}</p>
                      ) : null}
                      <div className="text-[11px] text-slate-400">{n.createdAt}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </aside>
      )}

      {/* Main Studio Area */}
      <div className="flex min-w-0 flex-1 flex-col rounded-2xl bg-white shadow-xs ring-1 ring-slate-900/[0.05] dark:bg-[#0D1713] dark:ring-emerald-500/15 overflow-hidden">
        {/* Top Bar */}
        <header className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200/80 px-4 py-3 dark:border-emerald-500/15">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 dark:bg-white/[0.06] dark:text-slate-200"
              title={isAr ? 'إظهار/إخفاء القائمة الجانبية' : 'Toggle sidebar'}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </button>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[15.5px] sm:text-[17px] font-black text-slate-900 dark:text-white">
                  {isAr ? 'اسأل فريال — محرك بيانات Odoo 17' : 'Ask Feryal — Odoo 17 Data Engine'}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-200">
                  <Database className="h-3 w-3" />
                  {modeBadgeLabel}
                </span>
              </div>
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
                {isAr
                  ? '6 علامات تجارية • 7 فروع مربوطة + بند غير منسوب لفرع • استعلام من Odoo 17 وفحص برمجي لكل رقم'
                  : '6 Brands • 7 Mapped Branches + Unattributed Bucket • Odoo 17 Queries & Strict Numeric Verifier'}
              </p>
            </div>
          </div>

          {/* View Switcher: Chat | Odoo Governance Alerts | Odoo Query Log */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/[0.06]">
              <button
                type="button"
                onClick={() => setMainTab('chat')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  mainTab === 'chat'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                }`}
              >
                {isAr ? 'المحادثة' : 'Chat'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMainTab('alerts')
                  void fetchServerGovernanceBreaches()
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  mainTab === 'alerts'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{isAr ? 'تنبيهات الحوكمة الفعلية' : 'Odoo Governance Alerts'}</span>
                {liveBreaches.length > 0 && (
                  <span className="rounded-full bg-rose-600 px-1.5 py-0.2 text-[10.5px] font-black text-white">
                    {liveBreaches.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMainTab('audit')
                  void fetchServerAuditLogs()
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  mainTab === 'audit'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                }`}
              >
                <History className="h-3.5 w-3.5" />
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
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <Brain className="h-3.5 w-3.5 text-emerald-600" />
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
            {/* Quick Live Odoo Query Chips */}
            {!isAuditor && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-slate-100 px-4 py-2.5 dark:border-white/[0.05]">
                {FERYAL_EXECUTIVE_AUDIT_CHIPS.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    disabled={sending}
                    onClick={() => handleQuickAuditChip(chip.id)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/90 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50/70 hover:text-emerald-900 disabled:opacity-50 dark:border-slate-800 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-emerald-950/50"
                  >
                    <span>{isAr ? chip.labelAr : chip.labelEn}</span>
                    <span className="rounded-md bg-emerald-600/10 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                      {isAr ? chip.badgeAr : chip.badgeEn}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Conversation Stream */}
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
              {messages.length === 0 ? (
                <div className="mx-auto max-w-3xl py-6 space-y-5">
                  <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/50 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                    <div className="flex items-center gap-2.5 text-emerald-900 dark:text-emerald-200">
                      <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <h2 className="text-[15px] font-black">
                        {isAr
                          ? 'فريال مربوطة حصرياً باستعلامات Odoo 17 الفعلية'
                          : 'Feryal Connected Exclusively to Odoo 17 Queries'}
                      </h2>
                    </div>
                    <p className="mt-2 text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
                      {isAr
                        ? 'كل سؤال يُترجم إلى استعلام فعلي على موديلات Odoo 17 (pos.order، pos.order.line، account.move.line، purchase.order، stock.move / stock.scrap، hr.employee) عبر الفروع السبعة المعتمدة وبند «غير منسوب لفرع»، ثم تُفحص جميع الأرقام برمجياً قبل عرض الإجابة.'
                        : 'Every question executes a direct query against Odoo 17 models across the 7 approved branches + Unattributed bucket, followed by strict programmatic number checking.'}
                    </p>
                  </div>

                  {!isAuditor && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {LIVE_ODOO_STARTER_QUESTIONS.map((q) => (
                        <button
                          key={q.id}
                          type="button"
                          disabled={sending}
                          onClick={() => void sendQuestion(isAr ? q.ar : q.en)}
                          className="flex flex-col items-start gap-1.5 rounded-2xl border border-slate-200/80 bg-white p-3.5 text-start transition hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-emerald-500/40"
                        >
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10.5px] font-bold text-emerald-700 dark:bg-slate-800 dark:text-emerald-300">
                            {q.modelBadge}
                          </span>
                          <span className="text-[13.5px] font-bold text-slate-900 dark:text-white">
                            {isAr ? q.ar : q.en}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-3xl rounded-2xl px-4 py-3.5 ${
                        msg.sender === 'user'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'w-full bg-[#F8FAF9] text-slate-900 ring-1 ring-slate-900/[0.06] dark:bg-[#111E19] dark:text-slate-100 dark:ring-emerald-500/15'
                      }`}
                    >
                      {msg.sender === 'feryal' && (
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-2 dark:border-white/[0.07]">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                              {isAr ? 'فريال' : 'Feryal'}
                            </span>
                            {msg.providerBadge && (
                              <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                {msg.providerBadge}
                              </span>
                            )}
                            {msg.complianceTier && (
                              <FeryalVisionCompliancePill tier={msg.complianceTier} isAr={isAr} />
                            )}
                            {msg.verifier?.valid &&
                              msg.executedQueries &&
                              msg.executedQueries.length > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100/80 px-2 py-0.5 text-[10.5px] font-bold text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {isAr ? 'أرقام مطابقة لـ Odoo' : 'Odoo-Matched Numbers'}
                                </span>
                              )}
                          </div>
                          <span className="text-[11px] text-slate-400">{msg.time}</span>
                        </div>
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
                        <FeryalStudioMessage text={msg.text} />
                      )}

                      {/* Executed Odoo Queries Provenance Strip */}
                      {msg.sender === 'feryal' &&
                        msg.executedQueries &&
                        msg.executedQueries.length > 0 && (
                          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-200/70 pt-2.5 text-[11px] text-slate-600 dark:border-white/[0.07] dark:text-slate-300">
                            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="font-semibold">
                              {isAr ? 'الاستعلام المنفذ:' : 'Executed Query:'}
                            </span>
                            {msg.executedQueries.map((q, idx) => (
                              <span
                                key={`${q.model}-${idx}`}
                                dir="ltr"
                                className="rounded-md bg-white px-2 py-0.5 font-mono text-[10.5px] text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700"
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
                            className="inline-flex items-center gap-1 rounded-xl bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700"
                          >
                            {copiedId === msg.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <ClipboardCopy className="h-3.5 w-3.5" />
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
                            className="inline-flex items-center gap-1 rounded-xl bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700"
                          >
                            {speakingId === msg.id ? (
                              <VolumeX className="h-3.5 w-3.5 text-rose-600" />
                            ) : (
                              <Volume2 className="h-3.5 w-3.5 text-emerald-600" />
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
                              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700 disabled:bg-emerald-800/60"
                            >
                              <Bell className="h-3.5 w-3.5" />
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
                ))
              )}

              {sending && (
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    {isAr
                      ? 'جارٍ استعلام Odoo 17 ومطابقة الأرقام...'
                      : 'Querying Odoo 17 & checking reply numbers...'}
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            {!isAuditor ? (
              <div className="border-t border-slate-200/80 bg-white p-3.5 dark:border-emerald-500/15 dark:bg-[#0D1713]">
                <FeryalPendingAttachmentsTray
                  isAr={isAr}
                  attachments={pendingAttachments}
                  processing={processingMedia}
                  errorText={mediaError}
                  onRemove={handleRemoveAttachment}
                  onClearAll={handleClearAllAttachments}
                  onApplyPresetPrompt={(p) => setInputText(p)}
                />

                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void sendQuestion()
                  }}
                  className="flex items-end gap-2"
                >
                  <FeryalMediaPickerButton
                    isAr={isAr}
                    disabled={sending}
                    processing={processingMedia}
                    attachmentCount={pendingAttachments.length}
                    onFilesSelected={handleFilesSelected}
                    openPickerRef={openPickerRef}
                    openCameraRef={openCameraRef}
                  />

                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => void handleToggleVoiceInput()}
                    title={isAr ? 'إدخال صوتي' : 'Voice input'}
                    className={`inline-flex h-[44px] sm:h-[48px] w-[42px] sm:w-[46px] shrink-0 items-center justify-center rounded-2xl transition ${
                      recordingVoice
                        ? 'bg-rose-600 text-white animate-pulse'
                        : 'bg-[#F6F7F8] text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 dark:bg-[#09110E] dark:text-slate-200'
                    }`}
                  >
                    {recordingVoice ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>

                  <textarea
                    rows={1}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        void sendQuestion()
                      }
                    }}
                    placeholder={
                      isAr
                        ? 'اسأل فريال عن مبيعات الفروع، الأصناف، أوامر الشراء، المخزن، أو القيود في Odoo...'
                        : 'Ask Feryal about branch POS sales, items, purchase orders, stock moves, or GL entries...'
                    }
                    className="min-h-[44px] sm:min-h-[48px] max-h-36 flex-1 resize-none rounded-2xl border border-slate-200 bg-[#F6F7F8] px-4 py-3 text-[14px] text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-[#09110E] dark:text-white"
                  />

                  <button
                    type="submit"
                    disabled={sending || (!inputText.trim() && pendingAttachments.length === 0)}
                    className="inline-flex h-[44px] sm:h-[48px] shrink-0 items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 sm:px-5 text-xs sm:text-sm font-bold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-45"
                  >
                    <Send className="h-4 w-4" />
                    <span>{isAr ? 'إرسال' : 'Send'}</span>
                  </button>
                </form>
              </div>
            ) : (
              <div className="border-t border-slate-200/80 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                {isAr
                  ? 'وضع المراجع الخارجي (للقراءة فقط) — يمكنك مراجعة التنبيهات وسجل الأسئلة والاستعلامات الكامل لـ Odoo 17.'
                  : 'Read-only External Reviewer Mode — inspect Odoo 17 alerts and the full Odoo query log.'}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Real Odoo Governance Breaches ONLY (`/api/erp/governance`) */}
        {mainTab === 'alerts' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-black text-slate-900 dark:text-white">
                  {isAr
                    ? 'تنبيهات الحوكمة الفعلية من Odoo 17'
                    : 'Odoo 17 Governance Alerts'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isAr
                    ? 'تُعرض فقط المخالفات الناتجة فعلياً عن استعلام Odoo 17 مقابل السقوف المحفوظة من مسؤول النظام.'
                    : 'Displays strictly real breaches computed from Odoo 17 records against admin-saved server thresholds.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void fetchServerGovernanceBreaches()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingBreaches ? 'animate-spin' : ''}`} />
                <span>{isAr ? 'تحديث من Odoo' : 'Refresh'}</span>
              </button>
            </div>

            {loadingBreaches ? (
              <div className="flex items-center justify-center py-12 text-xs font-semibold text-slate-500">
                <Loader2 className="me-2 h-4 w-4 animate-spin text-emerald-600" />
                {isAr ? 'جارٍ فحص قواعد الحوكمة على Odoo 17...' : 'Evaluating Odoo 17 governance rules...'}
              </div>
            ) : liveBreaches.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-emerald-300/70 bg-emerald-50/40 p-8 text-center space-y-1.5 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                <div className="text-[14px] font-bold text-slate-900 dark:text-white">
                  {isAr
                    ? 'لا توجد مخالفات فعلية مسجلة من Odoo 17 حالياً'
                    : 'No active Odoo 17 governance breaches'}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {isAr
                    ? 'لا يتم عرض أي تنبيه افتراضي أو ثابت عند عدم وجود تجاوز فعلي في بيانات Odoo 17.'
                    : 'Zero static or synthetic alerts are shown when no Odoo 17 threshold is breached.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {liveBreaches.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 space-y-2 dark:border-rose-900/50 dark:bg-rose-950/20"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded-md bg-rose-600 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                        {b.odooModel}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
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
                          className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline dark:text-emerald-300"
                        >
                          <span>{isAr ? 'فتح السجل في Odoo' : 'Open in Odoo'}</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Transparent Odoo Query & Numeric Verifier Audit Log */}
        {mainTab === 'audit' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-black text-slate-900 dark:text-white">
                  {isAr
                    ? 'سجل الأسئلة والاستعلامات لفريال'
                    : 'Feryal Odoo Query Log'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isAr
                    ? 'يوثق كل سؤال، ودور المستخدم، والطابع الزمني، واستعلامات Odoo 17 المنفذة، ونتيجة فحص الأرقام، والإجابة النهائية.'
                    : 'Records every question, user role, timestamp, executed Odoo 17 queries, numeric verifier status, and final answer.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void fetchServerAuditLogs()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />
                <span>{isAr ? 'تحديث السجل' : 'Refresh Log'}</span>
              </button>
            </div>

            {auditLogs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                {isAr
                  ? 'لا توجد استعلامات مسجلة في سجل الأسئلة والاستعلامات حتى الآن.'
                  : 'No queries recorded in the Odoo query log yet.'}
              </div>
            ) : (
              <div className="space-y-3">
                {auditLogs.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 space-y-2.5 dark:border-slate-800 dark:bg-slate-900/60"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md bg-slate-200/80 px-2 py-0.5 font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                          {entry.userRole}
                        </span>
                        {!isAuditor && (
                          <span className="font-mono text-[11px] text-slate-500">
                            {entry.userSub}
                          </span>
                        )}
                        <span
                          className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
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
                      <span dir="ltr" className="font-mono text-[11px] text-slate-400">
                        {entry.timestampIso}
                      </span>
                    </div>

                    <div className="text-[13.5px] font-bold text-slate-900 dark:text-white">
                      {isAr ? 'السؤال: ' : 'Q: '}
                      {entry.question}
                    </div>

                    {entry.executedQueries.length > 0 && (
                      <div className="space-y-1 rounded-xl bg-white p-2.5 text-[11.5px] ring-1 ring-slate-200/70 dark:bg-slate-950 dark:ring-slate-800">
                        {entry.executedQueries.map((q, qi) => (
                          <div key={`${entry.id}-q-${qi}`} dir="ltr" className="font-mono text-slate-700 dark:text-slate-300">
                            model={q.model} | groupby={JSON.stringify(q.groupby)} | period={q.period.from}..{q.period.to} | domain={JSON.stringify(q.domain)}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="whitespace-pre-wrap rounded-xl bg-white/80 p-3 text-xs leading-relaxed text-slate-700 ring-1 ring-slate-200/60 dark:bg-slate-950/60 dark:text-slate-200 dark:ring-slate-800">
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
