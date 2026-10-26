import type { Page } from '@/lib/api/cursor'
import { AppError } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/context'
import { permissions } from '@/lib/auth/permissions'
import { db, withTransaction, type Queryable } from '@/lib/db'
import { buildActivity } from '@/modules/crm/domain/activity'
import type { Customer, CustomerProfile, CustomerRef } from '@/modules/crm/domain/types'
import { crmEventBase, publishCrmEvent } from '@/modules/crm/events'
import * as customers from '@/modules/crm/repositories/customer-repository'
import * as leads from '@/modules/crm/repositories/lead-repository'
import * as quotations from '@/modules/crm/repositories/quotation-repository'
import type { CreateCustomerInput, ListCustomersQuery, UpdateCustomerInput } from '@/modules/crm/schemas/customer'
import { getCustomerFinancials } from '@/modules/finance'

/** Recent records shown on a customer profile. The full lists have their own endpoints. */
const PROFILE_LIMIT = 10

function notFound(): AppError {
  return new AppError(404, 'not_found', 'The customer was not found.')
}

export function listCustomers(auth: AuthContext, query: ListCustomersQuery): Promise<Page<Customer>> {
  return customers.listCustomers(db, auth.tenantId, query)
}

export async function getCustomer(auth: AuthContext, id: string): Promise<{ data: Customer }> {
  const customer = await customers.findCustomer(db, auth.tenantId, id)
  if (!customer) throw notFound()
  return { data: customer }
}

export async function createCustomer(auth: AuthContext, input: CreateCustomerInput): Promise<Customer> {
  const customer = await withTransaction(async (tx) => {
    const created = await customers.insertCustomer(tx, auth.tenantId, auth.userId, input)
    await writeAudit(tx, {
      tenantId: auth.tenantId,
      actorId: auth.userId,
      entity: 'customer',
      entityId: created.id,
      action: 'create',
      before: null,
      after: created,
    })
    return created
  })
  await publishCrmEvent({
    ...crmEventBase(auth.tenantId),
    name: 'crm.customer.created',
    payload: { customerId: customer.id, name: customer.name, createdBy: auth.userId },
  })
  return customer
}

export async function updateCustomer(auth: AuthContext, id: string, input: UpdateCustomerInput): Promise<{ data: Customer }> {
  const updated = await withTransaction(async (tx) => {
    const before = await customers.findCustomer(tx, auth.tenantId, id, { lock: true })
    if (!before) throw notFound()
    if (before.version !== input.version) {
      throw new AppError(409, 'version_conflict', 'The customer was changed by someone else. Reload it and try again.')
    }
    const after = await customers.updateCustomer(tx, auth.tenantId, id, input)
    if (!after) {
      throw new AppError(409, 'version_conflict', 'The customer was changed by someone else. Reload it and try again.')
    }
    await writeAudit(tx, {
      tenantId: auth.tenantId,
      actorId: auth.userId,
      entity: 'customer',
      entityId: id,
      action: 'update',
      before,
      after,
    })
    return after
  })
  await publishCrmEvent({
    ...crmEventBase(auth.tenantId),
    name: 'crm.customer.updated',
    payload: { customerId: updated.id, name: updated.name, status: updated.status, updatedBy: auth.userId },
  })
  return { data: updated }
}

/**
 * The 360 view. The customer comes first, then each section the caller may see: finance figures need
 * `finance.invoice.read`, quotations and leads need their own read permissions. A section the caller cannot read is
 * left out (financials null, lists empty) rather than failing the whole profile.
 */
export async function getCustomerProfile(auth: AuthContext, id: string): Promise<{ data: CustomerProfile }> {
  const customer = await customers.findCustomer(db, auth.tenantId, id)
  if (!customer) throw notFound()
  const can = (permission: string): boolean => auth.permissions.has(permission)
  const [financials, quoteList, leadList] = await Promise.all([
    can(permissions.financeInvoiceRead) ? getCustomerFinancials(db, auth.tenantId, id) : Promise.resolve(null),
    can(permissions.crmQuotationRead)
      ? quotations.listQuotationsForCustomer(db, auth.tenantId, id, PROFILE_LIMIT)
      : Promise.resolve([]),
    can(permissions.crmLeadRead) ? leads.listLeadsForCustomer(db, auth.tenantId, id, PROFILE_LIMIT) : Promise.resolve([]),
  ])
  return {
    data: {
      customer,
      financials,
      quotations: quoteList,
      leads: leadList,
      activity: buildActivity({ quotations: quoteList, leads: leadList, financials }),
    },
  }
}

/** Public lookup for other modules. Runs inside the caller's transaction and is always tenant scoped. */
export function findCustomer(tx: Queryable, tenantId: string, customerId: string): Promise<CustomerRef | null> {
  return customers.findCustomerRef(tx, tenantId, customerId)
}
