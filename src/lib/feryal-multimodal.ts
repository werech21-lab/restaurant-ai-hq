/**
 * Feryal Multimodal Vision & Video Frame Engine (`src/lib/feryal-multimodal.ts`)
 *
 * Powers Feryal's Multimodal Vision & Video Executive Inspector on `/erp/feryal-ai`:
 *  1. Images (`image/jpeg`, `image/png`, `image/webp`) -> Normalized via HTML5 <canvas> to crisp
 *     max-1440px JPEG Base64 + lightweight 260px thumbnail (with raw Base64 fallback if canvas is unavailable).
 *  2. Videos (`video/mp4`, `video/webm`, `video/quicktime`) ->
 *     - Extracts 3 to 4 representative chronological JPEG keyframes across the timeline via offscreen
 *       `<video>` + `<canvas>`.
 *     - Gracefully falls back to raw video bytes (`nativeVideoBase64`) up to 3.0 MB when browser video
 *       decoding is unavailable or for compact temporal inspection.
 *  3. Sends structured payload (`prompt`, `locale`, `mediaItems`, active `brand`/`branch` context) to
 *     `POST /api/erp/feryal/vision`.
 */

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
  /** Compact thumbnail (<15 KB) persisted in chat history */
  thumbDataUrl: string
  /** Normalized high-res Base64 (for kind === 'image') */
  base64Data?: string
  /** Chronological timestamped frames (3-4 keyframes for kind === 'video') */
  extractedFrames?: FeryalExtractedFrame[]
  /** Optional compact native video Base64 stream when video file <= 3.0 MB */
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

export interface FeryalVisionFramePayload {
  index: number
  timestampSec: number
  timestampLabel: string
  mimeType: 'image/jpeg'
  base64Data: string
}

export interface FeryalVisionMediaItemPayload {
  id: string
  kind: 'image' | 'video'
  name: string
  mimeType: string
  width?: number
  height?: number
  durationSec?: number
  base64Data?: string
  extractedFrames?: FeryalVisionFramePayload[]
  nativeVideoBase64?: string
  nativeVideoMimeType?: string
}

export interface FeryalVisionRequestPayload {
  prompt: string
  locale: 'ar' | 'en'
  brand?: string
  branch?: string
  period?: string
  workspaceContext?: string
  mediaItems: FeryalVisionMediaItemPayload[]
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
    badgeEn: 'Dish Plating & Packaging 🍽️',
    labelAr: 'فحص جودة وتقديم الطبق 🍽️',
    labelEn: 'Dish Plating & Packaging 🍽️',
    promptAr:
      'افحصي الصورة أو الفيديو المرفق بدقة: قيّمي جودة تقديم الطبق، تناسق الحصة المرئية، وإحكام التغليف ضد التسريب في التوصيل، وحددي درجة المطابقة (🟢 مطابق / 🟡 ملاحظة متوسطة / 🔴 مخالفة حرجة) مع التوصية التشغيلية الفورية للفرع دون افتراض أي أرقام مالية غير مرئية.',
    promptEn:
      'Inspect the attached photo or video carefully: evaluate dish plating quality, visible portion consistency, and delivery packaging seal integrity. Assign a compliance score (🟢 Compliant / 🟡 Medium Observation / 🔴 Critical Violation) with immediate operational actions without inventing unseen financial figures.',
  },
  {
    id: 'kitchen-hygiene',
    badgeAr: 'فحص نظافة المطبخ والثلاجات 🧊',
    badgeEn: 'Kitchen & Chiller Hygiene 🧊',
    labelAr: 'فحص نظافة المطبخ والثلاجات 🧊',
    labelEn: 'Kitchen & Chiller Hygiene 🧊',
    promptAr:
      'افحصي صورة أو فيديو المطبخ والثلاجات المرفق: راجعي نظافة أسطح التحضير، ترتيب وتغليف المواد على الأرفف، وضوح ملصقات الصلاحية، والتزام الطاقم بالقفازات وغطاء الرأس، وحددي درجة المطابقة (🟢 مطابق / 🟡 ملاحظة متوسطة / 🔴 مخالفة حرجة).',
    promptEn:
      'Inspect the attached kitchen or chiller photo/video: review prep surface cleanliness, shelf organization, date-label legibility, and staff PPE/glove compliance, assigning an explicit compliance score (🟢 / 🟡 / 🔴).',
  },
  {
    id: 'supplier-invoice',
    badgeAr: 'فحص وضوح الملصقات والإيصالات 🧾',
    badgeEn: 'Receipt & Label Legibility 🧾',
    labelAr: 'فحص وضوح الملصقات والإيصالات 🧾',
    labelEn: 'Receipt & Label Legibility 🧾',
    promptAr:
      'افحصي وضوح بيانات الملصق أو اللوحة السعرية أو سند الاستلام المرئي في الصورة المرفقة، واذكري فقط ما يظهر بصرياً بوضوح مع الإشارة إلى أن أي رقم مطبوع بالصورة هو قراءة بصرية غير مطابقة تلقائياً مع سجلات Odoo.',
    promptEn:
      'Inspect the legibility and visible details of the attached label, menu board, or receipt photo, reporting strictly what is visibly present while noting that printed figures are visual observations rather than live Odoo records.',
  },
  {
    id: 'branch-video',
    badgeAr: 'تحليل فيديو خط التحضير والفرع 🎥',
    badgeEn: 'Kitchen Prep & Rush Video 🎥',
    labelAr: 'تحليل فيديو خط التحضير والفرع 🎥',
    labelEn: 'Kitchen Prep & Rush Video 🎥',
    promptAr:
      'شاهدي لقطات الفيديو المرفق زمنياً: حلّلي انسيابية خط التحضير وحركة الطاقم أو منطقة التسليم، واكتشفي أي نقاط اختناق بصرية مع تحديد درجة المطابقة وخطة تحسين فورية للفرع.',
    promptEn:
      'Review the attached video timeline across its keyframes: analyze kitchen prep workflow, dispatch organization, and visible bottlenecks, providing a compliance score and immediate operational action.',
  },
] as const

