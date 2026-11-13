'use client'

import React, { useEffect, useRef } from 'react'
import { Camera, Film, ImagePlus, Loader2, Sparkles, X } from 'lucide-react'
import {
  FERYAL_VISION_QUICK_PRESETS,
  formatDurationClock,
  formatFileSizeShort,
  getComplianceBadgeMeta,
  isSupportedMediaFile,
  type FeryalMediaAttachment,
  type StoredAttachmentMeta,
  type VisionComplianceTier,
} from '@/lib/feryal-multimodal'

export function FeryalMediaPickerButton({
  isAr,
  disabled,
  processing,
  attachmentCount,
  onFilesSelected,
  openPickerRef,
  openCameraRef,
  size = 'md',
}: {
  isAr: boolean
  disabled?: boolean
  processing?: boolean
  attachmentCount?: number
  onFilesSelected: (files: File[]) => void
  openPickerRef?: React.MutableRefObject<(() => void) | null>
  openCameraRef?: React.MutableRefObject<(() => void) | null>
  size?: 'md' | 'lg'
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const cameraRef = useRef<HTMLInputElement | null>(null)
  const hCls = size === 'lg' ? 'h-[48px] sm:h-[52px]' : 'h-[44px] sm:h-[48px]'

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
    <div className="inline-flex shrink-0 items-center gap-1.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*,video/mp4,video/webm,video/quicktime,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const raw = Array.from(e.target.files ?? []).filter(isSupportedMediaFile)
          if (raw.length > 0) {
            onFilesSelected(raw)
          }
          e.target.value = ''
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const raw = Array.from(e.target.files ?? []).filter(isSupportedMediaFile)
          if (raw.length > 0) {
            onFilesSelected(raw)
          }
          e.target.value = ''
        }}
      />

      <button
        type="button"
        disabled={disabled || processing}
        onClick={() => inputRef.current?.click()}
        title={
          isAr
            ? 'إرفاق صورة (JPG/PNG/WEBP) أو فيديو (MP4/WEBM/MOV) لتحليل فريال البصري'
            : 'Attach photo (JPG/PNG/WEBP) or video (MP4/WEBM/MOV) for Feryal Vision'
        }
        aria-label={isAr ? 'إرفاق صورة أو فيديو' : 'Attach photo or video'}
        className={`relative inline-flex ${hCls} shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl bg-[#F6F7F8] px-3 sm:px-3.5 text-xs font-semibold text-neutral-700 transition-all duration-150 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-45 dark:bg-[#09110E] dark:text-slate-200 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300`}
      >
        {processing ? (
          <Loader2 className="h-4 w-4 animate-spin text-emerald-600 dark:text-emerald-400" />
        ) : (
          <ImagePlus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        )}
        <span className="hidden sm:inline">
          {processing
            ? isAr
              ? 'جارٍ التجهيز…'
              : 'Processing…'
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
        disabled={disabled || processing}
        onClick={() => cameraRef.current?.click()}
        title={isAr ? 'التقاط مباشر بالكاميرا (طبق / مطبخ / فاتورة)' : 'Live Camera Capture'}
        aria-label={isAr ? 'التقاط بالكاميرا' : 'Capture with camera'}
        className={`inline-flex ${hCls} w-[42px] sm:w-[46px] shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-[#F6F7F8] text-neutral-700 transition-all duration-150 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-45 dark:bg-[#09110E] dark:text-slate-200 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300`}
      >
        <Camera className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
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
    <div className="mb-2.5 flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-neutral-100/90 dark:bg-white/[0.06]">
      {onOpenPicker ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onOpenPicker}
          className="inline-flex shrink-0 whitespace-nowrap cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-[13px] font-semibold text-emerald-800 shadow-sm ring-1 ring-emerald-500/20 transition-all duration-150 hover:bg-emerald-50 disabled:opacity-50 dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-500/30"
        >
          <Camera className="h-3.5 w-3.5" />
          <span>{isAr ? 'إرفاق صورة / فيديو 👁️' : 'Upload Photo / Video 👁️'}</span>
        </button>
      ) : null}

      {FERYAL_VISION_QUICK_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelectVisionPrompt(isAr ? preset.promptAr : preset.promptEn)}
          className="inline-flex shrink-0 whitespace-nowrap cursor-pointer items-center gap-1 rounded-xl px-3.5 py-2 text-[13px] font-medium text-neutral-600 transition-all duration-150 hover:bg-white/75 hover:text-neutral-900 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
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
      className={`inline-flex shrink-0 whitespace-nowrap items-center gap-1 rounded-lg px-2.5 py-0.5 text-xs font-semibold ${badge.pillClassName}`}
    >
      <span>{isAr ? badge.ar : badge.en}</span>
    </span>
  )
}

