'use client'

import type { ReactNode } from 'react'
import { useI18n } from '@/lib/i18n'

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

/** Keeps digits in source order. "18/20" stays 18/20 inside the RTL page. */
export function Num({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      dir="ltr"
      data-ltr-num=""
      style={{ direction: 'ltr', unicodeBidi: 'isolate-override' }}
      className={cx('num inline-block whitespace-nowrap text-left tabular-nums', className)}
    >
      {'\u200E'}
      {children}
    </span>
  )
}

export function Money({ value, className = '' }: { value: string; className?: string }) {
  const { t } = useI18n()
  return (
    <span dir="ltr" className={cx('inline-flex items-baseline gap-1.5', className)}>
      <Num>{value}</Num>
      <span className="text-[0.62em] font-semibold text-mist-400">{t('currency')}</span>
    </span>
  )
}

export function Card({
  children,
  className = '',
  accent = false,
  interactive = true,
}: {
  children: ReactNode
  className?: string
  accent?: boolean
  interactive?: boolean
}) {
  return (
    <section
      className={cx(
        'relative rounded-3xl border border-gold-300/10 bg-gradient-to-b from-white/[0.05] to-transparent p-4 shadow-card sm:p-5 md:p-6',
        interactive && 'transition duration-500 ease-out hover:border-gold-300/20 hover:bg-white/[0.025]',
        accent && 'border-s-2 border-s-gold-400/90',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-l from-transparent via-gold-300/80 to-transparent" />
      {children}
    </section>
  )
}

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const { t } = useI18n()
  return (
    <header className="mb-6 sm:mb-9">
      <p className="text-[11px] font-medium text-gold-400">{t('brand')}</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-mist-100 sm:text-[1.7rem] md:text-3xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-mist-400">{subtitle}</p>
    </header>
  )
}

const hintTones = {
  neutral: 'text-mist-400',
  good: 'text-emerald-400',
  bad: 'text-rose-400',
  warn: 'text-amber-300',
  info: 'text-sky-300',
}

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: keyof typeof hintTones
}) {
  return (
    <Card>
      <p className="text-[13px] text-mist-400">{label}</p>
      <div className="mt-3 text-[1.65rem] font-semibold leading-none tracking-tight text-mist-100 sm:mt-4 sm:text-[1.9rem]">{value}</div>
      {hint ? <p className={cx('mt-4 text-sm', hintTones[tone])}>{hint}</p> : null}
    </Card>
  )
}

const badgeTones = {
  neutral: 'bg-white/[0.05] text-mist-300',
  good: 'bg-emerald-400/10 text-emerald-300',
  bad: 'bg-rose-400/10 text-rose-300',
  warn: 'bg-amber-300/10 text-amber-200',
  info: 'bg-sky-300/10 text-sky-200',
  gold: 'bg-gold-400/10 text-gold-300',
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: keyof typeof badgeTones
}) {
  return (
    <span className={cx('inline-flex items-center rounded-full border border-white/10 px-2.5 py-1 text-xs font-medium', badgeTones[tone])}>
      {children}
    </span>
  )
}

const buttonStyles = {
  primary:
    'bg-gradient-to-b from-gold-300 to-gold-500 text-ink-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] hover:from-gold-200 hover:to-gold-400',
  ghost: 'border border-gold-300/15 bg-white/[0.03] text-mist-100 hover:border-gold-300/40 hover:bg-gold-300/[0.06]',
  danger: 'border border-rose-400/20 bg-rose-400/10 text-rose-300 hover:bg-rose-400/15',
}

export function Button({
  children,
  onClick,
  variant = 'ghost',
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: keyof typeof buttonStyles
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={cx(
        'cursor-pointer rounded-full px-5 py-2 text-sm font-semibold transition duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/50',
        buttonStyles[variant]
      )}
    >
      {children}
    </button>
  )
}
