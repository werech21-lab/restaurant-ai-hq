'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarClock,
  Check,
  Copy,
  FileText,
  Headphones,
  Landmark,
  Loader2,
  Maximize2,
  MessageCircle,
  Mic,
  MicOff,
  Minimize2,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { getOpenAIApiKey, getGeminiApiKey } from '@/lib/ai-keys'
import { askFeryalGeminiBrain, FERYAL_PROPOSALS, getDeterministicFeryalReply } from '@/lib/feryal-gemini-brain'
import { CASH_RUNWAY_PULSE, evaluateKuwaitCashCycle, KUWAIT_CALENDAR_PULSE, type KuwaitCalendarPulse } from '@/lib/full-journey-enterprise-brain'
import { LEDGER } from '@/lib/aether/ledger'
import { FeryalStudioMessage, feryalPlainText } from '@/components/aether/FeryalStudioMessage'

// ==============================================================================
// Conversation copy (strict Arabic / English isolation)
// ==============================================================================
const welcomeText = (lang: 'ar' | 'en') =>
  lang === 'ar'
    ? `أهلاً بك، أنا فريال، مستشارتك التنفيذية الشاملة للعمليات والمالية والنمو في فنتشر فودز. أراجع الرحلة الكاملة في أودو — من موردي المطبخ المركزي بالعارضية إلى مطابخ فروعنا الـ ${LEDGER.branches} ومنصات التوصيل وحتى التسويات البنكية وولاء العملاء — لنتخذ معاً قرارات جراحية ترفع الجودة وصافي الربح.`
    : `Welcome, I'm Feryal, your 360° COO, CFO and growth strategist at Venture Foods. I review the full journey in Odoo — from Ardiya Central Kitchen suppliers to our ${LEDGER.branches} restaurant kitchens, delivery platforms, bank settlements and customer loyalty — so we can take surgical decisions that lift quality and net profit.`

