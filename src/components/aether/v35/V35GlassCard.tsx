import React, { type HTMLAttributes, type ReactNode } from 'react'
import { cx } from '@/components/ui/cx'

export type V35GlassCardElement = 'div' | 'article' | 'section'
export type V35GlassCardVariant = 'glass' | 'hero' | 'subtle' | 'nested'

type DataAttributes = {
  [key: `data-${string}`]: string | number | boolean | undefined
}

export interface V35GlassCardProps
  extends Omit<HTMLAttributes<HTMLElement>, 'className' | 'children'>,
    DataAttributes {
  as?: V35GlassCardElement
  variant?: V35GlassCardVariant
  hoverLift?: boolean
  className?: string
  children?: ReactNode
}

const VARIANT_CLASSES: Record<V35GlassCardVariant, string> = {
  glass:
    'v35-glass-card bg-white/[0.84] dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/85 dark:border-slate-800 text-slate-900 dark:text-slate-50 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-[0_2px_6px_rgba(2,6,23,0.36)]',
  hero:
    'v35-glass-card v35-glass-hero bg-gradient-to-br from-blue-900 via-blue-600 to-blue-700 dark:from-[#172554] dark:via-[#1E40AF] dark:to-[#2563EB] backdrop-blur-xl border border-blue-300/35 dark:border-blue-300/30 text-[#FFFFFF] shadow-[0_16px_36px_-10px_rgba(37,99,235,0.40)] dark:shadow-[0_16px_36px_-10px_rgba(37,99,235,0.45)]',
  subtle:
    'v35-glass-card v35-glass-subtle bg-slate-50/85 dark:bg-slate-900/75 backdrop-blur-md border border-slate-200/85 dark:border-slate-800 text-slate-900 dark:text-slate-50 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-[0_4px_14px_-8px_rgba(2,6,23,0.5)]',
  nested:
    'v35-glass-card v35-glass-nested bg-slate-50/75 dark:bg-slate-800/55 backdrop-blur-sm border border-slate-200/85 dark:border-slate-800 text-slate-900 dark:text-slate-50 shadow-none',
}

const HOVER_LIFT_CLASSES: Record<V35GlassCardVariant, string> = {
  glass:
    'v35-glass-lift transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-blue-600/30 dark:hover:border-sky-400/35 hover:shadow-[0_4px_12px_rgba(37,99,235,0.08),0_18px_38px_-12px_rgba(15,23,42,0.14)] dark:hover:shadow-[0_6px_18px_rgba(37,99,235,0.22),0_18px_38px_-12px_rgba(2,6,23,0.72)]',
  hero:
    'v35-glass-lift transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_22px_44px_-10px_rgba(37,99,235,0.48)] dark:hover:shadow-[0_22px_44px_-10px_rgba(59,130,246,0.52)]',
  subtle:
    'v35-glass-lift transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-blue-600/30 dark:hover:border-sky-400/30',
  nested:
    'v35-glass-lift transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-blue-600/30 dark:hover:border-sky-400/30',
}

/**
 * Translucent frosted glass surface container for V35 Bento layouts.
 * Purely presentational with Light & Dark coherence and reduced-motion safety.
 */
export function V35GlassCard({
  as = 'div',
  variant = 'glass',
  hoverLift = false,
  className,
  children,
  ...rest
}: V35GlassCardProps) {
  const Tag = as as React.ElementType

  return (
    <Tag
      data-variant={variant}
      data-hover-lift={hoverLift ? 'true' : undefined}
      className={cx(
        'relative min-w-0 rounded-[24px]',
        VARIANT_CLASSES[variant],
        hoverLift
          ? HOVER_LIFT_CLASSES[variant]
          : 'transition-[box-shadow,border-color,background-color] duration-200 ease-out',
        'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}
