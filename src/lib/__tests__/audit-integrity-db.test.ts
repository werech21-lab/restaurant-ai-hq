import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { bootstrapTenant, createUser, getPglite, startDatabase, stopDatabase } from '@/lib/__tests__/support/database'
import type { AuthContext, SessionUser } from '@/lib/auth/context'
import { allPermissions } from '@/lib/auth/permissions'

vi.mock('@/lib/db', async () => {
  const support = await import('@/lib/__tests__/support/database')
  return { db: support.testDb, withTransaction: support.testWithTransaction }
})

import { approveApproval, listApprovals, runScan } from '@/modules/ai'
import { listApprovalsQuerySchema } from '@/modules/ai/schemas/ai'
import { acceptQuotation, createCustomer, createLead, createQuotation, moveLead, sendQuotation, updateCustomer, updateLead, updateQuotation } from '@/modules/crm'
import {
  approveInvoice,
  closePeriod,
  createAccount,
  createInvoice,
  createJournalEntry,
  createPeriod,
  postJournalEntry,
  recordPayment,
  reverseJournalEntry,
  submitInvoice,
  updateAccount,
  updateInvoice,
  updateJournalEntry,
  voidInvoice,
} from '@/modules/finance'
import { createItem, createProduct, createWarehouse, deleteProduct, recordMovement, updateItem, updateProduct, updateWarehouse } from '@/modules/inventory'
import { createBranch, createBrand, updateBranch, updateBrand } from '@/modules/org'
import {
  approveRequest,
  convertRequest,
  createCreditNote,
  createOrder,
  createPayment,
  createReceipt,
  createRequest,
  createReturn,
  createSupplier,
  createSupplierInvoice,
  getOrder,
  submitOrder,
  submitRequest,
  updateAccounting,
  updateSettings,
  updateSupplier,
  voidCreditNote,
  voidPayment,
} from '@/modules/procurement'
import { acceptInvitation, changeMemberRole, createInvitation, createRole, removeMember, updateRole } from '@/lib/iam/service'

/**
 * The audit trail itself, against the real migrations (0001-0015) in an in-process Postgres.
 *
 * One company runs a business cycle that touches every module and every kind of write the services perform (create,
 * update and the single hard delete the product catalogue allows). A second company runs beside it and must never
 * appear in the first one's trail. The assertions then prove four things about `audit_log`: a row exists for every
 * write with who, what, when, before and after; the row can never be updated or deleted, neither by the server's own
 * owner connection nor by a signed-in tenant owner through Supabase's roles; the trail is tenant scoped; and a
 * transaction that fails leaves nothing behind.
 *
 * Dates are fixed, never derived from the clock, so a rerun produces the same rows.
 */

const pg = () => getPglite()

type Action = 'create' | 'update' | 'delete'
type Operation = { label: string; entity: string; entityId: string; action: Action; actorId: string }

/** Every write the scenario performed, with the audit row it must have produced. */
const operations: Operation[] = []

let keyCounter = 0
const nextKey = () => `audit-key-${String(++keyCounter).padStart(8, '0')}`
let documentCounter = 0
const nextDocument = (prefix: string) => `${prefix}-${String(++documentCounter).padStart(5, '0')}`

let main: AuthContext
let other: AuthContext
/** A member of the main company whose role holds no permission at all. */
let blindMember: string

async function rows<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await pg().query<T>(sql, params)).rows
}

async function count(sql: string, params: unknown[] = []): Promise<number> {
  return (await pg().query<{ n: number }>(sql, params)).rows[0].n
}

async function auditCount(tenantId: string): Promise<number> {
  return count(`select count(*)::int as n from audit_log where tenant_id = $1`, [tenantId])
}

async function sqlFailure(sql: string, params: unknown[] = []): Promise<string> {
  try {
    await pg().query(sql, params)
    return 'ok'
  } catch (error) {
    return (error as Error).message
  }
}

async function outcome(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
    return 'ok'
  } catch (error) {
    const typed = error as { status?: number; code?: string; name?: string }
    if (typed.status) return `${typed.status}:${typed.code}`
    if (typed.code) return typed.code
    return `${typed.name}:${(error as Error).message}`
  }
}

function record(auth: AuthContext, label: string, entity: string, entityId: string, action: Action, actorId = auth.userId): void {
  operations.push({ label, entity, entityId, action, actorId })
}

/** Runs `fn` as a Supabase role with a chosen signed-in user, the way `security-db.test.ts` does. */
async function asRole<T>(role: 'anon' | 'authenticated', uid: string | null, fn: () => Promise<T>): Promise<T> {
  await pg().exec(`select set_config('test.uid', '${uid ?? ''}', false); set role ${role}`)
  try {
    return await fn()
  } finally {
    await pg().exec(`reset role; select set_config('test.uid', '', false)`)
  }
}

async function newTenant(label: string): Promise<AuthContext> {
  const userId = randomUUID()
  await createUser(userId, `${label}@example.test`)
  const tenantId = await bootstrapTenant(`Tenant ${label}`, `audit-${label}`, userId)
  return { userId, tenantId, permissions: new Set<string>(allPermissions) }
}

