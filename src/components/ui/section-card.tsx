import React, { type ReactNode } from 'react'
import type { FormatLocale } from '@/lib/format'
import { PartialWarningBanner } from './partial-warning-banner'
import { cx } from './cx'
import { StateBlock, type StateBlockState } from './state-block'

export type SectionCardState = 'ready' | StateBlockState

export interface SectionCardProps {
  title?: ReactNode
  subtitle?: ReactNode
  eyebrow?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  footer?: ReactNode
  state?: SectionCardState
  stateTitle?: ReactNode
  stateDescription?: ReactNode
  stateAction?: ReactNode
  onRetry?: () => void
  warningAr?: string | null
  warningEn?: string | null
  unavailableSections?: string[]
  /** Accepted only to satisfy StateBlock's safe error-swallowing contract. */
  error?: unknown
  locale?: FormatLocale
  padded?: boolean
  headerDivider?: boolean
  as?: 'section' | 'article' | 'div'
  id?: string
  ariaLabel?: string
  className?: string
  bodyClassName?: string
  children?: ReactNode
}

/**
 * Private-bank board-report section container:
 * - Deep neutral obsidian surface in dark mode, warm pure white in light mode
 * - 1px hairline border + subtle executive elevation shadow
 * - Header title/subtitle/actions + optional loading/empty/error/partial/unavailable body states
 */
export function SectionCard({
  title,
  subtitle,
  eyebrow,
  icon,
  actions,
  footer,
  state = 'ready',
  stateTitle,
  stateDescription,
  stateAction,
  onRetry,
  warningAr,
  warningEn,
  unavailableSections,
  error,
  locale = 'ar',
  padded = true,
  headerDivider = false,
  as: Tag = 'section',
  id,
  ariaLabel,
  className = '',
  bodyClassName = '',
  children,
}: SectionCardProps) {
  const isAr = locale !== 'en'
  const dir = isAr ? 'rtl' : 'ltr'
  const hasHeader = Boolean(title || subtitle || eyebrow || icon || actions)

  const renderBody = () => {
    if (
      state === 'loading' ||
      state === 'empty' ||
      state === 'error' ||
      state === 'unavailable' ||
      state === 'unlinked' ||
      state === 'forbidden'
    ) {
      return (
        <StateBlock
          state={state}
          locale={locale}
          title={stateTitle}
          description={stateDescription}
          action={stateAction}
          onRetry={onRetry}
          error={error}
        />
      )
    }

    if (state === 'partial') {
      return (
        <div className="space-y-4">
          <PartialWarningBanner
            partial
            warningAr={warningAr}
            warningEn={warningEn}
            unavailableSections={unavailableSections}
            locale={locale}
          />
          {children}
        </div>
      )
    }

    return children
  }

  return (
    <Tag
      id={id}
      dir={dir}
      aria-label={ariaLabel}
      className={cx(
        'ds-section-card ds-surface w-full min-w-0 rounded-2xl',
        className,
      )}
    >
      {hasHeader ? (
        <div
          className={cx(
            'flex flex-wrap items-start justify-between gap-3',
            padded ? 'px-4 pt-4 sm:px-6 sm:pt-5' : 'px-4 pt-4',
            headerDivider
              ? 'border-b border-[var(--ds-border-hairline)] pb-3.5'
              : 'pb-3',
          )}
        >
          <div className="flex min-w-0 items-start gap-3">
            {icon ? (
              <span
                className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
                style={{
                  backgroundColor: 'var(--ds-accent-soft)',
                  borderColor: 'var(--ds-border-accent)',
                  color: 'var(--ds-accent)',
                }}
                aria-hidden
              >
                {icon}
              </span>
            ) : null}
            <div className="min-w-0 space-y-1">
              {eyebrow ? (
                <div
                  className="text-xs font-semibold"
                  style={{ color: 'var(--ds-accent)' }}
                >
                  {eyebrow}
                </div>
              ) : null}
              {title ? <h2 className="ds-section-title break-words">{title}</h2> : null}
              {subtitle ? <p className="ds-caption break-words">{subtitle}</p> : null}
            </div>
          </div>

          {actions ? (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}

      <div
        className={cx(
          'min-w-0',
          padded
            ? hasHeader
              ? 'px-4 pb-5 pt-1 sm:px-6 sm:pb-6'
              : 'p-4 sm:p-6'
            : '',
          bodyClassName,
        )}
      >
        {renderBody()}
      </div>

      {footer ? (
        <div
          className="border-t border-[var(--ds-border-hairline)] px-4 py-3 text-xs sm:px-6"
          style={{ color: 'var(--ds-text-muted)' }}
        >
          {footer}
        </div>
      ) : null}
    </Tag>
  )
}
