import { AppError } from '@/lib/api/errors'
import type { AuthContext } from '@/lib/auth/context'
import { permissions, type Permission } from '@/lib/auth/permissions'
import { withTransaction } from '@/lib/db'
import { DomainError } from '@/lib/domain-error'
import { hashRequest, runIdempotent, type IdempotentResult } from '@/lib/idempotency'
import {
  assertCanConvert,
  assertWithinCreditLimit,
  invoiceDates,
  toInvoiceLines,
} from '@/modules/crm/domain/quotation'
import type { ConversionResult } from '@/modules/crm/domain/types'
import { crmEventBase, publishCrmEvents, type CrmEvent } from '@/modules/crm/events'
import * as customers from '@/modules/crm/repositories/customer-repository'
import * as repository from '@/modules/crm/repositories/quotation-repository'
import type { VersionBody } from '@/modules/crm/schemas/common'
import { winLeadWithin } from '@/modules/crm/services/lead-service'
import {
  auditQuotation,
  loadQuotationDetail,
  quotationNotFound,
  today,
  versionConflict,
} from '@/modules/crm/services/quotation-service'
import {
  createInvoiceWithin,
  getCustomerFinancials,
  publishFinanceEvents,
  submitInvoiceWithin,
  type FinanceEvent,
} from '@/modules/finance'
import { findStockShortages, publishInventoryEvents, type InventoryEvent } from '@/modules/inventory'

export type ConversionBody = { data: ConversionResult }

function requirePermission(auth: AuthContext, permission: Permission): void {
  if (!auth.permissions.has(permission)) {
    throw new AppError(403, 'forbidden', 'You do not have permission for this action.')
  }
}

/**
 * One-click quote-to-cash. In ONE database transaction it:
 *  1. locks the accepted quotation and checks its version,
 *  2. locks the customer and requires it to be active,
 *  3. checks the stock on hand for every stock line,
 *  4. checks the customer's credit limit against open balance plus this invoice,
 *  5. creates the invoice with the quotation's lines (due 30 days after today, UTC) and submits it by the normal
 *     finance rules: issued with stock deducted when the total is within the approval limit, otherwise pending approval,
 *  6. marks the quotation converted and links the invoice,
 *  7. moves the linked lead to won when it is still open,
 *  8. writes an audit row for each record it changed.
 * Anything that fails rolls everything back. Events are published only after the commit.
 * The caller needs the convert permission and the finance create and submit permissions.
 */
export async function convertQuotation(
  auth: AuthContext,
  idempotencyKey: string,
  id: string,
  input: VersionBody
): Promise<IdempotentResult<ConversionBody>> {
  requirePermission(auth, permissions.financeInvoiceCreate)
  requirePermission(auth, permissions.financeInvoiceSubmit)

  const crmEvents: CrmEvent[] = []
  const financeEvents: FinanceEvent[] = []
  const stockEvents: InventoryEvent[] = []

  const outcome = await withTransaction((tx) =>
    runIdempotent<ConversionBody>(
      tx,
      {
        tenantId: auth.tenantId,
        scope: `crm.quotation.convert:${id}`,
        key: idempotencyKey,
        requestHash: hashRequest({ id, version: input.version }),
      },
      async () => {
        const quotation = await repository.findQuotation(tx, auth.tenantId, id, { lock: true })
        if (!quotation) throw quotationNotFound()
        if (quotation.version !== input.version) throw versionConflict()
        assertCanConvert(quotation)

        // Locking the customer serialises conversions for one customer, so two of them cannot both pass the credit check.
        const customer = await customers.findCustomer(tx, auth.tenantId, quotation.customerId, { lock: true })
        if (!customer) throw new DomainError('customer_not_found', 'The customer does not exist.')
        if (customer.status !== 'active') {
          throw new DomainError(
            'customer_not_active',
            `The customer is ${customer.status}. Activate the customer before converting the quotation.`
          )
        }

        const lines = await repository.listLines(tx, auth.tenantId, id)
        const invoiceLines = toInvoiceLines(lines)

        const shortages = await findStockShortages(tx, auth.tenantId, invoiceLines)
        if (shortages.length > 0) {
          const detail = shortages
            .map((shortage) => `${shortage.sku} @ ${shortage.warehouseCode}: need ${shortage.required}, have ${shortage.available}`)
            .join('; ')
          throw new DomainError('insufficient_stock', `Not enough stock. ${detail}`)
        }

        const financials = await getCustomerFinancials(tx, auth.tenantId, customer.id)
        assertWithinCreditLimit({
          creditLimitMinor: customer.creditLimitMinor,
          openBalanceMinor: financials.openBalanceMinor,
          newTotalMinor: quotation.totalMinor,
        })

        const { issueDate, dueDate } = invoiceDates(today())
        const draft = await createInvoiceWithin(
          tx,
          auth,
          {
            customerId: customer.id,
            issueDate,
            dueDate,
            notes: (quotation.notes ? `Quotation ${quotation.quoteNumber}: ${quotation.notes}` : `Quotation ${quotation.quoteNumber}`).slice(
              0,
              2000
            ),
            lines: invoiceLines,
          },
          financeEvents
        )
        const invoice = await submitInvoiceWithin(tx, auth, draft.id, { version: draft.version }, financeEvents, stockEvents)

        const converted = await repository.applyStatusChange(tx, auth.tenantId, id, input.version, {
          status: 'converted',
          invoiceId: invoice.id,
        })
        if (!converted) throw versionConflict()
        await auditQuotation(tx, auth, id, 'update', quotation, converted)
        crmEvents.push({
          ...crmEventBase(auth.tenantId),
          name: 'crm.quotation.converted',
          payload: {
            quotationId: id,
            quoteNumber: converted.quoteNumber,
            customerId: customer.id,
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            totalMinor: invoice.totalMinor,
            convertedBy: auth.userId,
          },
        })

        const lead = converted.leadId ? await winLeadWithin(tx, auth, converted.leadId, id, crmEvents) : null

        return {
          status: 200,
          body: {
            data: {
              quotation: await loadQuotationDetail(tx, auth, converted),
              invoice,
              lead,
              stockDeducted: invoice.status === 'issued',
            },
          },
        }
      }
    )
  )

  if (!outcome.replayed) {
    await publishFinanceEvents(financeEvents)
    await publishInventoryEvents(stockEvents)
    await publishCrmEvents(crmEvents)
  }
  return outcome
}
