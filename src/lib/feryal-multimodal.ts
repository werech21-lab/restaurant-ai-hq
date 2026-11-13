/**
 * Feryal Multimodal Vision & Video Frame Engine (`src/lib/feryal-multimodal.ts`)
 *
 * Powers Feryal's Multimodal Vision & Video Executive Inspector across `/erp/feryal` & `/erp/feryal-ai`:
 *  1. Images (`JPG`, `PNG`, `WEBP`) -> Normalized via HTML5 <canvas> to crisp max-1440px JPEG Base64
 *     + lightweight 260px thumbnail so payloads stay well under Vercel's 4.5 MB request body limit.
 *  2. Videos (`MP4`, `WEBM`, `MOV`) ->
 *     - Extracts up to 6 chronological timestamped JPEG keyframes across the timeline via offscreen
 *       `<video>` + `<canvas>` (works instantaneously even on 100 MB+ 4K phone videos!).
 *     - Preserves a live `videoPreviewUrl` (`URL.createObjectURL`) so `<video controls>` plays directly
 *       inside the chat composer before sending.
 *     - When the video file is <= 2.4 MB, also includes native `video/*` `inlineData` for temporal
 *       visual inspection while strictly respecting Vercel body size limits.
 */

import { AI_KEY_STORAGE_KEYS } from '@/lib/ai-keys'

export type VisionComplianceTier = 'green' | 'yellow' | 'red'

export interface FeryalExtractedFrame {
  index: number
  timestampSec: number
  timestampLabel: string
  mimeType: 'image/jpeg'
  base64Data: string
  previewDataUrl: string
}

export interface FeryalMediaAttachment {
  id: string
  kind: 'image' | 'video'
  name: string
  mimeType: string
  sizeBytes: number
  width: number
  height: number
  durationSec?: number
  /** Preview Data URL shown in composer & active session */
  previewDataUrl: string
  /** Live object URL for inline `<video controls>` playback inside composer */
  videoPreviewUrl?: string
  /** Compact thumbnail (<15 KB) persisted in IndexedDB chat history */
  thumbDataUrl: string
  /** Normalized high-res JPEG Base64 (for kind === 'image') */
  base64Data?: string
  /** Chronological timestamped frames (for kind === 'video') */
  extractedFrames?: FeryalExtractedFrame[]
  /** Optional compact native video Base64 stream when video file <= 2.4 MB (Vercel-safe) */
  nativeVideoBase64?: string
  nativeVideoMimeType?: string
}

export interface StoredAttachmentMeta {
  id: string
  kind: 'image' | 'video'
  name: string
  sizeBytes?: number
  durationSec?: number
  frameCount?: number
  thumbDataUrl: string
  frameThumbs?: { timestampLabel: string; thumbDataUrl: string }[]
}

export interface FeryalVisionPreset {
  id: 'dish-quality' | 'kitchen-hygiene' | 'supplier-invoice' | 'branch-video'
  badgeAr: string
  badgeEn: string
  labelAr: string
  labelEn: string
  promptAr: string
  promptEn: string
}

