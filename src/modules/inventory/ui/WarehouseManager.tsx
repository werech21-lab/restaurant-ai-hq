'use client'

import { FormEvent, useRef, useState } from 'react'
import { apiRequest, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { errorClass, inputClass, labelClass, panelClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { Badge, Num } from '@/components/ui'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { parseWholeNumber } from '@/lib/money'
import { createWarehouseSchema, updateWarehouseSchema, utilizationPercent, warehouseStatuses, type Warehouse, type WarehouseStatus } from '@/modules/inventory/client'
import { Modal, type Phase } from '@/modules/inventory/ui/shared'

type FormProps = {
  warehouse?: Warehouse
  onSaved: (message: MessageKey) => void
  onCancel: () => void
}

function issueMessage(path: ReadonlyArray<PropertyKey>): MessageKey {
  switch (path[0]) {
    case 'code':
      return 'inv.wh.errCode'
    case 'name':
      return 'inv.wh.errName'
    case 'capacity':
      return 'inv.wh.errCapacity'
    default:
      return 'erp.form.errGeneric'
  }
}

function WarehouseForm({ warehouse, onSaved, onCancel }: FormProps) {
  const { t } = useI18n()
  const [code, setCode] = useState(warehouse?.code ?? '')
  const [name, setName] = useState(warehouse?.name ?? '')
  const [location, setLocation] = useState(warehouse?.location ?? '')
  const [capacity, setCapacity] = useState(warehouse?.capacity === null || warehouse === undefined ? '' : String(warehouse.capacity))
  const [status, setStatus] = useState<WarehouseStatus>(warehouse?.status ?? 'active')
  const [errors, setErrors] = useState<MessageKey[]>([])
  const [pending, setPending] = useState(false)
  const idempotencyKey = useRef(newIdempotencyKey())

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmedCapacity = capacity.trim()
    const parsedCapacity = trimmedCapacity === '' ? null : (parseWholeNumber(trimmedCapacity) ?? Number.NaN)
    const shared = { name, location: location.trim() === '' ? null : location, capacity: parsedCapacity, status }
    const parsed = warehouse
      ? updateWarehouseSchema.safeParse({ ...shared, version: warehouse.version })
      : createWarehouseSchema.safeParse({ ...shared, code })
    if (!parsed.success) {
      setErrors(Array.from(new Set(parsed.error.issues.map((issue) => issueMessage(issue.path)))))
      return
    }
    setErrors([])
    setPending(true)
    try {
      if (warehouse) {
        await apiRequest(`/api/v1/inventory/warehouses/${warehouse.id}`, { method: 'PATCH', body: parsed.data })
        onSaved('inv.msg.whUpdated')
      } else {
        await apiRequest('/api/v1/inventory/warehouses', { method: 'POST', body: parsed.data, idempotencyKey: idempotencyKey.current })
        idempotencyKey.current = newIdempotencyKey()
        onSaved('inv.msg.whCreated')
      }
    } catch (error) {
      setErrors([errorKey(error)])
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          {t('inv.wh.code')}
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            disabled={warehouse !== undefined}
            dir="ltr"
            maxLength={20}
            autoComplete="off"
            className={`${inputClass} disabled:opacity-60`}
          />
          <span className="mt-1 block text-xs text-gray-500">{t('inv.wh.codeHint')}</span>
        </label>
        <label className={labelClass}>
          {t('inv.wh.name')}
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={200} className={inputClass} />
        </label>
        <label className={labelClass}>
          {t('inv.wh.location')}
          <input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={200} className={inputClass} />
        </label>
        <label className={labelClass}>
          {t('inv.wh.capacity')}
          <input inputMode="numeric" dir="ltr" value={capacity} onChange={(event) => setCapacity(event.target.value)} className={inputClass} />
          <span className="mt-1 block text-xs text-gray-500">{t('inv.wh.capacityHint')}</span>
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          {t('inv.wh.status')}
          <select value={status} onChange={(event) => setStatus(event.target.value as WarehouseStatus)} className={inputClass}>
            {warehouseStatuses.map((value) => (
              <option key={value} value={value}>
                {t(`inv.wh.${value}`)}
              </option>
            ))}
          </select>
          {status === 'inactive' ? <span className="mt-1 block text-xs text-gray-500">{t('inv.wh.inactiveHint')}</span> : null}
        </label>
      </div>

      {errors.length > 0 ? (
        <ul role="alert" className={`${errorClass} space-y-1`}>
          {errors.map((message) => (
            <li key={message}>{t(message)}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? t('erp.working') : warehouse ? t('erp.save') : t('inv.wh.create')}
        </button>
        <button type="button" onClick={onCancel} className={secondaryButton}>
          {t('erp.cancel')}
        </button>
      </div>
    </form>
  )
}

type Props = {
  warehouses: Warehouse[]
  phase: Phase
  error: MessageKey
  onRetry: () => void
  onChanged: (message: MessageKey) => void
}

/** Warehouse list with utilization, plus create and edit. Capacity is for tracking and is not enforced. */
export function WarehouseManager({ warehouses, phase, error, onRetry, onChanged }: Props) {
  const { t } = useI18n()
  const [editing, setEditing] = useState<Warehouse | 'new' | null>(null)

  return (
    <div className={panelClass}>
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={() => setEditing('new')} className={primaryButton}>
          {t('inv.wh.new')}
        </button>
      </div>

      {phase === 'loading' ? <p className="py-8 text-center text-sm text-gray-400">{t('erp.loading')}</p> : null}
      {phase === 'error' ? (
        <div className="space-y-3 py-6 text-center">
          <p role="alert" className={`${errorClass} inline-block`}>
            {t(error)}
          </p>
          <div>
            <button type="button" onClick={onRetry} className={secondaryButton}>
              {t('erp.retry')}
            </button>
          </div>
        </div>
      ) : null}
      {phase === 'ready' && warehouses.length === 0 ? <p className="py-10 text-center text-gray-300">{t('inv.wh.empty')}</p> : null}

      {phase === 'ready' && warehouses.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="text-gray-400">
              <tr className="border-b border-[#30363d]">
                <th className="px-3 py-2 text-start font-medium">{t('inv.wh.code')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('inv.wh.name')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('inv.wh.location')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('inv.warehouses.units')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('inv.wh.capacity')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('inv.wh.status')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('inv.col.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map((warehouse) => {
                const percent = utilizationPercent(warehouse.unitsStored, warehouse.capacity)
                return (
                  <tr key={warehouse.id} className="border-b border-[#30363d]/60 text-gray-200 hover:bg-white/[0.03]">
                    <td className="px-3 py-2.5 font-semibold text-blue-300">
                      <Num>{warehouse.code}</Num>
                    </td>
                    <td className="px-3 py-2.5">{warehouse.name}</td>
                    <td className="px-3 py-2.5 text-gray-400">{warehouse.location ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <Num>{warehouse.unitsStored.toLocaleString('en-US')}</Num>
                    </td>
                    <td className="px-3 py-2.5">
                      {warehouse.capacity === null ? (
                        <span className="text-gray-400">{t('inv.wh.capacityNone')}</span>
                      ) : (
                        <span className="inline-flex items-baseline gap-2">
                          <Num>{warehouse.capacity.toLocaleString('en-US')}</Num>
                          {percent !== null ? <span className="text-xs text-gray-400"><Num>{`${percent}%`}</Num></span> : null}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={warehouse.status === 'active' ? 'good' : 'neutral'}>{t(`inv.wh.${warehouse.status}`)}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <button type="button" onClick={() => setEditing(warehouse)} className="text-gray-300 hover:text-white">
                        {t('inv.edit')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {editing ? (
        <Modal title={editing === 'new' ? t('inv.wh.new') : t('inv.wh.edit')} onClose={() => setEditing(null)}>
          <WarehouseForm
            warehouse={editing === 'new' ? undefined : editing}
            onCancel={() => setEditing(null)}
            onSaved={(message) => {
              setEditing(null)
              onChanged(message)
            }}
          />
        </Modal>
      ) : null}
    </div>
  )
}
