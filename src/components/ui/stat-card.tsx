import React from 'react'
import { cx } from './cx'

export interface StatCardProps {
  href?: string
  label: string
  value: string
  danger?: boolean
  className?: string
}

export function StatCard({
  href,
  label,
  value,
  danger,
  className = '',
}: StatCardProps) {
  const body = (
    <>
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</p>
      <p
        className={cx(
          'mt-2.5 text-2xl font-semibold tracking-tight tabular-nums',
          danger ? 'text-rose-700 dark:text-rose-300' : 'text-slate-900 dark:text-slate-50',
        )}
      >
        {value}
      </p>
    </>
  )
  const surfaceClass = cx(
    'ds-surface rounded-2xl border border-slate-200/80 bg-white/80 p-5 text-slate-900 shadow-sm backdrop-blur-md transition-colors dark:border-slate-400/20 dark:bg-[rgba(15,26,48,0.78)] dark:text-slate-50',
    className,
  )
  if (!href) {
    return <section className={surfaceClass}>{body}</section>
  }
  return (
    <a
      href={href}
      className={cx(
        surfaceClass,
        'block hover:border-blue-500/40 dark:hover:border-sky-400/40',
      )}
    >
      {body}
    </a>
  )
}
