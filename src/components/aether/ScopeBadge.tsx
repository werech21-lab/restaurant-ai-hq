import { SCOPE_LABELS, type ScopeBadgeKind } from '@/lib/aether/brand-scope'

const BADGE_STYLE: Record<ScopeBadgeKind, string> = {
  'company-wide':
    'inline-flex items-center rounded-full bg-sky-50/80 px-2.5 py-0.5 text-xs font-semibold text-sky-900 backdrop-blur-sm ring-1 ring-sky-400/30 dark:bg-sky-400/15 dark:text-sky-200 dark:ring-sky-300/25',
  'all-brands':
    'inline-flex items-center rounded-full bg-indigo-50/85 px-2.5 py-0.5 text-xs font-semibold text-indigo-900 backdrop-blur-sm ring-1 ring-indigo-400/30 dark:bg-indigo-400/15 dark:text-indigo-200 dark:ring-indigo-300/25',
}

const LABEL_OF: Record<ScopeBadgeKind, { ar: string; en: string }> = {
  'company-wide': SCOPE_LABELS.companyWide,
  'all-brands': SCOPE_LABELS.allBrands,
}

/** Says which scope a card measures when it differs from the brand filter. Renders nothing for `null`. */
export function ScopeBadge({
  kind,
  target,
  isAr,
  className = '',
}: {
  kind: ScopeBadgeKind | null
  /** Stable id of the card or chart the badge belongs to. */
  target: string
  isAr: boolean
  className?: string
}) {
  if (!kind) return null
  const label = LABEL_OF[kind]
  return (
    <span data-scope-badge={kind} data-scope-for={target} className={`${BADGE_STYLE[kind]} ${className}`.trim()}>
      {isAr ? label.ar : label.en}
    </span>
  )
}
