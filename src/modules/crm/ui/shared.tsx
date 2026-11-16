'use client'

import { useEffect, type ReactNode } from 'react'
import {
  UNAVAILABLE_DASH,
  formatDateTime,
  formatKwd,
  getUnavailableTooltip,
} from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { formatMinor } from '@/lib/money'
import {
  effectiveStatus,
  utcDate,
  type ActivityEntry,
  type CustomerStatus,
  type LeadStage,
  type QuotationStatus,
  type TeamMember,
} from '@/modules/crm/client'

export const crmPanelClass =
  'ds-surface w-full min-w-0 rounded-2xl p-4 sm:p-5'

export const crmSubcardClass =
  'rounded-xl border border-slate-200/90 bg-slate-50/90 p-3 dark:border-emerald-500/15 dark:bg-[#0B1410]'

export const crmInputClass =
  'mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:border-emerald-500/20 dark:bg-[#0B1410] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-400'

export const crmLabelClass =
  'block text-sm font-medium text-slate-700 dark:text-slate-200'

export const crmPrimaryBtn =
  'inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400'

export const crmSecondaryBtn =
  'inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-500/25 dark:bg-[#101C17] dark:text-slate-200 dark:hover:bg-white/[0.06]'

export const crmDangerBtn =
  'inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/35 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-950/60'

export const crmErrorClass =
  'rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-800 dark:border-rose-500/35 dark:bg-rose-950/45 dark:text-rose-200'

export const crmNoticeClass =
  'rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-900 dark:border-emerald-500/35 dark:bg-emerald-950/45 dark:text-emerald-200'

type PillTone = 'neutral' | 'info' | 'good' | 'bad' | 'warn' | 'gold'

const PILL_TONES: Record<PillTone, string> = {
  neutral:
    'border-slate-300/80 bg-slate-100 text-slate-700 dark:border-white/15 dark:bg-white/[0.06] dark:text-slate-200',
  info:
    'border-sky-300/80 bg-sky-50 text-sky-800 dark:border-sky-400/30 dark:bg-sky-950/50 dark:text-sky-200',
  good:
    'border-emerald-300/80 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-950/50 dark:text-emerald-200',
  bad:
    'border-rose-300/80 bg-rose-50 text-rose-800 dark:border-rose-400/30 dark:bg-rose-950/50 dark:text-rose-200',
  warn:
    'border-amber-300/80 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/50 dark:text-amber-200',
  gold:
    'border-amber-400/70 bg-amber-100 text-amber-950 dark:border-amber-400/35 dark:bg-amber-950/60 dark:text-amber-200',
}

