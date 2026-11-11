'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Brain,
  Check,
  Columns2,
  Copy,
  FileText,
  Headphones,
  Loader2,
  Maximize2,
  MessageCircle,
  Mic,
  MicOff,
  Minimize2,
  Rocket,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { getOpenAIApiKey, getGeminiApiKey } from '@/lib/ai-keys'
import {
  askDualHeavyBrain,
  BRAIN_MODE_EVENT,
  getActiveBrainMode,
  normalizeBrainMode,
  type BrainMode,
} from '@/lib/dual-heavy-brain'
import { askFeryalGeminiBrain, getDeterministicFeryalReply } from '@/lib/feryal-gemini-brain'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
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

// ==============================================================================
// Conversation copy (strict Arabic / English isolation)
// ==============================================================================
const welcomeText = (lang: 'ar' | 'en') =>
  lang === 'ar'
    ? `هلا بك، أنا فريال. أتابع معك أرقام الفروع والمخزن ومطبخ العارضية والتوصيل مباشرة من أودو عبر العقل الثلاثي. اسألني بصوتك أو كتابة، وتُحفظ محادثاتك تلقائياً في دفاترك.`
    : `Hi, I'm Feryal. I audit branch, warehouse, Ardiya kitchen, and delivery numbers live from Odoo via the Triple-Brain Council. Ask by voice or text — every chat auto-saves to your notebooks.`

const TOPICS: {
  id: string
  tagAr: string
  tagEn: string
  labelAr: string
  labelEn: string
  promptAr: string
  promptEn: string
}[] = [
  {
    id: 'kitchen-gap',
    tagAr: 'المطبخ',
    tagEn: 'Kitchen',
    labelAr: 'نقص بالمطبخ',
    labelEn: 'Kitchen Gap',
    promptAr: 'وين يصير النقص في مواد المطبخ وكيف نضبط وزن الوجبات اليومي بين المخزن والعارضية والفروع؟',
    promptEn: 'Where is the kitchen food gap happening and how do we fix daily portion weights?',
  },
  {
    id: 'supplier-diff',
    tagAr: 'المشتريات',
    tagEn: 'Buying',
    labelAr: 'فرق سعر مورد',
    labelEn: 'Supplier Price Diff',
    promptAr: 'شنو أهم فروقات أسعار الموردين هالشهر وكيف نثبت السعر الأقل لعقود المخزن المركزي؟',
    promptEn: 'What are the main supplier price differences this month and how do we lock the lowest price?',
  },
  {
    id: 'item-price',
    tagAr: 'المينيو',
    tagEn: 'Menu',
    labelAr: 'تعديل سعر صنف',
    labelEn: 'Item Price Tweak',
    promptAr: 'شنو الأصناف اللي تتحمل زيادة بسيطة (١٠٠-١٥٠ فلس) مع عرض مشروب بدون خسارة زباين؟',
    promptEn: 'Which best-sellers can take a small 100–150 fils tweak plus a drink combo without losing guests?',
  },
  {
    id: 'delivery-dues',
    tagAr: 'التوصيل',
    tagEn: 'Delivery',
    labelAr: 'مستحقات التوصيل وTMP',
    labelEn: 'Delivery & TMP 15%',
    promptAr: 'كم لنا مبالغ معلقة عند طلبات وكيتا وديليفرو وأي الفروع نربح فيها بتعيين سائق TMP بعمولة 15%؟',
    promptEn: 'How much is owed by Talabat, Keeta, and Deliveroo, and where does a TMP 15% company driver pay off?',
  },
]

/** Client-side text sanitizer for speech output. */
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
    text = text.replace(/\bTMP\b/gi, ' سوق طلبات ')
  } else {
    text = text.replace(/\bKWD\b/gi, ' Kuwaiti Dinars ')
    text = text.replace(/د\.ك/g, ' Kuwaiti Dinars ')
    text = text.replace(/%/g, ' percent ')
    text = text.replace(/\bCOGS\b/gi, ' Cost of Goods Sold ')
  }
  return text.replace(/\s+/g, ' ').trim()
}

type ChatMessage = StoredChatMessage

const welcomeMessage = (lang: 'ar' | 'en'): ChatMessage => ({
  id: 'welcome',
  sender: 'feryal',
  text: welcomeText(lang),
  time: '',
})

