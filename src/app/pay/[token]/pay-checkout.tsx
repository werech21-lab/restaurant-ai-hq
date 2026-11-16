'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, CreditCard, Loader2, ShieldCheck } from 'lucide-react'
import { checkoutPaymentAction } from '@/app/actions/payments'
import { StateBlock } from '@/components/ui/state-block'
import { type FormatLocale } from '@/lib/format'
import { METHOD_LABEL } from '@/lib/gateways'
import { useI18n } from '@/lib/i18n'

const METHOD_LABEL_EN: Record<string, string> = {
  KNET: 'KNET',
  VISA_MASTER: 'Visa / Mastercard',
  APPLE_PAY: 'Apple Pay',
}

const KNOWN_ERROR_EN: Array<[RegExp, string]> = [
  [/غير مدعومة/, 'This payment method is not supported.'],
  [/غير موجود/, 'Payment link was not found.'],
  [/غير مفعّلة/, 'Payment gateway is currently inactive.'],
  [/التشغيل الحي/, 'Live payments confirm automatically via gateway webhook.'],
  [/انتهت صلاحية/, 'This payment link has expired. Please request a new link.'],
  [/قابل للتحصيل/, 'This payment link is no longer open for collection.'],
  [/تغير المتبقي/, 'Invoice balance changed. Please request an updated link.'],
]

function sanitizeCheckoutMessage(raw: string, isAr: boolean): string {
  const clean = raw.replace(/\s+/g, ' ').trim()
  if (
    !clean ||
    /ERR:|stack|https?:\/\/|prisma|sql|secret|token|password|apiKey/i.test(clean)
  ) {
    return isAr
      ? 'تعذّر إتمام عملية الدفع حالياً. يرجى المحاولة لاحقاً.'
      : 'Unable to complete the payment right now. Please try again.'
  }
  if (!isAr && /[\u0600-\u06FF]/.test(clean)) {
    for (const [pattern, enText] of KNOWN_ERROR_EN) {
      if (pattern.test(clean)) return enText
    }
    return 'Unable to complete the payment right now. Please try again.'
  }
  return clean
}

export function PayCheckout({
  token,
  methods,
  isTestMode,
  providerActive,
  paid,
  locale: localeProp,
}: {
  token: string
  methods: string[]
  isTestMode: boolean
  providerActive: boolean
  paid: boolean
  locale?: FormatLocale
}) {
  const router = useRouter()
  const { locale: ctxLocale } = useI18n()
  const locale: FormatLocale = localeProp ?? (ctxLocale === 'en' ? 'en' : 'ar')
  const isAr = locale !== 'en'
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState('')

  async function pay(method: string) {
    setError('')
    setMessage('')
    setPending(method)
    try {
      const result = await checkoutPaymentAction(token, method)
      setPending('')
      if (!result.ok) {
        setError(sanitizeCheckoutMessage(result.message ?? '', isAr))
        return
      }
      setMessage(
        isAr
          ? result.message || 'تم تأكيد الدفع بنجاح'
          : 'Payment confirmed successfully.',
      )
      router.refresh()
    } catch {
      setPending('')
      setError(
        isAr
          ? 'تعذّر الاتصال ببوابة الدفع حالياً. يرجى المحاولة مرة أخرى.'
          : 'Unable to reach the payment gateway right now. Please try again.',
      )
    }
  }

  if (paid) {
    return (
      <div
        role="status"
        className="flex items-start gap-2.5 rounded-2xl border p-4 text-sm font-semibold"
        style={{
          backgroundColor: 'var(--ds-positive-bg)',
          borderColor: 'var(--ds-positive-border)',
          color: 'var(--ds-positive)',
        }}
      >
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <span>
          {isAr
            ? 'تم استلام المبلغ وتأكيد السداد بنجاح. يمكن إغلاق هذه الصفحة.'
            : 'Payment received and confirmed. You may close this page.'}
        </span>
      </div>
    )
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-3">
      <div className="ds-surface-subtle flex items-start gap-2.5 rounded-xl p-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
        <ShieldCheck
          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400"
          aria-hidden="true"
        />
        <p>
          {isTestMode
            ? isAr
              ? 'وضع الاختبار المحلي: التأكيد يحاكي كي نت وفيزا وأبل باي دون خصم بطاقة حقيقية، مع ترحيل القيد المحاسبي التجريبي.'
              : 'Test mode: local confirmation simulates KNET, Visa/Mastercard, and Apple Pay without charging a real card.'
            : isAr
              ? 'التشغيل الحي ينتظر توقيع الويب هوك من البوابة. هذه الشاشة لا تجمع بيانات البطاقة.'
              : 'Live checkout awaits verified gateway webhook confirmation. Card details are never stored on this screen.'}
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-xl border px-3.5 py-2.5 text-sm font-semibold"
          style={{
            backgroundColor: 'var(--ds-negative-bg)',
            borderColor: 'var(--ds-negative-border)',
            color: 'var(--ds-negative)',
          }}
        >
          {error}
        </div>
      ) : null}

      {message ? (
        <div
          role="status"
          className="rounded-xl border px-3.5 py-2.5 text-sm font-semibold"
          style={{
            backgroundColor: 'var(--ds-positive-bg)',
            borderColor: 'var(--ds-positive-border)',
            color: 'var(--ds-positive)',
          }}
        >
          {message}
        </div>
      ) : null}

      {methods.length === 0 ? (
        <StateBlock
          state="unavailable"
          compact
          locale={locale}
          title={
            isAr
              ? 'لا توجد وسائل دفع مفعّلة'
              : 'No payment methods available'
          }
          description={
            isAr
              ? 'بوابة الدفع لا تملك وسائل دفع مفعّلة حالياً.'
              : 'No active payment methods are configured for this gateway right now.'
          }
        />
      ) : (
        <div className="ds-surface-subtle grid gap-2.5 rounded-2xl p-3.5">
          {methods.map((method) => {
            const label = isAr
              ? (METHOD_LABEL[method] ?? method)
              : (METHOD_LABEL_EN[method] ?? method)
            const actionText =
              pending === method
                ? isAr
                  ? 'جارٍ التأكيد…'
                  : 'Confirming…'
                : isAr
                  ? `ادفع عبر ${label}`
                  : `Pay via ${label}`

            return (
              <button
                key={method}
                type="button"
                aria-label={actionText}
                disabled={!providerActive || pending !== ''}
                onClick={() => pay(method)}
                className="ds-motion ds-focus-ring inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400"
              >
                {pending === method ? (
                  <Loader2
                    className="h-4 w-4 shrink-0 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <CreditCard className="h-4 w-4 shrink-0" aria-hidden="true" />
                )}
                <span>{actionText}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