export const FERYAL_VISION_QUICK_PRESETS: readonly FeryalVisionPreset[] = [
  {
    id: 'dish-quality',
    badgeAr: 'فحص جودة وتقديم الطبق 🍽️',
    badgeEn: 'Dish Quality & Plating Audit 🍽️',
    labelAr: 'فحص جودة وتقديم الطبق 🍽️',
    labelEn: 'Dish Quality & Plating Audit 🍽️',
    promptAr:
      'افحصي الصورة أو الفيديو المرفق بدقة: قيّمي جودة وتقديم الطبق، الالتزام بالوزن المعياري للوصفة (BOM)، إحكام التغليف ضد التسريب في التوصيل، وحددي درجة المطابقة (🟢 مطابق / 🟡 ملاحظة متوسطة / 🔴 مخالفة حرجة) مع التوصية الفورية للفرع.',
    promptEn:
      'Inspect the attached photo/video carefully: audit dish presentation quality, standard recipe BOM portion accuracy, delivery packaging seal integrity, and assign a compliance score (🟢 Compliant / 🟡 Medium Observation / 🔴 Critical Violation) with immediate branch actions.',
  },
  {
    id: 'kitchen-hygiene',
    badgeAr: 'تدقيق نظافة وسلامة المطبخ والثلاجات 🧊',
    badgeEn: 'Kitchen & Fridge Hygiene Audit 🧊',
    labelAr: 'تدقيق نظافة وسلامة المطبخ والثلاجات 🧊',
    labelEn: 'Kitchen & Fridge Hygiene Audit 🧊',
    promptAr:
      'دقّقي صورة أو فيديو المطبخ والثلاجات المرفق: افحصي نظافة الأسطح، ترتيب وتغليف المواد الخام وملصقات الصلاحية بالثلاجات، التزام الطاقم بالقفازات وغطاء الرأس واشتراطات بلدية الكويت والهيئة العامة للغذاء، وحددي درجة المطابقة (🟢 مطابق / 🟡 ملاحظة متوسطة / 🔴 مخالفة حرجة).',
    promptEn:
      'Audit the attached kitchen/refrigerator photo or video: inspect prep surface cleanliness, raw-material storage, date-labeling inside chillers, PPE/glove compliance, and Kuwait Municipality / PAFN food-safety standards, with an explicit compliance score.',
  },
  {
    id: 'supplier-invoice',
    badgeAr: 'قراءة ومطابقة فاتورة مورد مع أودو 🧾',
    badgeEn: 'Supplier Invoice vs Odoo OCR 🧾',
    labelAr: 'قراءة ومطابقة فاتورة مورد مع أودو 🧾',
    labelEn: 'Supplier Invoice vs Odoo OCR 🧾',
    promptAr:
      'اقرئي كل الأصناف والكميات وأسعار الوحدات والإجمالي في صورة فاتورة المورد أو سند الاستلام المرفق، وطابقيها مع أسعار العقود وحركة مخزن العارضية في أودو 17 لكشف أي زيادة سعرية أو نقص بالكمية المستلمة، مع درجة المطابقة.',
    promptEn:
      'Extract all line items, quantities, unit prices, and totals from the attached supplier invoice or delivery note, and reconcile them against our Odoo 17 contract rates and Ardiya Central Warehouse receipts to flag any price creep or quantity gap.',
  },
  {
    id: 'branch-video',
    badgeAr: 'تحليل فيديو ازدحام الفرع أو تحضير الطلب 🎥',
    badgeEn: 'Branch Rush / Order Prep Video 🎥',
    labelAr: 'تحليل فيديو ازدحام الفرع أو تحضير الطلب 🎥',
    labelEn: 'Branch Rush / Order Prep Video 🎥',
    promptAr:
      'شاهدي لقطات الفيديو المرفق زمنياً خطوة بخطوة: حلّلي ازدحام الفرع أو خط تحضير الطلب، اكتشفي نقاط الاختناق التي ترفع مدة التجهيز فوق 12 دقيقة (أخضر) أو 18 دقيقة (أحمر)، وحددي درجة المطابقة مع خطة تسريع فورية للمطبخ.',
    promptEn:
      'Inspect the attached video timeline frame-by-frame: analyze branch crowd flow or kitchen order preparation steps, pinpoint bottlenecks pushing prep SLA past 12 min (Green) or 18 min (Red), and give a scored compliance verdict + immediate kitchen fix.',
  },
] as const

/** Strict 2.4 MB raw video cap so Base64 JSON stays < 3.4 MB (100% safe under Vercel 4.5 MB limit) */
const MAX_NATIVE_VIDEO_BYTES = Math.floor(2.4 * 1024 * 1024)
const MAX_TOTAL_PAYLOAD_CHARS = 3_400_000
const VIDEO_KEYFRAME_COUNT = 6

