'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  Copy,
  Headphones,
  Loader2,
  Maximize2,
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
import { LEDGER } from '@/lib/aether/ledger'
import { FeryalStudioMessage, feryalPlainText } from '@/components/aether/FeryalStudioMessage'

// ==============================================================================
// Conversation copy (strict Arabic / English isolation)
// ==============================================================================
const welcomeText = (lang: 'ar' | 'en') =>
  lang === 'ar'
    ? `أهلاً بك، أنا فريال مستشارتك للحلول والمقترحات التنفيذية في فنتشر فودز. لنناقش معاً حلولاً عملية لنمو المبيعات وتحسين ربحية قنوات التوصيل وخفض التكاليف عبر مواقعنا الـ ${LEDGER.branches} وعلاماتنا المسجلة في أودو.`
    : `Welcome, I'm Feryal, your executive solutions and proposals advisor at Venture Foods. Let's discuss practical ways to grow sales, improve delivery channel profitability and reduce costs across our ${LEDGER.branches} restaurant locations and brands registered in Odoo.`

const TOPICS: { id: string; labelAr: string; labelEn: string; promptAr: string; promptEn: string }[] = [
  {
    id: 'channels',
    labelAr: 'ربحية قنوات التوصيل',
    labelEn: 'Channel profitability',
    promptAr: 'كيف نحسن ربحية قنوات التوصيل لدينا بناءً على بيانات أودو الفعلية؟',
    promptEn: 'How do we improve the profitability of our delivery channels based on actual Odoo data?',
  },
  {
    id: 'menu',
    labelAr: 'تحسين المنيو',
    labelEn: 'Menu optimization',
    promptAr: 'ما أفضل خطة لتركيز المنيو على الأصناف الأعلى مبيعاً ومراجعة الأصناف بطيئة الحركة؟',
    promptEn: 'What is the best plan to focus the menu on top sellers and review slow-moving items?',
  },
  {
    id: 'growth',
    labelAr: 'نمو المواقع',
    labelEn: 'Location growth',
    promptAr: 'أي موقع من مواقعنا يحتاج خطة نمو أولاً، وكيف نرفع هامشه التشغيلي؟',
    promptEn: 'Which of our locations needs a growth plan first, and how do we lift its operating margin?',
  },
  {
    id: 'cost',
    labelAr: 'ضبط التكاليف',
    labelEn: 'Cost control',
    promptAr: 'كيف نخفض تكلفة الأغذية في المواقع التي تتجاوز متوسط المجموعة؟',
    promptEn: 'How do we reduce food cost at the locations running above the group average?',
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

  const pill =
    'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold ring-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500'
  const pillIdle = 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800'
  const pillOn = 'bg-emerald-50 text-emerald-800 ring-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200'
  const panelShell = 'h-[calc(100vh-165px)] min-h-[660px] rounded-[26px] bg-white shadow-[0_8px_32px_rgba(10,30,50,0.05)] ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto w-full max-w-[1440px] space-y-5 px-5 py-5 font-sans text-slate-900 antialiased sm:px-8 dark:text-slate-100">
      {/* ───────────── Studio bar ───────────── */}
      <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0F172A] text-white shadow-sm ring-4 ring-emerald-500/15">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-extrabold tracking-tight text-slate-950 sm:text-xl dark:text-white">
              {T('Feryal — Executive Growth Advisor', 'محادثة المستشارة فريال')}
            </h1>
            <p className="truncate text-[13px] font-medium text-slate-500 sm:text-sm dark:text-slate-400">
              {T('Dedicated executive dialogue for real operational solutions and projected outcomes', 'مساحة حوار مخصصة لمناقشة المقترحات العملية والحلول الواقعية لتطوير الأداء')}
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* ───────────── Conversation studio ───────────── */}
        <section className={`${isExpanded ? 'lg:col-span-12' : 'lg:col-span-8'} flex ${panelShell} flex-col overflow-hidden`}>
          <div ref={chatScrollRef} className="flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-8" aria-live="polite">
            {messages.map((m) => {
              const mine = m.sender === 'user'
              return (
                <div key={m.id} className={`flex gap-3 ${mine ? 'justify-end' : 'justify-start'}`}>
                  {!mine && (
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0F172A] text-white">
                      <Sparkles className="h-4 w-4" />
                    </div>
                  )}
                  <div className={`min-w-0 ${mine ? 'max-w-[78%]' : 'max-w-[88%] flex-1'}`}>
                    <div
                      className={
                        mine
                          ? 'whitespace-pre-wrap rounded-2xl bg-[#0F172A] px-6 py-4 text-[15px] leading-[1.85] text-white sm:text-[16px]'
                          : 'rounded-2xl bg-slate-50 px-6 py-5 text-[15px] leading-[1.85] text-slate-800 ring-1 ring-slate-200/70 sm:text-[16px] dark:bg-slate-800/60 dark:text-slate-100 dark:ring-slate-700/60'
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
                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800"
                          >
                            {playingMsgId === m.id ? <Square className="h-3 w-3" /> : <Volume2 className="h-3.5 w-3.5" />}
                            {playingMsgId === m.id ? T('Stop', 'إيقاف') : T('Listen', 'استماع للرد')}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyMessage(m.id, m.text)}
                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800"
                          >
                            {copiedMsgId === m.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                            {copiedMsgId === m.id ? T('Copied', 'تم النسخ') : T('Copy Proposal', 'نسخ المقترح')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {isCopilotThinking && (
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0F172A] text-white">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div className="rounded-2xl bg-slate-50 px-5 py-3.5 text-[15px] text-slate-500 ring-1 ring-slate-200/70 dark:bg-slate-800/60 dark:ring-slate-700/60">
                  {T('Feryal is preparing the proposal…', 'فريال تُعدّ المقترح…')}
                </div>
              </div>
            )}
          </div>

          {/* Input dock */}
          <div className="border-t border-slate-100 bg-white/90 px-4 pb-4 pt-3 sm:px-6 dark:border-slate-800 dark:bg-slate-900/90">
            <div className="mb-3 flex flex-wrap gap-2">
              {TOPICS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={isCopilotThinking}
                  onClick={() => handleSendQuery(isAr ? t.promptAr : t.promptEn)}
                  className="rounded-full bg-slate-100 px-3.5 py-1.5 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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
                placeholder={T('Ask Feryal about a practical solution…', 'اسأل فريال عن حل عملي أو مقترح…')}
                className="min-h-[52px] flex-1 resize-none rounded-2xl bg-slate-50 px-4 py-3.5 text-[15px] leading-relaxed text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 dark:bg-slate-800 dark:text-white dark:ring-slate-700"
              />
              <button
                type="button"
                onClick={toggleListening}
                aria-pressed={isListening}
                aria-label={isListening ? T('Stop microphone', 'إيقاف المايكروفون') : T('Speak to Feryal', 'التحدث إلى فريال')}
                className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl ring-1 transition-all active:scale-95 ${
                  isListening ? 'animate-pulse bg-rose-600 text-white ring-rose-600' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700'
                }`}
              >
                {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={() => handleSendQuery()}
                disabled={isCopilotThinking || !inputText.trim()}
                className="inline-flex h-[52px] shrink-0 items-center gap-2 rounded-2xl bg-[#0F172A] px-5 text-[15px] font-bold text-white shadow-sm transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-40"
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
              <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">{T('Verified Proposals & Expected Outcomes', 'المقترحات الحقيقية والنتائج المتوقعة')}</h2>
              <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
                {T(`Best finding per domain from Odoo sales, accounting, purchasing and POS sessions · ${LEDGER.periodLabelEn}`, `أفضل نتيجة لكل محور من مبيعات أودو ومحاسبته ومشترياته وجلسات نقاط البيع · ${LEDGER.periodLabelAr}`)}
              </p>
            </div>
            {FERYAL_PROPOSALS.map((p) => (
              <article key={p.id} className="space-y-3 rounded-2xl p-4 ring-1 ring-slate-200/80 dark:ring-slate-700/70">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isAr ? p.titleAr : p.titleEn}</h3>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{T('Practical Solution', 'المقترح العملي')}</div>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-slate-700 dark:text-slate-300">{isAr ? p.solutionAr : p.solutionEn}</p>
                </div>
                <div className="rounded-xl bg-emerald-50/70 p-3 ring-1 ring-emerald-500/20 dark:bg-emerald-950/30">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">{T('Expected Result If Successful', 'النتيجة المتوقعة عند النجاح')}</span>
                    <span className="whitespace-nowrap text-[12px] font-extrabold text-emerald-700 dark:text-emerald-300">
                      {p.monthlyKwd > 0 ? (isAr ? `${fmtKwd(p.monthlyKwd, true)} شهرياً` : `+${fmtKwd(p.monthlyKwd, false)} / month`) : T('Control', 'ضبط ورقابة')}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-emerald-950 dark:text-emerald-50">{isAr ? p.outcomeAr : p.outcomeEn}</p>
                </div>
                <button
                  type="button"
                  disabled={isCopilotThinking}
                  onClick={() => handleSendQuery(isAr ? p.promptAr : p.promptEn)}
                  className="w-full rounded-full bg-slate-100 px-4 py-2.5 text-[13px] font-bold text-slate-800 transition-all hover:bg-slate-200 active:scale-[0.98] disabled:opacity-50 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  {T('Discuss Solution with Feryal', 'مناقشة تفاصيل الحل مع فريال')}
                </button>
              </article>
            ))}
          </aside>
        )}
      </div>
    </div>
  )
}
