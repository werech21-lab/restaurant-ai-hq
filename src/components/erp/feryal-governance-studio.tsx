'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Bell,
  Brain,
  Check,
  CheckCircle2,
  Columns2,
  Copy,
  Headphones,
  Loader2,
  Maximize2,
  MessageCircle,
  Mic,
  MicOff,
  Minimize2,
  Rocket,
  RotateCcw,
  Scale,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  TrendingUp,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { getGeminiApiKey, getOpenAIApiKey } from '@/lib/ai-keys'
import {
  askDualHeavyBrain,
  BRAIN_MODE_EVENT,
  getActiveBrainMode,
  normalizeBrainMode,
  setActiveBrainMode,
  type BrainMode,
} from '@/lib/dual-heavy-brain'
import { askFeryalGeminiBrain, getDeterministicFeryalReply } from '@/lib/feryal-gemini-brain'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import {
  APPROVED_BRANCH_IDS,
  APPROVED_BRAND_IDS,
  APPROVED_CHANNEL_IDS,
  APPROVED_KUWAIT_SLICES,
  APPROVED_PROFIT_LENSES,
  type GlobalBranch,
  type GlobalBrand,
  type GlobalChannel,
  type GlobalPeriod,
  type KuwaitSlice,
  type ProfitLens,
} from '@/lib/aether/global-filter-engine'
import { FeryalStudioMessage, feryalPlainText } from '@/components/aether/FeryalStudioMessage'
import {
  autoSaveChatThread,
  loadChatThread,
  type StoredChatMessage,
} from '@/lib/feryal-chat-store'
import {
  buildMacroBigBetPrompt,
  FERYAL_MEMORY_UPDATED_EVENT,
  getFeryalMemorySync,
  hydrateFeryalMemory,
  MACRO_BIG_BET_STRATEGIES,
  type MacroBigBetId,
} from '@/lib/feryal-learning-engine'
import { FeryalSidebarNotebooks } from '@/components/aether/FeryalSidebarNotebooks'
import { FeryalMemoryDrawer } from '@/components/aether/FeryalMemoryDrawer'
import { useGovernance } from '@/components/erp/GovernanceBellDrawer'
import {
  GOVERNANCE_UPDATED_EVENT,
  syncGovernanceFromServer,
} from '@/lib/governance-compliance'
import {
  buildFeryalGovernancePromptContext,
  buildGovernanceAwareFallbackReply,
  buildQuickAuditChipPrompt,
  extractFeryalRecommendationMeta,
  FERYAL_EXECUTIVE_AUDIT_CHIPS,
  formatFeryalExecutiveSummary,
  readLiveGovernanceSnapshot,
  submitFeryalRecommendationToBell,
  type QuickAuditChipId,
} from '@/lib/feryal-governance-bridge'

const CARD_CLS =
  'ae-bento-card bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-neutral-900'
const SUBCARD_CLS = 'rounded-2xl bg-[#F7F7F8] dark:bg-neutral-950'

const f0 = (n: number) => Math.round(Number.isFinite(n) ? n : 0).toLocaleString('en-US')

const welcomeText = (lang: 'ar' | 'en') =>
  lang === 'ar'
    ? 'هلا بك، أنا فريال. متصلة لحظياً بأرقام أودو 17، سجل المخالفات الرقابية، خارطة التخطيط الاستراتيجي، وجاهزية التشريعات عبر الفروع السبعة ومطبخ العارضية. اختر فحصاً سريعاً بالأسفل أو اسألني مباشرة، ويمكنك رفع أي توصية بضغطة واحدة إلى جرس اعتماد المدير 🔔.'
    : "Welcome — I'm Feryal, connected live to Venture Foods Odoo 17 telemetry, active compliance violations, the 90-day strategic roadmap, and 7-branch Kuwait regulatory readiness. Pick a quick audit below or ask anything, then queue any recommendation to the Manager Bell 🔔 in one click."

type ChatMessage = StoredChatMessage

const welcomeMessage = (lang: 'ar' | 'en'): ChatMessage => ({
  id: 'welcome',
  sender: 'feryal',
  text: welcomeText(lang),
  time: '',
})

const makeFreshChatId = () => `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const BRAIN_ENGINE_OPTIONS: readonly {
  id: 'triple' | 'claude' | 'gemini' | 'grok'
  ar: string
  en: string
}[] = [
  { id: 'triple', ar: 'العقل الثلاثي 🔥', en: 'Triple Brain 🔥' },
  { id: 'claude', ar: 'Claude 5.5 🔬', en: 'Claude 5.5 🔬' },
  { id: 'gemini', ar: 'Gemini Carbon ⚡', en: 'Gemini Carbon ⚡' },
  { id: 'grok', ar: 'Grok 4.20 🧠', en: 'Grok 4.20 🧠' },
] as const

function sanitizeTextForSpeechClient(rawText: string, lang: 'ar' | 'en'): string {
  if (!rawText) return ''
  let text = rawText
  text = text.replace(/https?:\/\/\S+/gi, '')
  text = text.replace(/[*#`_~•–—+\/\\|<>\[\]{}()=^:]/g, ' ')
  text = text.replace(
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu,
    ' ',
  )
  if (lang === 'ar') {
    text = text.replace(/\bKWD\b/gi, ' دينار كويتي ')
    text = text.replace(/د\.ك/g, ' دينار كويتي ')
    text = text.replace(/%/g, ' بالمئة ')
    text = text.replace(/\bCOGS\b/gi, ' تكلفة الأغذية والمواد ')
    text = text.replace(/\bAOV\b/gi, ' متوسط قيمة السلة ')
    text = text.replace(/\bTgo\b/gi, ' طلبات جو ')
    text = text.replace(/\bTMP\b/gi, ' أسطول طلبات الخاص ')
  } else {
    text = text.replace(/\bKWD\b/gi, ' Kuwaiti Dinars ')
    text = text.replace(/د\.ك/g, ' Kuwaiti Dinars ')
    text = text.replace(/%/g, ' percent ')
    text = text.replace(/\bCOGS\b/gi, ' Cost of Goods Sold ')
  }
  return text.replace(/\s+/g, ' ').trim()
}

