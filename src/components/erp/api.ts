import { DomainError } from '@/lib/domain-error'
import type { MessageKey } from '@/lib/i18n'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  idempotencyKey?: string
  signal?: AbortSignal
}

function readError(payload: unknown): { code: string; message: string; details?: unknown } | null {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) return null
  const error = (payload as { error: unknown }).error
  if (typeof error !== 'object' || error === null) return null
  const { code, message, details } = error as { code?: unknown; message?: unknown; details?: unknown }
  if (typeof code !== 'string' || typeof message !== 'string') return null
  return { code, message, details }
}

/** Calls an /api/v1 endpoint. Throws ApiError with the server's error code on any failure. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey

  let response: Response
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
      cache: 'no-store',
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'network', 'Network error')
  }

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (!response.ok) {
    const parsed = readError(payload)
    throw new ApiError(response.status, parsed?.code ?? 'generic', parsed?.message ?? 'Request failed', parsed?.details)
  }
  return payload as T
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

const errorKeys: Record<string, MessageKey> = {
  network: 'erp.err.network',
  unauthenticated: 'erp.err.unauthenticated',
  forbidden: 'erp.err.forbidden',
  no_tenant_access: 'erp.err.no_tenant_access',
  tenant_required: 'erp.err.tenant_required',
  version_conflict: 'erp.err.version_conflict',
  validation_failed: 'erp.err.validation_failed',
  payment_exceeds_balance: 'erp.err.payment_exceeds_balance',
  payment_not_positive: 'erp.err.payment_not_positive',
  cannot_void: 'erp.err.cannot_void',
  invalid_transition: 'erp.err.invalid_transition',
  not_editable: 'erp.err.not_editable',
  empty_invoice: 'erp.err.empty_invoice',
  zero_total: 'erp.err.zero_total',
  amount_too_large: 'erp.err.amount_too_large',
  customer_not_found: 'erp.err.customer_not_found',
  customer_inactive: 'erp.err.customer_inactive',
  invoice_not_found: 'erp.err.invoice_not_found',
  finance_not_configured: 'erp.err.finance_not_configured',
  server_misconfigured: 'erp.err.server_misconfigured',
  idempotency_key_reused: 'erp.err.idempotency_key_reused',
  sku_exists: 'inv.err.sku_exists',
  warehouse_code_exists: 'inv.err.warehouse_code_exists',
  item_not_found: 'inv.err.item_not_found',
  warehouse_not_found: 'inv.err.warehouse_not_found',
  insufficient_stock: 'inv.err.insufficient_stock',
  item_inactive: 'inv.err.item_inactive',
  warehouse_inactive: 'inv.err.warehouse_inactive',
  same_warehouse: 'inv.err.same_warehouse',
  invalid_quantity: 'inv.err.invalid_quantity',
  credit_limit_exceeded: 'crm.err.credit_limit_exceeded',
  customer_not_active: 'crm.err.customer_not_active',
  quote_expired: 'crm.err.quote_expired',
  invalid_valid_until: 'crm.err.invalid_valid_until',
  customer_blocked: 'crm.err.customer_blocked',
  lead_closed: 'crm.err.lead_closed',
  lead_customer_mismatch: 'crm.err.lead_customer_mismatch',
  lead_not_found: 'crm.err.lead_not_found',
  not_found: 'crm.err.not_found',
  reference_invalid: 'crm.err.reference_invalid',
  proposal_stale: 'ai.err.proposal_stale',
  customer_already_blocked: 'ai.err.customer_already_blocked',
  condition_invalid: 'ai.err.condition_invalid',
  order_not_found: 'pro.err.not_found',
  request_not_found: 'pro.err.not_found',
  receipt_not_found: 'pro.err.not_found',
  supplier_not_found: 'pro.err.not_found',
  order_line_not_found: 'pro.err.not_found',
  request_line_not_found: 'pro.err.not_found',
  account_not_found: 'pro.err.not_found',
  order_not_draft: 'pro.err.order_state',
  order_not_pending: 'pro.err.order_state',
  order_not_cancellable: 'pro.err.order_state',
  order_not_receivable: 'pro.err.order_not_receivable',
  order_not_invoiceable: 'pro.err.order_not_invoiceable',
  request_not_draft: 'pro.err.request_state',
  request_not_submitted: 'pro.err.request_state',
  request_not_approved: 'pro.err.request_state',
  request_not_cancellable: 'pro.err.request_state',
  duplicate_invoice_line: 'pro.err.duplicate_line',
  duplicate_receipt_line: 'pro.err.duplicate_line',
  duplicate_request_line: 'pro.err.duplicate_line',
  over_receipt: 'pro.err.over_receipt',
  over_invoice: 'pro.err.over_invoice',
  nothing_to_invoice: 'pro.err.nothing_to_invoice',
  total_mismatch: 'pro.err.total_mismatch',
  accounts_not_configured: 'pro.err.accounts_not_configured',
  accounts_not_distinct: 'pro.err.accounts_not_distinct',
  account_not_postable: 'pro.err.account_invalid',
  account_type_invalid: 'pro.err.account_invalid',
  no_fiscal_period: 'pro.err.no_fiscal_period',
  period_closed: 'pro.err.period_closed',
  duplicate_supplier_invoice: 'pro.err.duplicate_supplier_invoice',
  supplier_blocked: 'pro.err.supplier_blocked',
  supplier_code_exists: 'pro.err.supplier_code_exists',
  request_line_unpriced: 'pro.err.request_line_unpriced',
  zero_invoice: 'pro.err.zero_invoice',
  currency_mismatch: 'pro.err.currency_mismatch',
  invoice_not_posted: 'pro.err.invoice_not_posted',
  rule_violation: 'pro.err.rule_violation',
  over_return: 'pro.err.over_return',
  over_credit: 'pro.err.over_credit',
  over_payment: 'pro.err.over_payment',
  nothing_to_return: 'pro.err.nothing_to_return',
  nothing_to_credit: 'pro.err.nothing_to_credit',
  duplicate_return_line: 'pro.err.duplicate_line',
  duplicate_credit_line: 'pro.err.duplicate_line',
  duplicate_allocation: 'pro.err.duplicate_line',
  invoice_line_not_found: 'pro.err.not_found',
  return_not_found: 'pro.err.not_found',
  credit_note_not_found: 'pro.err.not_found',
  payment_not_found: 'pro.err.not_found',
  duplicate_supplier_credit_note: 'pro.err.duplicate_supplier_credit_note',
  duplicate_payment_reference: 'pro.err.duplicate_payment_reference',
  allocation_mismatch: 'pro.err.allocation_mismatch',
  supplier_mismatch: 'pro.err.supplier_mismatch',
  payment_before_invoice: 'pro.err.payment_before_invoice',
  zero_amount: 'pro.err.zero_amount',
  invalid_price: 'pro.err.invalid_price',
  price_variance_exceeded: 'pro.err.price_variance_exceeded',
  tax_variance_exceeded: 'pro.err.tax_variance_exceeded',
  invoice_has_payments: 'pro.err.invoice_has_payments',
  invoice_has_credit_notes: 'pro.err.invoice_has_credit_notes',
  accounting_locked: 'pro.err.accounting_locked',
  credit_note_not_posted: 'pro.err.document_not_posted',
  payment_not_posted: 'pro.err.document_not_posted',
  employee_has_history: 'hr.err.history',
  cursor_invalid: 'erp.err.cursor_invalid',
  account_code_exists: 'led.err.account_code_exists',
  account_has_active_children: 'led.err.account_has_active_children',
  parent_not_found: 'led.err.parent_not_found',
  parent_type_mismatch: 'led.err.parent_type_mismatch',
  parent_not_header: 'led.err.parent_not_header',
  period_not_found: 'led.err.period_not_found',
  period_name_exists: 'led.err.period_name_exists',
  period_overlaps: 'led.err.period_overlaps',
  period_has_drafts: 'led.err.period_has_drafts',
  journal_entry_not_found: 'led.err.journal_entry_not_found',
  entry_not_draft: 'led.err.entry_not_draft',
  entry_not_posted: 'led.err.entry_not_posted',
  entry_has_source: 'led.err.entry_has_source',
  entry_not_reversible: 'led.err.entry_not_reversible',
  entry_source_mismatch: 'led.err.entry_source_mismatch',
  already_reversed: 'led.err.already_reversed',
  unbalanced_entry: 'led.err.unbalanced_entry',
  entry_too_short: 'led.err.entry_too_short',
  invalid_line: 'led.err.invalid_line',
  brand_not_found: 'org.err.brand_not_found',
  brand_code_exists: 'org.err.brand_code_exists',
  brand_has_active_branches: 'org.err.brand_has_active_branches',
  brand_inactive: 'org.err.brand_inactive',
  branch_not_found: 'org.err.branch_not_found',
  branch_code_exists: 'org.err.branch_code_exists',
  grant_exceeds_permissions: 'iam.err.grant_exceeds_permissions',
  admin_role_requires_role_manage: 'iam.err.admin_role_requires_role_manage',
  tenant_suspended: 'iam.err.tenant_suspended',
  last_admin: 'iam.err.last_admin',
  role_not_found: 'iam.err.role_not_found',
  already_member: 'iam.err.already_member',
  invitation_pending: 'iam.err.invitation_pending',
  invitation_not_found: 'iam.err.invitation_not_found',
  invitation_not_pending: 'iam.err.invitation_not_pending',
  invitation_invalid: 'iam.err.invitation_invalid',
  email_unconfirmed: 'iam.err.email_unconfirmed',
  cannot_change_own_role: 'iam.err.cannot_change_own_role',
  member_not_found: 'iam.err.member_not_found',
  admin_member_requires_role_manage: 'iam.err.admin_member_requires_role_manage',
  role_unchanged: 'iam.err.role_unchanged',
  cannot_remove_self: 'iam.err.cannot_remove_self',
  role_exists: 'iam.err.role_exists',
  system_role_locked: 'iam.err.system_role_locked',
}

const detailCodes = ['insufficient_stock', 'over_receipt', 'over_invoice', 'over_return', 'over_credit', 'over_payment']

/** The server's own message for errors whose detail helps the user, such as which SKU is short. Otherwise null. */
export function errorDetail(error: unknown): string | null {
  if (error instanceof ApiError && detailCodes.includes(error.code)) return error.message
  return null
}

/**
 * Picks the translated message for a failed request. A rule the screen checked itself before sending (a DomainError from the
 * shared pure rules) maps the same way as the server's answer. Unknown codes fall back to a generic message.
 */
export function errorKey(error: unknown): MessageKey {
  if (error instanceof ApiError || error instanceof DomainError) return errorKeys[error.code] ?? 'erp.err.generic'
  return 'erp.err.generic'
}