export function getComplianceBadgeMeta(tier: VisionComplianceTier): {
  tier: VisionComplianceTier
  ar: string
  en: string
  pillClassName: string
} {
  if (tier === 'red') {
    return {
      tier: 'red',
      ar: '🔴 مخالفة حرجة',
      en: '🔴 Critical Violation',
      pillClassName:
        'bg-rose-50 text-rose-700 ring-1 ring-rose-500/20 dark:bg-rose-950/60 dark:text-rose-200',
    }
  }
  if (tier === 'yellow') {
    return {
      tier: 'yellow',
      ar: '🟡 ملاحظة متوسطة',
      en: '🟡 Medium Observation',
      pillClassName:
        'bg-amber-50 text-amber-800 ring-1 ring-amber-500/20 dark:bg-amber-950/60 dark:text-amber-200',
    }
  }
  return {
    tier: 'green',
    ar: '🟢 مطابق',
    en: '🟢 Compliant',
    pillClassName:
      'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-200',
  }
}

export function inferVisionComplianceFromText(text: string): VisionComplianceTier {
  const s = (text || '').trim()
  const head = s.slice(0, 420)
  if (/🔴|مخالفة\s*حرجة|خطر\s*وسيء|critical\s*violation|non[-\s]?compliant|high\s*risk/i.test(head)) {
    return 'red'
  }
  if (/🟢|مطابق\s*للمعايير|🟢\s*مطابق|compliant\b/i.test(head) && !/غير\s*مطابق|non[-\s]?compliant/i.test(head)) {
    return 'green'
  }
  if (/🟡|ملاحظة\s*متوسطة|تحذير|medium\s*observation|needs\s*attention/i.test(head)) {
    return 'yellow'
  }
  if (/🔴|مخالفة\s*حرجة|تلوث|منتهي\s*الصلاحية|تسريب\s*شديد|فرق\s*سعر\s*كبير/i.test(s)) {
    return 'red'
  }
  if (/🟢\s*مطابق/i.test(s)) {
    return 'green'
  }
  return 'yellow'
}

export function formatDurationClock(sec?: number): string {
  if (!sec || !Number.isFinite(sec) || sec <= 0) return '00:00'
  const total = Math.max(0, Math.round(sec))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatFileSizeShort(bytes?: number): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function isSupportedMediaFile(file: File): boolean {
  const t = (file.type || '').toLowerCase()
  if (t.startsWith('image/') || t.startsWith('video/')) return true
  return /\.(jpe?g|png|webp|gif|bmp|heic|heif|mp4|mov|webm|m4v|avi|mkv|ogg)$/i.test(file.name || '')
}

export function inferMediaKind(file: File): 'image' | 'video' {
  const t = (file.type || '').toLowerCase()
  if (t.startsWith('video/')) return 'video'
  if (/\.(mp4|mov|webm|m4v|avi|mkv|ogg)$/i.test(file.name || '')) return 'video'
  return 'image'
}

function stripDataUrlPrefix(dataUrl: string): string {
  const idx = dataUrl.indexOf(',')
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl
}

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(new Error('FILE_READ_FAILED'))
    reader.readAsDataURL(file)
  })
}

function renderDrawableToJpeg(
  source: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  maxEdge: number,
  quality: number,
): { dataUrl: string; base64: string; width: number; height: number } {
  const safeW = Math.max(1, srcWidth || 640)
  const safeH = Math.max(1, srcHeight || 480)
  const scale = Math.min(1, maxEdge / Math.max(safeW, safeH))
  const outW = Math.max(1, Math.round(safeW * scale))
  const outH = Math.max(1, Math.round(safeH * scale))

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, outW, outH)
    ctx.drawImage(source, 0, 0, outW, outH)
  }
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return {
    dataUrl,
    base64: stripDataUrlPrefix(dataUrl),
    width: outW,
    height: outH,
  }
}

async function processImageFile(file: File, id: string): Promise<FeryalMediaAttachment> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'))
      el.src = objectUrl
    })

    const full = renderDrawableToJpeg(img, img.naturalWidth, img.naturalHeight, 1440, 0.84)
    const thumb = renderDrawableToJpeg(img, img.naturalWidth, img.naturalHeight, 260, 0.72)

    return {
      id,
      kind: 'image',
      name: file.name || 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: file.size,
      width: full.width,
      height: full.height,
      previewDataUrl: full.dataUrl,
      thumbDataUrl: thumb.dataUrl,
      base64Data: full.base64,
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function seekVideoToTime(video: HTMLVideoElement, targetSec: number): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      video.removeEventListener('seeked', finish)
      video.removeEventListener('error', finish)
      resolve()
    }
    const timer = window.setTimeout(finish, 1800)
    video.addEventListener(
      'seeked',
      () => {
        window.clearTimeout(timer)
        finish()
      },
      { once: true },
    )
    video.addEventListener(
      'error',
      () => {
        window.clearTimeout(timer)
        finish()
      },
      { once: true },
    )
    try {
      video.currentTime = Math.max(0, targetSec)
    } catch {
      window.clearTimeout(timer)
      finish()
    }
  })
}

