'use client'

import React, { useEffect, useRef } from 'react'
import { Camera, FileSpreadsheet, Film, ImagePlus, Loader2, RotateCw, Sparkles, X } from 'lucide-react'
import {
  CAMERA_CAPTURE_ACCEPT,
  DOCUMENT_INTAKE_ACCEPT,
  FERYAL_VISION_QUICK_PRESETS,
  PHOTO_VIDEO_UPLOAD_ACCEPT,
  formatDurationClock,
  formatFileSizeShort,
  getComplianceBadgeMeta,
  isSpreadsheetIntakeFile,
  isSupportedDocumentIntakeFile,
  isSupportedMediaFile,
  type FeryalMediaAttachment,
  type StoredAttachmentMeta,
  type VisionComplianceTier,
} from '@/lib/feryal-multimodal'

export function FeryalMediaPickerButton({
  isAr,
  disabled,
  processing,
  uploadingIntake,
  attachmentCount,
  onFilesSelected,
  onIntakeFileSelected,
  openPickerRef,
  openCameraRef,
  size = 'md',
}: {
  isAr: boolean
  disabled?: boolean
  processing?: boolean
  uploadingIntake?: boolean
  attachmentCount?: number
  onFilesSelected: (files: File[]) => void
  onIntakeFileSelected?: (file: File) => void
  openPickerRef?: React.MutableRefObject<(() => void) | null>
  openCameraRef?: React.MutableRefObject<(() => void) | null>
  size?: 'sm' | 'md' | 'lg'
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const intakeInputRef = useRef<HTMLInputElement | null>(null)
  const cameraRef = useRef<HTMLInputElement | null>(null)
  const hCls =
    size === 'lg'
      ? 'h-[48px] sm:h-[50px]'
      : size === 'sm'
        ? 'h-9'
        : 'h-[44px] sm:h-[46px]'
  const busy = Boolean(disabled || processing || uploadingIntake)

  useEffect(() => {
    if (openPickerRef) {
      openPickerRef.current = () => inputRef.current?.click()
    }
    if (openCameraRef) {
      openCameraRef.current = () => cameraRef.current?.click()
    }
    return () => {
      if (openPickerRef) openPickerRef.current = null
      if (openCameraRef) openCameraRef.current = null
    }
  }, [openCameraRef, openPickerRef])

  return (
    <div className="inline-flex flex-wrap sm:flex-nowrap items-center gap-1.5">
      <input
        ref={inputRef}
        type="file"
        data-feryal-media-input="true"
        accept={PHOTO_VIDEO_UPLOAD_ACCEPT}
        multiple
        aria-label={
          isAr
            ? 'رفع صور أو فيديو للفحص البصري'
            : 'Upload photos or videos for visual inspection'
        }
        className="hidden"
        onChange={(e) => {
          const allFiles = Array.from(e.target.files ?? [])
          if (onIntakeFileSelected) {
            const firstSheet = allFiles.find((f) => isSpreadsheetIntakeFile(f))
            if (firstSheet) {
              onIntakeFileSelected(firstSheet)
              e.target.value = ''
              return
            }
          }
          const raw = allFiles.filter(isSupportedMediaFile)
          if (raw.length > 0) {
            onFilesSelected(raw)
          }
          e.target.value = ''
        }}
      />

      {onIntakeFileSelected ? (
        <input
          ref={intakeInputRef}
          type="file"
          data-feryal-intake-input="true"
          accept={DOCUMENT_INTAKE_ACCEPT}
          aria-label={
            isAr
              ? 'رفع جدول أسعار Excel أو CSV أو صورة قائمة للمراجعة'
              : 'Upload Excel, CSV, or menu price image for review'
          }
          className="hidden"
          onChange={(e) => {
            const selected = Array.from(e.target.files ?? []).find(isSupportedDocumentIntakeFile)
            if (selected) {
              onIntakeFileSelected(selected)
            }
            e.target.value = ''
          }}
        />
      ) : null}

      <input
        ref={cameraRef}
        type="file"
        data-feryal-camera-input="true"
        accept={CAMERA_CAPTURE_ACCEPT}
        capture="environment"
        aria-label={isAr ? 'التقاط صورة أو فيديو بالكاميرا' : 'Capture photo or video with camera'}
        className="hidden"
        onChange={(e) => {
          const raw = Array.from(e.target.files ?? []).filter(isSupportedMediaFile)
          if (raw.length > 0) {
            onFilesSelected(raw)
          }
          e.target.value = ''
        }}
      />

      {onIntakeFileSelected ? (
        <button
          type="button"
          data-feryal-intake-trigger="true"
          disabled={busy}
          onClick={() => intakeInputRef.current?.click()}
          title={
            isAr
              ? 'رفع جدول أسعار (.xlsx / .csv) أو صورة قائمة للمراجعة والتأكيد'
              : 'Upload price sheet (.xlsx / .csv) or menu image for review & confirmation'
          }
          aria-label={
            isAr
              ? 'رفع جدول أسعار أو صورة قائمة للمراجعة'
              : 'Upload price sheet or menu image for review'
          }
          className={`relative inline-flex ${hCls} shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl bg-emerald-50 px-2.5 sm:px-3 text-xs font-bold text-emerald-900 ring-1 ring-emerald-500/25 transition-all duration-150 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-45 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-500/30 dark:hover:bg-emerald-900/60`}
        >
          {uploadingIntake ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-700 dark:text-emerald-300" />
          ) : (
            <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
          )}
          <span className="hidden whitespace-nowrap md:inline">
            {uploadingIntake
              ? isAr
                ? 'استخراج…'
                : 'Extracting…'
              : isAr
                ? 'جدول أسعار'
                : 'Price Sheet'}
          </span>
        </button>
      ) : null}

      <button
        type="button"
        data-feryal-media-trigger="true"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        title={
          isAr
            ? 'رفع صورة (JPG/PNG/WEBP) أو فيديو (MP4/WEBM/MOV) للفحص البصري'
            : 'Upload photo (JPG/PNG/WEBP) or video (MP4/WEBM/MOV) for visual analysis'
        }
        aria-label={isAr ? 'رفع صورة أو فيديو' : 'Upload photo or video'}
        className={`relative inline-flex ${hCls} shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl bg-[#F6F7F8] px-2.5 sm:px-3 text-xs font-semibold text-neutral-700 transition-all duration-150 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-45 dark:bg-[#09110E] dark:text-slate-200 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300`}
      >
        {processing ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-600 dark:text-emerald-400" />
        ) : (
          <ImagePlus className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        )}
        <span className="hidden whitespace-nowrap sm:inline">
          {processing
            ? isAr
              ? 'تجهيز…'
              : 'Preparing…'
            : isAr
              ? 'صورة / فيديو'
              : 'Photo / Video'}
        </span>
        {attachmentCount && attachmentCount > 0 ? (
          <span className="btn-colored inline-flex h-5 min-w-[20px] items-center justify-center rounded-md bg-emerald-600 px-1.5 text-xs font-bold tabular-nums text-white">
            {attachmentCount}
          </span>
        ) : null}
      </button>

      <button
        type="button"
        data-feryal-camera-trigger="true"
        disabled={busy}
        onClick={() => cameraRef.current?.click()}
        title={isAr ? 'التقاط مباشر بالكاميرا (طبق / مطبخ / رف)' : 'Live Camera Capture'}
        aria-label={isAr ? 'التقاط بالكاميرا' : 'Capture with camera'}
        className={`inline-flex ${hCls} shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-[#F6F7F8] px-2.5 sm:px-3 text-xs font-semibold text-neutral-700 transition-all duration-150 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-45 dark:bg-[#09110E] dark:text-slate-200 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300`}
      >
        <Camera className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span className="hidden whitespace-nowrap xl:inline">
          {isAr ? 'كاميرا' : 'Camera'}
        </span>
      </button>
    </div>
  )
}

