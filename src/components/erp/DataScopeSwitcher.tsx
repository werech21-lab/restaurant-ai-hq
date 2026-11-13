'use client'

import { inputClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import type { DataScope } from '@/lib/data-scope'

export type DataScopeValue = {
  scope: DataScope
  from: string
  to: string
}

type Props = {
  value: DataScopeValue
  onChange: (next: DataScopeValue) => void
}

/** Hot = last 90 days (fast). Archive = full Odoo history. Optional date range overrides both. */
export function DataScopeSwitcher({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-[#30363d] bg-[#09110E]/20 p-3">
      <button
        type="button"
        className={value.scope === 'hot' && !value.from && !value.to ? primaryButton : secondaryButton}
        onClick={() => onChange({ scope: 'hot', from: '', to: '' })}
      >
        العمليات النشطة (سريع ⚡)
      </button>
      <button
        type="button"
        className={value.scope === 'archive' && !value.from && !value.to ? primaryButton : secondaryButton}
        onClick={() => onChange({ scope: 'archive', from: '', to: '' })}
      >
        كل السنوات والأرشيف التاريخي (Odoo Full Archive 🗄️)
      </button>
      <label className="text-xs text-gray-400">
        من تاريخ
        <input
          type="date"
          className={`${inputClass} mt-1`}
          value={value.from}
          onChange={(event) => onChange({ ...value, from: event.target.value, scope: value.from || value.to || event.target.value ? 'archive' : value.scope })}
        />
      </label>
      <label className="text-xs text-gray-400">
        إلى تاريخ
        <input
          type="date"
          className={`${inputClass} mt-1`}
          value={value.to}
          onChange={(event) => onChange({ ...value, to: event.target.value, scope: value.from || value.to || event.target.value ? 'archive' : value.scope })}
        />
      </label>
    </div>
  )
}

export function scopeToQuery(value: DataScopeValue): Record<string, string> {
  const params: Record<string, string> = { scope: value.scope }
  if (value.from) params.from = value.from
  if (value.to) params.to = value.to
  return params
}
