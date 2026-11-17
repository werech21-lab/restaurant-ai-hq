'use client'

import { CalendarClock, CreditCard, ShieldCheck } from 'lucide-react'
import { PayCheckout } from '@/app/pay/[token]/pay-checkout'
import { StateBlock } from '@/components/ui/state-block'
import { WhatsAppButton } from '@/components/whatsapp-button'
import {
  STATUS_LABEL,
  UNAVAILABLE_DASH,
  formatDateTime,
  formatKwd,
  getUnavailableTooltip,
} from '@/lib/format'
import { PROVIDER_LABEL } from '@/lib/gateways'
import { LanguageSwitch, useI18n } from '@/lib/i18n'

const PROVIDER_LABEL_EN: Record<string, string> = {
  MYFATOORAH: 'MyFatoorah',
  STRIPE: 'Stripe',
  TAP: 'Tap Payments',
}

const STATUS_LABEL_EN: Record<string, string> = {
  PENDING: 'Pending Payment',
  PAID: 'Paid',
  EXPIRED: 'Expired',
  DRAFT: 'Draft',
}

export type PayViewData = {
  token: string
  companyName: string
  titleAr: string
  titleEn: string
  partyName: string
  amount: number | null
  gatewayProvider: string
  status: string
  createdAtIso: string | null
  paidAtIso: string | null
  expiresAtIso: string | null
  methods: string[]
  isTestMode: boolean
  providerActive: boolean
  whatsappHref?: string
}

export type PayViewProps =
  | { state: 'notFound' }
  | { state: 'error' }
  | { state: 'ready'; data: PayViewData }

export function PayView(props: PayViewProps) {
  const { locale } = useI18n()
  const isAr = locale !== 'en'
  const dir = isAr ? 'rtl' : 'ltr'
  const unavailableTip = getUnavailableTooltip(locale)

  return (
    <main
      dir={dir}
      className="relative flex min-h-screen w-full min-w-0 items-center justify-center overflow-x-hidden bg-[#F6F7F8] px-4 pb-12 pt-16 text-slate-900 dark:bg-[#090E0C] dark:text-slate-100"
    >
      <div className="fixed end-4 top-4 z-40 sm:end-6 sm:top-5">
        <LanguageSwitch />
      </div>

      <div className="w-full max-w-lg min-w-0">
        {props.state === 'notFound' ? (
          <StateBlock
            state="empty"
            locale={locale}
            title={isAr ? 'رابط الدفع غير موجود' : 'Payment link not found'}
            description={
              isAr
                ? 'تحقق من صحة رابط الدفع أو اطلب رابطاً جديداً من الجهة المُصدِرة.'
                : 'Verify the payment link or request a new payment link from the sender.'
            }
          />
        ) : props.state === 'error' ? (
          <StateBlock
            state="error"
            locale={locale}
            title={
              isAr
                ? 'تعذّر تحميل بيانات الدفع حالياً'
                : 'Unable to load payment details'
            }
            description={
              isAr
                ? 'حدث خلل مؤقت أثناء التحقق من رابط الدفع. يرجى المحاولة لاحقاً.'
                : 'A temporary issue occurred while verifying this payment link. Please try again.'
            }
          />
        ) : (
          <PayReadyCard data={props.data} unavailableTip={unavailableTip} />
        )}
      </div>
    </main>
  )
}