const TOPICS: { id: string; tagAr: string; tagEn: string; labelAr: string; labelEn: string; promptAr: string; promptEn: string }[] = [
  {
    id: 'zwarah-prep',
    tagAr: 'توقيت الرواتب والزوارة · تحضير العارضية',
    tagEn: 'Kuwait Payday & Zwarah · Ardiya Prep',
    labelAr: 'تبديل باقات الرواتب والزوارة ومنع نفاد الخميس والجمعة',
    labelEn: 'Kuwait Payday/Zwarah Bundles & Zero-Stockout Par Shield',
    promptAr: 'ما خطة التوقيت الميداني في الكويت بين ذروة الرواتب والزوارة (٢٠–٢٩ والخميس والجمعة) ودرع سيولة منتصف الشهر (١٠–١٩)، وكيف نضبط تحضير المطبخ المركزي بالعارضية لمنع هدر أول الأسبوع ومنع نفاد الأصناف مساء الخميس؟',
    promptEn: 'What is our Kuwait field-execution plan across Payday & Thu/Fri Zwarah surges (20th–29th) vs Mid-Month Liquidity Shield (10th–19th), and how do we set Ardiya Central Kitchen (#17) par levels to stop weekday spoilage and Thu/Fri stockouts?',
  },
  {
    id: 'field-upsell-b2b',
    tagAr: 'البيع الإضافي · الأبراج والديوانيات',
    tagEn: 'Cashier Upsell · Corporate & Diwaniya',
    labelAr: 'حافز الكاشير المموّل ذاتياً وبوكسات الأبراج والديوانيات بعمولة ٠٪',
    labelEn: 'Self-Funded Cashier Upsells & 0%-Commission B2B/Diwaniya Boxes',
    promptAr: 'أعطني جمل البيع الإضافي للكاشير لكل علامة مع قاعدة المكافأة الأسبوعية المموّلة ذاتياً بعد تحقيق 500 د.ك هامش صافي، وخطة بوكسات غداء الأبراج والوزارات حول العاصمة مول وبوكسات الديوانيات بعمولة صفر بالمئة.',
    promptEn: 'Give me the 1-line cashier upsell scripts per brand with the self-funded 25 KWD micro-bonus rule (unlocked after +500 KWD verified net margin), plus our 0%-commission Assima Tower Office Lunch & Kuwaiti Diwaniya box playbook.',
  },
  {
    id: 'cash-runway',
    tagAr: 'السيولة · التزامات نهاية الشهر',
    tagEn: 'CFO Cash Runway · 15-Day Shield',
    labelAr: 'نبض التزامات الإيجارات والرواتب وتوقيت تحصيل المنصات',
    labelEn: 'Month-End Rent, Payroll & Vendor Runway vs Platform Payouts',
    promptAr: 'راجعي نبض التزامات نهاية الشهر من الإيجارات والرواتب ومستحقات الموردين مقابل تدفقات نقاط البيع وخطة تحصيل تسويات طلبات وكيتا قبل 15 يوماً من نهاية الشهر.',
    promptEn: 'Review our End-of-Month Cash Commitments (Rent, Payroll & Vendor payables) against 30-day POS cash inflow and our 15-day pre-month-end Talabat & Keeta clearing sweep plan.',
  },
  {
    id: 'yield',
    tagAr: 'المطبخ المركزي بالعارضية (#17)',
    tagEn: 'Ardiya Central Kitchen (#17)',
    labelAr: 'فجوة الهدر الخفي وفروقات الجرد بالمطبخ المركزي',
    labelEn: 'Central Kitchen Yield & Stock Variance Shield',
    promptAr: 'أين يتسرب الربح بين المطبخ المركزي بالعارضية (مركز تكلفة #17) وفروعنا السبعة؟ حللي فروقات الجرد والهالك وانحراف حصص نودلز الدجاج وأعطني مذكرة تكليف مع فحص ميداني في 5 دقائق.',
    promptEn: 'Where is profit leaking between Ardiya Central Kitchen (Analytic #17) and our 7 branches? Analyse stock count variance, scrap and Chicken Noodles portion drift, with a 5-minute spot-audit dispatch brief.',
  },
  {
    id: 'menu-elasticity',
    tagAr: 'تشاينا جاردن (#86) · التسعير الجراحي',
    tagEn: 'China Garden (#86) · Elasticity Guardrail',
    labelAr: 'تسعير الأطباق القائدة وحماية الأصناف الجاذبة',
    labelEn: 'Hero Dish Repricing & Traffic-Driver Guardrail',
    promptAr: 'في تشاينا جاردن (مركز #86)، ما الأطباق القائدة غير الحساسة للسعر التي تتحمل +150 فلس بأمان (مثل نودلز الدجاج ودجاج سويت آند ساور) وما الأصناف الجاذبة التي يجب تجميد سعرها المنفرد؟',
    promptEn: 'In China Garden (Analytic #86), which inelastic hero dishes safely take +150 fils (e.g. Chicken Noodles, Sweet & Sour Chicken) vs. traffic drivers whose standalone price must stay frozen?',
  },
  {
    id: 'delivery',
    tagAr: 'طلبات جو وسوق طلبات · كيتا · التسويات',
    tagEn: 'Talabat Tgo/TMP · Keeta · Claims',
    labelAr: 'تشريح ربحية عروض كيتا ومطالبات فروقات طلبات',
    labelEn: 'Keeta Promo Cap & Talabat Settlement Recovery',
    promptAr: 'كم يصلنا صافياً في البنك من كيتا وطلبات (طلبات جو 17% مقابل سوق طلبات 10%) بعد العمولات والعروض المشتركة؟ ضعي خطة استرداد الفروقات وسقف العروض عند 3.5%.',
    promptEn: 'How much true net cash hits our bank from Keeta and Talabat (Tgo 17% vs TMP 10%) after commissions and co-funded promos? Give me the 3.5% promo cap & claim recovery plan.',
  },
]

const fmtKwd = (n: number, isAr: boolean) => `${Math.round(n).toLocaleString('en-US')} ${isAr ? 'د.ك' : 'KWD'}`

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

type ChatMessage = { id: string; sender: 'user' | 'feryal'; text: string; time: string }

