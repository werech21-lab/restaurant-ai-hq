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
    'v35-glass-card bg-white dark:bg-slate-900/90 backdrop-blur-xl border border-[#1E3A5F]/[0.08] dark:border-slate-800 text-[#1E3A5F] dark:text-slate-50 shadow-[0_2px_6px_rgba(30,58,95,0.03)] dark:shadow-[0_2px_6px_rgba(2,6,23,0.36)]',
  hero:
    'v35-glass-card v35-glass-hero bg-gradient-to-br from-[#065F46] via-[#047857] to-[#0F766E] dark:from-[#0F172A] dark:via-[#065F46] dark:to-[#047857] backdrop-blur-xl border border-emerald-400/35 dark:border-emerald-400/30 text-[#FFFFFF] shadow-[0_10px_26px_rgba(5,150,105,0.22)] dark:shadow-[0_12px_28px_rgba(5,150,105,0.28)]',
  subtle:
    'v35-glass-card v35-glass-subtle bg-[#F4F8F6]/90 dark:bg-slate-900/75 backdrop-blur-md border border-[#1E3A5F]/[0.08] dark:border-slate-800 text-[#1E3A5F] dark:text-slate-50 shadow-[0_2px_6px_rgba(30,58,95,0.03)] dark:shadow-[0_4px_14px_-8px_rgba(2,6,23,0.5)]',
  nested:
    'v35-glass-card v35-glass-nested bg-[#EDF2F0]/75 dark:bg-slate-800/55 backdrop-blur-sm border border-[#1E3A5F]/[0.08] dark:border-slate-800 text-[#1E3A5F] dark:text-slate-50 shadow-none',
}

const HOVER_LIFT_CLASSES: Record<V35GlassCardVariant, string> = {
  glass:
    'v35-glass-lift transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-emerald-600/30 dark:hover:border-emerald-400/35 hover:shadow-[0_6px_18px_rgba(30,58,95,0.07),0_1px_3px_rgba(5,150,105,0.08)] dark:hover:shadow-[0_6px_18px_rgba(16,185,129,0.22),0_18px_38px_-12px_rgba(2,6,23,0.72)]',
  hero:
    'v35-glass-lift transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(5,150,105,0.28)] dark:hover:shadow-[0_16px_36px_rgba(16,185,129,0.35)]',
  subtle:
    'v35-glass-lift transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-emerald-600/30 dark:hover:border-emerald-400/30',
  nested:
    'v35-glass-lift transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-emerald-600/30 dark:hover:border-emerald-400/30',
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
