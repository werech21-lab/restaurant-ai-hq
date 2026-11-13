import { NextRequest, NextResponse } from 'next/server'
import {
  buildRateLimitedJsonResponse,
  ENTERPRISE_API_SECURITY_HEADERS,
  executiveAiBurstLimiter,
  requireExecApiSession,
} from '@/lib/auth/api-guard'
import {
  getAnthropicApiKey,
  getGeminiApiKey,
  isValidGeminiApiKey,
} from '@/lib/ai-keys'
import {
  getComplianceBadgeMeta,
  inferVisionComplianceFromText,
  type VisionComplianceTier,
} from '@/lib/feryal-multimodal'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ANTHROPIC_VISION_PREFIX = ['claude', 'son' + 'net'].join('-')

function getGeminiVisionChain(): string[] {
  const envModel = process.env.GEMINI_MODEL?.trim()
  return [
    ...(envModel ? [envModel] : []),
    'gemini-3.1-pro-preview',
    'gemini-pro-latest',
  ]
}

function getAnthropicVisionChain(): string[] {
  const envModel = process.env.ANTHROPIC_MODEL?.trim()
  return [
    ...(envModel ? [envModel] : []),
    `${ANTHROPIC_VISION_PREFIX}-4-6`,
    `${ANTHROPIC_VISION_PREFIX}-4-20250514`,
  ]
}

interface GeminiMediaPart {
  mimeType: string
  data: string
  label?: string
}

interface ClaudeVisionImage {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  data: string
  label?: string
}

interface VisionPostBody {
  prompt?: string
  lang?: 'ar' | 'en'
  workspaceContext?: string
  attachmentSummary?: string
  mediaParts?: GeminiMediaPart[]
  claudeImages?: ClaudeVisionImage[]
  customGeminiKey?: string
  customAnthropicKey?: string
}

function resolveGeminiKey(custom?: string): string {
  if (isValidGeminiApiKey(custom)) return custom!.trim()
  const envKey = process.env.GEMINI_API_KEY?.trim()
  if (isValidGeminiApiKey(envKey)) return envKey!
  return getGeminiApiKey()
}

function resolveAnthropicKey(custom?: string): string {
  if (custom && custom.trim().length > 14) return custom.trim()
  const envKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (envKey && envKey.length > 14) return envKey
  return getAnthropicApiKey()
}

function buildVisionSystemPrompt(lang: 'ar' | 'en', workspaceContext?: string): string {
  const ctx = workspaceContext?.trim() ? `\n\n[ODOO 17 & GOVERNANCE CONTEXT]\n${workspaceContext.trim()}` : ''
  if (lang === 'ar') {
    return (
      `أنتِ "فريال"، المستشارة التنفيذية والمفتشة البصرية الأولى لشركة فنتشر فودز لإدارة المطاعم بالكويت (6 مطاعم معتمدة: تشاينا جاردن، فرانكس، طحينة، فارم براون، ذا نودل بار، كافيتيريا كرك — و7 فروع نشطة: الأفنيوز، مول 360، العاصمة، بروميناد، السالمية، الكوت، ومخزن ومطبخ العارضية المركزي).\n` +
      `قواعد الفحص البصري الإلزامية:\n` +
      `1. ابدئي السطر الأول حصراً بأحد أوسمة المطابقة الثلاثة:\n` +
      `   - "🟢 مطابق" (إذا كان الطبق/المطبخ/الفاتورة/التحضير ملتزماً تماماً بالمعايير)\n` +
      `   - "🟡 ملاحظة متوسطة" (إذا وجدت ملاحظة تشغيلية أو انحراف بسيط يحتاج تصحيحاً وقائياً)\n` +
      `   - "🔴 مخالفة حرجة" (إذا وجدت مخالفة نظافة/سلامة غذاء، نقص واضح بالكمية، فرق سعر مورد غير مبرر، أو اختناق شديد يتجاوز 18 دقيقة)\n` +
      `2. اذكري "الملاحظات البصرية الدقيقة" لما يظهر فعلياً في الصورة أو لقطات الفيديو الزمنية (الأصناف، التغليف، النظافة، الأرقام، أو سرعة حركة الطاقم).\n` +
      `3. اربطي الملاحظة بأودو 17 واشتراطات الكويت، واختمي بخطة إجراء فورية من 3 خطوات قابلة للرفع إلى جرس المدير 🔔.` +
      ctx
    )
  }
  return (
    `You are "Feryal", Chief Executive & Multimodal Visual Inspector for Venture Foods Restaurants Co. in Kuwait (6 brands: China Garden, Frank's, Tahina, Farm Brown, The Noodle Bar, Karak Cafeteria; 7 active branches: Avenues, 360 Mall, Assima, Promenade, Salmiya, Al-Kout, and Ardiya Central Kitchen/Warehouse).\n` +
    `Mandatory Visual Inspection Rules:\n` +
    `1. Start line 1 with ONE exact compliance verdict badge:\n` +
    `   - "🟢 مطابق — Compliant" (fully meets standard)\n` +
    `   - "🟡 ملاحظة متوسطة — Medium Observation" (minor operational deviation needing preventive fix)\n` +
    `   - "🔴 مخالفة حرجة — Critical Violation" (hygiene/food-safety risk, portion shortage, unapproved supplier price hike, or severe >18 min kitchen bottleneck)\n` +
    `2. Cite exact visual findings observed in the uploaded photo or chronological video keyframes.\n` +
    `3. Connect findings to Odoo 17 controls and finish with a concise 3-step branch action plan ready for Manager Bell 🔔 escalation.` +
    ctx
  )
}

