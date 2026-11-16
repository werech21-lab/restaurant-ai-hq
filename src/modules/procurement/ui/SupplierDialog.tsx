'use client'

import { useState } from 'react'
import { apiRequest } from '@/components/erp/api'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import {
  createSupplierSchema,
  supplierStatuses,
  updateSupplierSchema,
  type Supplier,
  type SupplierStatus,
} from '@/modules/procurement/client'
import { useCan } from '@/modules/procurement/ui/permissions'
import {
  FailureMessage,
  Field,
  proErrorClass,
  proInputClass,
  proPrimaryButton,
  proSecondaryButton,
  supplierStatusLabels,
  useRunner,
} from '@/modules/procurement/ui/shared'

type Props = {
  supplier?: Supplier
  onSaved: (message: MessageKey) => void
  onCancel: () => void
}

/** Create a supplier, or edit one. The code is its identity and is fixed once created. */
export function SupplierDialog({ supplier, onSaved, onCancel }: Props) {
  const canManage = useCan(permissions.procurementSupplierManage)
  const { t } = useI18n()
  const [code, setCode] = useState(supplier?.code ?? '')
  const [name, setName] = useState(supplier?.name ?? '')
  const [status, setStatus] = useState<SupplierStatus>(supplier?.status ?? 'active')
  const [terms, setTerms] = useState(String(supplier?.paymentTermsDays ?? 30))
  const [notes, setNotes] = useState(supplier?.notes ?? '')
  const [errors, setErrors] = useState<MessageKey[]>([])
  const { pending, failure, run } = useRunner()

  function save() {
    setErrors([])
    const base = {
      name,
      paymentTermsDays: /^\d{1,3}$/.test(terms.trim()) ? Number(terms.trim()) : Number.NaN,
      notes: notes.trim() === '' ? null : notes,
    }
    const parsed = supplier
      ? updateSupplierSchema.safeParse({ ...base, version: supplier.version, status })
      : createSupplierSchema.safeParse({ ...base, code })
    if (!parsed.success) {
      setErrors(
        Array.from(
          new Set(
            parsed.error.issues.map((issue): MessageKey => {
              if (issue.path[0] === 'code') return 'pro.err.form.code'
              if (issue.path[0] === 'name') return 'pro.err.form.name'
              if (issue.path[0] === 'paymentTermsDays') return 'pro.err.form.terms'
              return 'pro.err.form.generic'
            }),
          ),
        ),
      )
      return
    }
    void run(async () => {
      await apiRequest(
        supplier
          ? `/api/v1/procurement/suppliers/${supplier.id}`
          : '/api/v1/procurement/suppliers',
        {
          method: supplier ? 'PATCH' : 'POST',
          body: parsed.data,
        },
      )
      onSaved('pro.msg.supplierSaved')
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('pro.sup.code')}>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            disabled={supplier !== undefined}
            maxLength={20}
            dir="ltr"
            className={proInputClass}
          />
        </Field>
        <Field label={t('pro.sup.name')}>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={200}
            className={proInputClass}
          />
        </Field>
        <Field label={t('pro.sup.terms')}>
          <input
            value={terms}
            onChange={(event) => setTerms(event.target.value)}
            inputMode="numeric"
            dir="ltr"
            className={proInputClass}
          />
        </Field>
        {supplier ? (
          <Field label={t('pro.col.status')}>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as SupplierStatus)}
              className={proInputClass}
            >
              {supplierStatuses.map((value) => (
                <option key={value} value={value}>
                  {t(supplierStatusLabels[value])}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label={t('erp.form.notes')} className="sm:col-span-2">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={2000}
            rows={2}
            className={proInputClass}
          />
        </Field>
      </div>
      {errors.length > 0 ? (
        <ul role="alert" className={`${proErrorClass} list-disc space-y-1 ps-6`}>
          {errors.map((message) => (
            <li key={message}>{t(message)}</li>
          ))}
        </ul>
      ) : null}
      <FailureMessage failure={failure} />
      <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--ds-border-hairline)] pt-4">
        {canManage ? (
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className={proPrimaryButton}
          >
            {pending ? t('erp.loading') : t('pro.save')}
          </button>
        ) : null}
        <button type="button" onClick={onCancel} className={proSecondaryButton}>
          {t('erp.cancel')}
        </button>
      </div>
    </div>
  )
}