export function FeryalGovernanceStudio() {
  const { locale: ctxLocale } = useI18n()
  const searchParams = useSearchParams()
  const {
    filters,
    workspace,
    setPeriod,
    setCustomRange,
    setKuwaitSlice,
    setBrand,
    setBranch,
    setChannel,
    setLens,
  } = useGlobalFilter()
  const { openDrawer, getApprovalByRef } = useGovernance()

  const isAr = ctxLocale !== 'en'
  const currentLang: 'ar' | 'en' = isAr ? 'ar' : 'en'
  const T = useCallback((en: string, ar: string) => (isAr ? ar : en), [isAr])

  // Live Governance, Planning & Compliance Snapshot State
  const [govTick, setGovTick] = useState(0)
  useEffect(() => {
    void syncGovernanceFromServer().then((changed) => {
      if (changed) setGovTick((t) => t + 1)
    })
    const onGovSync = () => setGovTick((t) => t + 1)
    window.addEventListener(GOVERNANCE_UPDATED_EVENT, onGovSync)
    window.addEventListener('storage', onGovSync)
    return () => {
      window.removeEventListener(GOVERNANCE_UPDATED_EVENT, onGovSync)
      window.removeEventListener('storage', onGovSync)
    }
  }, [])

  const govSnap = useMemo(() => {
    void govTick
    return readLiveGovernanceSnapshot(workspace)
  }, [workspace, govTick])

  const realistic90 = useMemo(
    () =>
      govSnap.planning90d.scenarios.find((s) => s.id === 'realistic') ??
      govSnap.planning90d.scenarios[0],
    [govSnap.planning90d.scenarios],
  )

  // Persistent Chat, Brain Mode & UI State
  const [activeChatId, setActiveChatId] = useState<string>(() => makeFreshChatId())
  const [activeNotebookId, setActiveNotebookId] = useState<string>('all')
  const [messages, setMessages] = useState<ChatMessage[]>(() => [welcomeMessage(currentLang)])
  const [inputText, setInputText] = useState('')
  const [isCopilotThinking, setIsCopilotThinking] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [openSplitIds, setOpenSplitIds] = useState<Record<string, boolean>>({})
  const [activeBrainMode, setActiveBrainModeState] = useState<
    'triple' | 'claude' | 'gemini' | 'grok'
  >('triple')
  const [submittedBellMap, setSubmittedBellMap] = useState<Record<string, string>>({})
  const [toastNotice, setToastNotice] = useState<{ ar: string; en: string } | null>(null)
  const [ingestedDeepLinkLabel, setIngestedDeepLinkLabel] = useState<string | null>(null)

  // Institutional Memory & Big-Bet Generator State
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [bigBetMenuOpen, setBigBetMenuOpen] = useState(false)
  const [memoryCountBadge, setMemoryCountBadge] = useState<number>(7)
  const bigBetMenuRef = useRef<HTMLDivElement>(null)

  // Voice & Audio Refs
  const [isListening, setIsListening] = useState(false)
  const [isVoiceMuted, setIsVoiceMuted] = useState(true)
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [micToast, setMicToast] = useState<string | null>(null)

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)
  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const inputFieldRef = useRef<HTMLTextAreaElement | null>(null)
  const silenceTimerRef = useRef<any>(null)
  const interimTranscriptRef = useRef<string>('')
  const isListeningRef = useRef(false)
  const handleSendQueryRef = useRef<((text?: string) => Promise<void>) | null>(null)
  const ingestedPromptSigRef = useRef<string>('')

  const showToast = useCallback((ar: string, en: string) => {
    setToastNotice({ ar, en })
    window.setTimeout(() => {
      setToastNotice((cur) => (cur?.ar === ar ? null : cur))
    }, 3400)
  }, [])

  useEffect(() => {
    const syncMemCount = () => {
      const m = getFeryalMemorySync()
      setMemoryCountBadge(m.rules.length + m.outcomes.length)
    }
    void hydrateFeryalMemory().then((m) => {
      setMemoryCountBadge(m.rules.length + m.outcomes.length)
    })
    window.addEventListener(FERYAL_MEMORY_UPDATED_EVENT, syncMemCount)
    return () => window.removeEventListener(FERYAL_MEMORY_UPDATED_EVENT, syncMemCount)
  }, [])

  useEffect(() => {
    if (!bigBetMenuOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (bigBetMenuRef.current && !bigBetMenuRef.current.contains(e.target as Node)) {
        setBigBetMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [bigBetMenuOpen])

  useEffect(() => {
    setActiveBrainModeState(normalizeBrainMode(getActiveBrainMode()))
    const onBrainMode = (e: Event) => {
      const detail = (e as CustomEvent<BrainMode>).detail
      setActiveBrainModeState(normalizeBrainMode(detail ?? getActiveBrainMode()))
    }
    window.addEventListener(BRAIN_MODE_EVENT, onBrainMode)
    return () => window.removeEventListener(BRAIN_MODE_EVENT, onBrainMode)
  }, [])

  const handleSelectBrainMode = useCallback((mode: 'triple' | 'claude' | 'gemini' | 'grok') => {
    setActiveBrainModeState(mode)
    setActiveBrainMode(mode)
  }, [])

  // Keep welcome message language synced before user sends first message
  useEffect(() => {
    setMessages((prev) => {
      if (prev.some((m) => m.sender === 'user')) return prev
      return [welcomeMessage(isAr ? 'ar' : 'en')]
    })
  }, [isAr])

  // Real-time auto-save to IndexedDB (`aether_feryal_chats_v2`)
  useEffect(() => {
    const hasUser = messages.some((m) => m.sender === 'user' && m.text.trim().length > 0)
    if (!hasUser) return
    void autoSaveChatThread({
      chatId: activeChatId,
      messages,
      lang: isAr ? 'ar' : 'en',
      filterLabel: isAr ? workspace.subtitleAr : workspace.subtitleEn,
      preferredNotebookId: activeNotebookId !== 'all' ? activeNotebookId : null,
    })
  }, [activeChatId, activeNotebookId, isAr, messages, workspace.subtitleAr, workspace.subtitleEn])

  // Auto-scroll conversation
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [messages, isCopilotThinking])

  // Auto-resize textarea
  useEffect(() => {
    const el = inputFieldRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [inputText])

  const copyToClipboard = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard?.writeText(text)
    } catch {}
    setCopiedKey(key)
    window.setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 2200)
  }, [])

  const stopAllMicTracks = useCallback(() => {
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => {
          track.stop()
          track.enabled = false
        })
      } catch {}
      mediaStreamRef.current = null
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort()
      } catch {}
    }
    setIsListening(false)
    isListeningRef.current = false
  }, [])

  const fallbackSpeechSynthesis = useCallback((rawText: string, lang: 'ar' | 'en') => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(sanitizeTextForSpeechClient(rawText, lang))
      utterance.lang = lang === 'ar' ? 'ar-XA' : 'en-US'
      utterance.rate = 1.0
      utterance.onend = () => setPlayingMsgId(null)
      utterance.onerror = () => setPlayingMsgId(null)
      window.speechSynthesis.speak(utterance)
    } catch {
      setPlayingMsgId(null)
    }
  }, [])

  const stopPlayback = useCallback(() => {
    if (audioPlayerRef.current) audioPlayerRef.current.pause()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setPlayingMsgId(null)
  }, [])

  const playFeryalSpeech = useCallback(
    async (text: string, msgId?: string, force = false) => {
      if (isVoiceMuted && !force) return
      stopAllMicTracks()
      if (audioPlayerRef.current) audioPlayerRef.current.pause()
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }

      const activeLang: 'ar' | 'en' = isAr ? 'ar' : 'en'
      const activeId = msgId || 'live-speech'
      setPlayingMsgId(activeId)
      const cleanText = sanitizeTextForSpeechClient(text, activeLang) || feryalPlainText(text)

      try {
        const apiKey = getOpenAIApiKey()
        let audioUrl = ''
        if (apiKey) {
          try {
            const openAiRes = await fetch('https://api.openai.com/v1/audio/speech', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'tts-1',
                voice: 'nova',
                input: cleanText.slice(0, 3600),
                response_format: 'mp3',
              }),
            })
            if (openAiRes.ok) {
              audioUrl = URL.createObjectURL(await openAiRes.blob())
            }
          } catch {}
        }

        if (!audioUrl) {
          fallbackSpeechSynthesis(cleanText, activeLang)
          return
        }

        const player = audioPlayerRef.current
        if (player) {
          player.src = audioUrl
          player.onended = () => setPlayingMsgId(null)
          player.onerror = () => fallbackSpeechSynthesis(cleanText, activeLang)
          await player.play().catch(() => fallbackSpeechSynthesis(cleanText, activeLang))
          return
        }
        fallbackSpeechSynthesis(cleanText, activeLang)
      } catch {
        fallbackSpeechSynthesis(cleanText, activeLang)
      }
    },
    [fallbackSpeechSynthesis, isAr, isVoiceMuted, stopAllMicTracks],
  )

  // Core Strategic Dispatch: Injects Live Governance + Planning + Regulatory Snapshot across all 4 Brain Modes
  const handleSendQuery = useCallback(
    async (queryText?: string) => {
      const textToSend = (queryText ?? inputText).trim()
      if (!textToSend) return

      const lang: 'ar' | 'en' = isAr ? 'ar' : 'en'
      const stamp = () =>
        new Date().toLocaleTimeString(lang === 'ar' ? 'ar-KW' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
        })

      setMessages((prev) => [
        ...prev,
        { id: `user-${Date.now()}`, sender: 'user', text: textToSend, time: stamp() },
      ])
      setInputText('')
      setIsCopilotThinking(true)

      const liveSnapshot = readLiveGovernanceSnapshot(workspace)
      const richGovernanceContext = buildFeryalGovernancePromptContext(
        liveSnapshot,
        workspace,
        lang,
      )

      try {
        let reply = ''
        let engineLabelAr: string | undefined
        let engineLabelEn: string | undefined
        let claudeReply: string | undefined
        let claudeModel: string | undefined
        let claudeThinkingSummary: string | undefined
        let geminiReply: string | undefined
        let geminiModel: string | undefined
        let grokReply: string | undefined
        let grokModel: string | undefined
        let statusNoteAr: string | undefined
        let statusNoteEn: string | undefined

        try {
          const dualRes = await askDualHeavyBrain({
            query: textToSend,
            lang,
            mode: activeBrainMode,
            filters,
            workspace,
            pageContext: richGovernanceContext,
          })
          reply = dualRes.reply?.trim() || ''
          engineLabelAr = dualRes.engineLabelAr
          engineLabelEn = dualRes.engineLabelEn
          claudeReply = dualRes.claudeReply
          claudeModel = dualRes.claudeModel
          claudeThinkingSummary = dualRes.claudeThinkingSummary
          geminiReply = dualRes.geminiReply
          geminiModel = dualRes.geminiModel
          grokReply = dualRes.grokReply
          grokModel = dualRes.grokModel
          statusNoteAr = dualRes.statusNoteAr
          statusNoteEn = dualRes.statusNoteEn
        } catch (brainErr) {
          console.warn('Feryal council warning:', brainErr)
        }

        if (!reply) {
          try {
            const res = await fetch('/api/feryal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'chat',
                query: `${richGovernanceContext}\n\n${textToSend}`,
                lang,
              }),
            })
            if (res.ok) {
              const data = (await res.json()) as {
                success?: boolean
                replyAr?: string
                replyEn?: string
              }
              if (data.success) {
                reply = (lang === 'ar' ? data.replyAr : data.replyEn) || ''
              }
            }
          } catch {}
        }

        if (!reply) {
          reply =
            buildGovernanceAwareFallbackReply(textToSend, liveSnapshot, workspace, lang) ||
            getDeterministicFeryalReply(textToSend, lang)
          engineLabelAr = 'محرك الحوكمة وأودو 17 الحتمي 🛡️'
          engineLabelEn = 'Odoo 17 & Governance Deterministic Engine 🛡️'
        }

        const feryalMsgId = `feryal-${Date.now()}`
        setMessages((prev) => [
          ...prev,
          {
            id: feryalMsgId,
            sender: 'feryal',
            text: reply,
            time: stamp(),
            engineLabelAr,
            engineLabelEn,
            claudeReply,
            claudeModel,
            claudeThinkingSummary,
            geminiReply,
            geminiModel,
            grokReply,
            grokModel,
            statusNoteAr,
            statusNoteEn,
          },
        ])
        void playFeryalSpeech(reply, feryalMsgId)
      } finally {
        setIsCopilotThinking(false)
      }
    },
    [activeBrainMode, filters, inputText, isAr, playFeryalSpeech, workspace],
  )

  useEffect(() => {
    handleSendQueryRef.current = handleSendQuery
  }, [handleSendQuery])

  // Auto-Ingest `?prompt=` (and optional filter params) from Growth Plays & Operational Pages without duplicate triggers
  useEffect(() => {
    if (typeof window === 'undefined') return
    const sp = new URLSearchParams(searchParams?.toString() || window.location.search)

    // Sync any explicit deep-link filter parameters cleanly
    const urlPeriod = sp.get('period') as GlobalPeriod | null
    if (
      urlPeriod &&
      (urlPeriod === 'today' ||
        urlPeriod === 'week' ||
        urlPeriod === 'month' ||
        urlPeriod === 'year' ||
        urlPeriod === 'custom') &&
      urlPeriod !== filters.period
    ) {
      setPeriod(urlPeriod)
    }
    const urlFrom = sp.get('from') ?? sp.get('customFrom')
    const urlTo = sp.get('to') ?? sp.get('customTo')
    if (urlFrom && urlTo && /^\d{4}-\d{2}-\d{2}$/.test(urlFrom) && /^\d{4}-\d{2}-\d{2}$/.test(urlTo)) {
      setCustomRange(urlFrom, urlTo)
    }
    const urlBrand = sp.get('brand') as GlobalBrand | null
    if (urlBrand && (APPROVED_BRAND_IDS as readonly string[]).includes(urlBrand) && urlBrand !== filters.brand) {
      setBrand(urlBrand)
    }
    const urlBranch = sp.get('branch') as GlobalBranch | null
    if (urlBranch && (APPROVED_BRANCH_IDS as readonly string[]).includes(urlBranch) && urlBranch !== filters.branch) {
      setBranch(urlBranch)
    }
    const urlChannel = sp.get('channel') as GlobalChannel | null
    if (urlChannel && (APPROVED_CHANNEL_IDS as readonly string[]).includes(urlChannel) && urlChannel !== filters.channel) {
      setChannel(urlChannel)
    }
    const urlSlice = sp.get('slice') as KuwaitSlice | null
    if (urlSlice && (APPROVED_KUWAIT_SLICES as readonly string[]).includes(urlSlice) && urlSlice !== filters.kuwaitSlice) {
      setKuwaitSlice(urlSlice)
    }
    const urlLens = sp.get('lens') as ProfitLens | null
    if (urlLens && (APPROVED_PROFIT_LENSES as readonly string[]).includes(urlLens) && urlLens !== filters.lens) {
      setLens(urlLens)
    }

    const incomingPrompt = (sp.get('prompt') ?? sp.get('q') ?? '').trim()
    if (!incomingPrompt) return
    if (ingestedPromptSigRef.current === incomingPrompt) return

    // Lock synchronously so StrictMode or filter hydration never fires twice
    ingestedPromptSigRef.current = incomingPrompt
    setIngestedDeepLinkLabel(
      incomingPrompt.length > 96 ? `${incomingPrompt.slice(0, 96)}…` : incomingPrompt,
    )

    // Strip prompt/q from URL bar while preserving active filter query params
    try {
      const cleanUrl = new URL(window.location.href)
      cleanUrl.searchParams.delete('prompt')
      cleanUrl.searchParams.delete('q')
      window.history.replaceState(
        window.history.state,
        '',
        cleanUrl.pathname + cleanUrl.search + cleanUrl.hash,
      )
    } catch {}

    const timer = window.setTimeout(() => {
      void handleSendQueryRef.current?.(incomingPrompt)
    }, 180)

    return () => {
      // Intentionally keep ingestedPromptSigRef locked for this exact prompt string
      void timer
    }
  }, [
    filters.branch,
    filters.brand,
    filters.channel,
    filters.kuwaitSlice,
    filters.lens,
    filters.period,
    searchParams,
    setBranch,
    setBrand,
    setChannel,
    setCustomRange,
    setKuwaitSlice,
    setLens,
    setPeriod,
  ])

  const startListening = useCallback(async () => {
    if (typeof window === 'undefined') return
    stopPlayback()
    stopAllMicTracks()

    let speechRecognitionActive = false
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      try {
        const recognizer = new SpeechRecognition()
        recognizer.continuous = false
        recognizer.interimResults = true
        recognizer.lang = isAr ? 'ar-KW' : 'en-US'
        recognizer.maxAlternatives = 1
        interimTranscriptRef.current = ''

        recognizer.onstart = () => {
          setIsListening(true)
          isListeningRef.current = true
          setMicToast(null)
        }
        recognizer.onresult = (event: any) => {
          let interimText = ''
          let finalText = ''
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const item = event.results[i]
            const transcript = item[0]?.transcript || ''
            if (item.isFinal) finalText += transcript
            else interimText += transcript
          }
          const liveText = (finalText || interimText).trim()
          if (liveText) {
            setInputText(liveText)
            interimTranscriptRef.current = liveText
          }
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
          if (finalText.trim()) {
            stopAllMicTracks()
            const q = finalText.trim()
            interimTranscriptRef.current = ''
            void handleSendQueryRef.current?.(q)
          }
        }
        recognizer.onerror = () => {
          stopAllMicTracks()
        }
        recognitionRef.current = recognizer
        recognizer.start()
        speechRecognitionActive = true
      } catch {}
    }

    if (!speechRecognitionActive && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaStreamRef.current = stream
        const mr = new MediaRecorder(stream)
        audioChunksRef.current = []
        mr.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data)
        }
        mr.onstop = async () => {
          stopAllMicTracks()
          if (audioChunksRef.current.length === 0) return
          const recordedBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          audioChunksRef.current = []
          setIsTranscribing(true)
          try {
            const base64Audio = await new Promise<string>((resolve) => {
              const reader = new FileReader()
              reader.onloadend = () => {
                const res = typeof reader.result === 'string' ? reader.result : ''
                resolve(res.includes(',') ? res.split(',')[1] : '')
              }
              reader.onerror = () => resolve('')
              reader.readAsDataURL(recordedBlob)
            })
            if (base64Audio && getGeminiApiKey()) {
              const multimodalRes = await askFeryalGeminiBrain({
                lang: isAr ? 'ar' : 'en',
                audioBase64: base64Audio,
                mimeType: 'audio/webm',
              })
              if (multimodalRes.transcript?.trim()) {
                void handleSendQueryRef.current?.(multimodalRes.transcript.trim())
              }
            }
          } catch {}
          setIsTranscribing(false)
        }
        mediaRecorderRef.current = mr
        mr.start(250)
        setIsListening(true)
        isListeningRef.current = true
      } catch {
        setMicToast(
          isAr
            ? 'تعذر تشغيل المايكروفون — يمكنك الكتابة مباشرة.'
            : 'Microphone unavailable — please type your question.',
        )
        window.setTimeout(() => setMicToast(null), 4000)
      }
    }
  }, [isAr, stopAllMicTracks, stopPlayback])

  const toggleListening = useCallback(() => {
    if (isListening) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop()
        } catch {}
      }
      stopAllMicTracks()
    } else {
      void startListening()
    }
  }, [isListening, startListening, stopAllMicTracks])

  useEffect(() => {
    return () => {
      stopPlayback()
      stopAllMicTracks()
    }
  }, [stopAllMicTracks, stopPlayback])

  const handleRunQuickAuditChip = useCallback(
    (chipId: QuickAuditChipId) => {
      if (isCopilotThinking) return
      const prompt = buildQuickAuditChipPrompt(chipId, govSnap, workspace, isAr)
      void handleSendQuery(prompt)
    },
    [govSnap, handleSendQuery, isAr, isCopilotThinking, workspace],
  )

  const launchMacroBigBet = useCallback(
    (strategyId: MacroBigBetId) => {
      setBigBetMenuOpen(false)
      const prompt = buildMacroBigBetPrompt(strategyId, workspace, isAr)
      void handleSendQuery(prompt)
    },
    [handleSendQuery, isAr, workspace],
  )

  const newDiscussion = useCallback(() => {
    stopPlayback()
    stopAllMicTracks()
    setInputText('')
    setOpenSplitIds({})
    setIngestedDeepLinkLabel(null)
    setActiveChatId(makeFreshChatId())
    setMessages([welcomeMessage(isAr ? 'ar' : 'en')])
  }, [isAr, stopAllMicTracks, stopPlayback])

  const handleSelectSavedChat = useCallback(
    async (chatId: string) => {
      stopPlayback()
      stopAllMicTracks()
      const thread = await loadChatThread(chatId)
      if (thread && thread.messages.length > 0) {
        setActiveChatId(thread.id)
        setOpenSplitIds({})
        setMessages(thread.messages)
      }
    },
    [stopAllMicTracks, stopPlayback],
  )

  const lastFeryal = useMemo(
    () => [...messages].reverse().find((m) => m.sender === 'feryal') ?? null,
    [messages],
  )

  const totalBellAttentionCount =
    govSnap.activeBreaches.length + govSnap.pendingApprovals.length

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="mx-auto w-full max-w-[1520px] space-y-4 pb-10 font-sans text-neutral-900 antialiased dark:text-slate-100"
    >
      {/* Hidden Audio Element (keeps header clean & unslopped) */}
      <audio ref={audioPlayerRef} className="hidden" preload="none" />

      {/* Instant Confirmation Toast */}
      {toastNotice ? (
        <div className="fixed bottom-6 end-6 z-50 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-semibold text-emerald-800 shadow-xl ring-1 ring-emerald-500/25 dark:bg-neutral-900 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{isAr ? toastNotice.ar : toastNotice.en}</span>
        </div>
      ) : null}

      {/* ───────────── 1. Clean Executive Studio Header ───────────── */}
      <header className={`${CARD_CLS} flex flex-col gap-3.5 xl:flex-row xl:items-center xl:justify-between`}>
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[20px] font-semibold tracking-tight text-neutral-950 sm:text-[22px] dark:text-white">
                {T('Ask Feryal — AI & Governance Studio', 'المستشارة فريال — استوديو الذكاء والحوكمة')}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <ShieldCheck className="h-3 w-3" />
                <span>{T('Live Odoo 17 + Bell Synced', 'متصل بأودو 17 وجرس الاعتماد')}</span>
              </span>
            </div>
            <p className="truncate text-xs text-neutral-500 dark:text-slate-400">
              {isAr ? workspace.subtitleAr : workspace.subtitleEn}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 4-Mode Brain Switcher Pills */}
          <div className="inline-flex flex-wrap items-center gap-1 rounded-full bg-[#F7F7F8] p-1 dark:bg-neutral-950">
            {BRAIN_ENGINE_OPTIONS.map((opt) => {
              const active = activeBrainMode === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectBrainMode(opt.id)}
                  className={`cursor-pointer rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-all ${
                    active
                      ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/20 dark:bg-emerald-950/70 dark:text-emerald-200'
                      : 'text-neutral-600 hover:text-neutral-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  {isAr ? opt.ar : opt.en}
                </button>
              )
            })}
          </div>

          {/* Manager Bell Quick Trigger */}
          <button
            type="button"
            onClick={() => openDrawer('approvals')}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-amber-50 px-3.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200"
          >
            <Bell className="h-3.5 w-3.5" />
            <span>{T('Manager Bell', 'جرس المدير')}</span>
            <span className="rounded-full bg-white/90 px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums text-amber-900 dark:bg-neutral-900 dark:text-amber-200">
              {totalBellAttentionCount}
            </span>
          </button>

          {/* Macro Big-Bet Menu */}
          <div ref={bigBetMenuRef} className="relative">
            <button
              type="button"
              disabled={isCopilotThinking}
              onClick={() => setBigBetMenuOpen((v) => !v)}
              className="ae-btn-primary btn-colored inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-all hover:opacity-95 disabled:opacity-50"
            >
              <Rocket className="h-3.5 w-3.5" />
              <span>{T('Big-Bet Plays 🚀', 'ابتكار الحلول الكبرى 🚀')}</span>
            </button>

            {bigBetMenuOpen ? (
              <div className="absolute end-0 z-50 mt-2 w-[330px] rounded-2xl bg-white p-3.5 shadow-xl ring-1 ring-neutral-200/80 space-y-2 sm:w-[380px] dark:bg-neutral-900 dark:ring-white/10">
                <div className="text-xs font-semibold text-neutral-950 dark:text-white">
                  {T('Launch Macro Profit Strategy 🚀', 'اختر محور ابتكار الحلول الكبرى 🚀')}
                </div>
                {MACRO_BIG_BET_STRATEGIES.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => launchMacroBigBet(st.id)}
                    className={`${SUBCARD_CLS} block w-full cursor-pointer p-3 text-start transition-all hover:ring-1 hover:ring-emerald-500/40`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-neutral-950 dark:text-white">
                        {isAr ? st.titleAr : st.titleEn}
                      </span>
                      <span
                        dir="ltr"
                        className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold tabular-nums text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      >
                        +{st.estMonthlyKwdMin.toLocaleString('en-US')}–
                        {st.estMonthlyKwdMax.toLocaleString('en-US')} {isAr ? 'د.ك' : 'KWD'}
                      </span>
                    </div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-neutral-500 dark:text-slate-400">
                      {isAr ? st.summaryAr : st.summaryEn}
                    </p>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Institutional Memory */}
          <button
            type="button"
            onClick={() => setMemoryOpen(true)}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-[#F7F7F8] px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-200/70 dark:bg-neutral-950 dark:text-slate-200"
          >
            <Brain className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{T('Memory', 'الذاكرة')}</span>
            <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
              {memoryCountBadge}
            </span>
          </button>

          {/* Compact Voice Controls */}
          <button
            type="button"
            onClick={() =>
              playingMsgId
                ? stopPlayback()
                : lastFeryal && void playFeryalSpeech(lastFeryal.text, lastFeryal.id, true)
            }
            className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors ${
              playingMsgId
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-[#F7F7F8] text-neutral-700 hover:bg-neutral-200/70 dark:bg-neutral-950 dark:text-slate-200'
            }`}
          >
            {playingMsgId ? <Square className="h-3 w-3" /> : <Headphones className="h-3.5 w-3.5" />}
            <span>{playingMsgId ? T('Stop', 'إيقاف') : T('Listen', 'استماع')}</span>
          </button>

          <button
            type="button"
            aria-pressed={!isVoiceMuted}
            onClick={() => setIsVoiceMuted((v) => !v)}
            className={`inline-flex h-9 cursor-pointer items-center gap-1 rounded-full px-3 text-xs font-semibold transition-colors ${
              !isVoiceMuted
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-[#F7F7F8] text-neutral-600 hover:bg-neutral-200/70 dark:bg-neutral-950 dark:text-slate-300'
            }`}
          >
            {isVoiceMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            <span>{T('Auto-Voice', 'رد صوتي')}</span>
          </button>

          <button
            type="button"
            aria-pressed={isExpanded}
            onClick={() => setIsExpanded((v) => !v)}
            className="hidden h-9 cursor-pointer items-center gap-1 rounded-full bg-[#F7F7F8] px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-200/70 lg:inline-flex dark:bg-neutral-950 dark:text-slate-200"
          >
            {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            <span>{isExpanded ? T('Notebooks', 'الدفاتر') : T('Expand', 'تكبير')}</span>
          </button>

          <button
            type="button"
            onClick={newDiscussion}
            className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-full bg-[#F7F7F8] px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-200/70 dark:bg-neutral-950 dark:text-slate-200"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{T('+ New Chat', '+ محادثة جديدة')}</span>
          </button>
        </div>
      </header>

      {/* Auto-Ingested Deep-Link Banner (when arriving via `?prompt=` from Growth Plays / Operational Pages) */}
      {ingestedDeepLinkLabel ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-emerald-50/80 px-4 py-2.5 text-xs font-medium text-emerald-900 ring-1 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-200">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold">
              {T('Growth Play Prompt Loaded:', 'تم استلام سياق البطاقة التشغيلية تلقائياً:')}
            </span>
            <span className="truncate text-emerald-800/90 dark:text-emerald-300">
              {ingestedDeepLinkLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIngestedDeepLinkLabel(null)}
            className="cursor-pointer rounded-full bg-white/80 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 hover:bg-white dark:bg-neutral-900 dark:text-emerald-300"
          >
            {T('Dismiss', 'إخفاء')}
          </button>
        </div>
      ) : null}

      {/* ───────────── 2. Live Governance, Planning & Compliance Pulse Strip ───────────── */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => handleRunQuickAuditChip('open-violations')}
          className="ae-kpi-card cursor-pointer bg-white p-4 text-start shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-0.5 dark:bg-neutral-900"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-neutral-500 dark:text-slate-400">
              {T('Open Odoo 17 Violations', 'المخالفات الرقابية المفتوحة')}
            </span>
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10.5px] font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
              {T('Live Audit', 'رقابة حية')}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="text-[20px] font-semibold tabular-nums text-neutral-950 dark:text-white">
              {govSnap.activeBreaches.length}{' '}
              <span className="text-xs font-normal text-neutral-400">
                {T('active', 'نشطة')}
              </span>
            </span>
            <span dir="ltr" className="text-xs font-semibold tabular-nums text-rose-600 dark:text-rose-400">
              -{f0(govSnap.totalMonthlyBleedKwd)} {isAr ? 'د.ك/شهر' : 'KWD/mo'}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => openDrawer('approvals')}
          className="ae-kpi-card cursor-pointer bg-white p-4 text-start shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-0.5 dark:bg-neutral-900"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-neutral-500 dark:text-slate-400">
              {T('Manager Bell Queue 🔔', 'بانتظار ختم جرس المدير 🔔')}
            </span>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
              {govSnap.approvedDecisions.length} {T('sealed', 'معتمدة')}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="text-[20px] font-semibold tabular-nums text-neutral-950 dark:text-white">
              {govSnap.pendingApprovals.length}{' '}
              <span className="text-xs font-normal text-neutral-400">
                {T('pending', 'طلبات معلقة')}
              </span>
            </span>
            <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
              {T('Open Bell ↗', 'عرض بالجرس ↗')}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleRunQuickAuditChip('seven-branch-plan')}
          className="ae-kpi-card cursor-pointer bg-white p-4 text-start shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-0.5 dark:bg-neutral-900"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-neutral-500 dark:text-slate-400">
              {T('90d Realistic Plan Net Cash', 'صافي الخطة الواقعية (90 يوم)')}
            </span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold tabular-nums text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              {govSnap.planReceiptSummary.readinessPct}% {T('branch ack', 'استلام الفروع')}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span dir="ltr" className="text-[20px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
              +{f0(realistic90.projectedNetCashKwd)} {isAr ? 'د.ك' : 'KWD'}
            </span>
            <span className="text-xs tabular-nums text-neutral-400">
              {govSnap.phases.length} {T('phases', 'مراحل')}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleRunQuickAuditChip('regulatory-readiness')}
          className="ae-kpi-card cursor-pointer bg-white p-4 text-start shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-0.5 dark:bg-neutral-900"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-neutral-500 dark:text-slate-400">
              {T('7-Branch Regulatory Readiness', 'جاهزية التشريعات (7 فروع)')}
            </span>
            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10.5px] font-semibold tabular-nums text-sky-800 dark:bg-sky-950/60 dark:text-sky-200">
              {govSnap.regulatoryReadySlots}/{govSnap.regulatoryTotalSlots}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span dir="ltr" className="text-[20px] font-semibold tabular-nums text-neutral-950 dark:text-white">
              {govSnap.regulatoryReadinessPct}%
            </span>
            <span dir="ltr" className="text-xs font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
              {f0(govSnap.totalPenaltiesShieldedKwd)} {isAr ? 'د.ك محمية' : 'KWD shielded'}
            </span>
          </div>
        </button>
      </section>

      {/* ───────────── 3. Main Studio Workspace + Persistent Notebooks ───────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section
          className={`${
            isExpanded ? 'lg:col-span-12' : 'lg:col-span-8'
          } flex h-[74vh] min-h-[580px] max-h-[840px] flex-col overflow-hidden rounded-3xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-neutral-900`}
        >
          {/* 4 Crisp 1-Click Executive Quick-Audit Chips Strip */}
          <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 bg-[#F7F7F8]/70 px-4 py-3 sm:px-6 dark:border-white/[0.06] dark:bg-neutral-950/60">
            {FERYAL_EXECUTIVE_AUDIT_CHIPS.map((chip) => {
              const chipToneCls =
                chip.tone === 'rose'
                  ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-200'
                  : chip.tone === 'emerald'
                    ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-200'
                    : chip.tone === 'amber'
                      ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200'
                      : 'bg-sky-50 text-sky-800 hover:bg-sky-100 dark:bg-sky-950/60 dark:text-sky-200'
              return (
                <button
                  key={chip.id}
                  type="button"
                  disabled={isCopilotThinking}
                  onClick={() => handleRunQuickAuditChip(chip.id)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 ${chipToneCls}`}
                >
                  <span>{isAr ? chip.labelAr : chip.labelEn}</span>
                </button>
              )
            })}
          </div>

          {/* Conversation Stream */}
          <div
            ref={chatScrollRef}
            className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6"
            aria-live="polite"
          >
            {messages.map((m, idx) => {
              const mine = m.sender === 'user'
              const prevUserMsg =
                !mine && idx > 0
                  ? [...messages.slice(0, idx)].reverse().find((x) => x.sender === 'user')
                  : undefined

              const recMeta =
                !mine && m.id !== 'welcome'
                  ? extractFeryalRecommendationMeta(m.text, prevUserMsg?.text, workspace)
                  : null

              const existingApproval = recMeta ? getApprovalByRef(recMeta.refKey) : undefined
              const isQueuedInBell =
                Boolean(recMeta && submittedBellMap[recMeta.refKey]) ||
                existingApproval?.status === 'pending'
              const isApprovedSealed = existingApproval?.status === 'approved'

              const execMemoText =
                recMeta && !mine
                  ? formatFeryalExecutiveSummary(m.text, recMeta, workspace, isAr)
                  : ''

              const brainPanels = !mine
                ? [
                    m.claudeReply
                      ? {
                          key: 'claude',
                          titleAr: 'رأي كلاود العميق 🔬',
                          titleEn: 'Claude Sonnet/Opus 🔬',
                          model: m.claudeModel,
                          reply: m.claudeReply,
                        }
                      : null,
                    m.geminiReply
                      ? {
                          key: 'gemini',
                          titleAr: 'رأي جميني كاربون High ⚡',
                          titleEn: 'Gemini Carbon High ⚡',
                          model: m.geminiModel,
                          reply: m.geminiReply,
                        }
                      : null,
                    m.grokReply
                      ? {
                          key: 'grok',
                          titleAr: 'رأي جروك 4.20 (٣ زوايا) 🧠',
                          titleEn: 'Grok 4.20 (3-Lens) 🧠',
                          model: m.grokModel,
                          reply: m.grokReply,
                        }
                      : null,
                  ].filter((x): x is NonNullable<typeof x> => Boolean(x))
                : []

              const hasMultipleBrains = brainPanels.length >= 2
              const splitOpen = Boolean(openSplitIds[m.id])
              const engineBadge = !mine ? (isAr ? m.engineLabelAr : m.engineLabelEn) : undefined
              const noteText = !mine ? (isAr ? m.statusNoteAr : m.statusNoteEn) : undefined

              return (
                <div key={m.id} className={`flex gap-3 ${mine ? 'justify-end' : 'justify-start'}`}>
                  {!mine ? (
                    <span className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      <Sparkles className="h-4 w-4" />
                    </span>
                  ) : null}

                  <div className={`min-w-0 ${mine ? 'max-w-[80%]' : 'max-w-[94%] flex-1'}`}>
                    {engineBadge ? (
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {engineBadge}
                        </span>
                        {noteText ? (
                          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                            {noteText}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    <div
                      className={
                        mine
                          ? 'whitespace-pre-wrap rounded-2xl bg-emerald-50/90 px-4 py-3.5 text-[14.5px] leading-relaxed font-medium text-emerald-950 ring-1 ring-emerald-600/15 dark:bg-emerald-950/50 dark:text-emerald-50 dark:ring-emerald-500/30'
                          : `${SUBCARD_CLS} px-5 py-4 text-[14.5px] leading-[1.85] text-neutral-800 dark:text-slate-100`
                      }
                    >
                      {mine ? m.text : <FeryalStudioMessage text={m.text} />}
                    </div>

                    {/* Strategic Response Governance & Executive Action Bar */}
                    {!mine && m.id !== 'welcome' && recMeta ? (
                      <div className="mt-2.5 rounded-2xl bg-[#F7F7F8]/90 p-3 space-y-2.5 dark:bg-neutral-950/80">
                        {/* Extracted Recommendation Scope + Conservative KWD Impact + Watchdog Rule */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
                          <span className="rounded-full bg-white px-2.5 py-0.5 font-medium text-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:bg-neutral-900 dark:text-slate-200">
                            {isAr ? recMeta.targetScopeAr : recMeta.targetScopeEn}
                          </span>
                          <span
                            dir="ltr"
                            className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold tabular-nums text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                          >
                            +{f0(recMeta.conservativeMonthlyReturnKwd)} {isAr ? 'د.ك/شهر (متحفظ)' : 'KWD/mo (conservative)'}
                          </span>
                          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                            {isAr ? recMeta.complianceRuleAr : recMeta.complianceRuleEn}
                          </span>
                        </div>

                        {/* Sleek High-Contrast Action Buttons */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {isApprovedSealed ? (
                              <button
                                type="button"
                                onClick={() => openDrawer('sealed')}
                                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-600/20 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:text-emerald-200"
                              >
                                <ShieldCheck className="h-3.5 w-3.5" />
                                <span>
                                  {isAr
                                    ? `معتمد بختم المدير (${existingApproval?.seal?.sealId ?? 'VF'}) ✅`
                                    : `Manager Sealed (${existingApproval?.seal?.sealId ?? 'VF'}) ✅`}
                                </span>
                              </button>
                            ) : isQueuedInBell ? (
                              <button
                                type="button"
                                onClick={() => openDrawer('approvals')}
                                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-600/25 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:text-emerald-200"
                              >
                                <Check className="h-3.5 w-3.5" />
                                <span>
                                  {T(
                                    'Queued in Manager Bell ✓ (View 🔔)',
                                    'تم الرفع لجرس المدير ✓ (فتح الجرس 🔔)',
                                  )}
                                </span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  const created = submitFeryalRecommendationToBell(recMeta)
                                  setSubmittedBellMap((prev) => ({
                                    ...prev,
                                    [recMeta.refKey]: created.id,
                                  }))
                                  setGovTick((t) => t + 1)
                                  showToast(
                                    `تم رفع التوصية إلى جرس المدير للاعتماد (+${f0(recMeta.conservativeMonthlyReturnKwd)} د.ك/شهر) 🔔`,
                                    `Recommendation queued in Manager Bell (+${f0(recMeta.conservativeMonthlyReturnKwd)} KWD/mo) 🔔`,
                                  )
                                }}
                                className="ae-btn-primary btn-colored inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-all hover:opacity-95"
                              >
                                <Bell className="h-3.5 w-3.5" />
                                <span>
                                  {T(
                                    'Submit Recommendation to Manager Bell 🔔',
                                    'رفع التوصية لجرس المدير 🔔',
                                  )}
                                </span>
                              </button>
                            )}

                            {/* Copy Crisp Executive Summary (`نسخ الملخص التنفيذي 📋`) */}
                            <button
                              type="button"
                              onClick={() => void copyToClipboard(`${m.id}-exec-memo`, execMemoText)}
                              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-white px-3.5 text-xs font-semibold text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:bg-neutral-100 dark:bg-neutral-900 dark:text-slate-200 dark:hover:bg-neutral-800"
                            >
                              {copiedKey === `${m.id}-exec-memo` ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>{T('Executive Summary Copied ✓', 'تم نسخ الملخص التنفيذي ✓')}</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5 text-neutral-500" />
                                  <span>{T('Copy Executive Summary 📋', 'نسخ الملخص التنفيذي 📋')}</span>
                                </>
                              )}
                            </button>

                            <a
                              href={`https://wa.me/?text=${encodeURIComponent(execMemoText)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-8 items-center gap-1 rounded-full bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              <span>{T('WhatsApp 📲', 'واتساب 📲')}</span>
                            </a>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-400">
                            {hasMultipleBrains ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenSplitIds((prev) => ({ ...prev, [m.id]: !prev[m.id] }))
                                }
                                className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full bg-white px-2.5 text-[11.5px] font-medium text-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:bg-neutral-100 dark:bg-neutral-900 dark:text-slate-300"
                              >
                                <Columns2 className="h-3 w-3" />
                                <span>
                                  {T(
                                    `Council Brains (${brainPanels.length})`,
                                    `آراء المحركات (${brainPanels.length})`,
                                  )}
                                </span>
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() =>
                                playingMsgId === m.id
                                  ? stopPlayback()
                                  : void playFeryalSpeech(m.text, m.id, true)
                              }
                              className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full bg-white px-2.5 text-[11.5px] font-medium text-neutral-600 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:bg-neutral-100 dark:bg-neutral-900 dark:text-slate-300"
                            >
                              {playingMsgId === m.id ? (
                                <Square className="h-3 w-3" />
                              ) : (
                                <Volume2 className="h-3 w-3" />
                              )}
                              <span>{playingMsgId === m.id ? T('Stop', 'إيقاف') : T('Listen', 'استماع')}</span>
                            </button>

                            {m.time ? <span className="tabular-nums">{m.time}</span> : null}
                          </div>
                        </div>
                      </div>
                    ) : mine && m.time ? (
                      <div className="mt-1 text-end text-[11px] tabular-nums text-neutral-400">
                        {m.time}
                      </div>
                    ) : null}

                    {/* Expandable Individual Brain Perspectives */}
                    {hasMultipleBrains && splitOpen ? (
                      <div
                        className={`mt-3 grid grid-cols-1 gap-3 ${
                          brainPanels.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'
                        }`}
                      >
                        {brainPanels.map((panel) => (
                          <div
                            key={panel.key}
                            className={`${SUBCARD_CLS} p-4 text-[13.5px] leading-relaxed text-neutral-700 dark:text-slate-200`}
                          >
                            <div className="mb-2 flex items-center justify-between gap-2 border-b border-neutral-200/70 pb-2 dark:border-white/[0.06]">
                              <span className="text-xs font-semibold text-neutral-950 dark:text-white">
                                {isAr ? panel.titleAr : panel.titleEn}
                              </span>
                              {panel.model ? (
                                <span
                                  dir="ltr"
                                  className="rounded-full bg-white px-2 py-0.5 font-mono text-[10.5px] font-medium text-neutral-600 dark:bg-neutral-900 dark:text-slate-300"
                                >
                                  {panel.model}
                                </span>
                              ) : null}
                            </div>
                            <FeryalStudioMessage text={panel.reply} />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}

            {/* Empty Conversation Starter Grid */}
            {messages.length <= 1 && !isCopilotThinking ? (
              <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                {FERYAL_EXECUTIVE_AUDIT_CHIPS.map((chip) => {
                  const Icon =
                    chip.id === 'open-violations'
                      ? ShieldAlert
                      : chip.id === 'seven-branch-plan'
                        ? CheckCircle2
                        : chip.id === 'odoo-growth-plan'
                          ? TrendingUp
                          : Scale
                  const badgeCls =
                    chip.tone === 'rose'
                      ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                      : chip.tone === 'emerald'
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : chip.tone === 'amber'
                          ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
                          : 'bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200'

                  return (
                    <button
                      key={`card-${chip.id}`}
                      type="button"
                      onClick={() => handleRunQuickAuditChip(chip.id)}
                      className={`${SUBCARD_CLS} group cursor-pointer p-4 text-start transition-all hover:ring-1 hover:ring-emerald-500/35`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badgeCls}`}>
                          {isAr ? chip.badgeAr : chip.badgeEn}
                        </span>
                        <Icon className="h-4 w-4 text-neutral-400 transition-colors group-hover:text-emerald-600" />
                      </div>
                      <div className="mt-2 text-[14px] font-semibold text-neutral-950 dark:text-white">
                        {isAr ? chip.labelAr : chip.labelEn}
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : null}

            {/* Thinking Indicator */}
            {isCopilotThinking ? (
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </span>
                <div className={`${SUBCARD_CLS} px-4 py-3 text-xs font-medium text-neutral-600 dark:text-slate-300`}>
                  {T(
                    'Feryal is auditing live Odoo 17 telemetry, active compliance caps & 7-branch plans…',
                    'فريال تدقق الآن أرقام أودو 17 الحية وسجل المخالفات وخارطة الفروع السبعة…',
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* Input Dock */}
          <div className="border-t border-neutral-100 bg-white px-4 pb-4 pt-3 sm:px-6 dark:border-white/[0.06] dark:bg-neutral-900">
            {(micToast || isListening || isTranscribing) ? (
              <div
                className={`mb-2 text-xs font-medium ${
                  micToast
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {micToast ??
                  (isTranscribing
                    ? T('Transcribing voice…', 'جارٍ تحويل الصوت إلى نص…')
                    : T('Listening… speak now', 'أستمع إليك الآن… تفضل بالحديث'))}
              </div>
            ) : null}

            <div className="flex items-end gap-2.5">
              <textarea
                ref={inputFieldRef}
                rows={1}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (!isCopilotThinking) void handleSendQuery()
                  }
                }}
                placeholder={T(
                  'Ask Feryal about any branch, supplier, campaign, regulation, or growth play…',
                  'اسأل فريال عن أي فرع أو مخالفة رقابية أو خطة نمو أو تشريع في أودو 17…',
                )}
                className={`${SUBCARD_CLS} min-h-[48px] flex-1 resize-none px-4 py-3 text-[14px] leading-relaxed text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:text-white`}
              />

              <button
                type="button"
                onClick={toggleListening}
                aria-pressed={isListening}
                aria-label={
                  isListening
                    ? T('Stop microphone', 'إيقاف المايكروفون')
                    : T('Speak to Feryal', 'التحدث إلى فريال')
                }
                className={`inline-flex h-[48px] w-[48px] shrink-0 cursor-pointer items-center justify-center rounded-2xl transition-all ${
                  isListening
                    ? 'btn-colored animate-pulse bg-rose-600 text-white'
                    : `${SUBCARD_CLS} text-neutral-700 hover:bg-neutral-200/70 dark:text-slate-200`
                }`}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={() => void handleSendQuery()}
                disabled={isCopilotThinking || !inputText.trim()}
                className="ae-btn-primary btn-colored inline-flex h-[48px] shrink-0 cursor-pointer items-center gap-2 rounded-2xl px-5 text-xs font-semibold transition-all hover:opacity-95 disabled:opacity-40"
              >
                <Send className={`h-3.5 w-3.5 ${isAr ? 'rotate-180' : ''}`} />
                <span>{T('Send', 'إرسال')}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Persistent Notebooks & Saved Threads Side Panel */}
        {!isExpanded ? (
          <FeryalSidebarNotebooks
            isAr={isAr}
            activeChatId={activeChatId}
            activeNotebookId={activeNotebookId}
            onSelectNotebook={setActiveNotebookId}
            onSelectChat={(id) => void handleSelectSavedChat(id)}
            onNewChat={newDiscussion}
            workspace={workspace}
            isCopilotThinking={isCopilotThinking}
            onRunNotePrompt={(p) => void handleSendQuery(p)}
            panelClassName="ae-bento-card h-[74vh] min-h-[580px] max-h-[840px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-neutral-900"
          />
        ) : null}
      </div>

      {/* Institutional Memory Drawer */}
      <FeryalMemoryDrawer
        open={memoryOpen}
        onClose={() => setMemoryOpen(false)}
        isAr={isAr}
        onAskScalePlan={(p) => void handleSendQuery(p)}
      />
    </div>
  )
}