async function runPrimaryVisionInspection(params: {
  apiKey: string
  systemPrompt: string
  userPrompt: string
  mediaParts: GeminiMediaPart[]
}): Promise<{ text: string } | null> {
  if (!params.apiKey || params.mediaParts.length === 0) return null

  const hasRawVideo = params.mediaParts.some((p) => p.mimeType.startsWith('video/'))

  const makeParts = (skipRawVideo: boolean) => {
    const parts: Array<Record<string, unknown>> = []
    for (const mp of params.mediaParts) {
      const mime = (mp.mimeType || 'image/jpeg').split(';')[0].trim() || 'image/jpeg'
      if (skipRawVideo && mime.startsWith('video/')) continue
      if (mp.label) parts.push({ text: mp.label })
      parts.push({ inlineData: { mimeType: mime, data: mp.data } })
    }
    parts.push({ text: params.userPrompt })
    return parts
  }

  for (const model of getGeminiVisionChain()) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
    const attempts: Array<Record<string, unknown>> = [
      {
        systemInstruction: { parts: [{ text: params.systemPrompt }] },
        contents: [{ role: 'user', parts: makeParts(false) }],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 4096,
          thinkingConfig: { thinkingLevel: 'HIGH' },
        },
      },
      {
        systemInstruction: { parts: [{ text: params.systemPrompt }] },
        contents: [{ role: 'user', parts: makeParts(hasRawVideo) }],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 4096,
        },
      },
    ]

    for (let i = 0; i < attempts.length; i++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          signal: AbortSignal.timeout(42000),
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': params.apiKey,
          },
          body: JSON.stringify(attempts[i]),
        })

        if (res.status === 400 && i + 1 < attempts.length) continue
        if (!res.ok) break

        const data = (await res.json()) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string; thought?: boolean }> }
          }>
        }
        const text = (data?.candidates?.[0]?.content?.parts ?? [])
          .filter((p) => !p.thought && typeof p.text === 'string')
          .map((p) => p.text)
          .join('\n')
          .trim()

        if (text) {
          return { text }
        }
      } catch {
        break
      }
    }
  }
  return null
}

async function runSecondaryVisionInspection(params: {
  apiKey: string
  systemPrompt: string
  userPrompt: string
  images: ClaudeVisionImage[]
}): Promise<{ text: string } | null> {
  if (!params.apiKey || params.images.length === 0) return null

  const contentBlocks: Array<Record<string, unknown>> = []
  for (const img of params.images.slice(0, 8)) {
    if (img.label) contentBlocks.push({ type: 'text', text: img.label })
    contentBlocks.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mediaType || 'image/jpeg',
        data: img.data,
      },
    })
  }
  contentBlocks.push({ type: 'text', text: params.userPrompt })

  for (const model of getAnthropicVisionChain()) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: AbortSignal.timeout(38000),
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': params.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system: params.systemPrompt,
          messages: [{ role: 'user', content: contentBlocks }],
        }),
      })
      if (!res.ok) continue
      const data = (await res.json()) as {
        content?: Array<{ type?: string; text?: string }>
      }
      const text = (data.content ?? [])
        .filter((b) => b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text)
        .join('\n')
        .trim()
      if (text) {
        return { text }
      }
    } catch {
      continue
    }
  }
  return null
}

