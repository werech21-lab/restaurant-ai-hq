import { NextRequest, NextResponse } from 'next/server'
import { getOpenAIApiKey } from '@/lib/openai-key'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as Blob | null
    const lang = (formData.get('lang') as string) || 'ar'

    if (!file) {
      return NextResponse.json({ ok: false, error: 'Audio file is required' }, { status: 400 })
    }

    const apiKey = getOpenAIApiKey()
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'OpenAI API key unavailable' }, { status: 500 })
    }

    const whisperPrompt =
      lang === 'en'
        ? "Feryal, Venture Foods, Odoo ERP, Keeta, Talabat, Tgo, TMP, China Garden, Frank's, Tahina, KWD"
        : 'فريال، فنتشر فودز، أودو، كيتا، طلبات، شاينا جاردن، فرانكس، طحينة، دينار كويتي، السالمية، الكوت'

    const openAiFormData = new FormData()
    // Ensure filename and content type
    const filename = (file as any).name || 'recording.webm'
    openAiFormData.append('file', file, filename)
    openAiFormData.append('model', 'whisper-1')
    openAiFormData.append('language', lang === 'en' ? 'en' : 'ar')
    openAiFormData.append('prompt', whisperPrompt)

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: openAiFormData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Whisper transcription failed:', response.status, errorText)
      return NextResponse.json(
        { ok: false, error: `Whisper API error (${response.status})` },
        { status: response.status }
      )
    }

    const result = await response.json()
    return NextResponse.json({
      ok: true,
      transcript: result.text || '',
    })
  } catch (error: any) {
    console.error('Error in Whisper STT route:', error)
    return NextResponse.json({ ok: false, error: error?.message || 'Server error' }, { status: 500 })
  }
}