export function FeryalVisionQuickBar({
  isAr,
  disabled,
  onSelectVisionPrompt,
  onOpenPicker,
}: {
  isAr: boolean
  disabled?: boolean
  onSelectVisionPrompt: (prompt: string) => void
  onOpenPicker?: () => void
}) {
  return (
    <div className="mb-2 flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar rounded-2xl bg-neutral-100/90 p-1 dark:bg-white/[0.06]">
      {onOpenPicker ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onOpenPicker}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-xs ring-1 ring-emerald-500/20 transition-all duration-150 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-50 dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-500/30"
        >
          <Camera className="h-3.5 w-3.5" />
          <span>{isAr ? 'رفع صورة / فيديو' : 'Photo / Video'}</span>
        </button>
      ) : null}

      {FERYAL_VISION_QUICK_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelectVisionPrompt(isAr ? preset.promptAr : preset.promptEn)}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium text-neutral-600 transition-all duration-150 hover:bg-white/75 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
        >
          <span>{isAr ? preset.badgeAr : preset.badgeEn}</span>
        </button>
      ))}
    </div>
  )
}

export function FeryalVisionCompliancePill({
  tier,
  isAr,
}: {
  tier?: VisionComplianceTier
  isAr: boolean
}) {
  if (!tier) return null
  const badge = getComplianceBadgeMeta(tier)
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-0.5 text-xs font-semibold ${badge.pillClassName}`}
    >
      <span>{isAr ? badge.ar : badge.en}</span>
    </span>
  )
}

export function readJpegExifOrientationClient(bytes: Uint8Array): number {
  if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return 1
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 2
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      break
    }
    const marker = bytes[offset + 1]
    if (marker === 0xff) {
      offset += 1
      continue
    }
    if (marker === 0xd8 || marker === 0x01) {
      offset += 2
      continue
    }
    if (marker === 0xd9 || marker === 0xda) {
      break
    }
    const segLength = view.getUint16(offset + 2, false)
    if (segLength < 2 || offset + 2 + segLength > bytes.length) {
      break
    }
    if (marker === 0xe1 && segLength >= 10) {
      const exifStart = offset + 4
      const isExifHeader =
        bytes[exifStart] === 0x45 &&
        bytes[exifStart + 1] === 0x78 &&
        bytes[exifStart + 2] === 0x69 &&
        bytes[exifStart + 3] === 0x66 &&
        bytes[exifStart + 4] === 0x00 &&
        bytes[exifStart + 5] === 0x00
      if (isExifHeader) {
        const tiffStart = exifStart + 6
        if (tiffStart + 8 <= bytes.length) {
          const byteOrder = view.getUint16(tiffStart, false)
          const littleEndian =
            byteOrder === 0x4949 ? true : byteOrder === 0x4d4d ? false : null
          if (littleEndian !== null && view.getUint16(tiffStart + 2, littleEndian) === 0x002a) {
            const ifdOffset = view.getUint32(tiffStart + 4, littleEndian)
            const dirStart = tiffStart + ifdOffset
            if (dirStart + 2 <= bytes.length) {
              const entryCount = view.getUint16(dirStart, littleEndian)
              for (let i = 0; i < entryCount; i++) {
                const entryPos = dirStart + 2 + i * 12
                if (entryPos + 12 > bytes.length) break
                const tag = view.getUint16(entryPos, littleEndian)
                if (tag === 0x0112) {
                  const orientation = view.getUint16(entryPos + 8, littleEndian)
                  if (orientation >= 1 && orientation <= 8) {
                    return orientation
                  }
                }
              }
            }
          }
        }
      }
    }
    offset += 2 + segLength
  }
  return 1
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(',')
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl
  if (typeof atob !== 'function') return new Uint8Array(0)
  const binary = atob(base64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i)
  }
  return out
}

export async function rotateOrNormalizeImageFileClient(
  file: File,
  extraClockwiseDegrees: 0 | 90 | 180 | 270 = 0,
): Promise<File> {
  const isImg =
    (file.type || '').toLowerCase().startsWith('image/') ||
    /\.(jpe?g|png|webp)$/i.test(file.name || '')
  if (!isImg || typeof document === 'undefined') {
    return file
  }

  let exifOrientation = 1
  try {
    const rawBuf = await file.arrayBuffer()
    exifOrientation = readJpegExifOrientationClient(new Uint8Array(rawBuf))
  } catch {
    exifOrientation = 1
  }

  if (exifOrientation === 1 && extraClockwiseDegrees === 0) {
    return file
  }

  const objectUrl =
    typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
      ? URL.createObjectURL(file)
      : ''

  try {
    let drawable: CanvasImageSource | null = null
    let srcW = 0
    let srcH = 0
    let closeBitmap: (() => void) | null = null

    if (typeof createImageBitmap === 'function') {
      try {
        const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
        drawable = bmp
        srcW = bmp.width
        srcH = bmp.height
        closeBitmap = () => bmp.close()
      } catch {
        drawable = null
      }
    }

    if (!drawable && objectUrl && typeof Image !== 'undefined') {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'))
        el.src = objectUrl
      })
      drawable = img
      srcW = img.naturalWidth
      srcH = img.naturalHeight
    }

    if (!drawable || srcW <= 0 || srcH <= 0) {
      return file
    }

    const maxEdge = 2200
    const scale = Math.min(1, maxEdge / Math.max(srcW, srcH))
    const drawW = Math.max(1, Math.round(srcW * scale))
    const drawH = Math.max(1, Math.round(srcH * scale))
    const swapAxes = extraClockwiseDegrees === 90 || extraClockwiseDegrees === 270

    const canvas = document.createElement('canvas')
    canvas.width = swapAxes ? drawH : drawW
    canvas.height = swapAxes ? drawW : drawH

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      closeBitmap?.()
      return file
    }

    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    if (extraClockwiseDegrees === 90) {
      ctx.translate(canvas.width, 0)
      ctx.rotate(Math.PI / 2)
    } else if (extraClockwiseDegrees === 180) {
      ctx.translate(canvas.width, canvas.height)
      ctx.rotate(Math.PI)
    } else if (extraClockwiseDegrees === 270) {
      ctx.translate(0, canvas.height)
      ctx.rotate((3 * Math.PI) / 2)
    }
    ctx.drawImage(drawable, 0, 0, drawW, drawH)
    ctx.restore()
    closeBitmap?.()

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    const jpegBytes = dataUrlToUint8Array(dataUrl)
    if (jpegBytes.length === 0) {
      return file
    }
    const baseName = (file.name || 'price-sheet').replace(/\.[a-z0-9]+$/i, '')
    const suffix = extraClockwiseDegrees > 0 ? `-rot${extraClockwiseDegrees}` : ''
    const safeBytes = new Uint8Array(jpegBytes.byteLength)
    safeBytes.set(jpegBytes)
    return new File([safeBytes], `${baseName}${suffix}.jpg`, { type: 'image/jpeg' })
  } catch {
    return file
  } finally {
    if (objectUrl) {
      try {
        URL.revokeObjectURL(objectUrl)
      } catch {
        // ignore URL revoke error
      }
    }
  }
}

export async function rotateMediaAttachment90Client(
  att: FeryalMediaAttachment,
): Promise<FeryalMediaAttachment> {
  if (att.kind !== 'image' || !att.previewDataUrl || typeof document === 'undefined' || typeof Image === 'undefined') {
    return att
  }
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'))
      el.src = att.previewDataUrl
    })
    const srcW = Math.max(1, img.naturalWidth || att.width || 800)
    const srcH = Math.max(1, img.naturalHeight || att.height || 600)

    const buildRotated = (maxEdge: number, quality: number) => {
      const scale = Math.min(1, maxEdge / Math.max(srcW, srcH))
      const drawW = Math.max(1, Math.round(srcW * scale))
      const drawH = Math.max(1, Math.round(srcH * scale))
      const canvas = document.createElement('canvas')
      canvas.width = drawH
      canvas.height = drawW
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.save()
        ctx.translate(canvas.width, 0)
        ctx.rotate(Math.PI / 2)
        ctx.drawImage(img, 0, 0, drawW, drawH)
        ctx.restore()
      }
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      const commaIdx = dataUrl.indexOf(',')
      return {
        dataUrl,
        base64: commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl,
        width: canvas.width,
        height: canvas.height,
      }
    }

    const full = buildRotated(1440, 0.86)
    const thumb = buildRotated(260, 0.74)
    if (!full.base64) return att

    return {
      ...att,
      mimeType: 'image/jpeg',
      width: full.width,
      height: full.height,
      previewDataUrl: full.dataUrl,
      thumbDataUrl: thumb.dataUrl,
      base64Data: full.base64,
    }
  } catch {
    return att
  }
}

export function FeryalPendingAttachmentsTray({
  isAr,
  attachments,
  processing,
  errorText,
  onRemove,
  onRotateAttachment,
  onClearAll,
  onApplyPresetPrompt,
}: {
  isAr: boolean
  attachments: readonly FeryalMediaAttachment[]
  processing?: boolean
  errorText?: string | null
  onRemove: (id: string) => void
  onRotateAttachment?: (id: string) => void
  onClearAll: () => void
  onApplyPresetPrompt?: (prompt: string) => void
}) {
  if (attachments.length === 0 && !processing && !errorText) return null

  return (
    <div className="mb-2.5 space-y-2 rounded-2xl bg-[#F6F7F8] p-2.5 dark:bg-[#09110E]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800 dark:text-slate-200">
          <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>
            {processing
              ? isAr
                ? 'جارٍ استخراج لقطات الفيديو وتجهيز الوسائط…'
                : 'Extracting keyframes & preparing media…'
              : isAr
                ? `المرفقات الجاهزة للفحص (${attachments.length})`
                : `Ready for visual inspection (${attachments.length})`}
          </span>
        </div>

        {attachments.length > 0 ? (
          <button
            type="button"
            onClick={onClearAll}
            className="shrink-0 cursor-pointer whitespace-nowrap rounded-xl bg-white px-2.5 py-1 text-xs font-semibold text-neutral-600 shadow-2xs hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:bg-[#101C17] dark:text-slate-300"
          >
            {isAr ? 'مسح الكل' : 'Clear all'}
          </button>
        ) : null}
      </div>

      {errorText ? (
        <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
          {errorText}
        </div>
      ) : null}

      {attachments.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="group relative flex max-w-full items-start gap-2.5 rounded-xl bg-white p-2 shadow-2xs ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10"
            >
              {att.kind === 'video' && att.videoPreviewUrl ? (
                <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-[#09110E]">
                  <video
                    src={att.videoPreviewUrl}
                    poster={att.previewDataUrl}
                    controls
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-[#09110E]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={att.previewDataUrl}
                    alt={att.name}
                    className="h-full w-full object-cover"
                  />
                  {att.kind === 'video' ? (
                    <span className="absolute bottom-1 start-1 inline-flex items-center gap-1 rounded-md bg-emerald-950/85 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-emerald-100">
                      <Film className="h-2.5 w-2.5" />
                      {formatDurationClock(att.durationSec)}
                    </span>
                  ) : null}
                </div>
              )}

              <div className="min-w-0 max-w-[240px] space-y-1 pe-5">
                <div className="truncate text-xs font-semibold text-neutral-900 dark:text-white">
                  {att.name}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500 dark:text-slate-400">
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    {att.kind === 'video'
                      ? isAr
                        ? `فيديو · ${att.extractedFrames?.length || 1} لقطات`
                        : `Video · ${att.extractedFrames?.length || 1} frames`
                      : isAr
                        ? 'صورة'
                        : 'Photo'}
                  </span>
                  <span dir="ltr" className="tabular-nums">
                    {formatFileSizeShort(att.sizeBytes)}
                  </span>
                  {att.kind === 'image' && onRotateAttachment ? (
                    <button
                      type="button"
                      data-rotate-media-attachment={att.id}
                      onClick={() => onRotateAttachment(att.id)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-700 transition hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-emerald-950/60"
                    >
                      <RotateCw className="h-3 w-3 shrink-0" aria-hidden />
                      <span>{isAr ? 'تدوير 90°' : 'Rotate 90°'}</span>
                    </button>
                  ) : null}
                </div>

                {att.kind === 'video' && att.extractedFrames && att.extractedFrames.length > 1 ? (
                  <div className="flex items-center gap-1 pt-0.5">
                    {att.extractedFrames.slice(0, 4).map((fr) => (
                      <div
                        key={fr.index}
                        title={fr.timestampLabel}
                        className="relative h-6 w-8 overflow-hidden rounded bg-neutral-100 dark:bg-[#09110E]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={fr.previewDataUrl}
                          alt={fr.timestampLabel}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => onRemove(att.id)}
                aria-label={isAr ? 'إزالة المرفق' : 'Remove attachment'}
                className="absolute end-1.5 top-1.5 inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 transition-colors hover:bg-rose-100 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:bg-emerald-950/60 dark:text-slate-300"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {attachments.length > 0 && onApplyPresetPrompt ? (
        <div className="flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar rounded-xl bg-neutral-100/90 p-1 dark:bg-white/[0.06]">
          <span className="shrink-0 whitespace-nowrap ps-2 text-xs font-medium text-neutral-500 dark:text-slate-400">
            {isAr ? 'قالب فحص:' : 'Preset:'}
          </span>
          {FERYAL_VISION_QUICK_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApplyPresetPrompt(isAr ? preset.promptAr : preset.promptEn)}
              className="shrink-0 cursor-pointer whitespace-nowrap rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 shadow-2xs ring-1 ring-slate-900/[0.05] transition-all duration-150 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:bg-[#101C17] dark:text-slate-200 dark:ring-emerald-500/20 dark:hover:bg-emerald-950/60"
            >
              {isAr ? preset.badgeAr : preset.badgeEn}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function FeryalMessageAttachmentsGallery({
  attachmentsMeta,
  isAr,
}: {
  attachmentsMeta?: readonly StoredAttachmentMeta[]
  isAr: boolean
}) {
  if (!attachmentsMeta || attachmentsMeta.length === 0) return null

  return (
    <div className="mb-2.5 flex flex-wrap gap-2">
      {attachmentsMeta.map((att) => (
        <div
          key={att.id}
          className="overflow-hidden rounded-xl bg-white/95 p-1.5 shadow-2xs ring-1 ring-slate-900/[0.05] dark:bg-[#101C17]/95 dark:ring-emerald-500/10"
        >
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-100 dark:bg-[#09110E]">
              {att.thumbDataUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={att.thumbDataUrl}
                  alt={att.name}
                  className="h-full w-full object-cover"
                />
              ) : att.kind === 'video' ? (
                <Film className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Camera className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              )}
              {att.kind === 'video' && att.durationSec ? (
                <span className="absolute bottom-1 start-1 inline-flex items-center gap-1 rounded bg-emerald-950/85 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-emerald-100">
                  <Film className="h-2.5 w-2.5" />
                  {formatDurationClock(att.durationSec)}
                </span>
              ) : null}
            </div>
            <div className="min-w-0 px-1 text-start">
              <div className="max-w-[180px] truncate text-xs font-semibold text-neutral-900 dark:text-white">
                {att.name}
              </div>
              <div className="mt-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                {att.kind === 'video'
                  ? isAr
                    ? `فيديو (${att.frameCount ?? 4} لقطات)`
                    : `Video (${att.frameCount ?? 4} frames)`
                  : isAr
                    ? 'صورة مرفقة'
                    : 'Attached photo'}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