const welcomeMessage = (lang: 'ar' | 'en'): ChatMessage => ({ id: 'welcome', sender: 'feryal', text: welcomeText(lang), time: '' })

// ==============================================================================
// Feryal — Executive Solutions & Proposals Studio
// ==============================================================================
export default function FeryalAiCommandPage() {
  const { locale: ctxLocale } = useI18n()

  // Reactive locale synced with the site navbar, localStorage and document lang/dir
  const [activeLocale, setActiveLocale] = useState<'ar' | 'en'>(() => {
    if (ctxLocale === 'en' || ctxLocale === 'ar') return ctxLocale
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('aetherbi_locale') || localStorage.getItem('NEXT_LOCALE') || localStorage.getItem('ai-hq-locale')
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
      const stored = localStorage.getItem('aetherbi_locale') || localStorage.getItem('NEXT_LOCALE') || localStorage.getItem('ai-hq-locale')
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
        if (m.type === 'attributes' && (m.attributeName === 'lang' || m.attributeName === 'dir')) syncLocale()
      }
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'dir'] })
    window.addEventListener('storage', syncLocale)
    return () => {
      observer.disconnect()
      window.removeEventListener('storage', syncLocale)
    }
  }, [])

  const currentLang: 'ar' | 'en' = ctxLocale === 'en' || ctxLocale === 'ar' ? ctxLocale : activeLocale
  const isAr = currentLang === 'ar'
  const T = useCallback((en: string, ar: string) => (isAr ? ar : en), [isAr])

  // Conversation state
  const [messages, setMessages] = useState<ChatMessage[]>(() => [welcomeMessage(currentLang)])
  const [inputText, setInputText] = useState('')
  const [isCopilotThinking, setIsCopilotThinking] = useState(false)
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [calPulse, setCalPulse] = useState<KuwaitCalendarPulse>(() => KUWAIT_CALENDAR_PULSE)

  useEffect(() => {
    setCalPulse(evaluateKuwaitCashCycle(new Date()))
  }, [])

  // A conversation lives in one language: switching the interface language opens a fresh discussion.
  useEffect(() => {
    setMessages([welcomeMessage(isAr ? 'ar' : 'en')])
  }, [isAr])

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
          (v.name.includes('Female') || v.name.includes('Zira') || v.name.includes('Laila') || v.name.includes('Hoda') || v.name.includes('Salma') || v.name.includes('Maged')) &&
          (lang === 'ar' ? v.lang.startsWith('ar') : v.lang.startsWith('en')),
      )
      if (femaleVoice) utterance.voice = femaleVoice
      utterance.onend = () => {
        setPlayingMsgId(null)
        if (isHandsFreeRef.current && !isVoiceMutedRef.current) setTimeout(() => startListeningRef.current?.(), 600)
      }
      utterance.onerror = () => setPlayingMsgId(null)
      window.speechSynthesis.speak(utterance)
    } catch {
      setPlayingMsgId(null)
    }
  }, [])

  const stopPlayback = useCallback(() => {
    if (audioPlayerRef.current) audioPlayerRef.current.pause()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    setPlayingMsgId(null)
  }, [])

  // OpenAI Nova voice through the visible audio element, with Google TTS and browser speech fallbacks.
  // `force` plays even when Auto-Voice is off (explicit Listen buttons).
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
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()

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
              headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: 'tts-1', voice: 'nova', input: cleanText.slice(0, 4000), response_format: 'mp3' }),
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
          audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${activeLang === 'en' ? 'en' : 'ar'}&q=${encodeURIComponent(cleanText.slice(0, 200))}`
        }

        const onEnded = () => {
          setPlayingMsgId(null)
          if (isHandsFreeRef.current && !isVoiceMutedRef.current) setTimeout(() => startListeningRef.current?.(), 600)
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
          if (playPromise !== undefined) playPromise.catch(() => fallbackSpeechSynthesis(cleanText, activeLang))
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

  // Send a message to Feryal: Gemini brain → OpenAI → /api/feryal → deterministic Odoo-grounded reply
  const handleSendQuery = useCallback(
    async (queryText?: string) => {
      const textToSend = (queryText ?? inputText).trim()
      if (!textToSend) return
      const lang: 'ar' | 'en' = isAr ? 'ar' : 'en'
      const stamp = () => new Date().toLocaleTimeString(lang === 'ar' ? 'ar-KW' : 'en-US', { hour: '2-digit', minute: '2-digit' })

      setMessages((prev) => [...prev, { id: `user-${Date.now()}`, sender: 'user', text: textToSend, time: stamp() }])
      setInputText('')
      setIsCopilotThinking(true)

      try {
        let reply = ''
        try {
          const brainRes = await askFeryalGeminiBrain({ query: textToSend, lang })
          reply = brainRes.reply?.trim() || ''
        } catch (brainErr) {
          console.warn('Feryal brain warning:', brainErr)
        }
        if (!reply) {
          try {
            const res = await fetch('/api/feryal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'chat', query: textToSend, lang }),
            })
            const data = await res.json()
            if (data.success) reply = (lang === 'ar' ? data.replyAr : data.replyEn) || ''
          } catch {}
        }
        if (!reply) reply = getDeterministicFeryalReply(textToSend, lang)

        const feryalMsgId = `feryal-${Date.now()}`
        setMessages((prev) => [...prev, { id: feryalMsgId, sender: 'feryal', text: reply, time: stamp() }])
        playFeryalSpeech(reply, feryalMsgId)
      } catch (e) {
        console.error('handleSendQuery error:', e)
      } finally {
        setIsCopilotThinking(false)
      }
    },
    [inputText, isAr, playFeryalSpeech],
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
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
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
            setMicToast(micLangRef.current === 'ar' ? 'تعذر التعرف على الصوت، حاول مرة أخرى أو اكتب رسالتك.' : 'Speech could not be recognised. Try again or type your message.')
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
        setMicToast(micLangRef.current === 'ar' ? 'تعذر تشغيل المايكروفون. يمكنك متابعة المحادثة كتابياً.' : 'The microphone could not start. You can continue by typing.')
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
                  const multimodalRes = await askFeryalGeminiBrain({ lang: micLangRef.current === 'en' ? 'en' : 'ar', audioBase64: base64Audio, mimeType: 'audio/webm' })
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
                  : 'فريال، فنتشر فودز، أودو، كيتا، طلبات، تشاينا جاردن، فرانكس، طحينة، دينار كويتي، السالمية، الكوت',
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
                    if (whisperData.text && whisperData.text.trim()) finalQuery = whisperData.text.trim()
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
                    if (sttData.ok && sttData.transcript && sttData.transcript.trim()) finalQuery = sttData.transcript.trim()
                  }
                } catch {}
              }
              if (!finalQuery && interimTranscriptRef.current.trim()) finalQuery = interimTranscriptRef.current.trim()
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
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [stopAllMicTracks])

  // Prime the audio element with the welcome so the player is ready
  useEffect(() => {
    const player = audioPlayerRef.current
    if (!player) return
    const clean = sanitizeTextForSpeechClient(welcomeText(isAr ? 'ar' : 'en'), isAr ? 'ar' : 'en').slice(0, 200)
    player.src = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${isAr ? 'ar' : 'en'}&q=${encodeURIComponent(clean)}`
  }, [isAr])

  const lastFeryal = useMemo(() => [...messages].reverse().find((m) => m.sender === 'feryal') ?? null, [messages])

  const newDiscussion = useCallback(() => {
    stopPlayback()
    stopAllMicTracks()
    setInputText('')
    setMessages([welcomeMessage(isAr ? 'ar' : 'en')])
  }, [isAr, stopAllMicTracks, stopPlayback])

  const formatAsDispatchBrief = useCallback(
    (rawText: string) => {
      const reviewDate = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)
      const body = feryalPlainText(rawText)
      return isAr
        ? [
            `📌 مذكرة تكليف ميدانية صادرة عن المستشارة فريال — شركة فنتشر فودز لإدارة المطاعم ذ.م.م`,
            `• المكلّف بالتنفيذ: مدير المنطقة / مدير الفرع / شيف المطبخ المركزي بالعارضية (#17)`,
            `• موعد مراجعة الأثر الفعلي (بعد 14 يوماً): ${reviewDate}`,
            ``,
            body,
            ``,
            `⏱️ قائمة التفتيش الميداني السريع لمدير المنطقة (٣ نقاط في ٥ دقائق):`,
            `  ١) مطابقة تطبيق القرار فعلياً على شاشة نقاط البيع وخط الإنتاج بالفرع.`,
            `  ٢) وزن ٣ حصص عشوائية على الميزان الرقمي وجرد علب التغليف مقابل فواتير أودو 17.`,
            `  ٣) مراجعة سجل الخصومات والإلغاءات وجمل البيع الإضافي للشفت المسائي.`,
          ].join('\n')
        : [
            `📌 FERYAL FIELD EXECUTION DISPATCH BRIEF — Venture Foods Restaurants Management Co. W.L.L.`,
            `• Accountable Owner: Area Manager / Branch Manager / Ardiya Central Kitchen Chef (#17)`,
            `• 14-Day Impact Review Date: ${reviewDate}`,
            ``,
            body,
            ``,
            `⏱️ 5-Minute Surgical Physical Spot-Audit Checklist (Area Manager):`,
            `  1) Verify live compliance on the branch Odoo POS terminal and hot-line station.`,
            `  2) Weigh 3 random portions on the digital scale and reconcile physical packaging vs Odoo 17.`,
            `  3) Audit evening-shift discount/void slips and 1-line cashier upsell execution.`,
          ].join('\n')
    },
    [isAr],
  )

  const pill =
    'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition-all focus:outline-none'
  const pillIdle =
    'bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_0_0_1px_rgba(15,23,42,0.05)] hover:bg-slate-50 dark:bg-[#0F1626] dark:text-slate-200 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)]'
  const pillOn = 'bg-emerald-50 text-emerald-800 shadow-[0_0_0_1px_rgba(16,185,129,0.28)] dark:bg-emerald-950/40 dark:text-emerald-200'
  const panelShell = 'ae-studio-card h-[75vh] min-h-[580px] max-h-[800px]'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full space-y-5 font-sans text-slate-900 antialiased dark:text-slate-100">
      {/* ───────────── Studio bar ───────────── */}
      <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0F172A] text-white shadow-sm dark:bg-white dark:text-slate-950">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[22px] font-bold tracking-tight text-slate-950 sm:text-[24px] dark:text-white">
              {T('Feryal — 360° COO, CFO & Growth Strategist', 'المستشارة التنفيذية الشاملة فريال')}
            </h1>
            <p className="truncate text-[13px] font-medium text-slate-500 dark:text-slate-400">
              {T(
                'Full-journey surgical decisions & 1-click dispatch briefs grounded in Odoo 17 Analytic Cost Centers',
                'قرارات جراحية ومذكرات تكليف جاهزة مبنية على مراكز التكلفة التحليلية الحية في أودو 17',
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
          <button
            type="button"
            onClick={() => (playingMsgId ? stopPlayback() : lastFeryal && playFeryalSpeech(lastFeryal.text, lastFeryal.id, true))}
            className={`${pill} ${playingMsgId ? pillOn : pillIdle}`}
          >
            {playingMsgId ? <Square className="h-3.5 w-3.5" /> : <Headphones className="h-4 w-4" />}
            {playingMsgId ? T('Stop', 'إيقاف') : T('Listen', 'استماع')}
          </button>
          <audio ref={audioPlayerRef} controls preload="none" className="h-9 w-[170px] shrink-0 rounded-full" aria-label={T('Feryal voice player', 'مشغل صوت فريال')} />
          <button type="button" aria-pressed={!isVoiceMuted} onClick={() => setIsVoiceMuted((v) => !v)} className={`${pill} ${!isVoiceMuted ? pillOn : pillIdle}`}>
            {isVoiceMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            {T('Auto-Voice', 'الرد الصوتي التلقائي')}
          </button>
          <button type="button" aria-pressed={isHandsFree} onClick={() => setIsHandsFree((v) => !v)} className={`${pill} ${isHandsFree ? pillOn : pillIdle}`}>
            <Mic className="h-4 w-4" />
            {T('Hands-Free', 'محادثة صوتية مستمرة')}
          </button>
          <button type="button" aria-pressed={isExpanded} onClick={() => setIsExpanded((v) => !v)} className={`${pill} ${isExpanded ? pillOn : pillIdle} hidden lg:inline-flex`}>
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {isExpanded ? T('Show Proposals', 'إظهار المقترحات') : T('Full-Screen Chat', 'تكبير مساحة المحادثة')}
          </button>
          <button type="button" onClick={newDiscussion} className={`${pill} ${pillIdle}`}>
            <RotateCcw className="h-4 w-4" />
            {T('New Discussion', 'محادثة جديدة')}
          </button>
        </div>
      </header>

      {/* Live Field-Execution & Month-End Cash Runway Pulse Pills (1-Click Briefing) */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isCopilotThinking}
          onClick={() => handleSendQuery(isAr ? TOPICS[0].promptAr : TOPICS[0].promptEn)}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3.5 py-1.5 text-[12px] font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          <span>
            {isAr
              ? `${calPulse.badgeAr} · ${calPulse.weekdayAr} (${calPulse.kuwaitDateIso})`
              : `${calPulse.badgeEn} · ${calPulse.weekdayEn} (${calPulse.kuwaitDateIso})`}
          </span>
        </button>
        <button
          type="button"
          disabled={isCopilotThinking}
          onClick={() => handleSendQuery(isAr ? TOPICS[2].promptAr : TOPICS[2].promptEn)}
          className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3.5 py-1.5 text-[12px] font-bold text-sky-800 transition hover:bg-sky-100 disabled:opacity-50 dark:bg-sky-950/40 dark:text-sky-300"
        >
          <Landmark className="h-3.5 w-3.5 shrink-0" />
          <span>
            {isAr
              ? `التزامات نهاية الشهر: ${fmtKwd(CASH_RUNWAY_PULSE.totalCommitmentsKwd, true)} · تغطية ${CASH_RUNWAY_PULSE.coverageRatio} مرة · تسويات معلقة ${fmtKwd(CASH_RUNWAY_PULSE.openClearingKwd, true)}`
              : `Month-End Obligations: ${fmtKwd(CASH_RUNWAY_PULSE.totalCommitmentsKwd, false)} · ${CASH_RUNWAY_PULSE.coverageRatio}x covered · ${fmtKwd(CASH_RUNWAY_PULSE.openClearingKwd, false)} open clearing`}
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* ───────────── Conversation studio ───────────── */}
        <section className={`${isExpanded ? 'lg:col-span-12' : 'lg:col-span-8'} flex ${panelShell} flex-col overflow-hidden`}>
          <div ref={chatScrollRef} className="flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-7" aria-live="polite">
            {messages.map((m) => {
              const mine = m.sender === 'user'
              const briefText = !mine && m.id !== 'welcome' ? formatAsDispatchBrief(m.text) : ''
              return (
                <div key={m.id} className={`flex gap-3 ${mine ? 'justify-end' : 'justify-start'}`}>
                  {!mine && (
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0F172A] text-white dark:bg-white dark:text-slate-950">
                      <Sparkles className="h-4 w-4" />
                    </div>
                  )}
                  <div className={`min-w-0 ${mine ? 'max-w-[78%]' : 'max-w-[90%] flex-1'}`}>
                    <div
                      className={
                        mine
                          ? 'whitespace-pre-wrap rounded-2xl bg-[#0F172A] px-5 py-4 text-[15px] leading-[1.85] text-white'
                          : 'ae-studio-subcard px-6 py-5 text-[15px] leading-[1.85] text-slate-800 dark:text-slate-100'
                      }
                    >
                      {mine ? m.text : <FeryalStudioMessage text={m.text} />}
                    </div>
                    <div className={`mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400 ${mine ? 'justify-end' : ''}`}>
                      {m.time && <span>{m.time}</span>}
                      {!mine && (
                        <>
                          <button
                            type="button"
                            onClick={() => (playingMsgId === m.id ? stopPlayback() : playFeryalSpeech(m.text, m.id, true))}
                            className="inline-flex items-center gap-1 rounded-full bg-[#F6F7F9] px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-200/70 dark:bg-white/[0.06] dark:text-slate-300"
                          >
                            {playingMsgId === m.id ? <Square className="h-3 w-3" /> : <Volume2 className="h-3.5 w-3.5" />}
                            {playingMsgId === m.id ? T('Stop', 'إيقاف') : T('Listen', 'استماع للرد')}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyMessage(m.id, m.text)}
                            className="inline-flex items-center gap-1 rounded-full bg-[#F6F7F9] px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-200/70 dark:bg-white/[0.06] dark:text-slate-300"
                          >
                            {copiedMsgId === m.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                            {copiedMsgId === m.id ? T('Copied', 'تم النسخ') : T('Copy Reply', 'نسخ الرد')}
                          </button>
                          {m.id !== 'welcome' && (
                            <>
                              <button
                                type="button"
                                onClick={() => copyMessage(`${m.id}-brief`, briefText)}
                                className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950"
                              >
                                {copiedMsgId === `${m.id}-brief` ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <FileText className="h-3.5 w-3.5" />}
                                {copiedMsgId === `${m.id}-brief` ? T('Brief Copied', 'تم نسخ المذكرة') : T('Dispatch Brief', 'توليد مذكرة تنفيذ')}
                              </button>
                              <a
                                href={`https://wa.me/?text=${encodeURIComponent(briefText)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 font-semibold text-white hover:bg-emerald-500"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                {T('WhatsApp Owner', 'إرسال عبر واتساب')}
                              </a>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {messages.length <= 1 && !isCopilotThinking && (
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                {TOPICS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSendQuery(isAr ? t.promptAr : t.promptEn)}
                    className="ae-studio-subcard group p-4 text-start transition-all hover:-translate-y-0.5 hover:ring-1 hover:ring-slate-900/15 active:scale-[0.99] dark:hover:ring-white/20"
                  >
                    <span className="inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {isAr ? t.tagAr : t.tagEn}
                    </span>
                    <div className="mt-2 text-[14px] font-bold text-slate-950 dark:text-white">{isAr ? t.labelAr : t.labelEn}</div>
                    <p className="mt-1 line-clamp-3 text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">{isAr ? t.promptAr : t.promptEn}</p>
                  </button>
                ))}
              </div>
            )}
            {isCopilotThinking && (
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0F172A] text-white">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div className="ae-studio-subcard px-5 py-3.5 text-[14.5px] font-medium text-slate-500">
                  {T('Feryal is cross-checking Odoo 17 cost centers…', 'فريال تفحص مراكز تكلفة أودو 17 وتُعدّ القرار…')}
                </div>
              </div>
            )}
          </div>

          {/* Input dock */}
          <div className="border-t border-slate-100 bg-white/95 px-4 pb-4 pt-3 sm:px-6 dark:border-white/[0.06] dark:bg-[#0F1626]/95">
            <div className={`mb-3 flex-wrap gap-2 ${messages.length <= 1 ? 'hidden' : 'flex'}`}>
              {TOPICS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={isCopilotThinking}
                  onClick={() => handleSendQuery(isAr ? t.promptAr : t.promptEn)}
                  className="rounded-full bg-[#F6F7F9] px-3.5 py-1.5 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-200/70 disabled:opacity-50 dark:bg-white/[0.06] dark:text-slate-200"
                >
                  {isAr ? t.labelAr : t.labelEn}
                </button>
              ))}
            </div>
            {(micToast || isListening || isTranscribing) && (
              <div className={`mb-2 text-[13px] font-medium ${micToast ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-400'}`}>
                {micToast ?? (isTranscribing ? T('Transcribing your voice…', 'جارٍ تحويل صوتك إلى نص…') : T('Listening… speak now', 'أستمع إليك… تفضل بالحديث'))}
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
                placeholder={T('Ask Feryal about any branch, brand, dish, cost center or claim…', 'اسأل فريال عن أي فرع أو علامة أو طبق أو مركز تكلفة أو تسوية…')}
                className="min-h-[52px] flex-1 resize-none rounded-2xl bg-[#F6F7F9] px-4 py-3.5 text-[15px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15 dark:bg-white/[0.06] dark:text-white"
              />
              <button
                type="button"
                onClick={toggleListening}
                aria-pressed={isListening}
                aria-label={isListening ? T('Stop microphone', 'إيقاف المايكروفون') : T('Speak to Feryal', 'التحدث إلى فريال')}
                className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl transition-all active:scale-95 ${
                  isListening
                    ? 'animate-pulse bg-rose-600 text-white'
                    : 'bg-[#F6F7F9] text-slate-700 hover:bg-slate-200/70 dark:bg-white/[0.06] dark:text-slate-100'
                }`}
              >
                {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={() => handleSendQuery()}
                disabled={isCopilotThinking || !inputText.trim()}
                className="inline-flex h-[52px] shrink-0 items-center gap-2 rounded-2xl bg-[#0F172A] px-5 text-[14.5px] font-bold text-white shadow-sm transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-40 dark:bg-white dark:text-slate-950"
              >
                <Send className={`h-4 w-4 ${isAr ? 'rotate-180' : ''}`} />
                {T('Send', 'إرسال')}
              </button>
            </div>
          </div>
        </section>

        {/* ───────────── Verified proposals ───────────── */}
        {!isExpanded && (
          <aside className={`lg:col-span-4 ${panelShell} space-y-4 overflow-y-auto p-6`}>
            <div>
              <h2 className="text-[15px] font-bold text-slate-950 dark:text-white">{T('Best Surgical Play per Journey Stage', 'أفضل قرار جراحي في كل مرحلة من الرحلة')}</h2>
              <p className="mt-1 text-[12.5px] text-slate-500 dark:text-slate-400">
                {T(`Grounded in Odoo 17 Analytic Cost Centers · ${LEDGER.periodLabelEn}`, `مبني على مراكز التكلفة التحليلية في أودو 17 · ${LEDGER.periodLabelAr}`)}
              </p>
            </div>
            {FERYAL_PROPOSALS.map((p) => (
              <article key={p.id} className="ae-studio-subcard space-y-3 p-4">
                <h3 className="text-[14px] font-bold text-slate-950 dark:text-white">{isAr ? p.titleAr : p.titleEn}</h3>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{T('Practical Solution', 'المقترح العملي')}</div>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">{isAr ? p.solutionAr : p.solutionEn}</p>
                </div>
                <div className="rounded-xl bg-emerald-50/75 p-3 dark:bg-emerald-950/30">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">{T('Expected Monthly Gain', 'العائد الشهري المتوقع')}</span>
                    <span dir="ltr" className="whitespace-nowrap text-[12px] font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
                      {p.monthlyKwd > 0 ? (isAr ? `+${fmtKwd(p.monthlyKwd, true)}/شهر` : `+${fmtKwd(p.monthlyKwd, false)}/mo`) : T('Control', 'ضبط ورقابة')}
                    </span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-emerald-950 dark:text-emerald-50">{isAr ? p.outcomeAr : p.outcomeEn}</p>
                </div>
                <button
                  type="button"
                  disabled={isCopilotThinking}
                  onClick={() => handleSendQuery(isAr ? p.promptAr : p.promptEn)}
                  className="w-full rounded-full bg-[#0F172A] px-4 py-2 text-[12.5px] font-bold text-white transition-all hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 dark:bg-white dark:text-slate-950"
                >
                  {T('Discuss & Generate Brief', 'مناقشة وتوليد مذكرة تنفيذ')}
                </button>
              </article>
            ))}
          </aside>
        )}
      </div>
    </div>
  )
}
