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
  method?: 'GET' | 'POST' | 'PATCH'
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
}

/** The server's own message for errors whose detail helps the user, such as which SKU is short. Otherwise null. */
export function errorDetail(error: unknown): string | null {
  if (error instanceof ApiError && error.code === 'insufficient_stock') return error.message
  return null
}

/** Picks the translated message for a failed request. Unknown codes fall back to a generic message. */
export function errorKey(error: unknown): MessageKey {
  if (error instanceof ApiError) return errorKeys[error.code] ?? 'erp.err.generic'
  return 'erp.err.generic'
}
