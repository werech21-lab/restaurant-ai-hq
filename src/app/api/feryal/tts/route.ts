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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { text, lang = 'ar' } = body

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ ok: false, error: 'Text is required' }, { status: 400 })
    }

    const ttsLang = lang === 'en' ? 'en' : 'ar'
    const cleanText = sanitizeTextForSpeech(text, ttsLang)

    if (!cleanText) {
      return NextResponse.json({ ok: false, error: 'Text is empty after sanitization' }, { status: 400 })
    }

    const apiKey = getOpenAIApiKey()

    // 1. Try OpenAI Nova TTS (Primary High-Fidelity Engine)
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
          const arrayBuf = await openAiRes.arrayBuffer()
          const b64 = Buffer.from(arrayBuf).toString('base64')
          const audioDataUrl = `data:audio/mpeg;base64,${b64}`

          return NextResponse.json({
            ok: true,
            engine: 'openai-nova',
            audioDataUrl,
            contentType: 'audio/mpeg',
          })
        } else {
          console.warn('OpenAI Nova TTS returned status:', openAiRes.status)
        }
      } catch (openAiErr) {
        console.error('OpenAI Nova TTS error, falling back:', openAiErr)
      }
    }

    // 2. Graceful Fallback: Google Translate TTS Stream
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${ttsLang}&q=${encodeURIComponent(
      cleanText.slice(0, 200)
    )}`

    const fallbackRes = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://translate.google.com/',
      },
    })

    if (fallbackRes.ok) {
      const fallbackBuf = await fallbackRes.arrayBuffer()
      const b64 = Buffer.from(fallbackBuf).toString('base64')
      return NextResponse.json({
        ok: true,
        engine: 'google-tts-fallback',
        audioDataUrl: `data:audio/mpeg;base64,${b64}`,
      })
    }

    return NextResponse.json({ ok: false, error: 'TTS generation failed' }, { status: 502 })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Server error' }, { status: 500 })
  }
}