async function processVideoFile(file: File, id: string): Promise<FeryalMediaAttachment> {
  const seekUrl = URL.createObjectURL(file)
  const playerPreviewUrl = URL.createObjectURL(file)
  try {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    video.src = seekUrl

    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => resolve(), 4500)
      video.onloadeddata = () => {
        window.clearTimeout(timer)
        resolve()
      }
      video.onloadedmetadata = () => {
        window.setTimeout(() => {
          window.clearTimeout(timer)
          resolve()
        }, 120)
      }
      video.onerror = () => {
        window.clearTimeout(timer)
        reject(new Error('VIDEO_DECODE_FAILED'))
      }
    })

    const rawDuration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 6
    const vW = video.videoWidth || 1280
    const vH = video.videoHeight || 720

    const frameCount: number = rawDuration <= 2 ? 3 : VIDEO_KEYFRAME_COUNT
    const extractedFrames: FeryalExtractedFrame[] = []

    for (let i = 0; i < frameCount; i++) {
      const ratio = frameCount <= 1 ? 0.5 : 0.06 + (0.88 * i) / (frameCount - 1)
      const ts = Math.min(Math.max(0.05, rawDuration * ratio), Math.max(0.05, rawDuration - 0.05))
      await seekVideoToTime(video, ts)
      const frameRender = renderDrawableToJpeg(video, vW, vH, 1024, 0.78)
      extractedFrames.push({
        index: i + 1,
        timestampSec: Number(ts.toFixed(1)),
        timestampLabel: formatDurationClock(ts),
        mimeType: 'image/jpeg',
        base64Data: frameRender.base64,
        previewDataUrl: frameRender.dataUrl,
      })
    }

    const coverSource = extractedFrames[0]
    const thumbRender = renderDrawableToJpeg(video, vW, vH, 260, 0.7)

    let nativeVideoBase64: string | undefined
    let nativeVideoMimeType: string | undefined

    if (file.size > 0 && file.size <= MAX_NATIVE_VIDEO_BYTES) {
      try {
        const rawDataUrl = await readFileAsDataUrl(file)
        const b64 = stripDataUrlPrefix(rawDataUrl)
        if (b64 && b64.length < 3_250_000) {
          nativeVideoBase64 = b64
          const rawMime = (file.type || '').split(';')[0].trim().toLowerCase()
          nativeVideoMimeType =
            rawMime === 'video/mp4' ||
            rawMime === 'video/webm' ||
            rawMime === 'video/quicktime' ||
            rawMime === 'video/mpeg'
              ? rawMime
              : 'video/mp4'
        }
      } catch {
        // Keyframes remain active even if raw file read is skipped
      }
    }

    return {
      id,
      kind: 'video',
      name: file.name || 'video.mp4',
      mimeType: nativeVideoMimeType || file.type || 'video/mp4',
      sizeBytes: file.size,
      width: vW,
      height: vH,
      durationSec: Number(rawDuration.toFixed(1)),
      previewDataUrl: coverSource?.previewDataUrl || thumbRender.dataUrl,
      videoPreviewUrl: playerPreviewUrl,
      thumbDataUrl: thumbRender.dataUrl,
      extractedFrames,
      nativeVideoBase64,
      nativeVideoMimeType,
    }
  } finally {
    URL.revokeObjectURL(seekUrl)
  }
}

export function revokeAttachmentObjectUrls(attachments: readonly FeryalMediaAttachment[]) {
  for (const att of attachments) {
    if (att.videoPreviewUrl) {
      try {
        URL.revokeObjectURL(att.videoPreviewUrl)
      } catch {}
    }
  }
}

