import { NextRequest, NextResponse } from 'next/server'

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
  text = text.replace(/[•–—+\/\\|<>\[\]{}()=^]/g, ' ')

  // Remove all emoji characters
  text = text.replace(
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu,
    ' '
  )

  if (lang === 'ar') {
    // Replace abbreviations with natural Arabic words
    text = text.replace(/\bKWD\b/gi, ' دينار كويتي ')
    text = text.replace(/د\.ك/g, ' دينار كويتي ')
    text = text.replace(/%/g, ' بالمئة ')
    text = text.replace(/\bCOGS\b/gi, ' تكلفة الأغذية والمواد ')
    text = text.replace(/\bAOV\b/gi, ' متوسط قيمة السلة ')
    text = text.replace(/\bTgo\b/gi, ' طلبات جو ')
    text = text.replace(/\bTMP\b/gi, ' طلبات ماركتبليس ')
    text = text.replace(/\bTalabat\b/gi, ' طلبات ')
    text = text.replace(/\bKeeta\b/gi, ' كيتا ')
    text = text.replace(/\bDeliveroo\b/gi, ' دليفرو ')
    text = text.replace(/\bOdoo\b/gi, ' أودو ')

    // Replace decimal commas/dots in numbers for natural reading
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
 * Split text into small chunks suitable for Google TTS API (max 180 chars per chunk)
 */
function chunkText(text: string, maxLen = 170): string[] {
  const sentences = text.split(/(?<=[.?!،؛\n])\s+/)
  const chunks: string[] = []
  let current = ''

  for (const sentence of sentences) {
    if ((current + ' ' + sentence).trim().length <= maxLen) {
      current = (current + ' ' + sentence).trim()
    } else {
      if (current) chunks.push(current)
      if (sentence.length > maxLen) {
        // Break long sentence by words
        const words = sentence.split(/\s+/)
        let wordChunk = ''
        for (const w of words) {
          if ((wordChunk + ' ' + w).trim().length <= maxLen) {
            wordChunk = (wordChunk + ' ' + w).trim()
          } else {
            if (wordChunk) chunks.push(wordChunk)
            wordChunk = w
          }
        }
        current = wordChunk
      } else {
        current = sentence
      }
    }
  }
  if (current) chunks.push(current)
  return chunks.filter((c) => c.trim().length > 0)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { text, lang = 'ar' } = body

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const ttsLang = lang === 'en' ? 'en' : 'ar'
    const cleanText = sanitizeTextForSpeech(text, ttsLang)

    if (!cleanText) {
      return NextResponse.json({ error: 'Text became empty after sanitization' }, { status: 400 })
    }

    const chunks = chunkText(cleanText)
    const audioBuffers: Buffer[] = []

    for (const chunk of chunks) {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${ttsLang}&q=${encodeURIComponent(
        chunk
      )}`

      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'https://translate.google.com/',
        },
      })

      if (res.ok) {
        const arrayBuf = await res.arrayBuffer()
        audioBuffers.push(Buffer.from(arrayBuf))
      }
    }

    if (audioBuffers.length === 0) {
      return NextResponse.json({ error: 'Failed to generate audio stream' }, { status: 502 })
    }

    const finalBuffer = Buffer.concat(audioBuffers)

    return new NextResponse(finalBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': finalBuffer.length.toString(),
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const text = searchParams.get('text')
  const lang = (searchParams.get('lang') || 'ar') as 'ar' | 'en'

  if (!text) {
    return NextResponse.json({ error: 'Text query param is required' }, { status: 400 })
  }

  // Reuse POST logic
  return POST(
    new NextRequest(req.url, {
      method: 'POST',
      body: JSON.stringify({ text, lang }),
      headers: { 'Content-Type': 'application/json' },
    })
  )
}
