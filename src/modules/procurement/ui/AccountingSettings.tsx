'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { errorClass, inputClass, noticeClass, panelClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { bpsToInput, minorToInput, parseKwdToMinor, parsePercentToBps } from '@/lib/money'
import {
  accountingBases,
  costingMethods,
  updateAccountingSchema,
  type AccountingBasis,
  type CostingMethod,
  updateSettingsSchema,
  type ProcurementAccounting,
  type ProcurementSettings,
} from '@/modules/procurement/client'
import { AccountSelect } from '@/modules/procurement/ui/Selects'
import { FailureMessage, Field, useRunner, type Phase } from '@/modules/procurement/ui/shared'

/** The two company decisions the cycle depends on: where supplier invoices post, and the order approval limit. */
export function AccountingSettings({ reloadToken, onChanged }: { reloadToken: number; onChanged: (message: MessageKey) => void }) {
  const { t } = useI18n()
  const [phase, setPhase] = useState<Phase>('loading')
  const [loadError, setLoadError] = useState<MessageKey>('erp.err.generic')
  const [retry, setRetry] = useState(0)
  const [accounting, setAccounting] = useState<ProcurementAccounting | null>(null)
  const [settings, setSettings] = useState<ProcurementSettings | null>(null)

  const [inventoryId, setInventoryId] = useState('')
  const [payableId, setPayableId] = useState('')
  const [taxId, setTaxId] = useState('')
  const [basis, setBasis] = useState<AccountingBasis>('invoice_basis')
  const [grniId, setGrniId] = useState('')
  const [ppvId, setPpvId] = useState('')
  const [costingMethod, setCostingMethod] = useState<CostingMethod>('moving_weighted_average')
  const [cogsId, setCogsId] = useState('')
  const [priceTolerance, setPriceTolerance] = useState('0.00')
  const [taxTolerance, setTaxTolerance] = useState('0.000')
  const [threshold, setThreshold] = useState('')
  const [errors, setErrors] = useState<MessageKey[]>([])
  const [notice, setNotice] = useState<MessageKey | null>(null)
  const accountsRun = useRunner()
  const limitRun = useRunner()

  const apply = useCallback((nextAccounting: ProcurementAccounting, nextSettings: ProcurementSettings) => {
    setAccounting(nextAccounting)
    setSettings(nextSettings)
    setInventoryId(nextAccounting.inventoryAccountId ?? '')
    setPayableId(nextAccounting.payableAccountId ?? '')
    setTaxId(nextAccounting.inputTaxAccountId ?? '')
    setBasis(nextAccounting.accountingBasis)
    setGrniId(nextAccounting.grniAccountId ?? '')
    setPpvId(nextAccounting.ppvAccountId ?? '')
    setCostingMethod(nextAccounting.costingMethod)
    setCogsId(nextAccounting.cogsAccountId ?? '')
    setPriceTolerance(bpsToInput(nextAccounting.priceToleranceBps))
    setTaxTolerance(minorToInput(nextAccounting.taxToleranceMinor))
    setThreshold(nextSettings.approvalThresholdMinor === null ? '' : minorToInput(nextSettings.approvalThresholdMinor))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setPhase('loading')
    Promise.all([
      apiRequest<{ data: ProcurementAccounting }>('/api/v1/procurement/accounting', { signal: controller.signal }),
      apiRequest<{ data: ProcurementSettings }>('/api/v1/procurement/settings', { signal: controller.signal }),
    ])
      .then(([a, s]) => {
        apply(a.data, s.data)
        setPhase('ready')
      })
      .catch((error: unknown) => {
        if (isAbort(error)) return
        setLoadError(errorKey(error))
        setPhase('error')
      })
    return () => controller.abort()
  }, [reloadToken, retry, apply])

  function saveAccounts() {
    if (!accounting) return
    setErrors([])
    const priceBps = parsePercentToBps(priceTolerance)
    const taxMinor = parseKwdToMinor(taxTolerance)
    if (priceBps === null || taxMinor === null) {
      setErrors(['pro.acct.errTolerance'])
      return
    }
    // Every field is sent, because saving replaces them all: leaving one out would put it back to its default.
    const parsed = updateAccountingSchema.safeParse({
      version: accounting.version,
      inventoryAccountId: inventoryId,
      payableAccountId: payableId,
      inputTaxAccountId: taxId === '' ? null : taxId,
      accountingBasis: basis,
      grniAccountId: grniId === '' ? null : grniId,
      ppvAccountId: ppvId === '' ? null : ppvId,
      costingMethod,
      cogsAccountId: cogsId === '' ? null : cogsId,
      priceToleranceBps: priceBps,
      taxToleranceMinor: taxMinor,
    })
    if (!parsed.success) {
      const needsReceiptAccounts = parsed.error.issues.some((issue) => issue.path[0] === 'grniAccountId')
      const needsCosting = parsed.error.issues.some((issue) => issue.path[0] === 'cogsAccountId')
      setErrors([needsReceiptAccounts ? 'pro.acct.errReceiptBasis' : needsCosting ? 'pro.acct.errCosting' : 'pro.acct.errRequired'])
      return
    }
    void accountsRun.run(async () => {
      const saved = await apiRequest<{ data: ProcurementAccounting }>('/api/v1/procurement/accounting', { method: 'PATCH', body: parsed.data })
      setAccounting(saved.data)
      setNotice('pro.msg.accountsSaved')
      onChanged('pro.msg.accountsSaved')
    })
  }

  function saveLimit() {
    if (!settings) return
    setErrors([])
    const parsed = updateSettingsSchema.safeParse({
      version: settings.version,
      approvalThresholdMinor: threshold.trim() === '' ? null : (parseKwdToMinor(threshold) ?? Number.NaN),
    })
    if (!parsed.success) {
      setErrors(['pro.acct.errLimit'])
      return
    }
    void limitRun.run(async () => {
      const saved = await apiRequest<{ data: ProcurementSettings }>('/api/v1/procurement/settings', { method: 'PATCH', body: parsed.data })
      setSettings(saved.data)
      setNotice('pro.msg.limitSaved')
      onChanged('pro.msg.limitSaved')
    })
  }

  if (phase === 'loading') return <p className="py-8 text-center text-sm text-gray-400">{t('erp.loading')}</p>
  if (phase === 'error') {
    return (
      <div className="space-y-3 py-6 text-center">
        <p role="alert" className={`${errorClass} inline-block`}>
          {t(loadError)}
        </p>
        <div>
          <button type="button" onClick={() => setRetry((value) => value + 1)} className={secondaryButton}>
            {t('erp.retry')}
          </button>
        </div>
      </div>
    )
  }

  const configured = accounting !== null && accounting.inventoryAccountId !== null && accounting.payableAccountId !== null

  return (
    <div className="space-y-5">
      {notice ? (
        <p role="status" className={noticeClass}>
          {t(notice)}
        </p>
      ) : null}
      {errors.length > 0 ? (
        <ul role="alert" className={`${errorClass} list-disc space-y-1 ps-6`}>
          {errors.map((message) => (
            <li key={message}>{t(message)}</li>
          ))}
        </ul>
      ) : null}

      <section className={panelClass} aria-label={t('pro.acct.title')}>
        <h3 className="text-base font-semibold text-gray-100">{t('pro.acct.title')}</h3>
        <p className="mt-1 text-sm text-gray-400">{t('pro.acct.hint')}</p>
        {!configured ? (
          <p role="status" className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            {t('pro.acct.notConfigured')}
          </p>
        ) : null}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <AccountSelect type="asset" value={inventoryId} onChange={setInventoryId} label={t('pro.acct.inventory')} />
          <AccountSelect type="liability" value={payableId} onChange={setPayableId} label={t('pro.acct.payable')} />
          <AccountSelect type="asset" value={taxId} onChange={setTaxId} label={t('pro.acct.inputTax')} />
        </div>
        <p className="mt-2 text-xs text-gray-500">{t('pro.acct.taxHint')}</p>

        <h4 className="mt-6 text-sm font-semibold text-gray-200">{t('pro.acct.basisTitle')}</h4>
        <p className="mt-1 text-sm text-gray-400">{t(basis === 'receipt_basis' ? 'pro.acct.basis.receiptHint' : 'pro.acct.basis.invoiceHint')}</p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={t('pro.acct.basis')}>
            <select value={basis} onChange={(event) => setBasis(event.target.value as AccountingBasis)} className={inputClass}>
              {accountingBases.map((value) => (
                <option key={value} value={value}>
                  {t(value === 'receipt_basis' ? 'pro.acct.basis.receipt' : 'pro.acct.basis.invoice')}
                </option>
              ))}
            </select>
          </Field>
          {basis === 'receipt_basis' ? (
            <>
              <AccountSelect type="liability" value={grniId} onChange={setGrniId} label={t('pro.acct.grni')} />
              <AccountSelect type="expense" value={ppvId} onChange={setPpvId} label={t('pro.acct.ppv')} />
            </>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-gray-500">{t('pro.acct.basisLocked')}</p>

        <h4 className="mt-6 text-sm font-semibold text-gray-200">{t('pro.acct.costingTitle')}</h4>
        <p className="mt-1 text-sm text-gray-400">{t('pro.acct.costingHint')}</p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={t('pro.acct.costing')}>
            <select value={costingMethod} onChange={(event) => setCostingMethod(event.target.value as CostingMethod)} className={inputClass}>
              {costingMethods.map((value) => (
                <option key={value} value={value}>
                  {t(value === 'moving_weighted_average' ? 'pro.acct.costing.mwa' : 'pro.acct.costing.order')}
                </option>
              ))}
            </select>
          </Field>
          {costingMethod === 'moving_weighted_average' ? (
            <AccountSelect type="expense" value={cogsId} onChange={setCogsId} label={t('pro.acct.cogs')} />
          ) : null}
        </div>

        <h4 className="mt-6 text-sm font-semibold text-gray-200">{t('pro.acct.matchTitle')}</h4>
        <p className="mt-1 text-sm text-gray-400">{t('pro.acct.matchHint')}</p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={t('pro.acct.priceTolerance')}>
            <input value={priceTolerance} onChange={(event) => setPriceTolerance(event.target.value)} inputMode="decimal" dir="ltr" className={inputClass} />
          </Field>
          <Field label={t('pro.acct.taxTolerance')}>
            <input value={taxTolerance} onChange={(event) => setTaxTolerance(event.target.value)} inputMode="decimal" dir="ltr" className={inputClass} />
          </Field>
        </div>

        <div className="mt-4 space-y-3">
          <FailureMessage failure={accountsRun.failure} onReload={() => setRetry((value) => value + 1)} />
          <button type="button" onClick={saveAccounts} disabled={accountsRun.pending} className={primaryButton}>
            {accountsRun.pending ? t('erp.loading') : t('pro.save')}
          </button>
        </div>
      </section>

      <section className={panelClass} aria-label={t('pro.acct.limitTitle')}>
        <h3 className="text-base font-semibold text-gray-100">{t('pro.acct.limitTitle')}</h3>
        <p className="mt-1 text-sm text-gray-400">{t('pro.acct.limitHint')}</p>
        <div className="mt-4 max-w-xs">
          <Field label={t('pro.acct.limit')}>
            <input value={threshold} onChange={(event) => setThreshold(event.target.value)} inputMode="decimal" dir="ltr" className={inputClass} />
          </Field>
        </div>
        <div className="mt-4 space-y-3">
          <FailureMessage failure={limitRun.failure} onReload={() => setRetry((value) => value + 1)} />
          <button type="button" onClick={saveLimit} disabled={limitRun.pending} className={primaryButton}>
            {limitRun.pending ? t('erp.loading') : t('pro.save')}
          </button>
        </div>
      </section>
    </div>
  )
}