/** The whole business cycle, module by module. Every call that writes records what its audit row must look like. */
async function runScenario(auth: AuthContext): Promise<void> {
  // ---- org ----
  const brand = (await createBrand(auth, { code: 'AETHER', name: 'Aether', status: 'active' })).data
  record(auth, 'org.createBrand', 'brand', brand.id, 'create')
  const brandUpdated = (await updateBrand(auth, brand.id, { version: brand.version, name: 'Aether Foods', status: 'active' })).data
  record(auth, 'org.updateBrand', 'brand', brandUpdated.id, 'update')
  const branch = (await createBranch(auth, { brandId: brand.id, code: 'SALMIYA', name: 'Salmiya', timezone: 'Asia/Kuwait', status: 'active' })).data
  record(auth, 'org.createBranch', 'branch', branch.id, 'create')
  const branchUpdated = (await updateBranch(auth, branch.id, { version: branch.version, name: 'Salmiya Main', timezone: 'Asia/Kuwait', status: 'active' })).data
  record(auth, 'org.updateBranch', 'branch', branchUpdated.id, 'update')

  // ---- inventory ----
  const warehouse = (await createWarehouse(auth, nextKey(), { code: 'MAIN', name: 'Main', location: null, capacity: null, status: 'active' })).body.data
  record(auth, 'inventory.createWarehouse', 'warehouse', warehouse.id, 'create')
  const warehouseUpdated = (await updateWarehouse(auth, warehouse.id, { version: warehouse.version, name: 'Main store', location: 'Shuwaikh', capacity: null, status: 'active' })).data
  record(auth, 'inventory.updateWarehouse', 'warehouse', warehouseUpdated.id, 'update')
  const flour = (
    await createItem(auth, nextKey(), { sku: 'FLOUR', name: 'Flour', unit: 'piece', unitCostMinor: 800, sellingPriceMinor: 1_500, reorderLevel: 0, isActive: true })
  ).body.data
  record(auth, 'inventory.createItem', 'item', flour.id, 'create')
  const flourUpdated = (
    await updateItem(auth, flour.id, { version: flour.version, name: 'Flour 50kg', unitCostMinor: 800, sellingPriceMinor: 1_600, reorderLevel: 0, isActive: true })
  ).data
  record(auth, 'inventory.updateItem', 'item', flourUpdated.id, 'update')
  const sugar = (
    await createItem(auth, nextKey(), { sku: 'SUGAR', name: 'Sugar', unit: 'piece', unitCostMinor: 400, sellingPriceMinor: 900, reorderLevel: 20, isActive: true })
  ).body.data
  record(auth, 'inventory.createItem (low stock item)', 'item', sugar.id, 'create')
  const movement = (await recordMovement(auth, nextKey(), { type: 'IN', itemId: flour.id, warehouseId: warehouse.id, quantity: 40, note: 'Opening stock' })).body.data
  record(auth, 'inventory.recordMovement', 'stock_movement', movement.movements[0].id, 'create')
  const sugarIn = (await recordMovement(auth, nextKey(), { type: 'IN', itemId: sugar.id, warehouseId: warehouse.id, quantity: 5, note: null })).body.data
  record(auth, 'inventory.recordMovement (below reorder level)', 'stock_movement', sugarIn.movements[0].id, 'create')

  const product = (await createProduct(auth, { name: 'Chicken shawarma', category: 'Sandwiches', priceMinor: 1_250, available: true })).data
  record(auth, 'inventory.createProduct', 'product', product.id, 'create')
  const productUpdated = (await updateProduct(auth, product.id, { version: product.version, name: 'Chicken shawarma', category: 'Sandwiches', priceMinor: 1_350, available: true })).data
  record(auth, 'inventory.updateProduct', 'product', productUpdated.id, 'update')
  const doomed = (await createProduct(auth, { name: 'Discontinued juice', category: 'Drinks', priceMinor: 500, available: false })).data
  record(auth, 'inventory.createProduct (to be deleted)', 'product', doomed.id, 'create')
  await deleteProduct(auth, doomed.id, { version: doomed.version })
  record(auth, 'inventory.deleteProduct', 'product', doomed.id, 'delete')

  // ---- crm ----
  const customer = await createCustomer(auth, {
    name: 'Audit Co',
    customerType: 'company',
    email: null,
    phone: null,
    taxId: null,
    address: null,
    creditLimitMinor: null,
    status: 'active',
    notes: null,
  })
  record(auth, 'crm.createCustomer', 'customer', customer.id, 'create')
  const customerUpdated = (
    await updateCustomer(auth, customer.id, {
      version: customer.version,
      name: 'Audit Company',
      customerType: 'company',
      email: null,
      phone: null,
      taxId: null,
      address: null,
      creditLimitMinor: null,
      status: 'active',
      notes: null,
    })
  ).data
  record(auth, 'crm.updateCustomer', 'customer', customerUpdated.id, 'update')

  const lead = (
    await createLead(auth, nextKey(), {
      customerId: customer.id,
      title: 'Catering contract',
      stage: 'new',
      expectedRevenueMinor: 50_000,
      probability: 30,
      assignedTo: null,
      expectedCloseDate: null,
      notes: null,
    })
  ).body.data
  record(auth, 'crm.createLead', 'lead', lead.id, 'create')
  const leadUpdated = (
    await updateLead(auth, lead.id, {
      version: lead.version,
      title: 'Catering contract 2026',
      expectedRevenueMinor: 60_000,
      probability: 40,
      assignedTo: null,
      expectedCloseDate: null,
      notes: null,
    })
  ).data
  record(auth, 'crm.updateLead', 'lead', leadUpdated.id, 'update')
  const leadMoved = (await moveLead(auth, lead.id, { stage: 'qualified', version: leadUpdated.version })).data
  record(auth, 'crm.moveLead', 'lead', leadMoved.id, 'update')

  const quotation = (
    await createQuotation(auth, nextKey(), {
      customerId: customer.id,
      leadId: lead.id,
      validUntil: '2099-12-31',
      notes: null,
      lines: [{ description: 'Catering', quantity: 2, unitPriceMinor: 5_000, taxRateBps: 500, itemId: null, warehouseId: null }],
    })
  ).body.data
  record(auth, 'crm.createQuotation', 'quotation', quotation.id, 'create')
  const quotationUpdated = (
    await updateQuotation(auth, quotation.id, {
      version: quotation.version,
      customerId: customer.id,
      leadId: lead.id,
      validUntil: '2099-12-31',
      notes: 'Revised',
      lines: [{ description: 'Catering', quantity: 3, unitPriceMinor: 5_000, taxRateBps: 500, itemId: null, warehouseId: null }],
    })
  ).data
  record(auth, 'crm.updateQuotation', 'quotation', quotationUpdated.id, 'update')
  const quotationSent = (await sendQuotation(auth, quotation.id, { version: quotationUpdated.version })).data
  record(auth, 'crm.sendQuotation', 'quotation', quotationSent.id, 'update')
  const quotationAccepted = (await acceptQuotation(auth, quotation.id, { version: quotationSent.version })).data
  record(auth, 'crm.acceptQuotation', 'quotation', quotationAccepted.id, 'update')

  // ---- finance: invoices and payments ----
  const line = (quantity: number) => ({ description: 'Goods', quantity, unitPriceMinor: 1_000, taxRateBps: 500, itemId: flour.id, warehouseId: warehouse.id })
  const invoice = (
    await createInvoice(auth, nextKey(), { customerId: customer.id, issueDate: '2026-05-01', dueDate: '2026-06-01', notes: null, lines: [line(4)] })
  ).body.data
  record(auth, 'finance.createInvoice', 'invoice', invoice.id, 'create')
  const invoiceEdited = (
    await updateInvoice(auth, invoice.id, {
      version: invoice.version,
      customerId: customer.id,
      issueDate: '2026-05-01',
      dueDate: '2026-06-01',
      notes: 'Corrected quantity',
      lines: [line(5)],
    })
  ).data
  record(auth, 'finance.updateInvoice', 'invoice', invoiceEdited.id, 'update')
  const issued = (await submitInvoice(auth, invoice.id, { version: invoiceEdited.version })).data
  record(auth, 'finance.submitInvoice', 'invoice', issued.id, 'update')
  const paid = (
    await recordPayment(auth, invoice.id, nextKey(), {
      version: issued.version,
      amountMinor: issued.totalMinor,
      currency: 'KWD',
      method: 'knet',
      paidAt: '2026-05-05T10:00:00.000Z',
      reference: 'KNET-1',
    })
  ).body.data
  record(auth, 'finance.recordPayment (payment)', 'payment', paid.payment.id, 'create')
  record(auth, 'finance.recordPayment (invoice)', 'invoice', invoice.id, 'update')

  const voidable = (
    await createInvoice(auth, nextKey(), { customerId: customer.id, issueDate: '2026-05-01', dueDate: '2026-06-01', notes: null, lines: [line(2)] })
  ).body.data
  record(auth, 'finance.createInvoice (to be voided)', 'invoice', voidable.id, 'create')
  const voidableIssued = (await submitInvoice(auth, voidable.id, { version: voidable.version })).data
  record(auth, 'finance.submitInvoice (to be voided)', 'invoice', voidableIssued.id, 'update')
  const voided = (await voidInvoice(auth, voidable.id, { version: voidableIssued.version, reason: 'Entered twice' })).data
  record(auth, 'finance.voidInvoice', 'invoice', voided.id, 'update')

  const large = (
    await createInvoice(auth, nextKey(), {
      customerId: customer.id,
      issueDate: '2026-05-01',
      dueDate: '2026-06-01',
      notes: null,
      lines: [{ description: 'Annual contract', quantity: 1, unitPriceMinor: 6_000_000, taxRateBps: 0, itemId: null, warehouseId: null }],
    })
  ).body.data
  record(auth, 'finance.createInvoice (above the approval limit)', 'invoice', large.id, 'create')
  const pending = (await submitInvoice(auth, large.id, { version: large.version })).data
  record(auth, 'finance.submitInvoice (held for approval)', 'invoice', pending.id, 'update')
  const approved = (await approveInvoice(auth, large.id, { version: pending.version })).data
  record(auth, 'finance.approveInvoice', 'invoice', approved.id, 'update')

  // ---- finance: the general ledger ----
  const account = async (code: string, type: 'asset' | 'liability' | 'expense') =>
    (await createAccount(auth, { code, name: `Account ${code}`, type, parentId: null, isPostable: true })).data
  const inventoryAccount = await account('1100', 'asset')
  record(auth, 'finance.createAccount', 'account', inventoryAccount.id, 'create')
  const payableAccount = await account('2100', 'liability')
  record(auth, 'finance.createAccount (payable)', 'account', payableAccount.id, 'create')
  const taxAccount = await account('1300', 'asset')
  record(auth, 'finance.createAccount (input tax)', 'account', taxAccount.id, 'create')
  const grniAccount = await account('2150', 'liability')
  record(auth, 'finance.createAccount (GRNI)', 'account', grniAccount.id, 'create')
  const ppvAccount = await account('5100', 'expense')
  record(auth, 'finance.createAccount (price variance)', 'account', ppvAccount.id, 'create')
  const bankAccount = await account('1010', 'asset')
  record(auth, 'finance.createAccount (bank)', 'account', bankAccount.id, 'create')
  const renamed = (await updateAccount(auth, payableAccount.id, { version: payableAccount.version, name: 'Trade payables', isActive: true })).data
  record(auth, 'finance.updateAccount', 'account', renamed.id, 'update')

  const period = (await createPeriod(auth, { name: 'FY2026', startsOn: '2026-01-01', endsOn: '2026-12-31' })).data
  record(auth, 'finance.createPeriod', 'fiscal_period', period.id, 'create')
  const emptyPeriod = (await createPeriod(auth, { name: 'FY2024', startsOn: '2024-01-01', endsOn: '2024-12-31' })).data
  record(auth, 'finance.createPeriod (empty, to be closed)', 'fiscal_period', emptyPeriod.id, 'create')
  const closed = (await closePeriod(auth, emptyPeriod.id, { version: emptyPeriod.version })).data
  record(auth, 'finance.closePeriod', 'fiscal_period', closed.id, 'update')

  const entry = (
    await createJournalEntry(auth, nextKey(), {
      entryDate: '2026-05-02',
      memo: 'Opening',
      currency: 'KWD',
      lines: [
        { accountId: bankAccount.id, debitMinor: 10_000, creditMinor: 0, description: '' },
        { accountId: payableAccount.id, debitMinor: 0, creditMinor: 9_000, description: '' },
      ],
    })
  ).body.data
  record(auth, 'finance.createJournalEntry', 'journal_entry', entry.id, 'create')
  const balanced = (
    await updateJournalEntry(auth, entry.id, {
      version: entry.version,
      entryDate: '2026-05-02',
      memo: 'Opening balance',
      currency: 'KWD',
      lines: [
        { accountId: bankAccount.id, debitMinor: 10_000, creditMinor: 0, description: '' },
        { accountId: payableAccount.id, debitMinor: 0, creditMinor: 10_000, description: '' },
      ],
    })
  ).data
  record(auth, 'finance.updateJournalEntry', 'journal_entry', balanced.id, 'update')
  const postedEntry = (await postJournalEntry(auth, entry.id, { version: balanced.version })).data
  record(auth, 'finance.postJournalEntry', 'journal_entry', postedEntry.id, 'update')
  const reversal = (await reverseJournalEntry(auth, entry.id, nextKey(), { version: postedEntry.version, entryDate: '2026-05-03', memo: 'Reversal' })).body.data
  record(auth, 'finance.reverseJournalEntry (draft)', 'journal_entry', reversal.id, 'create')
  record(auth, 'finance.reverseJournalEntry (posted)', 'journal_entry', reversal.id, 'update')

  // ---- procurement ----
  const supplier = (await createSupplier(auth, { code: 'GULF', name: 'Gulf Foods', paymentTermsDays: 30, notes: null })).data
  record(auth, 'procurement.createSupplier', 'supplier', supplier.id, 'create')
  const supplierUpdated = (await updateSupplier(auth, supplier.id, { version: supplier.version, name: 'Gulf Foods Co', paymentTermsDays: 45, notes: null, status: 'active' })).data
  record(auth, 'procurement.updateSupplier', 'supplier', supplierUpdated.id, 'update')
  await updateSettings(auth, { version: 0, approvalThresholdMinor: 1_000_000 })
  record(auth, 'procurement.updateSettings', 'procurement_settings', auth.tenantId, 'create')
  await updateAccounting(auth, {
    version: 0,
    inventoryAccountId: inventoryAccount.id,
    payableAccountId: payableAccount.id,
    inputTaxAccountId: taxAccount.id,
    accountingBasis: 'receipt_basis',
    grniAccountId: grniAccount.id,
    ppvAccountId: ppvAccount.id,
    priceToleranceBps: 200,
    taxToleranceMinor: 50,
  })
  record(auth, 'procurement.updateAccounting', 'procurement_accounting', auth.tenantId, 'create')

  const request = (
    await createRequest(auth, nextKey(), {
      neededBy: '2026-06-01',
      reason: 'Weekly stock',
      lines: [{ itemId: flour.id, description: 'Flour', quantity: 10 }],
    })
  ).body.data
  record(auth, 'procurement.createRequest', 'purchase_request', request.id, 'create')
  const submittedRequest = (await submitRequest(auth, request.id, { version: request.version })).data
  record(auth, 'procurement.submitRequest', 'purchase_request', submittedRequest.id, 'update')
  const approvedRequest = (await approveRequest(auth, request.id, { version: submittedRequest.version })).data
  record(auth, 'procurement.approveRequest', 'purchase_request', approvedRequest.id, 'update')
  const converted = (
    await convertRequest(auth, request.id, nextKey(), {
      version: approvedRequest.version,
      supplierId: supplier.id,
      orderDate: '2026-05-02',
      expectedDate: null,
      notes: null,
      lines: approvedRequest.lines.map((entry) => ({ requestLineId: entry.id, unitCostMinor: 1_000, taxRateBps: 500 })),
    })
  ).body.data
  record(auth, 'procurement.convertRequest (request)', 'purchase_request', request.id, 'update')
  record(auth, 'procurement.convertRequest (order)', 'purchase_order', converted.order.id, 'create')

  const draftOrder = (await getOrder(auth, converted.order.id)).data
  const order = (await submitOrder(auth, draftOrder.id, { version: draftOrder.version })).data
  record(auth, 'procurement.submitOrder', 'purchase_order', order.id, 'update')
  const receipt = (
    await createReceipt(auth, order.id, nextKey(), {
      version: order.version,
      warehouseId: warehouse.id,
      receiptDate: '2026-05-10',
      notes: null,
      lines: [{ orderLineId: order.lines[0].id, quantity: 10 }],
    })
  ).body.data
  record(auth, 'procurement.createReceipt (receipt)', 'goods_receipt', receipt.id, 'create')
  record(auth, 'procurement.createReceipt (order)', 'purchase_order', order.id, 'update')

  const supplierInvoice = (
    await createSupplierInvoice(auth, nextKey(), {
      orderId: order.id,
      supplierInvoiceNumber: nextDocument('SI'),
      invoiceDate: '2026-05-12',
      currency: 'KWD',
      expectedTotalMinor: null,
      notes: null,
      lines: [{ orderLineId: order.lines[0].id, quantity: 10 }],
    })
  ).body.data
  record(auth, 'procurement.createSupplierInvoice', 'supplier_invoice', supplierInvoice.id, 'create')

  const purchaseReturn = (
    await createReturn(auth, nextKey(), {
      orderId: order.id,
      warehouseId: warehouse.id,
      returnDate: '2026-05-14',
      reason: 'Damaged on arrival',
      lines: [{ orderLineId: order.lines[0].id, quantity: 2 }],
    })
  ).body.data
  record(auth, 'procurement.createReturn', 'purchase_return', purchaseReturn.id, 'create')

  const creditNote = (
    await createCreditNote(auth, nextKey(), {
      invoiceId: supplierInvoice.id,
      supplierCreditNoteNumber: nextDocument('CN'),
      creditDate: '2026-05-15',
      currency: 'KWD',
      expectedTotalMinor: null,
      reason: 'Goods returned',
      lines: [{ invoiceLineId: supplierInvoice.lines[0].id, quantity: 1 }],
    })
  ).body.data
  record(auth, 'procurement.createCreditNote', 'supplier_credit_note', creditNote.id, 'create')
  const voidedNote = (await voidCreditNote(auth, creditNote.id, { version: creditNote.version, reason: 'Issued twice', entryDate: '2026-05-16' })).data
  record(auth, 'procurement.voidCreditNote', 'supplier_credit_note', voidedNote.id, 'update')

  const supplierPayment = (
    await createPayment(auth, nextKey(), {
      supplierId: supplier.id,
      paymentDate: '2026-05-20',
      amountMinor: 1_000,
      currency: 'KWD',
      method: 'bank_transfer',
      reference: 'TRF-00001',
      paidFromAccountId: bankAccount.id,
      notes: null,
      allocations: [{ invoiceId: supplierInvoice.id, amountMinor: 1_000 }],
    })
  ).body.data
  record(auth, 'procurement.createPayment', 'supplier_payment', supplierPayment.id, 'create')
  const voidedPayment = (await voidPayment(auth, supplierPayment.id, { version: supplierPayment.version, reason: 'Bounced', entryDate: '2026-05-21' })).data
  record(auth, 'procurement.voidPayment', 'supplier_payment', voidedPayment.id, 'update')

  // ---- identity and access ----
  const clerk = await createRole(auth, { name: 'Clerk', description: 'Reads invoices', permissions: ['finance.invoice.read'] })
  record(auth, 'iam.createRole', 'role', clerk.id, 'create')
  const clerkUpdated = await updateRole(auth, clerk.id, {
    version: clerk.version,
    name: 'Clerk',
    description: 'Reads invoices and customers',
    permissions: ['finance.invoice.read', 'crm.customer.read'],
  })
  record(auth, 'iam.updateRole', 'role', clerkUpdated.id, 'update')
  const auditorRole = await createRole(auth, { name: 'Auditor', description: 'Reads everything about money', permissions: ['finance.invoice.read'] })
  record(auth, 'iam.createRole (second role)', 'role', auditorRole.id, 'create')

  const invitedId = randomUUID()
  const invitedEmail = 'invited@example.test'
  await createUser(invitedId, invitedEmail)
  const invited: SessionUser = { userId: invitedId, email: invitedEmail, emailConfirmed: true }
  const invitation = await createInvitation(auth, { email: invitedEmail, roleId: clerk.id })
  record(auth, 'iam.createInvitation', 'invitation', invitation.invitation.id, 'create')
  await acceptInvitation(invited, { token: invitation.token })
  record(auth, 'iam.acceptInvitation (invitation)', 'invitation', invitation.invitation.id, 'update', invitedId)
  record(auth, 'iam.acceptInvitation (member)', 'member', invitedId, 'create', invitedId)
  await changeMemberRole(auth, invitedId, { roleId: auditorRole.id, expectedRoleId: clerk.id })
  record(auth, 'iam.changeMemberRole', 'member', invitedId, 'update')
  await removeMember(auth, invitedId, { expectedRoleId: auditorRole.id })
  record(auth, 'iam.removeMember', 'member', invitedId, 'delete')

  // ---- ai ----
  await runScan(auth, { trigger: null, itemIds: null })
  const insights = await rows<{ id: string }>(`select id from ai_insights_alerts where tenant_id = $1`, [auth.tenantId])
  expect(insights.length).toBeGreaterThan(0)
  for (const insight of insights) record(auth, 'ai.runScan (insight)', 'ai_insight', insight.id, 'create')
  const requests = (await listApprovals(auth, listApprovalsQuerySchema.parse({ limit: '100', status: 'pending' }))).data
  const restocks = requests.filter((entry) => entry.actionType === 'auto_reorder')
  expect(restocks.length).toBeGreaterThan(0)
  for (const restock of restocks) {
    record(auth, 'ai.runScan (approval request)', 'ai_action_approval', restock.id, 'create')
    await approveApproval(auth, restock.id, nextKey(), { version: restock.version, note: null })
    record(auth, 'ai.approveApproval', 'ai_action_approval', restock.id, 'update')
  }
}