/** Safe 3.0 MB raw video cap so Base64 JSON stays well within serverless body size limits */
export const MAX_NATIVE_VIDEO_BYTES = 3 * 1024 * 1024
const MAX_TOTAL_PAYLOAD_CHARS = 4_200_000
export const VIDEO_KEYFRAME_COUNT = 4

export const PHOTO_VIDEO_UPLOAD_ACCEPT =
  'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,.jpg,.jpeg,.png,.webp,.mp4,.webm,.mov'

export const CAMERA_CAPTURE_ACCEPT =
  'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime'

export const DOCUMENT_INTAKE_ACCEPT =
  '.xlsx,.csv,.jpg,.jpeg,.png,.webp,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,image/jpeg,image/png,image/webp'

const FALLBACK_VIDEO_POSTER_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160"><rect width="240" height="160" rx="16" fill="#0f1f1a"/><polygon points="102,56 102,104 146,80" fill="#10b981"/></svg>',
  )

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
  const head = s.slice(0, 480)
  if (/🔴|مخالفة\s*حرجة|خطر\s*صحي|critical\s*violation|non[-\s]?compliant|high\s*risk/i.test(head)) {
    return 'red'
  }
  if (/🟢|مطابق\s*للمعايير|🟢\s*مطابق|\bcompliant\b/i.test(head) && !/غير\s*مطابق|non[-\s]?compliant/i.test(head)) {
    return 'green'
  }
  if (/🟡|ملاحظة\s*متوسطة|تحذير|medium\s*observation|needs\s*attention/i.test(head)) {
    return 'yellow'
  }
  if (/🔴|مخالفة\s*حرجة|تلوث|منتهي\s*الصلاحية|تسريب\s*شديد/i.test(s)) {
    return 'red'
  }
  if (/🟢\s*مطابق|\b🟢\s*compliant\b/i.test(s)) {
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

export function isSpreadsheetIntakeFile(file: Pick<File, 'name' | 'type'>): boolean {
  const name = (file.name || '').toLowerCase()
  const mime = (file.type || '').toLowerCase()
  if (/\.(xlsx|csv)$/i.test(name)) return true
  return (
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'text/csv' ||
    mime === 'application/csv'
  )
}

export function isSupportedIntakeImageFile(file: Pick<File, 'name' | 'type'>): boolean {
  const name = (file.name || '').toLowerCase()
  const mime = (file.type || '').toLowerCase()
  if (/\.(jpe?g|png|webp)$/i.test(name)) return true
  return mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp'
}

export function isSupportedDocumentIntakeFile(file: Pick<File, 'name' | 'type'>): boolean {
  return isSpreadsheetIntakeFile(file) || isSupportedIntakeImageFile(file)
}

export function isSupportedMediaFile(file: Pick<File, 'name' | 'type'>): boolean {
  const t = (file.type || '').toLowerCase()
  if (
    t === 'image/jpeg' ||
    t === 'image/png' ||
    t === 'image/webp' ||
    t === 'video/mp4' ||
    t === 'video/webm' ||
    t === 'video/quicktime' ||
    t.startsWith('image/') ||
    t.startsWith('video/')
  ) {
    return true
  }
  return /\.(jpe?g|png|webp|mp4|mov|webm|m4v)$/i.test(file.name || '')
}

export function inferMediaKind(file: Pick<File, 'name' | 'type'>): 'image' | 'video' {
  const t = (file.type || '').toLowerCase()
  if (t.startsWith('video/')) return 'video'
  if (/\.(mp4|mov|webm|m4v)$/i.test(file.name || '')) return 'video'
  return 'image'
}

function normalizeImageMime(rawMime: string, fileName: string): 'image/jpeg' | 'image/png' | 'image/webp' {
  const lower = (rawMime || '').split(';')[0].trim().toLowerCase()
  if (lower === 'image/png' || /\.png$/i.test(fileName)) return 'image/png'
  if (lower === 'image/webp' || /\.webp$/i.test(fileName)) return 'image/webp'
  return 'image/jpeg'
}

function normalizeVideoMime(rawMime: string, fileName: string): 'video/mp4' | 'video/webm' | 'video/quicktime' {
  const lower = (rawMime || '').split(';')[0].trim().toLowerCase()
  if (lower === 'video/webm' || /\.webm$/i.test(fileName)) return 'video/webm'
  if (lower === 'video/quicktime' || /\.mov$/i.test(fileName)) return 'video/quicktime'
  return 'video/mp4'
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
  const fallbackMime = normalizeImageMime(file.type, file.name)
  const objectUrl =
    typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
      ? URL.createObjectURL(file)
      : ''
  try {
    if (objectUrl && typeof Image !== 'undefined' && typeof document !== 'undefined') {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'))
        el.src = objectUrl
      })

      const full = renderDrawableToJpeg(img, img.naturalWidth, img.naturalHeight, 1440, 0.84)
      const thumb = renderDrawableToJpeg(img, img.naturalWidth, img.naturalHeight, 260, 0.72)

      if (full.base64.length > 0) {
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
      }
    }
  } catch {
    // Fall back to direct FileReader Base64 when canvas decoding is unavailable
  } finally {
    if (objectUrl) {
      try {
        URL.revokeObjectURL(objectUrl)
      } catch {
        // ignore URL revoke error
      }
    }
  }

  const rawDataUrl = await readFileAsDataUrl(file)
  const base64Data = stripDataUrlPrefix(rawDataUrl)
  if (!base64Data) {
    throw new Error('IMAGE_EMPTY')
  }
  return {
    id,
    kind: 'image',
    name: file.name || 'photo.jpg',
    mimeType: fallbackMime,
    sizeBytes: file.size,
    width: 1024,
    height: 768,
    previewDataUrl: rawDataUrl,
    thumbDataUrl: rawDataUrl,
    base64Data,
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

async function readSafeNativeVideoBase64(file: File): Promise<{
  base64?: string
  mimeType: 'video/mp4' | 'video/webm' | 'video/quicktime'
}> {
  const mimeType = normalizeVideoMime(file.type, file.name)
  if (file.size <= 0 || file.size > MAX_NATIVE_VIDEO_BYTES) {
    return { mimeType }
  }
  try {
    const rawDataUrl = await readFileAsDataUrl(file)
    const b64 = stripDataUrlPrefix(rawDataUrl)
    if (b64 && b64.length <= 4_100_000) {
      return { base64: b64, mimeType }
    }
  } catch {
    // Keyframes remain primary when raw video stream cannot be read
  }
  return { mimeType }
}

async function processVideoFile(file: File, id: string): Promise<FeryalMediaAttachment> {
  const normalizedMime = normalizeVideoMime(file.type, file.name)
  const rawVideoFallback = await readSafeNativeVideoBase64(file)

  const canCreateObjectUrl =
    typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
  const seekUrl = canCreateObjectUrl ? URL.createObjectURL(file) : ''
  const playerPreviewUrl = canCreateObjectUrl ? URL.createObjectURL(file) : undefined

  try {
    if (seekUrl && typeof document !== 'undefined' && typeof window !== 'undefined') {
      const video = document.createElement('video')
      video.preload = 'auto'
      video.muted = true
      video.playsInline = true
      video.crossOrigin = 'anonymous'
      video.src = seekUrl

      const decodedOk = await new Promise<boolean>((resolve) => {
        const timer = window.setTimeout(() => resolve(true), 4200)
        video.onloadeddata = () => {
          window.clearTimeout(timer)
          resolve(true)
        }
        video.onloadedmetadata = () => {
          window.setTimeout(() => {
            window.clearTimeout(timer)
            resolve(true)
          }, 120)
        }
        video.onerror = () => {
          window.clearTimeout(timer)
          resolve(false)
        }
      })

      if (decodedOk) {
        const rawDuration =
          Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 6
        const vW = video.videoWidth || 1280
        const vH = video.videoHeight || 720
        const frameCount = rawDuration <= 2.5 ? 3 : VIDEO_KEYFRAME_COUNT
        const extractedFrames: FeryalExtractedFrame[] = []

        for (let i = 0; i < frameCount; i++) {
          const ratio = frameCount <= 1 ? 0.5 : 0.08 + (0.84 * i) / (frameCount - 1)
          const ts = Math.min(
            Math.max(0.05, rawDuration * ratio),
            Math.max(0.05, rawDuration - 0.05),
          )
          await seekVideoToTime(video, ts)
          const frameRender = renderDrawableToJpeg(video, vW, vH, 1024, 0.8)
          if (frameRender.base64.length > 0) {
            extractedFrames.push({
              index: i + 1,
              timestampSec: Number(ts.toFixed(1)),
              timestampLabel: formatDurationClock(ts),
              mimeType: 'image/jpeg',
              base64Data: frameRender.base64,
              previewDataUrl: frameRender.dataUrl,
            })
          }
        }

        if (extractedFrames.length > 0) {
          const coverSource = extractedFrames[0]
          const thumbRender = renderDrawableToJpeg(video, vW, vH, 260, 0.7)
          return {
            id,
            kind: 'video',
            name: file.name || 'video.mp4',
            mimeType: normalizedMime,
            sizeBytes: file.size,
            width: vW,
            height: vH,
            durationSec: Number(rawDuration.toFixed(1)),
            previewDataUrl: coverSource?.previewDataUrl || thumbRender.dataUrl,
            videoPreviewUrl: playerPreviewUrl,
            thumbDataUrl: thumbRender.dataUrl || FALLBACK_VIDEO_POSTER_DATA_URL,
            extractedFrames,
            nativeVideoBase64: rawVideoFallback.base64,
            nativeVideoMimeType: rawVideoFallback.base64 ? rawVideoFallback.mimeType : undefined,
          }
        }
      }
    }
  } catch {
    // Graceful fallback to raw video bytes below when <video>/<canvas> is unsupported
  } finally {
    if (seekUrl) {
      try {
        URL.revokeObjectURL(seekUrl)
      } catch {
        // ignore URL revoke error
      }
    }
  }

  if (rawVideoFallback.base64) {
    return {
      id,
      kind: 'video',
      name: file.name || 'video.mp4',
      mimeType: rawVideoFallback.mimeType,
      sizeBytes: file.size,
      width: 1280,
      height: 720,
      durationSec: undefined,
      previewDataUrl: FALLBACK_VIDEO_POSTER_DATA_URL,
      videoPreviewUrl: playerPreviewUrl,
      thumbDataUrl: FALLBACK_VIDEO_POSTER_DATA_URL,
      extractedFrames: [],
      nativeVideoBase64: rawVideoFallback.base64,
      nativeVideoMimeType: rawVideoFallback.mimeType,
    }
  }

  if (playerPreviewUrl) {
    try {
      URL.revokeObjectURL(playerPreviewUrl)
    } catch {
      // ignore URL revoke error
    }
  }
  throw new Error('VIDEO_TOO_LARGE_FOR_RAW_FALLBACK')
}

export function revokeAttachmentObjectUrls(attachments: readonly FeryalMediaAttachment[]) {
  for (const att of attachments) {
    if (att.videoPreviewUrl) {
      try {
        URL.revokeObjectURL(att.videoPreviewUrl)
      } catch {
        // ignore URL revoke error
      }
    }
  }
}

let mediaSeqCounter = 0

export async function processFeryalMediaFile(file: File): Promise<FeryalMediaAttachment> {
  mediaSeqCounter = (mediaSeqCounter + 1) % 1_000_000
  const id = `media-${Date.now()}-${mediaSeqCounter}`
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
      const imgMime = normalizeImageMime(att.mimeType, att.name)
      if (usedChars + att.base64Data.length <= MAX_TOTAL_PAYLOAD_CHARS) {
        mediaParts.push({
          mimeType: imgMime,
          data: att.base64Data,
          label: `[Attached Photo: ${att.name} (${att.width}x${att.height})]`,
        })
        usedChars += att.base64Data.length
      }
      if (claudeImages.length < 8) {
        claudeImages.push({
          mediaType: imgMime,
          data: att.base64Data,
          label: `[Attached Photo: ${att.name} (${att.width}x${att.height})]`,
        })
      }
    } else if (att.kind === 'video') {
      if (
        att.nativeVideoBase64 &&
        att.nativeVideoMimeType &&
        attachments.length === 1 &&
        usedChars + att.nativeVideoBase64.length <= 3_400_000
      ) {
        mediaParts.push({
          mimeType: att.nativeVideoMimeType,
          data: att.nativeVideoBase64,
          label: `[Attached Video Stream: ${att.name} (${att.durationSec ?? 0}s)]`,
        })
        usedChars += att.nativeVideoBase64.length
      }

      if (att.extractedFrames && att.extractedFrames.length > 0) {
        for (const frame of att.extractedFrames.slice(0, VIDEO_KEYFRAME_COUNT)) {
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

export function buildVisionRequestPayload(params: {
  prompt: string
  locale: 'ar' | 'en'
  brand?: string
  branch?: string
  period?: string
  workspaceContext?: string
  attachments: readonly FeryalMediaAttachment[]
}): FeryalVisionRequestPayload {
  let usedChars = 0
  const mediaItems: FeryalVisionMediaItemPayload[] = []

  for (const att of params.attachments.slice(0, 4)) {
    if (att.kind === 'image' && att.base64Data) {
      if (usedChars + att.base64Data.length > MAX_TOTAL_PAYLOAD_CHARS) continue
      usedChars += att.base64Data.length
      mediaItems.push({
        id: att.id,
        kind: 'image',
        name: att.name,
        mimeType: normalizeImageMime(att.mimeType, att.name),
        width: att.width,
        height: att.height,
        base64Data: att.base64Data,
      })
      continue
    }

    if (att.kind === 'video') {
      const frames: FeryalVisionFramePayload[] = []
      for (const frame of (att.extractedFrames ?? []).slice(0, VIDEO_KEYFRAME_COUNT)) {
        if (!frame.base64Data) continue
        if (usedChars + frame.base64Data.length > MAX_TOTAL_PAYLOAD_CHARS) break
        usedChars += frame.base64Data.length
        frames.push({
          index: frame.index,
          timestampSec: frame.timestampSec,
          timestampLabel: frame.timestampLabel,
          mimeType: 'image/jpeg',
          base64Data: frame.base64Data,
        })
      }

      let includeNativeBase64: string | undefined
      let includeNativeMime: string | undefined
      if (
        att.nativeVideoBase64 &&
        att.nativeVideoMimeType &&
        (frames.length === 0 ||
          (params.attachments.length === 1 &&
            usedChars + att.nativeVideoBase64.length <= MAX_TOTAL_PAYLOAD_CHARS))
      ) {
        usedChars += att.nativeVideoBase64.length
        includeNativeBase64 = att.nativeVideoBase64
        includeNativeMime = att.nativeVideoMimeType
      }

      if (frames.length > 0 || includeNativeBase64) {
        mediaItems.push({
          id: att.id,
          kind: 'video',
          name: att.name,
          mimeType: normalizeVideoMime(att.mimeType, att.name),
          width: att.width,
          height: att.height,
          durationSec: att.durationSec,
          extractedFrames: frames,
          nativeVideoBase64: includeNativeBase64,
          nativeVideoMimeType: includeNativeMime,
        })
      }
    }
  }

  return {
    prompt: params.prompt,
    locale: params.locale,
    ...(params.brand && params.brand !== 'all' ? { brand: params.brand } : {}),
    ...(params.branch && params.branch !== 'all' ? { branch: params.branch } : {}),
    ...(params.period ? { period: params.period } : {}),
    ...(params.workspaceContext ? { workspaceContext: params.workspaceContext } : {}),
    mediaItems,
  }
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
  errorCode?: string
}

export const FERYAL_PRICE_TABLE_UPLOAD_EN =
  'I cannot read prices out of this image as Odoo data. Paste the price table as text or Excel. Anything you paste is Proposed / User Input, not Odoo Verified Actuals. OCR, if you run it, must stay tagged User Input.'

export const FERYAL_PRICE_TABLE_UPLOAD_AR =
  'لا أقرأ الأسعار من هذه الصورة كبيانات Odoo. الصق جدول الأسعار كنص أو Excel. أي رقم تلصقه هو Proposed / User Input وليس Odoo Verified Actuals. أي OCR يبقى موسوماً User Input.'

export const FERYAL_VISUAL_NOT_ODOO_EN =
  'This photo or video is not an Odoo read. I will not invent figures from it.'

export const FERYAL_VISUAL_NOT_ODOO_AR =
  'هذه الصورة أو هذا الفيديو ليسا قراءة من Odoo. لن أخترع أرقاماً منهما.'

export function looksLikePriceTableUpload(prompt: string, fileNames: readonly string[]): boolean {
  const blob = `${prompt} ${fileNames.join(' ')}`
  return /(price|prices|تسعير|سعر|اسعار|أسعار|menu|kwd|د\.ك|excel|xlsx|csv)/i.test(blob)
}

export function honestVisualReply(input: {
  prompt: string
  lang: 'ar' | 'en'
  fileNames: readonly string[]
}): string {
  const priceTable = looksLikePriceTableUpload(input.prompt, input.fileNames)
  if (input.lang === 'ar') return priceTable ? FERYAL_PRICE_TABLE_UPLOAD_AR : FERYAL_VISUAL_NOT_ODOO_AR
  return priceTable ? FERYAL_PRICE_TABLE_UPLOAD_EN : FERYAL_VISUAL_NOT_ODOO_EN
}

export interface RunFeryalVisionOptions {
  fetchImpl?: typeof fetch
  keys: {
    google: string
    anthropic: string
  }
  models?: {
    google?: string
    anthropic?: string
  }
  timeoutMs?: number
}

export interface RunFeryalVisionOutcome {
  response: FeryalVisionAuditResponse
  httpStatus: number
  telemetry?: {
    provider: 'google' | 'anthropic'
    modelId: string
    latencyMs: number
    tokensIn: number | null
    tokensOut: number | null
    status: 'ok' | 'error'
    errorCode: string | null
  }
}

const MIN_VISION_API_KEY_LENGTH = 20
const DEFAULT_VISION_GEMINI_MODEL = 'gemini-3.1-pro-preview'
const DEFAULT_VISION_ANTHROPIC_MODEL = 'claude-sonnet-4-6'
const DEFAULT_VISION_TIMEOUT_MS = 35_000

function buildVisionSystemPrompt(locale: 'ar' | 'en', contextSummary: string): string {
  if (locale === 'ar') {
    return [
      'أنتِ «فريال»، المستشارة التنفيذية للعمليات والجودة في شركة فنتشر فودز (Venture Foods Kuwait).',
      'مهمتك: تقديم فحص بصري تشغيلي دقيق ومختصر وموجّه للإدارة التنفيذية لما يظهر فعلياً في الصور أو لقطات الفيديو المرفقة فقط (تحضير المطبخ، جودة وتقديم الأطباق، التغليف، ترتيب المخزون والأرفف، النظافة وسلامة الغذاء، وضوح اللوحات أو الملصقات أو الإيصالات المطبوعة).',
      contextSummary ? `سياق الفلتر التشغيلي الحالي للمستخدم: ${contextSummary}` : '',
      'قواعد صارمة غير قابلة للتجاوز (100% أمان بيانات):',
      '1) هذا الفحص البصري ليس استعلاماً من قاعدة بيانات Odoo 17. لا تخترعي ولا تقدّري أبداً أي أرقام مبيعات، أو هوامش ربح، أو تكلفة بضاعة (COGS / standard_price)، أو أرصدة دفتر أستاذ، أو أسعار عقود غير مرئية بوضوح في الصورة نفسها.',
      '2) إذا ظهر رقم مطبوع بوضوح على ملصق أو إيصال داخل الصورة، اذكِريه كما هو مع وسم صريح: (مرئي في المرفق — غير مطابق تلقائياً مع Odoo).',
      '3) ابدئي الرد بسطر الحكم التنفيذي باستخدام أحد الوسوم الثلاثة حصراً: «🟢 مطابق» أو «🟡 ملاحظة متوسطة» أو «🔴 مخالفة حرجة».',
      '4) نظّمي الرد في 3 نقاط موجزة وواضحة بدون حشو: (المشاهدات البصرية الدقيقة • المخاطر أو الملاحظات التشغيلية • الإجراء الفوري الموصى به للفرع).',
    ]
      .filter(Boolean)
      .join('\n')
  }

  return [
    'You are Ferial, Executive F&B Operations & Quality Advisor at Venture Foods Kuwait.',
    'Deliver a crisp, board-ready visual operational audit strictly of what is visibly observable in the attached photo(s) or video keyframes (kitchen prep, dish plating, delivery packaging integrity, shelf/chiller stock, cleanliness & PPE compliance, menu signage, or printed label/receipt legibility).',
    contextSummary ? `Active operational scope context: ${contextSummary}` : '',
    'NON-NEGOTIABLE DATA INTEGRITY RULES:',
    '1) Visual inspection is NOT an Odoo 17 database query. NEVER invent, estimate, or extrapolate unseen Odoo POS sales, GL figures, COGS, standard_price, margins, or contract prices.',
    '2) If a printed price, weight, or date is visibly legible on a receipt or label in the image, cite it strictly as "(Visible in Uploaded Media — Unverified vs Odoo)".',
    '3) Start the reply with one explicit compliance verdict tag: "🟢 Compliant", "🟡 Medium Observation", or "🔴 Critical Violation".',
    '4) Structure the analysis into 3 concise executive sections: Visual Findings, Operational Risks, and Immediate Branch Action.',
  ]
    .filter(Boolean)
    .join('\n')
}

function asObjectRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function parseIntOrNull(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.max(0, Math.round(value))
}

function extractGeminiVisionResult(payload: unknown, requestedModel: string): {
  modelId: string
  text: string
  tokensIn: number | null
  tokensOut: number | null
} | null {
  const body = asObjectRecord(payload)
  if (!body) return null
  const modelId =
    (typeof body.modelVersion === 'string' && body.modelVersion.trim()) ||
    (typeof body.model === 'string' && body.model.trim()) ||
    requestedModel
  const candidates = Array.isArray(body.candidates) ? body.candidates : []
  const first = asObjectRecord(candidates[0])
  const content = asObjectRecord(first?.content)
  const parts = Array.isArray(content?.parts) ? content.parts : []
  const text = parts
    .map((part) => {
      const r = asObjectRecord(part)
      if (!r || r.thought === true || typeof r.text !== 'string') return ''
      return r.text
    })
    .join('')
    .trim()
  if (!text) return null
  const usage = asObjectRecord(body.usageMetadata)
  return {
    modelId,
    text,
    tokensIn: parseIntOrNull(usage?.promptTokenCount),
    tokensOut: parseIntOrNull(usage?.candidatesTokenCount),
  }
}

function extractAnthropicVisionResult(payload: unknown, requestedModel: string): {
  modelId: string
  text: string
  tokensIn: number | null
  tokensOut: number | null
} | null {
  const body = asObjectRecord(payload)
  if (!body) return null
  const modelId =
    (typeof body.model === 'string' && body.model.trim()) || requestedModel
  const content = Array.isArray(body.content) ? body.content : []
  const text = content
    .map((part) => {
      const r = asObjectRecord(part)
      if (!r || r.type !== 'text' || typeof r.text !== 'string') return ''
      return r.text
    })
    .join('')
    .trim()
  if (!text) return null
  const usage = asObjectRecord(body.usage)
  return {
    modelId,
    text,
    tokensIn: parseIntOrNull(usage?.input_tokens),
    tokensOut: parseIntOrNull(usage?.output_tokens),
  }
}

export async function runFeryalVisionAnalysis(
  input: FeryalVisionRequestPayload,
  options: RunFeryalVisionOptions,
): Promise<RunFeryalVisionOutcome> {
  const locale: 'ar' | 'en' = input.locale === 'en' ? 'en' : 'ar'
  const fetchFn = options.fetchImpl ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_VISION_TIMEOUT_MS
  const googleKey = (options.keys.google ?? '').trim()
  const anthropicKey = (options.keys.anthropic ?? '').trim()
  const googleModel = (options.models?.google ?? '').trim() || DEFAULT_VISION_GEMINI_MODEL
  const anthropicModel = (options.models?.anthropic ?? '').trim() || DEFAULT_VISION_ANTHROPIC_MODEL

  const hasGoogle = googleKey.length >= MIN_VISION_API_KEY_LENGTH
  const hasAnthropic = anthropicKey.length >= MIN_VISION_API_KEY_LENGTH

  if (!hasGoogle && !hasAnthropic) {
    const unavailableMsg =
      locale === 'ar'
        ? 'خدمة الفحص البصري غير مفعّلة حالياً على الخادم (مفاتيح نماذج الرؤية غير مضبوطة). لن أخترع ملاحظات أو أرقاماً من المرفق.'
        : 'Vision inspection is currently unavailable on the server (vision model keys are not configured). No findings or figures were fabricated.'
    const badge = getComplianceBadgeMeta('yellow')
    return {
      httpStatus: 503,
      response: {
        ok: false,
        reply: unavailableMsg,
        complianceTier: 'yellow',
        complianceBadgeAr: badge.ar,
        complianceBadgeEn: badge.en,
        provider: 'deterministic',
        model: 'unavailable',
        engineLabelAr: 'الخدمة غير مفعّلة',
        engineLabelEn: 'Vision Unavailable',
        errorCode: 'VISION_PROVIDER_UNAVAILABLE',
      },
    }
  }

  const contextParts = [
    input.brand ? `Brand: ${input.brand}` : '',
    input.branch ? `Branch: ${input.branch}` : '',
    input.period ? `Period: ${input.period}` : '',
    input.workspaceContext ? `Scope: ${input.workspaceContext}` : '',
  ].filter(Boolean)
  const systemPrompt = buildVisionSystemPrompt(locale, contextParts.join(' | '))
  const userPromptText =
    input.prompt.trim() ||
    (locale === 'ar'
      ? 'افحصي الوسائط المرفقة تشغيلياً وحددي درجة المطابقة والتوصية الفورية.'
      : 'Inspect the attached operational media, assign a compliance score, and list immediate actions.')

  const geminiParts: Array<Record<string, unknown>> = []
  const claudeBlocks: Array<Record<string, unknown>> = []

  for (const item of input.mediaItems) {
    if (item.kind === 'image' && item.base64Data) {
      const safeMime = normalizeImageMime(item.mimeType, item.name)
      geminiParts.push({ text: `[Photo: ${item.name}]` })
      geminiParts.push({
        inline_data: {
          mime_type: safeMime,
          data: item.base64Data,
        },
      })
      if (claudeBlocks.length < 12) {
        claudeBlocks.push({ type: 'text', text: `[Photo: ${item.name}]` })
        claudeBlocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: safeMime,
            data: item.base64Data,
          },
        })
      }
    } else if (item.kind === 'video') {
      if (item.nativeVideoBase64 && item.nativeVideoMimeType) {
        geminiParts.push({
          text: `[Video Clip: ${item.name}${item.durationSec ? ` (${item.durationSec}s)` : ''}]`,
        })
        geminiParts.push({
          inline_data: {
            mime_type: normalizeVideoMime(item.nativeVideoMimeType, item.name),
            data: item.nativeVideoBase64,
          },
        })
      }
      if (item.extractedFrames && item.extractedFrames.length > 0) {
        for (const frame of item.extractedFrames.slice(0, 6)) {
          if (!frame.base64Data) continue
          const label = `[Video "${item.name}" Keyframe #${frame.index} @ ${frame.timestampLabel}]`
          geminiParts.push({ text: label })
          geminiParts.push({
            inline_data: {
              mime_type: 'image/jpeg',
              data: frame.base64Data,
            },
          })
          if (claudeBlocks.length < 14) {
            claudeBlocks.push({ type: 'text', text: label })
            claudeBlocks.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: frame.base64Data,
              },
            })
          }
        }
      }
    }
  }

  geminiParts.push({ text: userPromptText })
  const hasClaudeImageBlocks = claudeBlocks.some((b) => b.type === 'image')
  claudeBlocks.push({ type: 'text', text: userPromptText })

  let lastTelemetry: RunFeryalVisionOutcome['telemetry']

  // 1. Primary Multimodal Vision Provider: Google Gemini (`gemini-3.1-pro-preview` inline_data)
  if (hasGoogle && geminiParts.length > 1) {
    const started = Date.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(googleModel)}:generateContent`
      const res = await fetchFn(geminiUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': googleKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: geminiParts }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1600,
          },
        }),
      })
      const latencyMs = Date.now() - started
      if (res.ok) {
        const json: unknown = await res.json().catch(() => null)
        const parsed = extractGeminiVisionResult(json, googleModel)
        if (parsed) {
          const complianceTier = inferVisionComplianceFromText(parsed.text)
          const badge = getComplianceBadgeMeta(complianceTier)
          return {
            httpStatus: 200,
            telemetry: {
              provider: 'google',
              modelId: parsed.modelId,
              latencyMs,
              tokensIn: parsed.tokensIn,
              tokensOut: parsed.tokensOut,
              status: 'ok',
              errorCode: null,
            },
            response: {
              ok: true,
              reply: parsed.text,
              complianceTier,
              complianceBadgeAr: badge.ar,
              complianceBadgeEn: badge.en,
              provider: 'gemini',
              model: parsed.modelId,
              engineLabelAr: `فحص بصري · ${parsed.modelId}`,
              engineLabelEn: `Vision Audit · ${parsed.modelId}`,
            },
          }
        }
      }
      lastTelemetry = {
        provider: 'google',
        modelId: googleModel,
        latencyMs,
        tokensIn: null,
        tokensOut: null,
        status: 'error',
        errorCode: res.ok ? 'EMPTY_VISION_REPLY' : `HTTP_${res.status}`,
      }
    } catch {
      lastTelemetry = {
        provider: 'google',
        modelId: googleModel,
        latencyMs: Date.now() - started,
        tokensIn: null,
        tokensOut: null,
        status: 'error',
        errorCode: 'VISION_NETWORK_OR_TIMEOUT',
      }
    } finally {
      clearTimeout(timer)
    }
  }

  // 2. Secondary Vision Fallback: Anthropic Claude Vision (for images & extracted video JPEG keyframes)
  if (hasAnthropic && hasClaudeImageBlocks) {
    const started = Date.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetchFn('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: anthropicModel,
          max_tokens: 1600,
          system: systemPrompt,
          messages: [{ role: 'user', content: claudeBlocks }],
        }),
      })
      const latencyMs = Date.now() - started
      if (res.ok) {
        const json: unknown = await res.json().catch(() => null)
        const parsed = extractAnthropicVisionResult(json, anthropicModel)
        if (parsed) {
          const complianceTier = inferVisionComplianceFromText(parsed.text)
          const badge = getComplianceBadgeMeta(complianceTier)
          return {
            httpStatus: 200,
            telemetry: {
              provider: 'anthropic',
              modelId: parsed.modelId,
              latencyMs,
              tokensIn: parsed.tokensIn,
              tokensOut: parsed.tokensOut,
              status: 'ok',
              errorCode: null,
            },
            response: {
              ok: true,
              reply: parsed.text,
              complianceTier,
              complianceBadgeAr: badge.ar,
              complianceBadgeEn: badge.en,
              provider: 'claude',
              model: parsed.modelId,
              engineLabelAr: `فحص بصري · ${parsed.modelId}`,
              engineLabelEn: `Vision Audit · ${parsed.modelId}`,
            },
          }
        }
      }
      lastTelemetry = {
        provider: 'anthropic',
        modelId: anthropicModel,
        latencyMs,
        tokensIn: null,
        tokensOut: null,
        status: 'error',
        errorCode: res.ok ? 'EMPTY_VISION_REPLY' : `HTTP_${res.status}`,
      }
    } catch {
      lastTelemetry = {
        provider: 'anthropic',
        modelId: anthropicModel,
        latencyMs: Date.now() - started,
        tokensIn: null,
        tokensOut: null,
        status: 'error',
        errorCode: 'VISION_NETWORK_OR_TIMEOUT',
      }
    } finally {
      clearTimeout(timer)
    }
  }

  const failedMsg =
    locale === 'ar'
      ? 'تعذّر إتمام الفحص البصري للوسائط حالياً — يرجى إعادة المحاولة بعد لحظات.'
      : 'Could not complete visual media inspection right now — please retry shortly.'
  const badge = getComplianceBadgeMeta('yellow')
  return {
    httpStatus: 502,
    telemetry: lastTelemetry,
    response: {
      ok: false,
      reply: failedMsg,
      complianceTier: 'yellow',
      complianceBadgeAr: badge.ar,
      complianceBadgeEn: badge.en,
      provider: 'deterministic',
      model: 'error',
      engineLabelAr: 'تعذّر الفحص البصري',
      engineLabelEn: 'Vision Error',
      errorCode: 'VISION_PROVIDER_FAILED',
    },
  }
}

export async function callFeryalVisionInspector(
  params: {
    prompt: string
    lang: 'ar' | 'en'
    workspaceContext: string
    brand?: string
    branch?: string
    period?: string
    attachments: readonly FeryalMediaAttachment[]
  },
  options?: { fetchImpl?: typeof fetch },
): Promise<FeryalVisionAuditResponse | null> {
  const payload = buildVisionRequestPayload({
    prompt: params.prompt,
    locale: params.lang,
    brand: params.brand,
    branch: params.branch,
    period: params.period,
    workspaceContext: params.workspaceContext,
    attachments: params.attachments,
  })

  if (payload.mediaItems.length === 0) {
    return null
  }

  const fetchFn = options?.fetchImpl ?? globalThis.fetch
  try {
    const res = await fetchFn('/api/erp/feryal/vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = (await res.json().catch(() => null)) as Partial<FeryalVisionAuditResponse> | null
    if (data && typeof data.reply === 'string' && data.reply.trim().length > 0) {
      const tier: VisionComplianceTier =
        data.complianceTier === 'green' ||
        data.complianceTier === 'yellow' ||
        data.complianceTier === 'red'
          ? data.complianceTier
          : inferVisionComplianceFromText(data.reply)
      const badge = getComplianceBadgeMeta(tier)
      return {
        ok: Boolean(res.ok && data.ok),
        reply: data.reply,
        complianceTier: tier,
        complianceBadgeAr: data.complianceBadgeAr || badge.ar,
        complianceBadgeEn: data.complianceBadgeEn || badge.en,
        provider:
          data.provider === 'gemini' || data.provider === 'claude'
            ? data.provider
            : 'deterministic',
        model: data.model || 'vision',
        engineLabelAr:
          data.engineLabelAr || (params.lang === 'ar' ? 'فحص الصور والفيديو' : 'Vision Inspector'),
        engineLabelEn: data.engineLabelEn || 'Vision Inspector',
        errorCode: data.errorCode,
      }
    }
  } catch {
    // Return honest connection error below
  }

  const badge = getComplianceBadgeMeta('yellow')
  return {
    ok: false,
    reply:
      params.lang === 'ar'
        ? 'تعذّر الاتصال بخدمة الفحص البصري — يرجى المحاولة مرة أخرى.'
        : 'Connection failed while running visual inspection — please retry.',
    complianceTier: 'yellow',
    complianceBadgeAr: badge.ar,
    complianceBadgeEn: badge.en,
    provider: 'deterministic',
    model: 'connection_error',
    engineLabelAr: 'تعذّر الاتصال',
    engineLabelEn: 'Connection Error',
    errorCode: 'CONNECTION_ERROR',
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
      return 'افحصي الصور والفيديو المرفقين بدقة، وحددي درجة المطابقة (🟢 مطابق / 🟡 ملاحظة متوسطة / 🔴 مخالفة حرجة) مع المشاهدات البصرية الدقيقة والتوصية التشغيلية الفورية.'
    }
    if (hasVideo) {
      return 'شاهدي الفيديو المرفق وحلّلي لقطاته الزمنية بدقة (خط التحضير، التنظيم، الجودة، أو النظافة) وحددي درجة المطابقة (🟢 مطابق / 🟡 ملاحظة متوسطة / 🔴 مخالفة حرجة) مع خطة العمل.'
    }
    return 'افحصي الصورة المرفقة بدقة (جودة وتقديم الطبق، التغليف، النظافة والثلاجات، المخزون، أو وضوح الملصقات) وحددي درجة المطابقة (🟢 مطابق / 🟡 ملاحظة متوسطة / 🔴 مخالفة حرجة) مع الملاحظات البصرية الدقيقة.'
  }
  if (hasVideo && hasImage) {
    return 'Inspect the attached photos and video carefully, assign a compliance score (🟢 Compliant / 🟡 Medium Observation / 🔴 Critical Violation), cite exact visual findings, and give an immediate operational action plan.'
  }
  if (hasVideo) {
    return 'Analyze the attached video across its keyframes, score compliance (🟢 Compliant / 🟡 Medium Observation / 🔴 Critical Violation), and provide an immediate operational recommendation.'
  }
  return 'Inspect the attached image in detail (dish plating, packaging, kitchen hygiene, shelf stock, or label legibility), score compliance (🟢 / 🟡 / 🔴), and list exact visual findings.'
}