export function FeryalPendingAttachmentsTray({
  isAr,
  attachments,
  processing,
  errorText,
  onRemove,
  onClearAll,
  onApplyPresetPrompt,
}: {
  isAr: boolean
  attachments: readonly FeryalMediaAttachment[]
  processing?: boolean
  errorText?: string | null
  onRemove: (id: string) => void
  onClearAll: () => void
  onApplyPresetPrompt?: (prompt: string) => void
}) {
  if (attachments.length === 0 && !processing && !errorText) return null

  return (
    <div className="mb-3 space-y-2.5 rounded-2xl bg-[#F6F7F8] p-3 dark:bg-[#09110E]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-800 dark:text-slate-200">
          <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>
            {processing
              ? isAr
                ? 'جارٍ استخراج لقطات الفيديو الزمنية وضغط الوسائط بأعلى دقة…'
                : 'Extracting chronological video keyframes & optimizing compact HD media…'
              : isAr
                ? `وسائط جاهزة للفحص البصري مع فريال (${attachments.length})`
                : `Visual media ready for Feryal inspection (${attachments.length})`}
          </span>
        </div>

        {attachments.length > 0 ? (
          <button
            type="button"
            onClick={onClearAll}
            className="shrink-0 whitespace-nowrap cursor-pointer rounded-xl bg-white px-2.5 py-1 text-[13px] font-semibold text-neutral-600 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:text-rose-600 dark:bg-[#101C17] dark:text-slate-300"
          >
            {isAr ? 'مسح المرفقات' : 'Clear all'}
          </button>
        ) : null}
      </div>

      {errorText ? (
        <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
          {errorText}
        </div>
      ) : null}

      {attachments.length > 0 ? (
        <div className="flex flex-wrap gap-2.5">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="group relative flex max-w-full items-start gap-3 rounded-xl bg-white p-2.5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10"
            >
              {att.kind === 'video' && att.videoPreviewUrl ? (
                <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-[#09110E]">
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
                <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-[#09110E]">
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

              <div className="min-w-0 max-w-[260px] space-y-1 pe-5">
                <div className="truncate text-xs font-semibold text-neutral-900 dark:text-white">
                  {att.name}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500 dark:text-slate-400">
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    {att.kind === 'video'
                      ? isAr
                        ? `فيديو (${formatDurationClock(att.durationSec)}) · ${att.extractedFrames?.length ?? 0} لقطات`
                        : `Video (${formatDurationClock(att.durationSec)}) · ${att.extractedFrames?.length ?? 0} frames`
                      : isAr
                        ? 'صورة عالية الدقة'
                        : 'HD Photo'}
                  </span>
                  <span dir="ltr" className="tabular-nums">
                    {formatFileSizeShort(att.sizeBytes)}
                  </span>
                </div>

                {att.kind === 'video' && att.extractedFrames && att.extractedFrames.length > 1 ? (
                  <div className="flex items-center gap-1 pt-0.5">
                    {att.extractedFrames.slice(0, 6).map((fr) => (
                      <div
                        key={fr.index}
                        title={fr.timestampLabel}
                        className="relative h-7 w-9 overflow-hidden rounded bg-neutral-100 dark:bg-[#09110E]"
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
                className="absolute end-1.5 top-1.5 inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 transition-colors hover:bg-rose-100 hover:text-rose-700 dark:bg-emerald-950/60 dark:text-slate-300"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {attachments.length > 0 && onApplyPresetPrompt ? (
        <div className="flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-neutral-100/90 dark:bg-white/[0.06]">
          <span className="shrink-0 whitespace-nowrap ps-2 text-[12px] font-medium text-neutral-500 dark:text-slate-400">
            {isAr ? 'فحص سريع:' : 'Quick inspection:'}
          </span>
          {FERYAL_VISION_QUICK_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApplyPresetPrompt(isAr ? preset.promptAr : preset.promptEn)}
              className="shrink-0 whitespace-nowrap cursor-pointer rounded-xl bg-white px-3.5 py-2 text-[13px] font-medium text-neutral-700 shadow-sm ring-1 ring-slate-900/[0.05] transition-all duration-150 hover:bg-emerald-50 hover:text-emerald-800 dark:bg-[#101C17] dark:text-slate-200 dark:ring-emerald-500/20 dark:hover:bg-emerald-950/60"
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
    <div className="mb-3 flex flex-wrap gap-2">
      {attachmentsMeta.map((att) => (
        <div
          key={att.id}
          className="overflow-hidden rounded-xl bg-white/95 p-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17]/95 dark:ring-emerald-500/10"
        >
          <div className="flex items-center gap-2.5">
            <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-[#09110E]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={att.thumbDataUrl}
                alt={att.name}
                className="h-full w-full object-cover"
              />
              {att.kind === 'video' ? (
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
                    ? `🎥 فيديو محلّل (${att.frameCount ?? 6} لقطات زمنية)`
                    : `🎥 Video analyzed (${att.frameCount ?? 6} keyframes)`
                  : isAr
                    ? '📷 صورة موثّقة ومحلّلة بصرياً'
                    : '📷 Visually audited photo'}
              </div>
              {att.frameThumbs && att.frameThumbs.length > 1 ? (
                <div className="mt-1 flex items-center gap-1">
                  {att.frameThumbs.map((ft, idx) => (
                    <div
                      key={`${att.id}-f-${idx}`}
                      className="h-6 w-8 overflow-hidden rounded bg-neutral-100 dark:bg-[#09110E]"
                      title={ft.timestampLabel}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ft.thumbDataUrl}
                        alt={ft.timestampLabel}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