beforeAll(async () => {
  await startDatabase()
  // The stub's auth.uid() is always null. Let the test choose the signed-in user the way a Supabase JWT would.
  await pg().exec(`
    create or replace function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  `)
  main = await newTenant('main')
  other = await newTenant('other')
  await runScenario(main)

  // The second company does enough to own rows of its own in the tables the first one wrote to.
  const otherWarehouse = (await createWarehouse(other, nextKey(), { code: 'MAIN', name: 'Other main', location: null, capacity: null, status: 'active' })).body.data
  const otherItem = (
    await createItem(other, nextKey(), { sku: 'RICE', name: 'Rice', unit: 'piece', unitCostMinor: 300, sellingPriceMinor: 700, reorderLevel: 0, isActive: true })
  ).body.data
  await recordMovement(other, nextKey(), { type: 'IN', itemId: otherItem.id, warehouseId: otherWarehouse.id, quantity: 9, note: null })
  await createCustomer(other, {
    name: 'Other Co',
    customerType: 'company',
    email: null,
    phone: null,
    taxId: null,
    address: null,
    creditLimitMinor: null,
    status: 'active',
    notes: null,
  })

  // A member of the main company whose role grants nothing: the trail must stay invisible to them.
  blindMember = randomUUID()
  await createUser(blindMember, 'blind@example.test')
  const blindRole = await createRole(main, { name: 'No access', description: '', permissions: [] })
  await pg().query(`insert into tenant_members (tenant_id, user_id, role_id, created_by) values ($1, $2, $3, $4)`, [
    main.tenantId,
    blindMember,
    blindRole.id,
    main.userId,
  ])
}, 300_000)
afterAll(stopDatabase)