export async function processFeryalMediaFile(file: File): Promise<FeryalMediaAttachment> {
  const id = `media-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const kind = inferMediaKind(file)
  if (kind === 'video') {
    return processVideoFile(file, id)
  }
  return processImageFile(file, id)
}

export function toStoredAttachmentMeta(att: FeryalMediaAttachment): StoredAttachmentMeta {
  return {
    id: att.id,
    kind: att.kind,
    name: att.name,
    sizeBytes: att.sizeBytes,
    durationSec: att.durationSec,
    frameCount: att.extractedFrames?.length,
    thumbDataUrl: att.thumbDataUrl,
    frameThumbs: att.extractedFrames?.slice(0, 4).map((f) => ({
      timestampLabel: f.timestampLabel,
      thumbDataUrl: f.previewDataUrl,
    })),
  }
}

export function buildCompactVisionTransportPayload(attachments: readonly FeryalMediaAttachment[]): {
  mediaParts: Array<{ mimeType: string; data: string; label?: string }>
  claudeImages: Array<{
    mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
    data: string
    label?: string
  }>
} {
  const mediaParts: Array<{ mimeType: string; data: string; label?: string }> = []
  const claudeImages: Array<{
    mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
    data: string
    label?: string
  }> = []

  let usedChars = 0

  for (const att of attachments) {
    if (att.kind === 'image' && att.base64Data) {
      if (usedChars + att.base64Data.length <= MAX_TOTAL_PAYLOAD_CHARS) {
        mediaParts.push({
          mimeType: 'image/jpeg',
          data: att.base64Data,
          label: `[Attached Photo: ${att.name} (${att.width}x${att.height})]`,
        })
        usedChars += att.base64Data.length
      }
      if (claudeImages.length < 8) {
        claudeImages.push({
          mediaType: 'image/jpeg',
          data: att.base64Data,
          label: `[Attached Photo: ${att.name} (${att.width}x${att.height})]`,
        })
      }
    } else if (att.kind === 'video') {
      if (
        att.nativeVideoBase64 &&
        att.nativeVideoMimeType &&
        attachments.length === 1 &&
        usedChars + att.nativeVideoBase64.length <= 2_600_000
      ) {
        mediaParts.push({
          mimeType: att.nativeVideoMimeType,
          data: att.nativeVideoBase64,
          label: `[Attached Video Stream: ${att.name} (${att.durationSec ?? 0}s)]`,
        })
        usedChars += att.nativeVideoBase64.length
      }

      if (att.extractedFrames && att.extractedFrames.length > 0) {
        for (const frame of att.extractedFrames) {
          if (usedChars + frame.base64Data.length <= MAX_TOTAL_PAYLOAD_CHARS) {
            mediaParts.push({
              mimeType: 'image/jpeg',
              data: frame.base64Data,
              label: `[Video "${att.name}" Keyframe #${frame.index}/${att.extractedFrames.length} @ ${frame.timestampLabel}]`,
            })
            usedChars += frame.base64Data.length
          }
          if (claudeImages.length < 8) {
            claudeImages.push({
              mediaType: 'image/jpeg',
              data: frame.base64Data,
              label: `[Video "${att.name}" Keyframe #${frame.index}/${att.extractedFrames.length} @ ${frame.timestampLabel}]`,
            })
          }
        }
      }
    }
  }

  return { mediaParts, claudeImages }
}

export interface FeryalVisionAuditResponse {
  ok: boolean
  reply: string
  complianceTier: VisionComplianceTier
  complianceBadgeAr: string
  complianceBadgeEn: string
  provider: 'gemini' | 'claude' | 'deterministic'
  model: string
  engineLabelAr: string
  engineLabelEn: string
}