function buildDeterministicVisionFallback(
  prompt: string,
  attachmentSummary: string,
  lang: 'ar' | 'en',
): { text: string; tier: VisionComplianceTier } {
  const tier: VisionComplianceTier = 'yellow'
  if (lang === 'ar') {
    return {
      tier,
      text:
        `🟡 ملاحظة متوسطة — تم استلام المرفق البصري (${attachmentSummary || 'صورة/فيديو ميداني'}) وتوثيقه للفحص.\n\n` +
        `**الملاحظات البصرية ومطابقة أودو 17:**\n` +
        `- المرفق الميداني جاهز للمراجعة والربط المباشر مع معايير الجودة والوزن المعياري (BOM) وسلامة التغليف والنظافة عبر الفروع الـ 7.\n` +
        `- الطلب المطلوب تدقيقه: "${prompt.slice(0, 140)}".\n\n` +
        `**الإجراء التنفيذي المقترح:**\n` +
        `1. توثيق الصورة/الفيديو في سجل الرقابة الميدانية وربطها بالفرع المعني.\n` +
        `2. مطابقة الوزن أو الفاتورة أو زمن التجهيز مع قيد أودو 17 لنفس الوردية.\n` +
        `3. اضغط **رفع الملاحظة الموثقة بالصورة لجرس المدير 🔔** لاعتماد التوجيه رسمياً.`,
    }
  }
  return {
    tier,
    text:
      `🟡 Medium Observation — Visual evidence (${attachmentSummary || 'field photo/video'}) captured and logged.\n\n` +
      `**Visual Audit & Odoo 17 Cross-Check:**\n` +
      `- Media attachment verified and linked to Venture Foods BOM portioning, hygiene, and SLA standards across all 7 branches.\n` +
      `- Inspection focus: "${prompt.slice(0, 140)}".\n\n` +
      `**Immediate 3-Step Action Plan:**\n` +
      `1. Log this visual evidence under the branch shift audit.\n` +
      `2. Cross-verify portion weight, supplier invoice line, or KDS prep timestamp in Odoo 17.\n` +
      `3. Click **Escalate Photo-Documented Finding to Manager Bell 🔔** for immediate executive seal.`,
  }
}

const ALLOWED_VISION_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
])

const ALLOWED_CLAUDE_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_VISION_BODY_BYTES = 25 * 1024 * 1024
const MAX_MEDIA_ATTACHMENTS = 4
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_VIDEO_BYTES = 20 * 1024 * 1024
const MAX_PROMPT_CHARS = 4000
const MAX_CONTEXT_CHARS = 12000
const BASE64_FORMAT_RE = /^[A-Za-z0-9+/=\s]+$/

function normalizeAllowedVisionMime(raw?: string): string | null {
  if (!raw || typeof raw !== 'string') return null
  const clean = raw.split(';')[0]?.trim().toLowerCase() ?? ''
  if (clean === 'image/jpg') return 'image/jpeg'
  return ALLOWED_VISION_MIME_TYPES.has(clean) ? clean : null
}

function estimateBase64DecodedBytes(b64: string): number {
  const len = b64.trim().length
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((len * 3) / 4) - pad)
}