// ---------------------------------------------------------------------------------------------------------------------

describe('every business write leaves an audit row', () => {
  it('covers all 70 or more creates, updates and deletes the scenario performed', async () => {
    expect(operations.length).toBeGreaterThanOrEqual(70)
    const missing: string[] = []
    for (const operation of operations) {
      const found = await count(
        `select count(*)::int as n from audit_log
          where tenant_id = $1 and entity = $2 and entity_id = $3 and action = $4 and actor_id = $5`,
        [main.tenantId, operation.entity, operation.entityId, operation.action, operation.actorId]
      )
      if (found === 0) missing.push(`${operation.label} -> ${operation.entity}.${operation.action}`)
    }
    expect(missing).toEqual([])
  })

  it('reaches every module: org, inventory, crm, finance, procurement, iam and ai', async () => {
    const entities = (await rows<{ entity: string }>(`select distinct entity from audit_log where tenant_id = $1 order by entity`, [main.tenantId])).map(
      (row) => row.entity
    )
    expect(entities).toEqual(
      expect.arrayContaining([
        'account',
        'ai_action_approval',
        'ai_insight',
        'ai_scan',
        'branch',
        'brand',
        'customer',
        'fiscal_period',
        'goods_receipt',
        'invitation',
        'invoice',
        'item',
        'journal_entry',
        'lead',
        'member',
        'payment',
        'procurement_accounting',
        'procurement_settings',
        'product',
        'purchase_order',
        'purchase_request',
        'purchase_return',
        'quotation',
        'role',
        'stock_movement',
        'supplier',
        'supplier_credit_note',
        'supplier_invoice',
        'supplier_payment',
        'warehouse',
      ])
    )
  })

  it('names who, what and when on every row, and nothing else is ever written', async () => {
    const malformed = await rows<{ id: string }>(
      `select id from audit_log
        where actor_id is null or entity_id is null or created_at is null
           or char_length(entity) = 0 or action not in ('create', 'update', 'delete')`
    )
    expect(malformed).toEqual([])
    const unknownActor = await rows<{ id: string }>(
      `select a.id from audit_log a where not exists (select 1 from auth.users u where u.id = a.actor_id)`
    )
    expect(unknownActor).toEqual([])
  })

  it('keeps before and after in step with the action: create has only after, delete has only before', async () => {
    // `writeAudit` stores a state that does not exist as SQL NULL. The JSON value `null` is accepted here as well so an
    // older row written before that fix does not read as a present state.
    const empty = (column: string) => `coalesce(jsonb_typeof(${column}), 'null') = 'null'`
    const wrong = await rows<{ action: string; entity: string; id: string }>(
      `select id, entity, action from audit_log
        where ((action = 'create' and (not ${empty('before')} or ${empty('after')}))
            or (action = 'update' and (${empty('before')} or ${empty('after')}))
            or (action = 'delete' and (${empty('before')} or not ${empty('after')})))`
    )
    expect(wrong).toEqual([])
    // The deleted product kept its last known state, which is the only record of a row that no longer exists.
    const deleted = await rows<{ before: { name: string } | null; after: unknown }>(
      `select before, after from audit_log where tenant_id = $1 and entity = 'product' and action = 'delete'`,
      [main.tenantId]
    )
    expect(deleted).toHaveLength(1)
    expect(deleted[0].before?.name).toBe('Discontinued juice')
    expect(deleted[0].after).toBeNull()
    expect(await count(`select count(*)::int as n from products where tenant_id = $1`, [main.tenantId])).toBe(1)
  })

  it('has a create row for every business record the services wrote, table by table', async () => {
    // Bootstrap writes the tenant, its system roles, the owner's membership and the settings rows without an actor's
    // decision behind them, so those are not business writes and are not in this list.
    const owned: Array<[table: string, entity: string]> = [
      ['brands', 'brand'],
      ['branches', 'branch'],
      ['warehouses', 'warehouse'],
      ['items', 'item'],
      ['stock_movements', 'stock_movement'],
      ['products', 'product'],
      ['customers', 'customer'],
      ['crm_leads_pipeline', 'lead'],
      ['sales_quotations', 'quotation'],
      ['invoices', 'invoice'],
      ['payments', 'payment'],
      ['accounts', 'account'],
      ['fiscal_periods', 'fiscal_period'],
      ['journal_entries', 'journal_entry'],
      ['suppliers', 'supplier'],
      ['purchase_requests', 'purchase_request'],
      ['purchase_orders', 'purchase_order'],
      ['goods_receipts', 'goods_receipt'],
      ['supplier_invoices', 'supplier_invoice'],
      ['purchase_returns', 'purchase_return'],
      ['supplier_credit_notes', 'supplier_credit_note'],
      ['supplier_payments', 'supplier_payment'],
      ['tenant_invitations', 'invitation'],
      ['ai_insights_alerts', 'ai_insight'],
      ['ai_action_approvals', 'ai_action_approval'],
    ]
    const uncovered: string[] = []
    for (const [table, entity] of owned) {
      const total = await count(`select count(*)::int as n from ${table} where tenant_id = $1`, [main.tenantId])
      expect(total, table).toBeGreaterThan(0)
      const unaudited = await count(
        `select count(*)::int as n from ${table} t
          where t.tenant_id = $1
            and not exists (
              select 1 from audit_log a
               where a.tenant_id = t.tenant_id and a.entity = $2 and a.entity_id = t.id and a.action = 'create')`,
        [main.tenantId, entity]
      )
      if (unaudited > 0) uncovered.push(`${table}: ${unaudited} of ${total}`)
    }
    expect(uncovered).toEqual([])
  })

  it('has an update row for every record that moved past its first version', async () => {
    const versioned: Array<[table: string, entity: string]> = [
      ['brands', 'brand'],
      ['branches', 'branch'],
      ['warehouses', 'warehouse'],
      ['items', 'item'],
      ['products', 'product'],
      ['customers', 'customer'],
      ['crm_leads_pipeline', 'lead'],
      ['sales_quotations', 'quotation'],
      ['invoices', 'invoice'],
      ['accounts', 'account'],
      ['fiscal_periods', 'fiscal_period'],
      ['journal_entries', 'journal_entry'],
      ['suppliers', 'supplier'],
      ['purchase_requests', 'purchase_request'],
      ['purchase_orders', 'purchase_order'],
      ['supplier_invoices', 'supplier_invoice'],
      ['supplier_credit_notes', 'supplier_credit_note'],
      ['supplier_payments', 'supplier_payment'],
      ['ai_action_approvals', 'ai_action_approval'],
    ]
    const uncovered: string[] = []
    let changed = 0
    for (const [table, entity] of versioned) {
      changed += await count(`select count(*)::int as n from ${table} where tenant_id = $1 and version > 1`, [main.tenantId])
      const unaudited = await count(
        `select count(*)::int as n from ${table} t
          where t.tenant_id = $1 and t.version > 1
            and not exists (
              select 1 from audit_log a
               where a.tenant_id = t.tenant_id and a.entity = $2 and a.entity_id = t.id and a.action = 'update')`,
        [main.tenantId, entity]
      )
      if (unaudited > 0) uncovered.push(`${table}: ${unaudited}`)
    }
    expect(changed).toBeGreaterThan(10)
    expect(uncovered).toEqual([])
  })

  it('writes the audit row in the same transaction as the record, never later', async () => {
    // Every invoice's create row carries a timestamp inside the invoice's own transaction window.
    const late = await rows<{ id: string }>(
      `select i.id from invoices i
        join audit_log a on a.tenant_id = i.tenant_id and a.entity = 'invoice' and a.entity_id = i.id and a.action = 'create'
       where i.tenant_id = $1 and a.created_at <> i.created_at`,
      [main.tenantId]
    )
    expect(late).toEqual([])
  })
})