export function CrmPill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: PillTone
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${PILL_TONES[tone]}`}
    >
      {children}
    </span>
  )
}

const modalWidths = { md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' } as const

export function CrmModal({
  title,
  onClose,
  children,
  size = 'md',
}: {
  title: string
  onClose: () => void
  children: ReactNode
  size?: keyof typeof modalWidths
}) {
  const { t, locale } = useI18n()
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
        onClick={(event) => event.stopPropagation()}
        className={`my-8 w-full ${modalWidths[size]} rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl dark:border-emerald-500/20 dark:bg-[#101C17] dark:text-slate-100`}
      >
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-white/10">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('erp.close')}
            title={t('erp.close')}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-xl leading-none text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function CrmMoney({
  minor,
  className = '',
}: {
  minor: number | null | undefined
  className?: string
}) {
  const { locale } = useI18n()
  const fmtLocale = locale === 'en' ? 'en' : 'ar'
  if (typeof minor !== 'number' || !Number.isSafeInteger(minor)) {
    return (
      <span
        dir="ltr"
        title={getUnavailableTooltip(fmtLocale)}
        className={`inline-block whitespace-nowrap tabular-nums text-slate-500 dark:text-slate-400 ${className}`}
      >
        {UNAVAILABLE_DASH}
      </span>
    )
  }
  return (
    <span
      dir="ltr"
      className={`inline-block whitespace-nowrap tabular-nums ${className}`}
    >
      {formatKwd(minor / 1000, fmtLocale)}
    </span>
  )
}

export function formatCrmDateTime(iso: string | null | undefined, locale: string): string {
  const fmtLocale = locale === 'en' ? 'en' : 'ar'
  return formatDateTime(iso, { locale: fmtLocale })
}

export const stageLabels: Record<LeadStage, MessageKey> = {
  new: 'crm.stage.new',
  contacted: 'crm.stage.contacted',
  qualified: 'crm.stage.qualified',
  proposal: 'crm.stage.proposal',
  won: 'crm.stage.won',
  lost: 'crm.stage.lost',
}

export const customerStatusLabels: Record<CustomerStatus, MessageKey> = {
  lead: 'crm.cstatus.lead',
  prospect: 'crm.cstatus.prospect',
  active: 'crm.cstatus.active',
  blocked: 'crm.cstatus.blocked',
}

export const quotationStatusLabels: Record<QuotationStatus, MessageKey> = {
  draft: 'crm.qstatus.draft',
  sent: 'crm.qstatus.sent',
  accepted: 'crm.qstatus.accepted',
  rejected: 'crm.qstatus.rejected',
  expired: 'crm.qstatus.expired',
  converted: 'crm.qstatus.converted',
}

const customerTones: Record<CustomerStatus, PillTone> = {
  lead: 'neutral',
  prospect: 'info',
  active: 'good',
  blocked: 'bad',
}

const quotationTones: Record<QuotationStatus, PillTone> = {
  draft: 'neutral',
  sent: 'info',
  accepted: 'good',
  rejected: 'bad',
  expired: 'warn',
  converted: 'gold',
}

const activityLabels: Record<string, MessageKey> = {
  'quotation:created': 'crm.act.quotation.created',
  'quotation:sent': 'crm.act.quotation.sent',
  'quotation:accepted': 'crm.act.quotation.accepted',
  'quotation:rejected': 'crm.act.quotation.rejected',
  'quotation:expired': 'crm.act.quotation.expired',
  'quotation:converted': 'crm.act.quotation.converted',
  'lead:created': 'crm.act.lead.created',
  'lead:won': 'crm.act.lead.won',
  'lead:lost': 'crm.act.lead.lost',
  'invoice:created': 'crm.act.invoice.created',
  'invoice:voided': 'crm.act.invoice.voided',
  'payment:recorded': 'crm.act.payment.recorded',
}

export function activityLabel(entry: Pick<ActivityEntry, 'kind' | 'action'>): MessageKey | null {
  return activityLabels[`${entry.kind}:${entry.action}`] ?? null
}

/** Today in UTC, the same day the server uses for validity and due dates. */
export function todayUtc(): string {
  return utcDate(new Date())
}

/** Integer fils as a KWD string, or a dash when the number is outside the safe range. */
export function minorText(amountMinor: number): string {
  try {
    return formatMinor(amountMinor)
  } catch {
    return UNAVAILABLE_DASH
  }
}

export function memberName(team: readonly TeamMember[], userId: string | null): string | null {
  if (!userId) return null
  const member = team.find((candidate) => candidate.userId === userId)
  if (!member) return userId.slice(0, 8)
  return member.displayName.trim() === '' ? member.userId.slice(0, 8) : member.displayName
}

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  const { t } = useI18n()
  return <CrmPill tone={customerTones[status]}>{t(customerStatusLabels[status])}</CrmPill>
}

/** Shows `expired` for a sent quotation past its date, because nothing flips it on its own. */
export function QuotationStatusBadge({
  quotation,
}: {
  quotation: { status: QuotationStatus; validUntil: string }
}) {
  const { t } = useI18n()
  const shown = effectiveStatus(quotation, todayUtc())
  return <CrmPill tone={quotationTones[shown]}>{t(quotationStatusLabels[shown])}</CrmPill>
}

export function LeadStageBadge({ stage }: { stage: LeadStage }) {
  const { t } = useI18n()
  const tone: PillTone = stage === 'won' ? 'good' : stage === 'lost' ? 'bad' : 'info'
  return <CrmPill tone={tone}>{t(stageLabels[stage])}</CrmPill>
}