function PayReadyCard({
  data,
  unavailableTip,
}: {
  data: PayViewData
  unavailableTip: string
}) {
  const { locale } = useI18n()
  const isAr = locale !== 'en'

  const providerLabel = isAr
    ? (PROVIDER_LABEL[data.gatewayProvider] ?? data.gatewayProvider)
    : (PROVIDER_LABEL_EN[data.gatewayProvider] ?? data.gatewayProvider)
  const statusLabel = isAr
    ? (STATUS_LABEL[data.status] ?? data.status)
    : (STATUS_LABEL_EN[data.status] ?? data.status)

  const amountStr = formatKwd(data.amount, locale)
  const amountUnavailable = amountStr === UNAVAILABLE_DASH
  const createdStr = data.createdAtIso
    ? formatDateTime(data.createdAtIso, { locale, showZone: true })
    : UNAVAILABLE_DASH
  const paidStr = data.paidAtIso
    ? formatDateTime(data.paidAtIso, { locale, showZone: true })
    : UNAVAILABLE_DASH
  const expiresStr = data.expiresAtIso
    ? formatDateTime(data.expiresAtIso, { locale, showZone: true })
    : UNAVAILABLE_DASH

  const isExpired = data.status === 'EXPIRED'
  const isPaid = data.status === 'PAID'
  const secondTimestamp = isPaid ? paidStr : expiresStr

  return (
    <section className="ds-surface min-w-0 space-y-5 rounded-3xl p-5 sm:p-7">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 pb-4 dark:border-white/10">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{data.companyName}</span>
          </div>
          <h1 className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-50">
            {isAr ? 'بوابة الدفع الإلكتروني' : 'Online Payment Checkout'}
          </h1>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {isAr ? data.titleAr : data.titleEn}
          </p>
        </div>

        <span
          className="inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-bold"
          style={
            isPaid
              ? {
                  backgroundColor: 'var(--ds-positive-bg)',
                  color: 'var(--ds-positive)',
                }
              : isExpired
                ? {
                    backgroundColor: 'var(--ds-negative-bg)',
                    color: 'var(--ds-negative)',
                  }
                : {
                    backgroundColor: 'var(--ds-warning-bg)',
                    color: 'var(--ds-warning)',
                  }
          }
        >
          {statusLabel}
        </span>
      </header>

      <div className="ds-surface-subtle rounded-2xl p-4">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
          {isAr ? 'الطرف / المستفيد' : 'Customer / Beneficiary'}
        </p>
        <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">
          {data.partyName || (
            <span
              title={unavailableTip}
              aria-label={unavailableTip}
              data-unavailable="true"
            >
              {UNAVAILABLE_DASH}
            </span>
          )}
        </p>

        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-slate-200/80 pt-3 dark:border-white/10">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            {isAr ? 'المبلغ المستحق' : 'Amount Due'}
          </span>
          <p
            dir="ltr"
            title={amountUnavailable ? unavailableTip : undefined}
            aria-label={amountUnavailable ? unavailableTip : undefined}
            data-unavailable={amountUnavailable ? 'true' : undefined}
            className="ds-num text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl dark:text-slate-50"
          >
            {amountStr}
          </p>
        </div>

        <div className="mt-3 space-y-1.5 border-t border-slate-200/80 pt-3 text-xs text-slate-600 dark:border-white/10 dark:text-slate-300">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{isAr ? 'مزوّد البوابة' : 'Gateway'}</span>
            </span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {providerLabel}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>{isAr ? 'تاريخ الإنشاء' : 'Issued'}</span>
            </span>
            <span
              dir="ltr"
              title={createdStr === UNAVAILABLE_DASH ? unavailableTip : undefined}
              aria-label={
                createdStr === UNAVAILABLE_DASH ? unavailableTip : undefined
              }
              data-unavailable={
                createdStr === UNAVAILABLE_DASH ? 'true' : undefined
              }
              className="font-semibold tabular-nums"
            >
              {createdStr}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>
              {isPaid
                ? isAr
                  ? 'تاريخ السداد'
                  : 'Paid At'
                : isAr
                  ? 'صالح حتى'
                  : 'Expires'}
            </span>
            <span
              dir="ltr"
              title={
                secondTimestamp === UNAVAILABLE_DASH ? unavailableTip : undefined
              }
              aria-label={
                secondTimestamp === UNAVAILABLE_DASH ? unavailableTip : undefined
              }
              data-unavailable={
                secondTimestamp === UNAVAILABLE_DASH ? 'true' : undefined
              }
              className="font-semibold tabular-nums"
            >
              {secondTimestamp}
            </span>
          </div>
        </div>
      </div>

      {data.whatsappHref ? (
        <div className="flex justify-start">
          <WhatsAppButton
            label={
              isAr
                ? 'إرسال رابط الدفع عبر واتساب'
                : 'Share payment link via WhatsApp'
            }
            href={data.whatsappHref}
          />
        </div>
      ) : null}

      {isExpired ? (
        <StateBlock
          state="error"
          compact
          locale={locale}
          title={
            isAr ? 'انتهت صلاحية رابط الدفع' : 'Payment link has expired'
          }
          description={
            isAr
              ? 'انتهت صلاحية هذا الرابط. يرجى طلب رابط دفع جديد.'
              : 'This payment link is no longer active. Please request a new payment link.'
          }
        />
      ) : (
        <PayCheckout
          token={data.token}
          methods={data.methods}
          isTestMode={data.isTestMode}
          providerActive={data.providerActive}
          paid={isPaid}
          locale={locale}
        />
      )}
    </section>
  )
}
