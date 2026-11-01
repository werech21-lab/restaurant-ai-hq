'use client'

import { useI18n } from '@/lib/i18n'
import { useOptionalScope } from '@/components/ScopeProvider'

export function GlobalScopeFilter({ compact = false }: { compact?: boolean }) {
  const scope = useOptionalScope()
  const { locale, t } = useI18n()
  if (!scope) return null

  const label = locale === 'en' ? scope.labelEn : scope.labelAr
  const selectClass =
    'rounded-lg border border-white/10 bg-ink-900/90 px-2.5 py-1.5 text-xs font-semibold text-mist-100 outline-none focus:border-[#8cc63f]/60 disabled:opacity-60'

  return (
    <div
      className={`flex min-w-0 flex-wrap items-center gap-2 ${compact ? '' : 'rounded-xl border border-gold-300/15 bg-ink-900/50 px-2.5 py-1.5'}`}
    >
      <label className="sr-only" htmlFor="vf-brand-scope">
        {t('scope.brand')}
      </label>
      <select
        id="vf-brand-scope"
        className={selectClass}
        disabled={scope.pending}
        value={scope.brandId ?? ''}
        onChange={(event) => scope.setBrand((event.target.value || null) as typeof scope.brandId)}
      >
        <option value="">{t('scope.allBrands')}</option>
        {scope.brands.map((brand) => (
          <option key={brand.id} value={brand.id}>
            {locale === 'en' ? brand.nameEn : brand.nameAr}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="vf-branch-scope">
        {t('scope.branch')}
      </label>
      <select
        id="vf-branch-scope"
        className={`${selectClass} min-w-[9rem]`}
        disabled={scope.pending}
        value={scope.branchId ?? ''}
        onChange={(event) => scope.setBranch((event.target.value || null) as typeof scope.branchId)}
      >
        <option value="">{t('scope.allBranches')}</option>
        {scope.filteredBranches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {locale === 'en' ? branch.nameEn : branch.nameAr}
          </option>
        ))}
      </select>

      <button
        type="button"
        disabled={scope.pending || (!scope.brandId && !scope.branchId)}
        onClick={() => scope.reset()}
        className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-mist-300 transition hover:border-[#8cc63f]/40 hover:text-mist-100 disabled:opacity-40"
      >
        {t('scope.reset')}
      </button>

      <span className="inline-flex max-w-[18rem] items-center truncate rounded-full border border-[#8cc63f]/35 bg-[#8cc63f]/10 px-2.5 py-1 text-[11px] font-bold text-[#8cc63f]">
        {label}
      </span>
    </div>
  )
}