export async function callFeryalVisionInspector(params: {
  prompt: string
  lang: 'ar' | 'en'
  workspaceContext: string
  attachments: readonly FeryalMediaAttachment[]
}): Promise<FeryalVisionAuditResponse | null> {
  const { mediaParts, claudeImages } = buildCompactVisionTransportPayload(params.attachments)
  if (mediaParts.length === 0 && claudeImages.length === 0) return null

  let customGeminiKey = ''
  let customAnthropicKey = ''
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      customGeminiKey = window.localStorage.getItem(AI_KEY_STORAGE_KEYS.gemini) ?? ''
      customAnthropicKey = window.localStorage.getItem(AI_KEY_STORAGE_KEYS.anthropic) ?? ''
    }
  } catch {}

  const attachmentSummary = params.attachments
    .map((a) =>
      a.kind === 'video'
        ? `${a.name} (video ${a.durationSec ?? 0}s, ${a.extractedFrames?.length ?? 0} frames)`
        : `${a.name} (image ${a.width}x${a.height})`,
    )
    .join(', ')

  const res = await fetch('/api/erp/feryal/vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: params.prompt,
      lang: params.lang,
      workspaceContext: params.workspaceContext,
      attachmentSummary,
      mediaParts,
      claudeImages,
      ...(customGeminiKey.trim() ? { customGeminiKey: customGeminiKey.trim() } : {}),
      ...(customAnthropicKey.trim() ? { customAnthropicKey: customAnthropicKey.trim() } : {}),
    }),
  })

  if (!res.ok) return null
  const data = (await res.json()) as Partial<FeryalVisionAuditResponse>
  if (!data.ok || !data.reply) return null

  const tier: VisionComplianceTier =
    data.complianceTier === 'green' || data.complianceTier === 'yellow' || data.complianceTier === 'red'
      ? data.complianceTier
      : inferVisionComplianceFromText(data.reply)
  const badge = getComplianceBadgeMeta(tier)

  return {
    ok: true,
    reply: data.reply,
    complianceTier: tier,
    complianceBadgeAr: data.complianceBadgeAr || badge.ar,
    complianceBadgeEn: data.complianceBadgeEn || badge.en,
    provider: data.provider || 'gemini',
    model: params.lang === 'ar' ? 'فحص الصور والفيديو' : 'Vision & Video Inspector',
    engineLabelAr: 'فحص الصور والفيديو',
    engineLabelEn: 'Vision & Video Inspector',
  }
}

export function buildDefaultMediaPrompt(
  attachments: readonly FeryalMediaAttachment[],
  lang: 'ar' | 'en',
): string {
  const hasVideo = attachments.some((a) => a.kind === 'video')
  const hasImage = attachments.some((a) => a.kind === 'image')
  if (lang === 'ar') {
    if (hasVideo && hasImage) {
      return 'افحصي الصور والفيديو المرفقين بدقة، وحددي درجة المطابقة (🟢 مطابق / 🟡 ملاحظة متوسطة / 🔴 مخالفة حرجة) مع الملاحظات البصرية الدقيقة والتوصية الفورية لفروع فنتشر فودز.'
    }
    if (hasVideo) {
      return 'شاهدي الفيديو المرفق وحلّلي كل لقطاته الزمنية بدقة (سرعة التجهيز، الازدحام، الجودة، أو النظافة) وحددي درجة المطابقة (🟢 مطابق / 🟡 ملاحظة متوسطة / 🔴 مخالفة حرجة) مع خطة العمل.'
    }
    return 'افحصي الصورة المرفقة بدقة عبر معايير فنتشر فودز (6 مطاعم • 7 فروع • 8 قنوات — جودة الطبق، النظافة والثلاجات، المخزن، أو فاتورة مورد) وحددي درجة المطابقة (🟢 مطابق / 🟡 ملاحظة متوسطة / 🔴 مخالفة حرجة) مع الملاحظات البصرية الدقيقة.'
  }
  if (hasVideo && hasImage) {
    return 'Inspect the attached photos and video carefully across Venture Foods standards (6 Brands • 7 Branches • 8 Channels), assign a compliance score (🟢 Compliant / 🟡 Medium Observation / 🔴 Critical Violation), cite exact visual findings, and give an immediate action plan.'
  }
  if (hasVideo) {
    return 'Analyze the attached video across all timeline keyframes, score compliance (🟢 Compliant / 🟡 Medium Observation / 🔴 Critical Violation), and provide an immediate operational recommendation.'
  }
  return 'Inspect the attached image in detail (dish plating, kitchen hygiene, shelf stock, or supplier invoice), score compliance (🟢 / 🟡 / 🔴), and list exact visual findings.'
}
