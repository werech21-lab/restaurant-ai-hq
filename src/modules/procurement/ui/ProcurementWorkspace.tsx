'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { Badge, Num } from '@/components/ui'
import { SectionCard } from '@/components/ui/section-card'
import { StateBlock } from '@/components/ui/state-block'
import { permissions } from '@/lib/auth/permissions'
import {
  UNAVAILABLE_DASH,
  formatDate,
  formatInt,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import {
  invoiceStatuses,
  orderStatuses,
  requestStatuses,
  type PurchaseOrder,
  type PurchaseRequest,
  type PurchaseReturn,
  type Supplier,
  type SupplierCreditNote,
  type SupplierInvoice,
  type SupplierPayment,
  type SupplierPaymentStatus,
} from '@/modules/procurement/client'
import { AccountingSettings } from '@/modules/procurement/ui/AccountingSettings'
import { CreditNoteDialog } from '@/modules/procurement/ui/CreditNoteDialog'
import { InvoiceDialog } from '@/modules/procurement/ui/InvoiceDialog'
import { OrderDialog } from '@/modules/procurement/ui/OrderDialog'
import { PagedTable } from '@/modules/procurement/ui/PagedTable'
import { PaymentDialog } from '@/modules/procurement/ui/PaymentDialog'
import { PermissionProvider, useCan } from '@/modules/procurement/ui/permissions'
import { ReceiveDialog } from '@/modules/procurement/ui/ReceiveDialog'
import { ReconciliationPanel } from '@/modules/procurement/ui/ReconciliationPanel'
import { RequestDialog } from '@/modules/procurement/ui/RequestDialog'
import { ReturnDialog } from '@/modules/procurement/ui/ReturnDialog'
import { SupplierDialog } from '@/modules/procurement/ui/SupplierDialog'
import {
  InvoiceStatusBadge,
  Modal,
  OrderStatusBadge,
  RequestStatusBadge,
  SupplierStatusBadge,
  dateTimeText,
  formatMinorKwd,
  invoiceStatusLabels,
  orderStatusLabels,
  proInputClass,
  proNoticeClass,
  proPrimaryButton,
  proSecondaryButton,
  requestStatusLabels,
} from '@/modules/procurement/ui/shared'

const allTabs = [
  'requests',
  'orders',
  'invoices',
  'returns',
  'creditnotes',
  'payments',
  'suppliers',
  'reconciliation',
  'settings',
] as const
type Tab = (typeof allTabs)[number]

const tabPermission: Record<Tab, string> = {
  requests: permissions.procurementRequestRead,
  orders: permissions.procurementOrderRead,
  invoices: permissions.procurementInvoiceRead,
  returns: permissions.procurementReturnRead,
  creditnotes: permissions.procurementCreditNoteRead,
  payments: permissions.procurementPaymentRead,
  suppliers: permissions.procurementSupplierRead,
  reconciliation: permissions.procurementInvoiceRead,
  settings: permissions.procurementSettingsManage,
}

type Dialog =
  | { kind: 'request'; requestId?: string }
  | { kind: 'order'; orderId?: string }
  | { kind: 'receive'; orderId: string }
  | { kind: 'invoice'; orderId?: string; invoiceId?: string }
  | { kind: 'return'; orderId?: string; returnId?: string }
  | { kind: 'creditnote'; invoiceId?: string; creditNoteId?: string }
  | { kind: 'payment'; paymentId?: string; start?: { supplierId: string; invoiceId: string } }
  | { kind: 'supplier'; supplier?: Supplier }
  | null

const paymentStateLabels: Record<SupplierPaymentStatus, MessageKey> = {
  unpaid: 'pro.paystate.unpaid',
  partially_paid: 'pro.paystate.partially_paid',
  paid: 'pro.paystate.paid',
  credited: 'pro.paystate.credited',
}
const paymentStateTones: Record<
  SupplierPaymentStatus,
  'warn' | 'info' | 'good' | 'neutral'
> = {
  unpaid: 'warn',
  partially_paid: 'info',
  paid: 'good',
  credited: 'neutral',
}

function DocumentStatusBadge({ status }: { status: 'posted' | 'void' }) {
  const { t } = useI18n()
  return (
    <Badge tone={status === 'posted' ? 'good' : 'neutral'}>
      {t(invoiceStatusLabels[status])}
    </Badge>
  )
}

/** Purchase-to-pay procurement workspace. */
export default function ProcurementWorkspace({
  permissions: held,
  initialTab,
}: {
  permissions: readonly string[]
  initialTab?: string
}) {
  return (
    <PermissionProvider permissions={held}>
      <Workspace initialTab={initialTab} />
    </PermissionProvider>
  )
}

function Workspace({ initialTab }: { initialTab?: string }) {
  const { t, locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  const isAr = fmtLocale === 'ar'
  const unavailableTooltip = getUnavailableTooltip(fmtLocale)

  const canReadRequests = useCan(tabPermission.requests)
  const canReadOrders = useCan(tabPermission.orders)
  const canReadInvoices = useCan(tabPermission.invoices)
  const canReadReturns = useCan(tabPermission.returns)
  const canReadCredits = useCan(tabPermission.creditnotes)
  const canReadPayments = useCan(tabPermission.payments)
  const canReadSuppliers = useCan(tabPermission.suppliers)
  const canManageSettings = useCan(tabPermission.settings)
  const canCreateSupplier = useCan(permissions.procurementSupplierManage)
  const canCreateOrder = useCan(permissions.procurementOrderCreate)
  const canCreateRequest = useCan(permissions.procurementRequestCreate)
  const canCreatePayment = useCan(permissions.procurementPaymentCreate)

  const visibleTabs = useMemo<Tab[]>(() => {
    const allowed: Record<Tab, boolean> = {
      requests: canReadRequests,
      orders: canReadOrders,
      invoices: canReadInvoices,
      returns: canReadReturns,
      creditnotes: canReadCredits,
      payments: canReadPayments,
      suppliers: canReadSuppliers,
      reconciliation: canReadInvoices,
      settings: canManageSettings,
    }
    return allTabs.filter((value) => allowed[value])
  }, [
    canReadRequests,
    canReadOrders,
    canReadInvoices,
    canReadReturns,
    canReadCredits,
    canReadPayments,
    canReadSuppliers,
    canManageSettings,
  ])

  const [chosenTab, setTab] = useState<Tab>(
    allTabs.includes(initialTab as Tab) ? (initialTab as Tab) : 'requests',
  )
  const tab: Tab | null = visibleTabs.includes(chosenTab)
    ? chosenTab
    : (visibleTabs[0] ?? null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [notice, setNotice] = useState<MessageKey | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [requestStatus, setRequestStatus] = useState('all')
  const [orderStatus, setOrderStatus] = useState('all')
  const [invoiceStatus, setInvoiceStatus] = useState('all')
  const [settlement, setSettlement] = useState('all')
  const [creditStatus, setCreditStatus] = useState('all')
  const [paymentStatus, setPaymentStatus] = useState('all')
  const [supplierStatus, setSupplierStatus] = useState('all')

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const changed = useCallback((message: MessageKey) => {
    setNotice(message)
    setReloadToken((value) => value + 1)
  }, [])
  const closeDialog = useCallback(() => setDialog(null), [])

  const title = (() => {
    switch (dialog?.kind) {
      case 'request':
        return t(dialog.requestId ? 'pro.req.title' : 'pro.req.new')
      case 'order':
        return t(dialog.orderId ? 'pro.ord.title' : 'pro.ord.new')
      case 'receive':
        return t('pro.rcv.title')
      case 'invoice':
        return t(dialog.invoiceId ? 'pro.inv.title' : 'pro.inv.new')
      case 'return':
        return t(dialog.returnId ? 'pro.ret.title' : 'pro.ret.new')
      case 'creditnote':
        return t(dialog.creditNoteId ? 'pro.cn.title' : 'pro.cn.new')
      case 'payment':
        return t(dialog.paymentId ? 'pro.pay.title' : 'pro.pay.new')
      case 'supplier':
        return t(dialog.supplier ? 'pro.sup.edit' : 'pro.sup.new')
      default:
        return ''
    }
  })()

  const requestPath = useMemo(
    () => `/api/v1/procurement/requests?limit=25&status=${requestStatus}`,
    [requestStatus],
  )
  const orderPath = useMemo(
    () => `/api/v1/procurement/orders?limit=25&status=${orderStatus}`,
    [orderStatus],
  )
  const invoicePath = useMemo(
    () =>
      `/api/v1/procurement/invoices?limit=25&status=${invoiceStatus}&settlement=${settlement}`,
    [invoiceStatus, settlement],
  )
  const returnPath = '/api/v1/procurement/returns?limit=25'
  const creditPath = useMemo(
    () => `/api/v1/procurement/credit-notes?limit=25&status=${creditStatus}`,
    [creditStatus],
  )
  const paymentPath = useMemo(
    () => `/api/v1/procurement/payments?limit=25&status=${paymentStatus}`,
    [paymentStatus],
  )
  const supplierPath = useMemo(
    () => `/api/v1/procurement/suppliers?limit=25&status=${supplierStatus}`,
    [supplierStatus],
  )

  const statusFilter = (value: string, onChange: (next: string) => void) => (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={t('pro.col.status')}
      className={`${proInputClass} mt-0 w-auto`}
    >
      <option value="all">{t('pro.allStatuses')}</option>
      {invoiceStatuses.map((status) => (
        <option key={status} value={status}>
          {t(invoiceStatusLabels[status])}
        </option>
      ))}
    </select>
  )

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-w-0 space-y-5">
      <Link
        href="/erp"
        className="ds-focus-ring inline-block rounded text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
      >
        {t('erp.back')}
      </Link>

      <SectionCard
        locale={fmtLocale}
        icon={<ShoppingCart className="h-4 w-4" aria-hidden />}
        title={t('pro.title')}
        subtitle={t('pro.subtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            {canCreateSupplier ? (
              <button
                type="button"
                onClick={() => setDialog({ kind: 'supplier' })}
                className={proSecondaryButton}
              >
                {t('pro.sup.new')}
              </button>
            ) : null}
            {canCreateOrder ? (
              <button
                type="button"
                onClick={() => setDialog({ kind: 'order' })}
                className={proSecondaryButton}
              >
                {t('pro.ord.new')}
              </button>
            ) : null}
            {canCreatePayment ? (
              <button
                type="button"
                onClick={() => setDialog({ kind: 'payment' })}
                className={proSecondaryButton}
              >
                {t('pro.pay.new')}
              </button>
            ) : null}
            {canCreateRequest ? (
              <button
                type="button"
                onClick={() => setDialog({ kind: 'request' })}
                className={proPrimaryButton}
              >
                {t('pro.req.new')}
              </button>
            ) : null}
          </div>
        }
      >
        {notice ? (
          <p role="status" className={`${proNoticeClass} mb-4`}>
            {t(notice)}
          </p>
        ) : null}

        {tab === null ? (
          <StateBlock
            state="forbidden"
            locale={fmtLocale}
            title={t('pro.noAccess')}
          />
        ) : (
          <>
            <div
              role="tablist"
              aria-label={t('pro.title')}
              className="mb-4 flex max-w-full items-center gap-1 overflow-x-auto no-scrollbar border-b border-[var(--ds-border-hairline)]"
            >
              {visibleTabs.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  id={`pro-tab-${value}`}
                  aria-selected={tab === value}
                  aria-controls={`pro-panel-${value}`}
                  onClick={() => setTab(value)}
                  className={`ds-focus-ring -mb-px shrink-0 cursor-pointer whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition ${
                    tab === value
                      ? 'border-emerald-600 font-bold text-emerald-700 dark:border-emerald-400 dark:text-emerald-300'
                      : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {t(`pro.tab.${value}`)}
                </button>
              ))}
            </div>

            <div
              role="tabpanel"
              id={`pro-panel-${tab}`}
              aria-labelledby={`pro-tab-${tab}`}
            >
              {tab === 'requests' ? (
                <PagedTable<PurchaseRequest>
                  path={requestPath}
                  reloadToken={reloadToken}
                  onOpen={(row) => setDialog({ kind: 'request', requestId: row.id })}
                  emptyTitle="pro.req.empty"
                  emptyHint="pro.req.emptyHint"
                  toolbar={
                    <select
                      value={requestStatus}
                      onChange={(event) => setRequestStatus(event.target.value)}
                      aria-label={t('pro.col.status')}
                      className={`${proInputClass} mt-0 w-auto`}
                    >
                      <option value="all">{t('pro.allStatuses')}</option>
                      {requestStatuses.map((value) => (
                        <option key={value} value={value}>
                          {t(requestStatusLabels[value])}
                        </option>
                      ))}
                    </select>
                  }
                  columns={[
                    {
                      header: 'pro.col.number',
                      cell: (row) => (
                        <Num className="font-semibold text-emerald-700 dark:text-emerald-300">
                          PR-{row.number}
                        </Num>
                      ),
                    },
                    {
                      header: 'pro.col.neededBy',
                      cell: (row) =>
                        row.neededBy ? (
                          <Num>{formatDate(row.neededBy, fmtLocale)}</Num>
                        ) : (
                          <span title={unavailableTooltip}>{UNAVAILABLE_DASH}</span>
                        ),
                    },
                    {
                      header: 'pro.col.lines',
                      cell: (row) => <Num>{formatInt(row.lineCount, fmtLocale)}</Num>,
                    },
                    {
                      header: 'pro.col.created',
                      cell: (row) => <Num>{dateTimeText(row.createdAt, fmtLocale)}</Num>,
                    },
                    {
                      header: 'pro.col.status',
                      cell: (row) => <RequestStatusBadge status={row.status} />,
                    },
                  ]}
                />
              ) : null}

              {tab === 'orders' ? (
                <PagedTable<PurchaseOrder>
                  path={orderPath}
                  reloadToken={reloadToken}
                  onOpen={(row) => setDialog({ kind: 'order', orderId: row.id })}
                  emptyTitle="pro.ord.empty"
                  emptyHint="pro.ord.emptyHint"
                  toolbar={
                    <select
                      value={orderStatus}
                      onChange={(event) => setOrderStatus(event.target.value)}
                      aria-label={t('pro.col.status')}
                      className={`${proInputClass} mt-0 w-auto`}
                    >
                      <option value="all">{t('pro.allStatuses')}</option>
                      {orderStatuses.map((value) => (
                        <option key={value} value={value}>
                          {t(orderStatusLabels[value])}
                        </option>
                      ))}
                    </select>
                  }
                  columns={[
                    {
                      header: 'pro.col.number',
                      cell: (row) => (
                        <Num className="font-semibold text-emerald-700 dark:text-emerald-300">
                          PO-{row.number}
                        </Num>
                      ),
                    },
                    { header: 'pro.col.supplier', cell: (row) => row.supplierName },
                    {
                      header: 'pro.col.date',
                      cell: (row) => <Num>{formatDate(row.orderDate, fmtLocale)}</Num>,
                    },
                    {
                      header: 'pro.col.total',
                      cell: (row) => <Num>{formatMinorKwd(row.totalMinor, fmtLocale)}</Num>,
                    },
                    {
                      header: 'pro.col.status',
                      cell: (row) => <OrderStatusBadge status={row.status} />,
                    },
                  ]}
                />
              ) : null}

              {tab === 'invoices' ? (
                <PagedTable<SupplierInvoice>
                  path={invoicePath}
                  reloadToken={reloadToken}
                  onOpen={(row) => setDialog({ kind: 'invoice', invoiceId: row.id })}
                  emptyTitle="pro.inv.empty"
                  emptyHint="pro.inv.emptyHint"
                  toolbar={
                    <>
                      <select
                        value={invoiceStatus}
                        onChange={(event) => setInvoiceStatus(event.target.value)}
                        aria-label={t('pro.col.status')}
                        className={`${proInputClass} mt-0 w-auto`}
                      >
                        <option value="all">{t('pro.allStatuses')}</option>
                        {invoiceStatuses.map((value) => (
                          <option key={value} value={value}>
                            {t(invoiceStatusLabels[value])}
                          </option>
                        ))}
                      </select>
                      <select
                        value={settlement}
                        onChange={(event) => setSettlement(event.target.value)}
                        aria-label={t('pro.inv.paymentStatus')}
                        className={`${proInputClass} mt-0 w-auto`}
                      >
                        <option value="all">{t('pro.inv.settleAll')}</option>
                        <option value="open">{t('pro.inv.settleOpen')}</option>
                      </select>
                    </>
                  }
                  columns={[
                    {
                      header: 'pro.col.number',
                      cell: (row) => (
                        <Num className="font-semibold text-emerald-700 dark:text-emerald-300">
                          SI-{row.number}
                        </Num>
                      ),
                    },
                    { header: 'pro.col.supplier', cell: (row) => row.supplierName },
                    {
                      header: 'pro.inv.supplierNumber',
                      cell: (row) => <Num>{row.supplierInvoiceNumber}</Num>,
                    },
                    {
                      header: 'pro.inv.dueDate',
                      cell: (row) => <Num>{formatDate(row.dueDate, fmtLocale)}</Num>,
                    },
                    {
                      header: 'pro.col.total',
                      cell: (row) => <Num>{formatMinorKwd(row.totalMinor, fmtLocale)}</Num>,
                    },
                    {
                      header: 'pro.inv.balance',
                      cell: (row) => <Num>{formatMinorKwd(row.balanceMinor, fmtLocale)}</Num>,
                    },
                    {
                      header: 'pro.inv.paymentStatus',
                      cell: (row) =>
                        row.status === 'posted' ? (
                          <Badge tone={paymentStateTones[row.paymentStatus]}>
                            {t(paymentStateLabels[row.paymentStatus])}
                          </Badge>
                        ) : (
                          <span title={unavailableTooltip}>{UNAVAILABLE_DASH}</span>
                        ),
                    },
                    {
                      header: 'pro.col.status',
                      cell: (row) => <InvoiceStatusBadge status={row.status} />,
                    },
                  ]}
                />
              ) : null}

              {tab === 'returns' ? (
                <PagedTable<PurchaseReturn>
                  path={returnPath}
                  reloadToken={reloadToken}
                  onOpen={(row) => setDialog({ kind: 'return', returnId: row.id })}
                  emptyTitle="pro.ret.empty"
                  emptyHint="pro.ret.emptyHint"
                  columns={[
                    {
                      header: 'pro.col.number',
                      cell: (row) => (
                        <Num className="font-semibold text-emerald-700 dark:text-emerald-300">
                          RT-{row.number}
                        </Num>
                      ),
                    },
                    { header: 'pro.col.supplier', cell: (row) => row.supplierName },
                    {
                      header: 'pro.rcv.order',
                      cell: (row) => <Num>PO-{row.orderNumber}</Num>,
                    },
                    {
                      header: 'pro.ret.date',
                      cell: (row) => <Num>{formatDate(row.returnDate, fmtLocale)}</Num>,
                    },
                    {
                      header: 'pro.ret.value',
                      cell: (row) => <Num>{formatMinorKwd(row.valueMinor, fmtLocale)}</Num>,
                    },
                  ]}
                />
              ) : null}

              {tab === 'creditnotes' ? (
                <PagedTable<SupplierCreditNote>
                  path={creditPath}
                  reloadToken={reloadToken}
                  onOpen={(row) => setDialog({ kind: 'creditnote', creditNoteId: row.id })}
                  emptyTitle="pro.cn.empty"
                  emptyHint="pro.cn.emptyHint"
                  toolbar={statusFilter(creditStatus, setCreditStatus)}
                  columns={[
                    {
                      header: 'pro.col.number',
                      cell: (row) => (
                        <Num className="font-semibold text-emerald-700 dark:text-emerald-300">
                          CN-{row.number}
                        </Num>
                      ),
                    },
                    { header: 'pro.col.supplier', cell: (row) => row.supplierName },
                    {
                      header: 'pro.cn.invoice',
                      cell: (row) => <Num>SI-{row.invoiceNumber}</Num>,
                    },
                    {
                      header: 'pro.cn.supplierNumber',
                      cell: (row) => <Num>{row.supplierCreditNoteNumber}</Num>,
                    },
                    {
                      header: 'pro.col.total',
                      cell: (row) => <Num>{formatMinorKwd(row.totalMinor, fmtLocale)}</Num>,
                    },
                    {
                      header: 'pro.col.status',
                      cell: (row) => <DocumentStatusBadge status={row.status} />,
                    },
                  ]}
                />
              ) : null}

              {tab === 'payments' ? (
                <PagedTable<SupplierPayment>
                  path={paymentPath}
                  reloadToken={reloadToken}
                  onOpen={(row) => setDialog({ kind: 'payment', paymentId: row.id })}
                  emptyTitle="pro.pay.empty"
                  emptyHint="pro.pay.emptyHint"
                  toolbar={statusFilter(paymentStatus, setPaymentStatus)}
                  columns={[
                    {
                      header: 'pro.col.number',
                      cell: (row) => (
                        <Num className="font-semibold text-emerald-700 dark:text-emerald-300">
                          PAY-{row.number}
                        </Num>
                      ),
                    },
                    { header: 'pro.col.supplier', cell: (row) => row.supplierName },
                    {
                      header: 'pro.pay.date',
                      cell: (row) => <Num>{formatDate(row.paymentDate, fmtLocale)}</Num>,
                    },
                    {
                      header: 'pro.pay.method',
                      cell: (row) => t(`pro.pay.method.${row.method}`),
                    },
                    {
                      header: 'pro.pay.amount',
                      cell: (row) => <Num>{formatMinorKwd(row.amountMinor, fmtLocale)}</Num>,
                    },
                    {
                      header: 'pro.col.status',
                      cell: (row) => <DocumentStatusBadge status={row.status} />,
                    },
                  ]}
                />
              ) : null}

              {tab === 'suppliers' ? (
                <PagedTable<Supplier>
                  path={supplierPath}
                  reloadToken={reloadToken}
                  onOpen={(row) => setDialog({ kind: 'supplier', supplier: row })}
                  emptyTitle="pro.sup.empty"
                  emptyHint="pro.sup.emptyHint"
                  toolbar={
                    <select
                      value={supplierStatus}
                      onChange={(event) => setSupplierStatus(event.target.value)}
                      aria-label={t('pro.col.status')}
                      className={`${proInputClass} mt-0 w-auto`}
                    >
                      <option value="all">{t('pro.allStatuses')}</option>
                      <option value="active">{t('pro.sstatus.active')}</option>
                      <option value="blocked">{t('pro.sstatus.blocked')}</option>
                    </select>
                  }
                  columns={[
                    {
                      header: 'pro.sup.code',
                      cell: (row) => (
                        <Num className="font-semibold text-emerald-700 dark:text-emerald-300">
                          {row.code}
                        </Num>
                      ),
                    },
                    { header: 'pro.sup.name', cell: (row) => row.name },
                    {
                      header: 'pro.sup.terms',
                      cell: (row) => <Num>{formatInt(row.paymentTermsDays, fmtLocale)}</Num>,
                    },
                    {
                      header: 'pro.col.status',
                      cell: (row) => <SupplierStatusBadge status={row.status} />,
                    },
                  ]}
                />
              ) : null}

              {tab === 'reconciliation' ? (
                <ReconciliationPanel reloadToken={reloadToken} />
              ) : null}

              {tab === 'settings' ? (
                <AccountingSettings reloadToken={reloadToken} onChanged={changed} />
              ) : null}
            </div>
          </>
        )}
      </SectionCard>

      {dialog ? (
        <Modal
          title={title}
          onClose={closeDialog}
          size={dialog.kind === 'supplier' ? 'md' : 'xl'}
        >
          {dialog.kind === 'request' ? (
            <RequestDialog
              requestId={dialog.requestId}
              onChanged={changed}
              onClose={closeDialog}
              onOpenOrder={(orderId) => setDialog({ kind: 'order', orderId })}
            />
          ) : null}
          {dialog.kind === 'order' ? (
            <OrderDialog
              key={dialog.orderId ?? 'new'}
              orderId={dialog.orderId}
              onChanged={changed}
              onClose={closeDialog}
              onReceive={(orderId) => setDialog({ kind: 'receive', orderId })}
              onInvoice={(orderId) => setDialog({ kind: 'invoice', orderId })}
              onReturn={(orderId) => setDialog({ kind: 'return', orderId })}
              onOpenInvoice={(invoiceId) => setDialog({ kind: 'invoice', invoiceId })}
              onOpenReturn={(returnId) => setDialog({ kind: 'return', returnId })}
            />
          ) : null}
          {dialog.kind === 'receive' ? (
            <ReceiveDialog
              orderId={dialog.orderId}
              onChanged={changed}
              onClose={closeDialog}
              onBack={(orderId) => setDialog({ kind: 'order', orderId })}
            />
          ) : null}
          {dialog.kind === 'invoice' ? (
            <InvoiceDialog
              key={dialog.invoiceId ?? dialog.orderId}
              invoiceId={dialog.invoiceId}
              orderId={dialog.orderId}
              onChanged={changed}
              onClose={closeDialog}
              onBack={(orderId) => setDialog({ kind: 'order', orderId })}
              onPay={(start) => setDialog({ kind: 'payment', start })}
              onCredit={(invoiceId) => setDialog({ kind: 'creditnote', invoiceId })}
            />
          ) : null}
          {dialog.kind === 'return' ? (
            <ReturnDialog
              key={dialog.returnId ?? dialog.orderId}
              orderId={dialog.orderId}
              returnId={dialog.returnId}
              onChanged={changed}
              onClose={closeDialog}
              onBack={(orderId) => setDialog({ kind: 'order', orderId })}
            />
          ) : null}
          {dialog.kind === 'creditnote' ? (
            <CreditNoteDialog
              key={dialog.creditNoteId ?? dialog.invoiceId}
              invoiceId={dialog.invoiceId}
              creditNoteId={dialog.creditNoteId}
              onChanged={changed}
              onClose={closeDialog}
              onOpenInvoice={(invoiceId) => setDialog({ kind: 'invoice', invoiceId })}
            />
          ) : null}
          {dialog.kind === 'payment' ? (
            <PaymentDialog
              key={dialog.paymentId ?? dialog.start?.invoiceId ?? 'new'}
              paymentId={dialog.paymentId}
              start={dialog.start}
              onChanged={changed}
              onClose={closeDialog}
              onOpenInvoice={(invoiceId) => setDialog({ kind: 'invoice', invoiceId })}
            />
          ) : null}
          {dialog.kind === 'supplier' ? (
            <SupplierDialog
              supplier={dialog.supplier}
              onCancel={closeDialog}
              onSaved={(message) => {
                closeDialog()
                changed(message)
              }}
            />
          ) : null}
        </Modal>
      ) : null}
    </div>
  )
}