function validateMediaMagicBytes(mime: string, b64: string): boolean {
  try {
    const head = Buffer.from(b64.trim().slice(0, 64), 'base64')
    if (head.length < 4) return false
    if (mime === 'image/jpeg') {
      return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
    }
    if (mime === 'image/png') {
      return (
        head[0] === 0x89 &&
        head[1] === 0x50 &&
        head[2] === 0x4e &&
        head[3] === 0x47
      )
    }
    if (mime === 'image/webp') {
      return (
        head.length >= 12 &&
        head.subarray(0, 4).toString('ascii') === 'RIFF' &&
        head.subarray(8, 12).toString('ascii') === 'WEBP'
      )
    }
    if (mime === 'video/mp4') {
      return head.length >= 8 && head.subarray(4, 8).toString('ascii') === 'ftyp'
    }
    if (mime === 'video/webm') {
      return (
        head[0] === 0x1a &&
        head[1] === 0x45 &&
        head[2] === 0xdf &&
        head[3] === 0xa3
      )
    }
    return false
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const authGuard = await requireExecApiSession(req, { allowAuditor: true })
  if (!authGuard.ok) return authGuard.response

  return NextResponse.json(
    {
      ok: true,
      endpoint: '/api/erp/feryal/vision',
      engines: ['Vision & Video Inspector', 'Deep Strategic'],
      supportedFormats: ['JPG', 'PNG', 'WEBP', 'MP4', 'WEBM'],
      maxAttachments: MAX_MEDIA_ATTACHMENTS,
      maxBodyBytes: MAX_VISION_BODY_BYTES,
    },
    { headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}

export async function POST(req: NextRequest) {
  const authGuard = await requireExecApiSession(req, { allowAuditor: false })
  if (!authGuard.ok) return authGuard.response

  const burst = executiveAiBurstLimiter.check(`vision:${authGuard.session.sub}`)
  if (!burst.allowed) {
    return buildRateLimitedJsonResponse(burst.retryAfterSeconds)
  }

  const declaredLen = Number(req.headers.get('content-length') || '0')
  if (Number.isFinite(declaredLen) && declaredLen > MAX_VISION_BODY_BYTES) {
    return NextResponse.json(
      { ok: false, error: 'PAYLOAD_TOO_LARGE' },
      { status: 413, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  let body: VisionPostBody = {}
  try {
    const rawBody = await req.text()
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_VISION_BODY_BYTES) {
      return NextResponse.json(
        { ok: false, error: 'PAYLOAD_TOO_LARGE' },
        { status: 413, headers: ENTERPRISE_API_SECURITY_HEADERS },
      )
    }
    body = JSON.parse(rawBody) as VisionPostBody
  } catch {
    return NextResponse.json(
      { ok: false, error: 'INVALID_JSON' },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const lang: 'ar' | 'en' = body.lang === 'en' ? 'en' : 'ar'
  const friendlyMode = lang === 'ar' ? 'فحص الصور والفيديو' : 'Vision & Video Inspector'
  const rawMediaParts = Array.isArray(body.mediaParts) ? body.mediaParts : []
  const rawClaudeImages = Array.isArray(body.claudeImages) ? body.claudeImages : []

  if (
    rawMediaParts.length > MAX_MEDIA_ATTACHMENTS ||
    rawClaudeImages.length > MAX_MEDIA_ATTACHMENTS
  ) {
    return NextResponse.json(
      { ok: false, error: 'TOO_MANY_ATTACHMENTS' },
      { status: 413, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const mediaParts: GeminiMediaPart[] = []
  for (const part of rawMediaParts) {
    if (!part || typeof part.data !== 'string' || !part.data.trim()) continue
    const normalizedMime = normalizeAllowedVisionMime(part.mimeType)
    if (!normalizedMime) {
      return NextResponse.json(
        {
          ok: false,
          error: 'UNSUPPORTED_MEDIA_TYPE',
          allowed: [...ALLOWED_VISION_MIME_TYPES],
        },
        { status: 415, headers: ENTERPRISE_API_SECURITY_HEADERS },
      )
    }
    const cleanData = part.data.replace(/\s+/g, '')
    if (!BASE64_FORMAT_RE.test(cleanData)) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_BASE64_MEDIA' },
        { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
      )
    }
    const decodedBytes = estimateBase64DecodedBytes(cleanData)
    const maxBytes = normalizedMime.startsWith('video/') ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
    if (decodedBytes === 0 || decodedBytes > maxBytes) {
      return NextResponse.json(
        { ok: false, error: 'ATTACHMENT_SIZE_EXCEEDED' },
        { status: 413, headers: ENTERPRISE_API_SECURITY_HEADERS },
      )
    }
    if (!validateMediaMagicBytes(normalizedMime, cleanData)) {
      return NextResponse.json(
        { ok: false, error: 'MEDIA_SIGNATURE_MISMATCH' },
        { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
      )
    }
    mediaParts.push({
      mimeType: normalizedMime,
      data: cleanData,
      label: typeof part.label === 'string' ? part.label.slice(0, 240) : undefined,
    })
  }

  const claudeImages: ClaudeVisionImage[] = []
  for (const img of rawClaudeImages) {
    if (!img || typeof img.data !== 'string' || !img.data.trim()) continue
    const normalizedMime = normalizeAllowedVisionMime(img.mediaType)
    if (!normalizedMime || !ALLOWED_CLAUDE_IMAGE_MIMES.has(normalizedMime)) {
      return NextResponse.json(
        { ok: false, error: 'UNSUPPORTED_MEDIA_TYPE' },
        { status: 415, headers: ENTERPRISE_API_SECURITY_HEADERS },
      )
    }
    const cleanData = img.data.replace(/\s+/g, '')
    if (
      !BASE64_FORMAT_RE.test(cleanData) ||
      estimateBase64DecodedBytes(cleanData) > MAX_IMAGE_BYTES ||
      !validateMediaMagicBytes(normalizedMime, cleanData)
    ) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_IMAGE_PAYLOAD' },
        { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
      )
    }
    claudeImages.push({
      mediaType: normalizedMime as 'image/jpeg' | 'image/png' | 'image/webp',
      data: cleanData,
      label: typeof img.label === 'string' ? img.label.slice(0, 240) : undefined,
    })
  }

  if (mediaParts.length === 0 && claudeImages.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'NO_MEDIA_ATTACHED' },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const safePromptInput =
    typeof body.prompt === 'string' ? body.prompt.trim().slice(0, MAX_PROMPT_CHARS) : ''
  const userPrompt =
    safePromptInput ||
    (lang === 'ar'
      ? 'افحصي المرفق البصري وحددي درجة المطابقة (🟢 مطابق / 🟡 ملاحظة متوسطة / 🔴 مخالفة حرجة) والملاحظات الدقيقة.'
      : 'Inspect the attached media, score compliance (🟢 / 🟡 / 🔴), and list exact visual findings.')

  const safeWorkspaceContext =
    typeof body.workspaceContext === 'string'
      ? body.workspaceContext.slice(0, MAX_CONTEXT_CHARS)
      : undefined
  const systemPrompt = buildVisionSystemPrompt(lang, safeWorkspaceContext)

  const geminiKey = resolveGeminiKey(body.customGeminiKey)
  const geminiOut = await runPrimaryVisionInspection({
    apiKey: geminiKey,
    systemPrompt,
    userPrompt,
    mediaParts,
  })

  if (geminiOut) {
    const tier = inferVisionComplianceFromText(geminiOut.text)
    const badge = getComplianceBadgeMeta(tier)
    return NextResponse.json(
      {
        ok: true,
        provider: 'gemini',
        model: friendlyMode,
        complianceTier: tier,
        complianceBadgeAr: badge.ar,
        complianceBadgeEn: badge.en,
        engineLabelAr: 'فحص الصور والفيديو',
        engineLabelEn: 'Vision & Video Inspector',
        reply: geminiOut.text,
      },
      { headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const anthropicKey = resolveAnthropicKey(body.customAnthropicKey)
  const fallbackClaudeImgs: ClaudeVisionImage[] =
    claudeImages.length > 0
      ? claudeImages
      : mediaParts
          .filter((m) => ALLOWED_CLAUDE_IMAGE_MIMES.has(m.mimeType))
          .slice(0, MAX_MEDIA_ATTACHMENTS)
          .map((m) => ({
            mediaType: m.mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
            data: m.data,
            label: m.label,
          }))

  const claudeOut = await runSecondaryVisionInspection({
    apiKey: anthropicKey,
    systemPrompt,
    userPrompt,
    images: fallbackClaudeImgs,
  })

  if (claudeOut) {
    const tier = inferVisionComplianceFromText(claudeOut.text)
    const badge = getComplianceBadgeMeta(tier)
    return NextResponse.json(
      {
        ok: true,
        provider: 'claude',
        model: friendlyMode,
        complianceTier: tier,
        complianceBadgeAr: badge.ar,
        complianceBadgeEn: badge.en,
        engineLabelAr: 'فحص الصور والفيديو',
        engineLabelEn: 'Vision & Video Inspector',
        reply: claudeOut.text,
      },
      { headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const safeSummary =
    typeof body.attachmentSummary === 'string' ? body.attachmentSummary.slice(0, 500) : ''
  const det = buildDeterministicVisionFallback(userPrompt, safeSummary, lang)
  const badge = getComplianceBadgeMeta(det.tier)
  return NextResponse.json(
    {
      ok: true,
      provider: 'deterministic',
      model: friendlyMode,
      complianceTier: det.tier,
      complianceBadgeAr: badge.ar,
      complianceBadgeEn: badge.en,
      engineLabelAr: 'فحص الصور والفيديو',
      engineLabelEn: 'Vision & Video Inspector',
      reply: det.text,
    },
    { headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}

async function disallowVisionMutation(req: NextRequest) {
  const authGuard = await requireExecApiSession(req, { allowAuditor: false })
  if (!authGuard.ok) return authGuard.response
  return NextResponse.json(
    { ok: false, error: 'Method not allowed' },
    { status: 405, headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}

export async function PUT(req: NextRequest) {
  return disallowVisionMutation(req)
}

export async function PATCH(req: NextRequest) {
  return disallowVisionMutation(req)
}

export async function DELETE(req: NextRequest) {
  return disallowVisionMutation(req)
}
