'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Delete, KeyRound, Lock, Settings, ShieldCheck, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import {
  changeManagerPin,
  unlockExecutiveSession,
  verifyManagerPin,
} from '@/lib/governance-compliance'

export interface ExecutivePinModalProps {
  open: boolean
  actionTitleAr?: string
  actionTitleEn?: string
  initialMode?: 'verify' | 'change'
  onClose: () => void
  onVerified?: () => void
}

export function ExecutivePinModal({
  open,
  actionTitleAr,
  actionTitleEn,
  initialMode = 'verify',
  onClose,
  onVerified,
}: ExecutivePinModalProps) {
  const { locale } = useI18n()
  const isAr = locale === 'ar'

  const [mounted, setMounted] = useState(false)
  const [mode, setMode] = useState<'verify' | 'change'>(initialMode)
  const [changeStep, setChangeStep] = useState<'current' | 'next'>('current')
  const [verifiedCurrentPin, setVerifiedCurrentPin] = useState('')
  const [digits, setDigits] = useState<string[]>([])
  const [shaking, setShaking] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const hiddenInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    setMode(initialMode)
    setChangeStep('current')
    setVerifiedCurrentPin('')
    setDigits([])
    setShaking(false)
    setErrorMsg(null)
    setSuccessMsg(null)
    const t = window.setTimeout(() => hiddenInputRef.current?.focus(), 60)
    return () => window.clearTimeout(t)
  }, [open, initialMode])

  const triggerShake = useCallback((msg: string) => {
    setErrorMsg(msg)
    setShaking(true)
    window.setTimeout(() => {
      setShaking(false)
      setDigits([])
    }, 380)
  }, [])

  const evaluateFourDigits = useCallback(
    (code: string) => {
      if (mode === 'verify') {
        if (verifyManagerPin(code)) {
          unlockExecutiveSession()
          setErrorMsg(null)
          setSuccessMsg(
            isAr
              ? 'تم تفعيل وضع المدير لمدة ١٥ دقيقة 🔓'
              : 'Executive Session unlocked for 15 minutes 🔓',
          )
          window.setTimeout(() => {
            onVerified?.()
            onClose()
          }, 180)
        } else {
          triggerShake(
            isAr
              ? 'رمز المدير غير صحيح — حاول مرة أخرى'
              : 'Incorrect Manager PIN — please try again',
          )
        }
        return
      }

      // Change PIN flow: Step 1 (verify current PIN) -> Step 2 (set new 4-digit PIN)
      if (changeStep === 'current') {
        if (verifyManagerPin(code)) {
          setVerifiedCurrentPin(code)
          setChangeStep('next')
          setDigits([])
          setErrorMsg(null)
        } else {
          triggerShake(
            isAr ? 'الرمز الحالي غير صحيح' : 'Current Manager PIN is incorrect',
          )
        }
      } else {
        const res = changeManagerPin(verifiedCurrentPin, code)
        if (res.ok) {
          unlockExecutiveSession()
          setErrorMsg(null)
          setSuccessMsg(
            isAr
              ? 'تم تحديث وتشفير رمز المدير الجديد بنجاح ✅'
              : 'New Manager PIN hashed & saved ✅',
          )
          window.setTimeout(() => {
            setMode('verify')
            setChangeStep('current')
            setDigits([])
            setSuccessMsg(null)
            onVerified?.()
            onClose()
          }, 520)
        } else {
          triggerShake((isAr ? res.errorAr : res.errorEn) ?? 'Error')
        }
      }
    },
    [changeStep, isAr, mode, onClose, onVerified, triggerShake, verifiedCurrentPin],
  )

  const pushDigit = useCallback(
    (d: string) => {
      if (!/^\d$/.test(d) || shaking || Boolean(successMsg)) return
      setErrorMsg(null)
      setDigits((prev) => {
        if (prev.length >= 4) return prev
        const next = [...prev, d]
        if (next.length === 4) {
          const full = next.join('')
          window.setTimeout(() => evaluateFourDigits(full), 75)
        }
        return next
      })
    },
    [evaluateFourDigits, shaking, successMsg],
  )

  const popDigit = useCallback(() => {
    if (shaking || Boolean(successMsg)) return
    setErrorMsg(null)
    setDigits((prev) => prev.slice(0, -1))
  }, [shaking, successMsg])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (/^\d$/.test(e.key)) {
        e.preventDefault()
        pushDigit(e.key)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        popDigit()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open, popDigit, pushDigit])

  if (!mounted || !open) return null

  const activeSlot = Math.min(3, digits.length)

  const titleText =
    mode === 'change'
      ? changeStep === 'current'
        ? isAr
          ? 'تأكيد رمز المدير الحالي'
          : 'Confirm Current Manager PIN'
        : isAr
          ? 'أدخل رمز المدير الجديد (٤ أرقام)'
          : 'Enter New 4-Digit Manager PIN'
      : isAr
        ? 'اعتماد المدير التنفيذي'
        : 'Executive Manager Authorization'

  const subtitleText =
    mode === 'change'
      ? changeStep === 'current'
        ? isAr
          ? 'أدخل الرمز الحالي قبل تعيين رمز سري جديد مشفّر'
          : 'Verify your current PIN before setting a new hashed PIN'
        : isAr
          ? 'سيتم تشفير الرمز وحفظه محلياً وتفعيل الجلسة فوراً'
          : 'Your new PIN is hashed locally and unlocks a 15-min session'
      : actionTitleAr || actionTitleEn
        ? isAr
          ? actionTitleAr ?? ''
          : actionTitleEn ?? ''
        : isAr
          ? 'أدخل رمز المدير من ٤ خانات لفتح الصلاحية لمدة ١٥ دقيقة'
          : 'Enter your 4-digit PIN to unlock a 15-minute Executive Session'

  return createPortal(
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px] transition-opacity duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <style>{`
        @keyframes vfPinShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-7px); }
          40% { transform: translateX(7px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(4px); }
        }
        .vf-pin-shake {
          animation: vfPinShake 340ms cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }
      `}</style>

      <div
        role="dialog"
        aria-modal="true"
        aria-label={titleText}
        className="w-full max-w-[390px] rounded-3xl bg-[#F7F7F8] p-5 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.22)] transition-all duration-150 dark:bg-[#0D151C] dark:ring-1 dark:ring-white/[0.08]"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-emerald-950/70 dark:text-emerald-300">
              {mode === 'change' ? (
                <KeyRound className="h-5 w-5" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 className="text-[16px] font-semibold tracking-tight text-neutral-950 dark:text-white">
                {titleText}
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500 dark:text-slate-400">
                {subtitleText}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white text-neutral-500 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors duration-150 hover:text-neutral-900 dark:bg-[#111A22] dark:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Hidden mobile input for touch keyboard convenience */}
        <input
          ref={hiddenInputRef}
          type="tel"
          inputMode="numeric"
          autoComplete="one-time-code"
          value=""
          onChange={(e) => {
            const ch = e.target.value.replace(/\D/g, '').slice(-1)
            if (ch) pushDigit(ch)
          }}
          className="sr-only"
          aria-hidden
        />

        {/* 4 Pure White Elevated OTP Tiles (Always LTR order digit 1 -> 4) */}
        <div
          dir="ltr"
          onClick={() => hiddenInputRef.current?.focus()}
          className={`mt-5 flex items-center justify-center gap-3 ${
            shaking ? 'vf-pin-shake' : ''
          }`}
        >
          {[0, 1, 2, 3].map((idx) => {
            const filled = idx < digits.length
            const isCurrent = idx === activeSlot && digits.length < 4 && !successMsg
            return (
              <div
                key={idx}
                className={`flex h-16 w-14 cursor-text items-center justify-center rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-150 dark:bg-[#111A22] ${
                  errorMsg
                    ? 'ring-2 ring-rose-500/80 shadow-[0_0_0_4px_rgba(244,63,94,0.10)]'
                    : isCurrent
                      ? 'ring-2 ring-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.14)]'
                      : filled
                        ? 'ring-1 ring-emerald-500/40'
                        : 'ring-1 ring-neutral-200/70 dark:ring-white/[0.08]'
                }`}
              >
                <span
                  className={`h-3.5 w-3.5 rounded-full transition-all duration-150 ${
                    filled
                      ? errorMsg
                        ? 'scale-100 bg-rose-500'
                        : 'scale-100 bg-emerald-600 dark:bg-emerald-400'
                      : 'scale-0 bg-neutral-300'
                  }`}
                  style={{
                    transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                />
              </div>
            )
          })}
        </div>

        {/* Feedback Banner */}
        <div className="mt-3 min-h-[22px] text-center">
          {errorMsg ? (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{errorMsg}</p>
          ) : successMsg ? (
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{successMsg}</span>
            </p>
          ) : (
            <p className="text-[11.5px] text-neutral-400 dark:text-slate-400">
              {isAr
                ? 'التحقق التلقائي فور إدخال الرقم الرابع • الجلسة ١٥ دقيقة'
                : 'Auto-verifies on 4th digit • 15-minute Executive Session'}
            </p>
          )}
        </div>

        {/* Tactile Pure White Keypad */}
        <div dir="ltr" className="mt-3 grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => pushDigit(n)}
              className="flex h-11 cursor-pointer items-center justify-center rounded-2xl bg-white text-[16px] font-semibold tabular-nums text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-150 hover:bg-emerald-50/60 active:scale-95 dark:bg-[#111A22] dark:text-white dark:hover:bg-emerald-950/40"
            >
              {n}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setDigits([])}
            className="flex h-11 cursor-pointer items-center justify-center rounded-2xl bg-neutral-100 text-xs font-medium text-neutral-600 transition-all duration-150 hover:bg-neutral-200/70 active:scale-95 dark:bg-white/[0.05] dark:text-slate-300"
          >
            {isAr ? 'مسح' : 'Clear'}
          </button>

          <button
            type="button"
            onClick={() => pushDigit('0')}
            className="flex h-11 cursor-pointer items-center justify-center rounded-2xl bg-white text-[16px] font-semibold tabular-nums text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-150 hover:bg-emerald-50/60 active:scale-95 dark:bg-[#111A22] dark:text-white dark:hover:bg-emerald-950/40"
          >
            0
          </button>

          <button
            type="button"
            onClick={popDigit}
            aria-label={isAr ? 'حذف رقم' : 'Backspace'}
            className="flex h-11 cursor-pointer items-center justify-center rounded-2xl bg-neutral-100 text-neutral-700 transition-all duration-150 hover:bg-neutral-200/70 active:scale-95 dark:bg-white/[0.05] dark:text-slate-200"
          >
            <Delete className="h-4 w-4" />
          </button>
        </div>

        {/* Footer: Toggle Change Manager PIN ⚙️ */}
        <div className="mt-4 flex items-center justify-between pt-1 text-xs">
          <span className="inline-flex items-center gap-1 text-neutral-400">
            <Lock className="h-3.5 w-3.5" />
            <span>{isAr ? 'مشفّر محلياً بالمتصفح' : 'Locally hashed'}</span>
          </span>

          <button
            type="button"
            onClick={() => {
              setErrorMsg(null)
              setDigits([])
              setChangeStep('current')
              setMode((m) => (m === 'verify' ? 'change' : 'verify'))
            }}
            className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-white px-3 py-1.5 font-medium text-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors duration-150 hover:text-emerald-700 dark:bg-[#111A22] dark:text-slate-200 dark:hover:text-emerald-300"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>
              {mode === 'verify'
                ? isAr
                  ? 'تغيير رمز المدير ⚙️'
                  : 'Change Manager PIN ⚙️'
                : isAr
                  ? 'العودة للتحقق ↩'
                  : 'Back to Verify ↩'}
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