// ---------------------------------------------------------------------------------------------------------------------

describe('the audit trail cannot be rewritten', () => {
  it('refuses an update or a delete from the server\'s own owner connection', async () => {
    const before = await auditCount(main.tenantId)
    expect(before).toBeGreaterThan(0)
    expect(await sqlFailure(`update audit_log set action = 'create' where tenant_id = $1`, [main.tenantId])).toContain('immutable')
    expect(await sqlFailure(`update audit_log set before = null, after = null where tenant_id = $1`, [main.tenantId])).toContain('immutable')
    expect(await sqlFailure(`update audit_log set actor_id = $2 where tenant_id = $1`, [main.tenantId, other.userId])).toContain('immutable')
    expect(await sqlFailure(`delete from audit_log where tenant_id = $1`, [main.tenantId])).toContain('cannot be deleted')
    expect(await sqlFailure(`delete from audit_log`)).toContain('cannot be deleted')
    expect(await auditCount(main.tenantId)).toBe(before)
  })

  it('refuses them to a signed-in tenant owner, who has no write privilege at all', async () => {
    const before = await auditCount(main.tenantId)
    await asRole('authenticated', main.userId, async () => {
      await expect(pg().query(`update audit_log set action = 'create' where tenant_id = $1`, [main.tenantId])).rejects.toThrow(/permission denied/i)
      await expect(pg().query(`delete from audit_log where tenant_id = $1`, [main.tenantId])).rejects.toThrow(/permission denied/i)
      await expect(pg().query(`insert into audit_log (tenant_id, actor_id, entity, entity_id, action) values ($1, $2, 'invoice', $1, 'create')`, [
        main.tenantId,
        main.userId,
      ])).rejects.toThrow(/permission denied/i)
    })
    expect(await auditCount(main.tenantId)).toBe(before)
  })

  it('keeps the owner connection able to read it, so nothing above passed because the rows were gone', async () => {
    expect(await auditCount(main.tenantId)).toBeGreaterThan(100)
    expect(await auditCount(other.tenantId)).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------------------------------------------------

describe('the audit trail is tenant scoped', () => {
  it('never points a row at another company\'s record or actor', async () => {
    const foreignActor = await rows<{ id: string }>(
      `select a.id from audit_log a
        where not exists (
          select 1 from tenant_members m where m.tenant_id = a.tenant_id and m.user_id = a.actor_id)
          and not exists (
          select 1 from audit_log b where b.tenant_id = a.tenant_id and b.entity = 'member' and b.entity_id = a.actor_id and b.action = 'delete')`
    )
    expect(foreignActor).toEqual([])
    const crossed: string[] = []
    for (const [table, entity] of [
      ['invoices', 'invoice'],
      ['items', 'item'],
      ['customers', 'customer'],
      ['stock_movements', 'stock_movement'],
      ['supplier_payments', 'supplier_payment'],
    ] as const) {
      const found = await count(
        `select count(*)::int as n from audit_log a join ${table} t on t.id = a.entity_id where a.entity = $1 and t.tenant_id <> a.tenant_id`,
        [entity]
      )
      if (found > 0) crossed.push(`${table}: ${found}`)
    }
    expect(crossed).toEqual([])
  })

  it('shows each owner only their own rows through Supabase', async () => {
    const seen: Record<string, string[]> = {}
    for (const tenant of [main, other]) {
      seen[tenant.tenantId] = await asRole('authenticated', tenant.userId, async () =>
        (await rows<{ tenant_id: string }>(`select distinct tenant_id from audit_log`)).map((row) => row.tenant_id)
      )
    }
    expect(seen[main.tenantId]).toEqual([main.tenantId])
    expect(seen[other.tenantId]).toEqual([other.tenantId])
  })

  it('shows nothing to a member without finance.invoice.read, and nothing to a stranger or to anon', async () => {
    expect(await asRole('authenticated', blindMember, async () => count(`select count(*)::int as n from audit_log`))).toBe(0)
    const stranger = randomUUID()
    await createUser(stranger, 'stranger@example.test')
    expect(await asRole('authenticated', stranger, async () => count(`select count(*)::int as n from audit_log`))).toBe(0)
    await asRole('anon', null, async () => {
      await expect(pg().query(`select * from audit_log`)).rejects.toThrow(/permission denied/i)
    })
  })
})

// ---------------------------------------------------------------------------------------------------------------------

describe('a transaction that fails leaves no audit row', () => {
  it('rolls the audit row back with the record when the commit itself is refused', async () => {
    const auditBefore = await auditCount(main.tenantId)
    const customersBefore = await count(`select count(*)::int as n from customers where tenant_id = $1`, [main.tenantId])
    // A deferred constraint trigger lets the audit row be written inside the transaction and refuses it at commit, which
    // is the only way to prove the row is rolled back rather than never inserted.
    await pg().exec(`
      create function audit_test_explode() returns trigger language plpgsql as $$ begin raise exception 'audit boom'; end; $$;
      create constraint trigger audit_test_explode after insert on audit_log deferrable initially deferred
        for each row execute function audit_test_explode();`)
    const failure = await outcome(
      createCustomer(main, {
        name: 'Never committed',
        customerType: 'company',
        email: null,
        phone: null,
        taxId: null,
        address: null,
        creditLimitMinor: null,
        status: 'active',
        notes: null,
      })
    )
    await pg().exec(`drop trigger audit_test_explode on audit_log; drop function audit_test_explode();`)
    expect(failure).toBe('P0001')
    expect(await auditCount(main.tenantId)).toBe(auditBefore)
    expect(await count(`select count(*)::int as n from customers where tenant_id = $1`, [main.tenantId])).toBe(customersBefore)
    expect(await count(`select count(*)::int as n from customers where tenant_id = $1 and name = 'Never committed'`, [main.tenantId])).toBe(0)

    // The same call succeeds once the trigger is gone, so the failure above was the trigger and not a broken request.
    const created = await createCustomer(main, {
      name: 'Committed',
      customerType: 'company',
      email: null,
      phone: null,
      taxId: null,
      address: null,
      creditLimitMinor: null,
      status: 'active',
      notes: null,
    })
    expect(await auditCount(main.tenantId)).toBe(auditBefore + 1)
    expect(
      await count(`select count(*)::int as n from audit_log where tenant_id = $1 and entity = 'customer' and entity_id = $2 and action = 'create'`, [
        main.tenantId,
        created.id,
      ])
    ).toBe(1)
  })

  it('writes no audit row for a business rule that refuses the request outright', async () => {
    const auditBefore = await auditCount(main.tenantId)
    const movementsBefore = await count(`select count(*)::int as n from stock_movements where tenant_id = $1`, [main.tenantId])
    const flour = (await rows<{ id: string }>(`select id from items where tenant_id = $1 and sku = 'FLOUR'`, [main.tenantId]))[0]
    const warehouse = (await rows<{ id: string }>(`select id from warehouses where tenant_id = $1 and code = 'MAIN'`, [main.tenantId]))[0]
    expect(
      await outcome(
        recordMovement(main, nextKey(), { type: 'OUT', itemId: flour.id, warehouseId: warehouse.id, quantity: 1_000_000, note: null })
      )
    ).toBe('insufficient_stock')
    expect(await auditCount(main.tenantId)).toBe(auditBefore)
    expect(await count(`select count(*)::int as n from stock_movements where tenant_id = $1`, [main.tenantId])).toBe(movementsBefore)
  })
})
