import { SCOPE_LABELS, type ScopeBadgeKind } from '@/lib/aether/brand-scope'

const BADGE_STYLE: Record<ScopeBadgeKind, string> = {
  'company-wide':
    'inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-900/10 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/10',
  'all-brands':
    'inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-400/15 dark:text-amber-200',
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
