import { NextRequest, NextResponse } from 'next/server'
import { getOpenAIApiKey } from '@/lib/openai-key'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Clean & sanitize text for natural speech synthesis
 * Removes strange symbols, emojis, markdown, and expands abbreviations.
 */
function sanitizeTextForSpeech(rawText: string, lang: 'ar' | 'en'): string {
  if (!rawText) return ''
  let text = rawText

  // Remove URLs
  text = text.replace(/https?:\/\/\S+/gi, '')

  // Remove markdown formatting characters
  text = text.replace(/[*#`_~]/g, ' ')

  // Remove bullets, dashes, bars, brackets, special math symbols
  text = text.replace(/[•–—+\/\\|<>\[\]{}()=^:]/g, ' ')

  // Remove all emoji characters
  text = text.replace(
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu,
    ' '
  )

  if (lang === 'ar') {
    // Replace abbreviations with natural spoken Arabic
    text = text.replace(/\bKWD\b/gi, ' دينار كويتي ')
    text = text.replace(/د\.ك/g, ' دينار كويتي ')
    text = text.replace(/%/g, ' بالمئة ')
    text = text.replace(/\bCOGS\b/gi, ' تكلفة الأغذية والمواد ')
    text = text.replace(/\bAOV\b/gi, ' متوسط قيمة السلة ')
    text = text.replace(/\bTgo\b/gi, ' طلبات جو ')
    text = text.replace(/\bTMP\b/gi, ' سوق طلبات ')
    text = text.replace(/\bTalabat\b/gi, ' طلبات ')
    text = text.replace(/\bKeeta\b/gi, ' كيتا ')
    text = text.replace(/\bDeliveroo\b/gi, ' دليفرو ')
    text = text.replace(/\bOdoo\b/gi, ' أودو ')

    // Natural decimal numbers
    text = text.replace(/(\d+)[,.](\d{3})\s*دينار كويتي/g, '$1 دينار و $2 فلس')
    text = text.replace(/(\d+)[,.](\d+)/g, '$1 فاصلة $2')
  } else {
    // English substitutions
    text = text.replace(/\bKWD\b/gi, ' Kuwaiti Dinars ')
    text = text.replace(/د\.ك/g, ' Kuwaiti Dinars ')
    text = text.replace(/%/g, ' percent ')
    text = text.replace(/\bCOGS\b/gi, ' Cost of Goods Sold ')
    text = text.replace(/\bAOV\b/gi, ' Average Order Value ')
    text = text.replace(/\bTgo\b/gi, ' Talabat Go ')
    text = text.replace(/\bTMP\b/gi, ' Talabat Marketplace ')
  }

  // Collapse multiple spaces into one
  text = text.replace(/\s+/g, ' ').trim()
  return text
}

/**
 * Fallback to Google Translate TTS audio buffer
 */
async function fetchGoogleTTSAudio(text: string, lang: 'ar' | 'en'): Promise<Buffer | null> {
  try {
    const shortText = text.slice(0, 200)
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${
      lang === 'en' ? 'en' : 'ar'
    }&q=${encodeURIComponent(shortText)}`

    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://translate.google.com/',
      },
    })

    if (res.ok) {
      const arr = await res.arrayBuffer()
      return Buffer.from(arr)
    }
  } catch (err) {
    console.error('Google TTS fallback error:', err)
  }
  return null
}

/**
 * Handle audio synthesis using OpenAI Nova with Google TTS fallback
 */
async function generateSpeechAudio(
  text: string,
  lang: 'ar' | 'en'
): Promise<{ buffer: Buffer; engine: string } | null> {
  const cleanText = sanitizeTextForSpeech(text, lang)
  if (!cleanText) return null

  const apiKey = getOpenAIApiKey()

  // 1. Try OpenAI Nova TTS
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
        const arr = await openAiRes.arrayBuffer()
        return { buffer: Buffer.from(arr), engine: 'openai-nova' }
      } else {
        console.warn('OpenAI Nova TTS returned non-200:', openAiRes.status)
      }
    } catch (err) {
      console.error('OpenAI Nova TTS exception, trying fallback:', err)
    }
  }

  // 2. Fallback to Google TTS
  const fallbackBuf = await fetchGoogleTTSAudio(cleanText, lang)
  if (fallbackBuf) {
    return { buffer: fallbackBuf, engine: 'google-tts-fallback' }
  }

  return null
}

/**
 * GET Handler - Supports native streaming <audio src="/api/feryal/tts?lang=ar&text=...">
 */
export async function GET(req: NextRequest) {
  try {
    const text = req.nextUrl.searchParams.get('text') || ''
    const lang = (req.nextUrl.searchParams.get('lang') === 'en' ? 'en' : 'ar') as 'ar' | 'en'
    const format = req.nextUrl.searchParams.get('format') || ''

    if (!text.trim()) {
      return new Response('Text parameter is required', { status: 400 })
    }

    const speech = await generateSpeechAudio(text, lang)
    if (!speech) {
      return new Response('Failed to generate audio', { status: 502 })
    }

    if (format === 'json') {
      const b64 = speech.buffer.toString('base64')
      return NextResponse.json({
        ok: true,
        engine: speech.engine,
        audioDataUrl: `data:audio/mpeg;base64,${b64}`,
      })
    }

    return new Response(new Uint8Array(speech.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': speech.buffer.length.toString(),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Accept-Ranges': 'bytes',
        'X-TTS-Engine': speech.engine,
      },
    })
  } catch (error: any) {
    console.error('TTS GET error:', error)
    return new Response(error?.message || 'Server error', { status: 500 })
  }
}

/**
 * POST Handler - Supports JSON and raw streaming calls
 */
export async function POST(req: NextRequest) {
  try {
    let text = ''
    let lang: 'ar' | 'en' = 'ar'
    let returnJson = true

    try {
      const body = await req.json()
      text = body.text || ''
      lang = body.lang === 'en' ? 'en' : 'ar'
      if (body.format === 'binary') returnJson = false
    } catch {
      text = req.nextUrl.searchParams.get('text') || ''
      lang = req.nextUrl.searchParams.get('lang') === 'en' ? 'en' : 'ar'
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ ok: false, error: 'Text is required' }, { status: 400 })
    }

    const speech = await generateSpeechAudio(text, lang)
    if (!speech) {
      return NextResponse.json({ ok: false, error: 'TTS generation failed' }, { status: 502 })
    }

    if (!returnJson) {
      return new Response(new Uint8Array(speech.buffer), {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': speech.buffer.length.toString(),
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-TTS-Engine': speech.engine,
        },
      })
    }

    const b64 = speech.buffer.toString('base64')
    return NextResponse.json({
      ok: true,
      engine: speech.engine,
      audioDataUrl: `data:audio/mpeg;base64,${b64}`,
      contentType: 'audio/mpeg',
    })
  } catch (error: any) {
    console.error('TTS POST error:', error)
    return NextResponse.json({ ok: false, error: error?.message || 'Server error' }, { status: 500 })
  }
}