const makeFreshChatId = () =>
  `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

// ==============================================================================
// Feryal — Executive Solutions, Notebooks & Self-Learning Studio
// ==============================================================================
export default function FeryalAiCommandPage() {
  const { locale: ctxLocale } = useI18n()

  // Reactive locale synced with the site navbar, localStorage and document lang/dir
  const [activeLocale, setActiveLocale] = useState<'ar' | 'en'>(() => {
    if (ctxLocale === 'en' || ctxLocale === 'ar') return ctxLocale
    if (typeof window !== 'undefined') {
      const stored =
        localStorage.getItem('aetherbi_locale') ||
        localStorage.getItem('NEXT_LOCALE') ||
        localStorage.getItem('ai-hq-locale')
      if (stored === 'en' || stored === 'ar') return stored as 'ar' | 'en'
      const docLang = document.documentElement.lang
      if (docLang === 'en' || docLang === 'ar') return docLang as 'ar' | 'en'
      if (document.documentElement.dir === 'rtl') return 'ar'
      if (document.documentElement.dir === 'ltr') return 'en'
    }
    return 'ar'
  })

  useEffect(() => {
    if (ctxLocale === 'en' || ctxLocale === 'ar') setActiveLocale(ctxLocale)
  }, [ctxLocale])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const syncLocale = () => {
      const stored =
        localStorage.getItem('aetherbi_locale') ||
        localStorage.getItem('NEXT_LOCALE') ||
        localStorage.getItem('ai-hq-locale')
      if (stored === 'en' || stored === 'ar') {
        setActiveLocale(stored)
        return
      }
      const lang = document.documentElement.lang
      if (lang === 'en' || lang === 'ar') {
        setActiveLocale(lang)
        return
      }
      const dir = document.documentElement.dir
      if (dir === 'rtl') setActiveLocale('ar')
      else if (dir === 'ltr') setActiveLocale('en')
    }
    syncLocale()
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && (m.attributeName === 'lang' || m.attributeName === 'dir')) {
          syncLocale()
        }
      }
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang', 'dir'],
    })
    window.addEventListener('storage', syncLocale)
    return () => {
      observer.disconnect()
      window.removeEventListener('storage', syncLocale)
    }
  }, [])

  const currentLang: 'ar' | 'en' =
    ctxLocale === 'en' || ctxLocale === 'ar' ? ctxLocale : activeLocale
  const isAr = currentLang === 'ar'
  const T = useCallback((en: string, ar: string) => (isAr ? ar : en), [isAr])
  const { filters, workspace } = useGlobalFilter()

  // Persistent Chat & Notebook State
  const [activeChatId, setActiveChatId] = useState<string>(() => makeFreshChatId())
  const [activeNotebookId, setActiveNotebookId] = useState<string>('all')
  const [messages, setMessages] = useState<ChatMessage[]>(() => [welcomeMessage(currentLang)])
  const [inputText, setInputText] = useState('')
  const [isCopilotThinking, setIsCopilotThinking] = useState(false)
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [openSplitIds, setOpenSplitIds] = useState<Record<string, boolean>>({})
  const [activeBrainMode, setActiveBrainModeState] = useState<'triple' | 'claude' | 'gemini' | 'grok'>('triple')

  // Self-Learning Memory & Macro Big-Bet UI State
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [bigBetMenuOpen, setBigBetMenuOpen] = useState(false)
  const [memoryCountBadge, setMemoryCountBadge] = useState<number>(7)
  const bigBetMenuRef = useRef<HTMLDivElement>(null)

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

  // Update welcome text if conversation has no user messages yet when switching language
  useEffect(() => {
    setMessages((prev) => {
      const hasUserMsg = prev.some((m) => m.sender === 'user')
      if (hasUserMsg) return prev
      return [welcomeMessage(isAr ? 'ar' : 'en')]
    })
  }, [isAr])

  // Real-time zero-click auto-save to IndexedDB (`aether_feryal_chats_v2`) + localStorage index
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

  const copyMessage = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard?.writeText(feryalPlainText(text))
    } catch {}
    setCopiedMsgId(id)
    window.setTimeout(() => setCopiedMsgId((c) => (c === id ? null : c)), 1800)
  }, [])

  // Voice interaction state (audio element + Web Speech API + MediaRecorder)
  const [isListening, setIsListening] = useState(false)
  const [micLang, setMicLang] = useState<'ar' | 'en'>(isAr ? 'ar' : 'en')
  const [isVoiceMuted, setIsVoiceMuted] = useState(false)
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null)
  const [isHandsFree, setIsHandsFree] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [micToast, setMicToast] = useState<string | null>(null)

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)
  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const inputFieldRef = useRef<HTMLTextAreaElement | null>(null)

  const isHandsFreeRef = useRef(false)
  const isVoiceMutedRef = useRef(false)
  const isListeningRef = useRef(false)
  const micLangRef = useRef<'ar' | 'en'>(isAr ? 'ar' : 'en')
  const handleSendQueryRef = useRef<((text?: string) => Promise<void>) | null>(null)
  const startListeningRef = useRef<(() => void) | null>(null)
  const silenceTimerRef = useRef<any>(null)
  const interimTranscriptRef = useRef<string>('')

  // Stop and release all microphone tracks immediately (returns a Bluetooth headset to stereo mode)
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

  useEffect(() => {
    isHandsFreeRef.current = isHandsFree
  }, [isHandsFree])
  useEffect(() => {
    isVoiceMutedRef.current = isVoiceMuted
  }, [isVoiceMuted])
  useEffect(() => {
    micLangRef.current = micLang
  }, [micLang])
  useEffect(() => {
    isListeningRef.current = isListening
  }, [isListening])
  useEffect(() => {
    setMicLang(isAr ? 'ar' : 'en')
  }, [isAr])

  // Auto-scroll the conversation
  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
  }, [messages, isCopilotThinking])

  // Auto-expanding input
  const resizeInput = useCallback(() => {
    const el = inputFieldRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }, [])
  useEffect(() => {
    resizeInput()
  }, [inputText, resizeInput])

  // Browser speech synthesis fallback
  const fallbackSpeechSynthesis = useCallback((rawText: string, lang: 'ar' | 'en') => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(sanitizeTextForSpeechClient(rawText, lang))
      utterance.lang = lang === 'ar' ? 'ar-XA' : 'en-US'
      utterance.rate = 1.0
      utterance.pitch = 1.0
      const voices = window.speechSynthesis.getVoices()
      const femaleVoice = voices.find(
        (v) =>
          (v.name.includes('Female') ||
            v.name.includes('Zira') ||
            v.name.includes('Laila') ||
            v.name.includes('Hoda') ||
            v.name.includes('Salma') ||
            v.name.includes('Maged')) &&
          (lang === 'ar' ? v.lang.startsWith('ar') : v.lang.startsWith('en')),
      )
      if (femaleVoice) utterance.voice = femaleVoice
      utterance.onend = () => {
        setPlayingMsgId(null)
        if (isHandsFreeRef.current && !isVoiceMutedRef.current) {
          setTimeout(() => startListeningRef.current?.(), 600)
        }
      }
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

  // OpenAI Nova voice through the visible audio element, with Google TTS and browser speech fallbacks.
  const playFeryalSpeech = useCallback(
    async (text: string, msgId?: string, force = false) => {
      if (isVoiceMuted && !force) return

      // Unlock the browser AudioContext on the user gesture (Windows Bluetooth mute & Chrome autoplay)
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        if (AudioContextClass) {
          const ctx = new AudioContextClass()
          if (ctx.state === 'suspended') await ctx.resume()
        }
      } catch {}

      // Release every mic track first so the Bluetooth headset returns to stereo
      stopAllMicTracks()
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop()
        } catch {}
      }
      if (audioPlayerRef.current) audioPlayerRef.current.pause()
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }

      const activeLang = isAr ? 'ar' : 'en'
      const activeId = msgId || 'live-speech'
      setPlayingMsgId(activeId)
      const cleanText = sanitizeTextForSpeechClient(text, activeLang) || text

      try {
        // Bluetooth half-duplex delay: give the driver 380 ms to switch from HFP back to A2DP stereo
        await new Promise((resolve) => setTimeout(resolve, 380))

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
                input: cleanText.slice(0, 4000),
                response_format: 'mp3',
              }),
            })
            if (openAiRes.ok) {
              audioUrl = URL.createObjectURL(await openAiRes.blob())
            } else {
              const errBody = await openAiRes.text().catch(() => '')
              throw new Error(`OpenAI HTTP ${openAiRes.status}: ${errBody || openAiRes.statusText}`)
            }
          } catch (directErr) {
            console.warn('OpenAI TTS failed, falling back:', directErr)
          }
        }
        if (!audioUrl) {
          audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${
            activeLang === 'en' ? 'en' : 'ar'
          }&q=${encodeURIComponent(cleanText.slice(0, 200))}`
        }

        const onEnded = () => {
          setPlayingMsgId(null)
          if (isHandsFreeRef.current && !isVoiceMutedRef.current) {
            setTimeout(() => startListeningRef.current?.(), 600)
          }
        }
        const player = audioPlayerRef.current
        if (player) {
          player.pause()
          player.src = audioUrl
          player.load()
          player.onplay = () => setPlayingMsgId(activeId)
          player.onpause = () => setPlayingMsgId(null)
          player.onended = onEnded
          player.onerror = () => {
            setPlayingMsgId(null)
            fallbackSpeechSynthesis(cleanText, activeLang)
          }
          const playPromise = player.play()
          if (playPromise !== undefined) {
            playPromise.catch(() => fallbackSpeechSynthesis(cleanText, activeLang))
          }
          return
        }
        const audio = new Audio(audioUrl)
        audio.onplay = () => setPlayingMsgId(activeId)
        audio.onpause = () => setPlayingMsgId(null)
        audio.onended = onEnded
        audio.onerror = () => fallbackSpeechSynthesis(cleanText, activeLang)
        audio.play().catch(() => fallbackSpeechSynthesis(cleanText, activeLang))
      } catch (err) {
        console.error('Audio playback pipeline error:', err)
        fallbackSpeechSynthesis(cleanText, activeLang)
      }
    },
    [fallbackSpeechSynthesis, isAr, isVoiceMuted, stopAllMicTracks],
  )

  // Send a message to Feryal: Triple-Brain Council -> /api/feryal -> deterministic Odoo reply
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

      const pageCtx = lang === 'ar' ? workspace.feryalContextAr : workspace.feryalContextEn
      const contextualQuery = `${pageCtx}\n${textToSend}`

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
            filters,
            workspace,
            pageContext: pageCtx,
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
          console.warn('Feryal triple-brain warning:', brainErr)
        }
        if (!reply) {
          try {
            const res = await fetch('/api/feryal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'chat', query: contextualQuery, lang }),
            })
            const data = await res.json()
            if (data.success) reply = (lang === 'ar' ? data.replyAr : data.replyEn) || ''
          } catch {}
        }
        if (!reply) reply = getDeterministicFeryalReply(textToSend, lang)

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
        playFeryalSpeech(reply, feryalMsgId)
      } catch (e) {
        console.error('handleSendQuery error:', e)
      } finally {
        setIsCopilotThinking(false)
      }
    },
    [filters, inputText, isAr, playFeryalSpeech, workspace],
  )

  useEffect(() => {
    handleSendQueryRef.current = handleSendQuery
  }, [handleSendQuery])

  // Deep link ?q= — sends text only, never opens the microphone
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q')
    if (!q || !q.trim()) return
    const timer = window.setTimeout(() => {
      handleSendQueryRef.current?.(q.trim())
      window.history.replaceState(null, '', window.location.pathname)
    }, 450)
    return () => window.clearTimeout(timer)
  }, [])

  // Dual-engine speech input: Web Speech API (live text) + MediaRecorder (Gemini audio / Whisper)
  const startListening = useCallback(async () => {
    if (typeof window === 'undefined') return
    if (audioPlayerRef.current) audioPlayerRef.current.pause()
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    stopAllMicTracks()

    let speechRecognitionActive = false
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      try {
        const recognizer = new SpeechRecognition()
        recognizer.continuous = false
        recognizer.interimResults = true
        recognizer.lang = micLangRef.current === 'ar' ? 'ar-KW' : 'en-US'
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
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current)
            silenceTimerRef.current = null
          }
          if (finalText.trim()) {
            setIsListening(false)
            isListeningRef.current = false
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              try {
                mediaRecorderRef.current.stop()
              } catch {}
            } else {
              const queryToSend = finalText.trim()
              interimTranscriptRef.current = ''
              handleSendQueryRef.current?.(queryToSend)
            }
            try {
              recognizer.stop()
            } catch {}
          } else if (interimText.trim()) {
            silenceTimerRef.current = setTimeout(() => {
              if (!isListeningRef.current) return
              setIsListening(false)
              isListeningRef.current = false
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                try {
                  mediaRecorderRef.current.stop()
                } catch {}
              } else if (interimTranscriptRef.current.trim()) {
                const queryToSend = interimTranscriptRef.current.trim()
                interimTranscriptRef.current = ''
                handleSendQueryRef.current?.(queryToSend)
              }
              try {
                recognizer.stop()
              } catch {}
            }, 1800)
          }
        }
        recognizer.onerror = (event: any) => {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
          const errCode = event.error || 'speech-recognition-error'
          if (errCode !== 'no-speech') {
            setMicToast(
              micLangRef.current === 'ar'
                ? 'تعذر التعرف على الصوت، حاول مرة أخرى أو اكتب رسالتك.'
                : 'Speech could not be recognised. Try again or type your message.',
            )
          }
        }
        recognizer.onend = () => {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
        }
        recognitionRef.current = recognizer
        recognizer.start()
        speechRecognitionActive = true
      } catch (recErr) {
        console.warn('SpeechRecognition start error:', recErr)
      }
    }

    let mediaStream: MediaStream | null = null
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaStreamRef.current = mediaStream
        setIsListening(true)
        isListeningRef.current = true
      }
    } catch (err: any) {
      console.error('getUserMedia failure:', err?.name, err?.message)
      if (!speechRecognitionActive) {
        setIsListening(false)
        isListeningRef.current = false
        mediaStreamRef.current = null
        setMicToast(
          micLangRef.current === 'ar'
            ? 'تعذر تشغيل المايكروفون. يمكنك متابعة المحادثة كتابياً.'
            : 'The microphone could not start. You can continue by typing.',
        )
        setTimeout(() => setMicToast(null), 6000)
        inputFieldRef.current?.focus()
        return
      }
    }

    if (mediaStream) {
      try {
        const mr = new MediaRecorder(mediaStream)
        audioChunksRef.current = []
        mr.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data)
        }
        mr.onstop = async () => {
          stopAllMicTracks()
          if (audioChunksRef.current.length > 0) {
            const recordedBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
            audioChunksRef.current = []
            setIsTranscribing(true)
            try {
              // 1. Gemini multimodal audio understanding
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
                try {
                  const multimodalRes = await askFeryalGeminiBrain({
                    lang: micLangRef.current === 'en' ? 'en' : 'ar',
                    audioBase64: base64Audio,
                    mimeType: 'audio/webm',
                  })
                  if (multimodalRes.transcript && multimodalRes.transcript.trim()) {
                    const qText = multimodalRes.transcript.trim()
                    setInputText(qText)
                    interimTranscriptRef.current = ''
                    handleSendQueryRef.current?.(qText)
                    return
                  }
                } catch (gemAudioErr) {
                  console.warn('Gemini audio fallback to Whisper:', gemAudioErr)
                }
              }

              // 2. OpenAI Whisper
              const apiKey = getOpenAIApiKey()
              const fd = new FormData()
              fd.append('file', recordedBlob, 'audio.webm')
              fd.append('model', 'whisper-1')
              fd.append('language', micLangRef.current === 'en' ? 'en' : 'ar')
              fd.append(
                'prompt',
                micLangRef.current === 'en'
                  ? "Feryal, Venture Foods, Odoo, Keeta, Talabat, China Garden, Frank's, Tahina, KWD"
                  : 'فريال، فنتشر فودز، أودو، كيتا، طلبات، تشاينا جاردن، فرانكس، طحينة، دينار كويتي، السالمية، الكوت، العارضية',
              )
              let finalQuery = ''
              if (apiKey) {
                try {
                  const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${apiKey}` },
                    body: fd,
                  })
                  if (whisperRes.ok) {
                    const whisperData = await whisperRes.json()
                    if (whisperData.text && whisperData.text.trim()) {
                      finalQuery = whisperData.text.trim()
                    }
                  }
                } catch (directWhisperErr) {
                  console.warn('Whisper request failed:', directWhisperErr)
                }
              }
              // 3. Server STT route
              if (!finalQuery) {
                try {
                  const sttRes = await fetch('/api/feryal/stt', { method: 'POST', body: fd })
                  if (sttRes.ok) {
                    const sttData = await sttRes.json()
                    if (sttData.ok && sttData.transcript && sttData.transcript.trim()) {
                      finalQuery = sttData.transcript.trim()
                    }
                  }
                } catch {}
              }
              if (!finalQuery && interimTranscriptRef.current.trim()) {
                finalQuery = interimTranscriptRef.current.trim()
              }
              if (finalQuery) {
                setInputText(finalQuery)
                interimTranscriptRef.current = ''
                handleSendQueryRef.current?.(finalQuery)
                return
              }
            } catch (sttErr) {
              console.warn('Speech transcription error:', sttErr)
            } finally {
              setIsTranscribing(false)
            }
          }
          if (interimTranscriptRef.current.trim()) {
            const fallbackQuery = interimTranscriptRef.current.trim()
            interimTranscriptRef.current = ''
            handleSendQueryRef.current?.(fallbackQuery)
          }
        }
        mediaRecorderRef.current = mr
        mr.start(250)
        setIsListening(true)
        isListeningRef.current = true
      } catch (mrErr) {
        console.warn('MediaRecorder init error:', mrErr)
      }
    }
  }, [stopAllMicTracks])

  useEffect(() => {
    startListeningRef.current = startListening
  }, [startListening])

  const toggleListening = useCallback(() => {
    if (isListening) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop()
        } catch {}
      }
      stopAllMicTracks()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopAllMicTracks])

  // Unmount cleanup
  useEffect(() => {
    const player = audioPlayerRef.current
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      stopAllMicTracks()
      if (player) player.pause()
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [stopAllMicTracks])

  // Prime the audio element with the welcome so the player is ready
  useEffect(() => {
    const player = audioPlayerRef.current
    if (!player) return
    const clean = sanitizeTextForSpeechClient(
      welcomeText(isAr ? 'ar' : 'en'),
      isAr ? 'ar' : 'en',
    ).slice(0, 200)
    player.src = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${
      isAr ? 'ar' : 'en'
    }&q=${encodeURIComponent(clean)}`
  }, [isAr])

  const lastFeryal = useMemo(
    () => [...messages].reverse().find((m) => m.sender === 'feryal') ?? null,
    [messages],
  )

  const newDiscussion = useCallback(() => {
    stopPlayback()
    stopAllMicTracks()
    setInputText('')
    setOpenSplitIds({})
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

  const launchMacroBigBet = useCallback(
    (strategyId: MacroBigBetId) => {
      setBigBetMenuOpen(false)
      const prompt = buildMacroBigBetPrompt(strategyId, workspace, isAr)
      void handleSendQuery(prompt)
    },
    [handleSendQuery, isAr, workspace],
  )

  const formatAsDispatchBrief = useCallback(
    (rawText: string) => {
      const reviewDate = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)
      const body = feryalPlainText(rawText)
      return isAr
        ? [
            `📌 توجيه تنفيذي سريع من المستشارة فريال — شركة فنتشر فودز لإدارة المطاعم ذ.م.م`,
            `• المسؤول عن المتابعة: مدير المنطقة / مدير الفرع / شيف مطبخ العارضية المركزي`,
            `• موعد مراجعة النتيجة (بعد 14 يوماً): ${reviewDate}`,
            ``,
            body,
            ``,
            `⏱️ فحص ميداني سريع لمدير المنطقة (٣ نقاط في ٥ دقائق):`,
            `  ١) التأكد من تطبيق الخطوة فعلياً على شاشة الكاشير وخط التحضير بالفرع.`,
            `  ٢) وزن ٣ وجبات عشوائية على الميزان الرقمي ومطابقة رصيد علب التغليف مع أودو.`,
            `  ٣) مراجعة الخصومات والطلبات الملغية واقتراحات البيع الإضافي للشفت المسائي.`,
          ].join('\n')
        : [
            `📌 QUICK TEAM BRIEF FROM FERYAL — Venture Foods Restaurants Management Co. W.L.L.`,
            `• Owner: Area Manager / Branch Manager / Ardiya Central Kitchen Chef`,
            `• 14-Day Results Check Date: ${reviewDate}`,
            ``,
            body,
            ``,
            `⏱️ 5-Minute Spot Check (Area Manager):`,
            `  1) Confirm the step is active on the branch POS screen and kitchen line.`,
            `  2) Weigh 3 random portions on the digital scale and match packaging count to Odoo.`,
            `  3) Check evening-shift discounts, cancellations, and cashier upsell suggestions.`,
          ].join('\n')
    },
    [isAr],
  )

  const activeBrainBadgeText =
    activeBrainMode === 'claude'
      ? T('Claude Deep 🔬', 'كلاود العميق 🔬')
      : activeBrainMode === 'gemini'
        ? T('Gemini Carbon High ⚡', 'جميني كاربون High ⚡')
        : activeBrainMode === 'grok'
          ? T('Grok Heavy 🧠', 'جروك Heavy 🧠')
          : T('Triple Brain 🔥', 'العقل الثلاثي 🔥')

  const pill =
    'inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[12.5px] font-bold transition-all duration-150 focus:outline-none'
  const pillIdle = 'ae-bento-subcard text-slate-700 hover:opacity-90 dark:text-slate-200'
  const pillOn =
    'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-500/40'
  const panelShell = 'ae-bento-card h-[76vh] min-h-[600px] max-h-[840px]'

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="mx-auto w-full max-w-[1600px] space-y-5 font-sans text-slate-900 antialiased dark:text-slate-100"
    >
      {/* ───────────── Finance V2 × Verdelo Studio Bar ───────────── */}
      <header className="ae-bento-card flex flex-col gap-4 p-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0B1220] text-white shadow-sm dark:bg-[#10B981] dark:text-[#04130D]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-[22px] font-extrabold tracking-tight text-slate-950 sm:text-[24px] dark:text-white">
                {T('Ask Feryal', 'المستشارة فريال')}
              </h1>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-800 ring-1 ring-emerald-500/20 dark:bg-emerald-950/50 dark:text-emerald-300">
                {activeBrainBadgeText}
              </span>
            </div>
            <p className="truncate text-[13px] font-medium text-slate-500 dark:text-slate-400">
              {isAr ? workspace.subtitleAr : workspace.subtitleEn}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* ابتكار الحلول الكبرى 🚀 */}
          <div ref={bigBetMenuRef} className="relative">
            <button
              type="button"
              disabled={isCopilotThinking}
              onClick={() => setBigBetMenuOpen((v) => !v)}
              className="ae-btn-primary inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-extrabold transition-all hover:opacity-95 disabled:opacity-50"
            >
              <Rocket className="h-3.5 w-3.5" />
              <span>{T('Big-Bet Generator 🚀', 'ابتكار الحلول الكبرى 🚀')}</span>
            </button>

            {bigBetMenuOpen ? (
              <div className="ae-bento-card absolute end-0 z-50 mt-2 w-[340px] space-y-2 p-3.5 sm:w-[390px]">
                <div className="text-[12.5px] font-extrabold text-slate-950 dark:text-white">
                  {T(
                    'Launch Macro Profit Strategy 🚀',
                    'اختر محور ابتكار الحلول الكبرى 🚀',
                  )}
                </div>
                {MACRO_BIG_BET_STRATEGIES.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => launchMacroBigBet(st.id)}
                    className="ae-bento-subcard block w-full cursor-pointer rounded-2xl p-3 text-start transition-all hover:ring-1 hover:ring-emerald-500/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-extrabold text-slate-950 dark:text-white">
                        {isAr ? st.titleAr : st.titleEn}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-extrabold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                        +{st.estMonthlyKwdMin.toLocaleString('en-US')}–
                        {st.estMonthlyKwdMax.toLocaleString('en-US')} {isAr ? 'د.ك' : 'KWD'}
                      </span>
                    </div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">
                      {isAr ? st.summaryAr : st.summaryEn}
                    </p>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* ذاكرة وتطور فريال 🧠 */}
          <button
            type="button"
            onClick={() => setMemoryOpen(true)}
            className={`${pill} ${pillIdle}`}
          >
            <Brain className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>{T('Feryal Memory 🧠', 'ذاكرة وتطور فريال 🧠')}</span>
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[10.5px] font-extrabold tabular-nums text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
              {memoryCountBadge}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              playingMsgId
                ? stopPlayback()
                : lastFeryal && playFeryalSpeech(lastFeryal.text, lastFeryal.id, true)
            }
            className={`${pill} ${playingMsgId ? pillOn : pillIdle}`}
          >
            {playingMsgId ? <Square className="h-3.5 w-3.5" /> : <Headphones className="h-4 w-4" />}
            {playingMsgId ? T('Stop', 'إيقاف') : T('Listen', 'استماع')}
          </button>
          <audio
            ref={audioPlayerRef}
            controls
            preload="none"
            className="h-9 w-[155px] shrink-0 rounded-full"
            aria-label={T('Feryal voice player', 'مشغل صوت فريال')}
          />
          <button
            type="button"
            aria-pressed={!isVoiceMuted}
            onClick={() => setIsVoiceMuted((v) => !v)}
            className={`${pill} ${!isVoiceMuted ? pillOn : pillIdle}`}
          >
            {isVoiceMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            {T('Auto-Voice', 'رد صوتي')}
          </button>
          <button
            type="button"
            aria-pressed={isHandsFree}
            onClick={() => setIsHandsFree((v) => !v)}
            className={`${pill} ${isHandsFree ? pillOn : pillIdle}`}
          >
            <Mic className="h-4 w-4" />
            {T('Hands-Free', 'محادثة مستمرة')}
          </button>
          <button
            type="button"
            aria-pressed={isExpanded}
            onClick={() => setIsExpanded((v) => !v)}
            className={`${pill} ${isExpanded ? pillOn : pillIdle} hidden lg:inline-flex`}
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {isExpanded ? T('Side Panel', 'الدفاتر') : T('Expand', 'تكبير')}
          </button>
          <button type="button" onClick={newDiscussion} className={`${pill} ${pillIdle}`}>
            <RotateCcw className="h-4 w-4" />
            {T('+ New Chat', '+ محادثة جديدة')}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* ───────────── Conversation Studio ───────────── */}
        <section
          className={`${
            isExpanded ? 'lg:col-span-12' : 'lg:col-span-8'
          } flex ${panelShell} flex-col overflow-hidden`}
        >
          <div
            ref={chatScrollRef}
            className="flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-7"
            aria-live="polite"
          >
            {messages.map((m) => {
              const mine = m.sender === 'user'
              const briefText = !mine && m.id !== 'welcome' ? formatAsDispatchBrief(m.text) : ''
              const brainPanels = !mine
                ? [
                    m.claudeReply
                      ? {
                          key: 'claude',
                          titleAr: 'رأي كلاود العميق 🔬',
                          titleEn: 'Claude Extended Thinking 🔬',
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
                          titleAr: 'رأي جروك Heavy (٣ زوايا) 🧠',
                          titleEn: 'xAI Grok Heavy (3-Lens) 🧠',
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
                  {!mine && (
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0B1220] text-white dark:bg-[#10B981] dark:text-[#04130D]">
                      <Sparkles className="h-4 w-4" />
                    </div>
                  )}
                  <div className={`min-w-0 ${mine ? 'max-w-[78%]' : 'max-w-[92%] flex-1'}`}>
                    {engineBadge ? (
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                          {engineBadge}
                        </span>
                        {noteText ? (
                          <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                            {noteText}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    <div
                      className={
                        mine
                          ? 'whitespace-pre-wrap rounded-2xl bg-[#0B1220] px-5 py-4 text-[15px] leading-[1.85] text-white dark:bg-[#0F2920] dark:text-emerald-50 dark:ring-1 dark:ring-emerald-500/30'
                          : 'ae-bento-subcard px-6 py-5 text-[15px] leading-[1.85] text-slate-800 dark:text-slate-100'
                      }
                    >
                      {mine ? m.text : <FeryalStudioMessage text={m.text} />}
                    </div>
                    <div
                      className={`mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400 ${
                        mine ? 'justify-end' : ''
                      }`}
                    >
                      {m.time && <span className="tabular-nums">{m.time}</span>}
                      {!mine && (
                        <>
                          {hasMultipleBrains && (
                            <button
                              type="button"
                              onClick={() =>
                                setOpenSplitIds((prev) => ({ ...prev, [m.id]: !prev[m.id] }))
                              }
                              className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-3 py-1 font-semibold transition-colors ${
                                splitOpen
                                  ? 'ae-btn-primary'
                                  : 'ae-bento-subcard text-slate-700 hover:opacity-90 dark:text-slate-200'
                              }`}
                            >
                              <Columns2 className="h-3.5 w-3.5" />
                              {T(
                                `View Council Brains Separately (${brainPanels.length})`,
                                `عرض آراء محركات المجلس منفردة (${brainPanels.length})`,
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              playingMsgId === m.id
                                ? stopPlayback()
                                : playFeryalSpeech(m.text, m.id, true)
                            }
                            className="ae-bento-subcard inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 font-semibold text-slate-600 hover:opacity-90 dark:text-slate-300"
                          >
                            {playingMsgId === m.id ? (
                              <Square className="h-3 w-3" />
                            ) : (
                              <Volume2 className="h-3.5 w-3.5" />
                            )}
                            {playingMsgId === m.id ? T('Stop', 'إيقاف') : T('Listen', 'استماع للرد')}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyMessage(m.id, m.text)}
                            className="ae-bento-subcard inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 font-semibold text-slate-600 hover:opacity-90 dark:text-slate-300"
                          >
                            {copiedMsgId === m.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                            {copiedMsgId === m.id
                              ? T('Copied', 'تم النسخ')
                              : T('Copy Reply', 'نسخ الرد')}
                          </button>
                          {m.id !== 'welcome' && (
                            <>
                              <button
                                type="button"
                                onClick={() => copyMessage(`${m.id}-brief`, briefText)}
                                className="ae-btn-primary inline-flex cursor-pointer items-center gap-1 rounded-full px-3 py-1 font-semibold hover:opacity-95"
                              >
                                {copiedMsgId === `${m.id}-brief` ? (
                                  <Check className="h-3.5 w-3.5" />
                                ) : (
                                  <FileText className="h-3.5 w-3.5" />
                                )}
                                {copiedMsgId === `${m.id}-brief`
                                  ? T('Brief Copied', 'تم نسخ الرسالة')
                                  : T('Team Brief', 'رسالة توجيه للفريق')}
                              </button>
                              <a
                                href={`https://wa.me/?text=${encodeURIComponent(briefText)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 font-semibold text-white hover:bg-emerald-500"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                {T('Send via WhatsApp', 'إرسال عبر واتساب')}
                              </a>
                            </>
                          )}
                        </>
                      )}
                    </div>

                    {hasMultipleBrains && splitOpen ? (
                      <div
                        className={`mt-3 grid grid-cols-1 gap-3 ${
                          brainPanels.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'
                        }`}
                      >
                        {brainPanels.map((panel) => (
                          <div
                            key={panel.key}
                            className="ae-bento-subcard rounded-2xl p-4 text-[13.5px] leading-[1.8] text-slate-700 dark:text-slate-200"
                          >
                            <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-200/70 pb-2 dark:border-white/[0.06]">
                              <span className="font-extrabold text-slate-950 dark:text-white">
                                {isAr ? panel.titleAr : panel.titleEn}
                              </span>
                              {panel.model ? (
                                <span
                                  dir="ltr"
                                  className="font-mono text-[11px] font-bold text-slate-500"
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

            {messages.length <= 1 && !isCopilotThinking && (
              <div className="space-y-4">
                {/* Macro Big-Bet Quick Pills */}
                <div className="ae-bento-subcard rounded-2xl p-4">
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <span className="text-[13px] font-extrabold text-slate-950 dark:text-white">
                      {T(
                        'Macro Big-Bet Generator 🚀 (Strategic Profit Levers)',
                        'ابتكار الحلول الكبرى 🚀 (قفزات الربح الاستراتيجية)',
                      )}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {MACRO_BIG_BET_STRATEGIES.map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => launchMacroBigBet(st.id)}
                        className="ae-kpi-card cursor-pointer rounded-xl p-3 text-start transition-all active:scale-[0.99]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400">
                            {isAr ? st.badgeAr : st.badgeEn}
                          </span>
                          <span className="font-mono text-[10.5px] font-bold text-slate-500">
                            +{st.estMonthlyKwdMin.toLocaleString('en-US')} {isAr ? 'د.ك+' : 'KWD+'}
                          </span>
                        </div>
                        <div className="mt-1 text-[13px] font-extrabold text-slate-950 dark:text-white">
                          {isAr ? st.titleAr : st.titleEn}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Daily Operational Topics */}
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  {TOPICS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSendQuery(isAr ? t.promptAr : t.promptEn)}
                      className="ae-kpi-card group cursor-pointer p-4 text-start active:scale-[0.99]"
                    >
                      <span className="inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                        {isAr ? t.tagAr : t.tagEn}
                      </span>
                      <div className="mt-2 text-[14px] font-bold text-slate-950 dark:text-white">
                        {isAr ? t.labelAr : t.labelEn}
                      </div>
                      <p className="mt-1 line-clamp-3 text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">
                        {isAr ? t.promptAr : t.promptEn}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isCopilotThinking && (
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0B1220] text-white dark:bg-[#10B981] dark:text-[#04130D]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div className="ae-bento-subcard px-5 py-3.5 text-[14.5px] font-medium text-slate-600 dark:text-slate-300">
                  {T(
                    'Running Triple-Brain Council + Evolving Memory on live Odoo numbers…',
                    'فريال تشغّل العقل الثلاثي وذاكرة الشركة المتطورة على أرقام أودو…',
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Input dock */}
          <div className="border-t border-slate-100 bg-white/95 px-4 pb-4 pt-3 sm:px-6 dark:border-white/[0.06] dark:bg-[#111A22]/95">
            <div className={`mb-3 flex-wrap gap-2 ${messages.length <= 1 ? 'hidden' : 'flex'}`}>
              {TOPICS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={isCopilotThinking}
                  onClick={() => handleSendQuery(isAr ? t.promptAr : t.promptEn)}
                  className="ae-bento-subcard cursor-pointer rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-slate-700 transition-opacity hover:opacity-90 disabled:opacity-50 dark:text-slate-200"
                >
                  {isAr ? t.labelAr : t.labelEn}
                </button>
              ))}
            </div>
            {(micToast || isListening || isTranscribing) && (
              <div
                className={`mb-2 text-[13px] font-medium ${
                  micToast
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {micToast ??
                  (isTranscribing
                    ? T('Transcribing your voice…', 'جارٍ تحويل صوتك إلى نص…')
                    : T('Listening… speak now', 'أستمع إليك… تفضل بالحديث'))}
              </div>
            )}
            <div className="flex items-end gap-2.5">
              <textarea
                ref={inputFieldRef}
                rows={1}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (!isCopilotThinking) handleSendQuery()
                  }
                }}
                placeholder={T(
                  'Ask Feryal or teach a permanent rule (e.g., "Remember that our supplier contract…")…',
                  'اسأل فريال عن أي فرع أو مورد أو علّمها قاعدة دائمة (مثال: تذكري أن…)',
                )}
                className="ae-bento-subcard min-h-[52px] flex-1 resize-none rounded-2xl px-4 py-3.5 text-[15px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/35 dark:text-white"
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
                className={`flex h-[52px] w-[52px] shrink-0 cursor-pointer items-center justify-center rounded-2xl transition-all active:scale-95 ${
                  isListening
                    ? 'animate-pulse bg-rose-600 text-white'
                    : 'ae-bento-subcard text-slate-700 hover:opacity-90 dark:text-slate-100'
                }`}
              >
                {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={() => handleSendQuery()}
                disabled={isCopilotThinking || !inputText.trim()}
                className="ae-btn-primary inline-flex h-[52px] shrink-0 cursor-pointer items-center gap-2 rounded-2xl px-5 text-[14.5px] font-bold transition-all hover:opacity-95 active:scale-95 disabled:opacity-40"
              >
                <Send className={`h-4 w-4 ${isAr ? 'rotate-180' : ''}`} />
                {T('Send', 'إرسال')}
              </button>
            </div>
          </div>
        </section>

        {/* ───────────── Gemini-Style Persistent Chats & Topic Notebooks Side Panel ───────────── */}
        {!isExpanded && (
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
            panelClassName={panelShell}
          />
        )}
      </div>

      {/* Slide-Over Institutional Memory & Continuous Learning Drawer */}
      <FeryalMemoryDrawer
        open={memoryOpen}
        onClose={() => setMemoryOpen(false)}
        isAr={isAr}
        onAskScalePlan={(p) => void handleSendQuery(p)}
      />
    </div>
  )
}
