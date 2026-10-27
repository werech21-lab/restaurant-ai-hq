'use client'

import { useEffect, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import type { ListPage } from '@/components/erp/common'
import { inputClass } from '@/components/erp/styles'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { Account } from '@/modules/finance/client'
import type { Warehouse } from '@/modules/inventory/client'
import type { Supplier } from '@/modules/procurement/client'

type Loaded<T> = { rows: T[]; failure: MessageKey | null; loading: boolean }

/** Loads up to 100 rows of a list endpoint once. These are choice lists, so a bigger set would need a search box. */
function useChoices<T>(path: string): Loaded<T> {
  const [state, setState] = useState<Loaded<T>>({ rows: [], failure: null, loading: true })
  useEffect(() => {
    const controller = new AbortController()
    setState({ rows: [], failure: null, loading: true })
    apiRequest<ListPage<T>>(path, { signal: controller.signal })
      .then((page) => setState({ rows: page.data, failure: null, loading: false }))
      .catch((error: unknown) => {
        if (!isAbort(error)) setState({ rows: [], failure: errorKey(error), loading: false })
      })
    return () => controller.abort()
  }, [path])
  return state
}

type SelectProps = { value: string; onChange: (id: string) => void; disabled?: boolean; label: string }

function Choice<T extends { id: string }>({
  state,
  value,
  onChange,
  disabled,
  label,
  text,
  placeholder,
}: SelectProps & { state: Loaded<T>; text: (row: T) => string; placeholder: MessageKey }) {
  const { t } = useI18n()
  return (
    <label className="block text-sm text-gray-400">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || state.loading}
        className={inputClass}
      >
        <option value="">{state.loading ? t('erp.loading') : t(placeholder)}</option>
        {state.rows.map((row) => (
          <option key={row.id} value={row.id}>
            {text(row)}
          </option>
        ))}
      </select>
      {state.failure ? (
        <span role="alert" className="mt-1 block text-xs text-red-300">
          {t(state.failure)}
        </span>
      ) : null}
    </label>
  )
}

/** Active suppliers. A blocked supplier cannot be ordered from. */
export function SupplierSelect(props: SelectProps) {
  const state = useChoices<Supplier>('/api/v1/procurement/suppliers?limit=100&status=active')
  return <Choice state={state} text={(row) => `${row.code} · ${row.name}`} placeholder="pro.pickSupplier" {...props} />
}

export function WarehouseSelect(props: SelectProps) {
  const state = useChoices<Warehouse>('/api/v1/inventory/warehouses?limit=100&status=active')
  return <Choice state={state} text={(row) => `${row.code} · ${row.name}`} placeholder="erp.form.selectWarehouse" {...props} />
}

/** Active postable accounts of one type, for the accounting settings. */
export function AccountSelect({ type, ...props }: SelectProps & { type: Account['type'] }) {
  const state = useChoices<Account>(`/api/v1/finance/accounts?limit=100&status=active&type=${type}`)
  const postable: Loaded<Account> = { ...state, rows: state.rows.filter((row) => row.isPostable) }
  return <Choice state={postable} text={(row) => `${row.code} · ${row.name}`} placeholder="pro.acct.pick" {...props} />
}
