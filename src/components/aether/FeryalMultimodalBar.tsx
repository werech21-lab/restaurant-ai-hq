'use client'

import React, { useRef } from 'react'
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
  size = 'md',
}: {
  isAr: boolean
  disabled?: boolean
  processing?: boolean
  attachmentCount?: number
  onFilesSelected: (files: File[]) => void
  size?: 'md' | 'lg'
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const cameraRef = useRef<HTMLInputElement | null>(null)
  const hCls = size === 'lg' ? 'h-[52px]' : 'h-[48px]'

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
        className={`relative inline-flex ${hCls} shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl bg-[#F7F7F8] px-3 text-xs font-semibold text-neutral-700 transition-all duration-150 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-45 dark:bg-[#0D1614] dark:text-slate-200 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300`}
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
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[10.5px] font-bold tabular-nums text-white">
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
        className={`inline-flex ${hCls} w-[46px] shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-[#F7F7F8] text-neutral-700 transition-all duration-150 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-45 dark:bg-[#0D1614] dark:text-slate-200 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300`}
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
    <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
      {onOpenPicker ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onOpenPicker}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11.5px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-950/60 dark:text-emerald-300"
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
          className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-[#F7F7F8] px-3 py-1 text-[11.5px] font-medium text-neutral-700 transition-colors hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-50 dark:bg-[#0D1614] dark:text-slate-300 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-200"
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
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${badge.pillClassName}`}
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
    <div className="mb-3 rounded-2xl bg-[#F7F7F8] p-3 space-y-2.5 dark:bg-[#0D1614]">
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
            className="cursor-pointer rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-neutral-600 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:text-rose-600 dark:bg-neutral-900 dark:text-slate-300"
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
              className="group relative flex max-w-full items-start gap-3 rounded-xl bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-neutral-900"
            >
              {att.kind === 'video' && att.videoPreviewUrl ? (
                <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800">
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
                <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={att.previewDataUrl}
                    alt={att.name}
                    className="h-full w-full object-cover"
                  />
                  {att.kind === 'video' ? (
                    <span className="absolute bottom-1 start-1 inline-flex items-center gap-1 rounded-md bg-emerald-950/85 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-100">
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
                <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-neutral-500 dark:text-slate-400">
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
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
                    {att.extractedFrames.slice(0, 5).map((fr) => (
                      <div
                        key={fr.index}
                        title={fr.timestampLabel}
                        className="relative h-7 w-9 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800"
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
                className="absolute end-1.5 top-1.5 inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition-colors hover:bg-rose-100 hover:text-rose-700 dark:bg-neutral-800 dark:text-slate-300"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {attachments.length > 0 && onApplyPresetPrompt ? (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[11px] font-medium text-neutral-400">
            {isAr ? 'فحص سريع:' : 'Quick inspection:'}
          </span>
          {FERYAL_VISION_QUICK_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApplyPresetPrompt(isAr ? preset.promptAr : preset.promptEn)}
              className="cursor-pointer rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-colors hover:bg-emerald-50 hover:text-emerald-800 dark:bg-neutral-900 dark:text-slate-200 dark:hover:bg-emerald-950/60"
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
          className="overflow-hidden rounded-xl bg-white/95 p-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:bg-neutral-900/95"
        >
          <div className="flex items-center gap-2">
            <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={att.thumbDataUrl}
                alt={att.name}
                className="h-full w-full object-cover"
              />
              {att.kind === 'video' ? (
                <span className="absolute bottom-1 start-1 inline-flex items-center gap-1 rounded bg-emerald-950/85 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-100">
                  <Film className="h-2.5 w-2.5" />
                  {formatDurationClock(att.durationSec)}
                </span>
              ) : null}
            </div>
            <div className="min-w-0 px-1 text-start">
              <div className="max-w-[180px] truncate text-xs font-semibold text-neutral-900 dark:text-white">
                {att.name}
              </div>
              <div className="mt-0.5 text-[10.5px] font-medium text-emerald-700 dark:text-emerald-300">
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
                      className="h-6 w-8 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800"
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
