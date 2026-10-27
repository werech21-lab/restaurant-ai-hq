import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { bootstrapTenant, createUser, getPglite, startDatabase, stopDatabase } from '@/lib/__tests__/support/database'
import type { AuthContext } from '@/lib/auth/context'
import { allPermissions } from '@/lib/auth/permissions'

vi.mock('@/lib/db', async () => {
  const support = await import('@/lib/__tests__/support/database')
  return { db: support.testDb, withTransaction: support.testWithTransaction }
})

import { createCustomer } from '@/modules/crm'
import {
  createAccount,
  createInvoice,
  createJournalEntry,
  createPeriod,
  getJournalEntry,
  getTrialBalance,
  postJournalEntry,
  recordPayment,
  reverseJournalEntry,
  submitInvoice,
  updateInvoice,
  voidInvoice,
} from '@/modules/finance'
import type { Account, InvoiceDetail, JournalEntryDetail } from '@/modules/finance/client'
import { createItem, createWarehouse, recordMovement } from '@/modules/inventory'
import type { Item, Warehouse } from '@/modules/inventory/client'
import {
  approveRequest,
  convertRequest,
  createCreditNote,
  createPayment,
  createReceipt,
  createRequest,
  createReturn,
  createSupplier,
  createSupplierInvoice,
  getOrder,
  getReconciliation,
  getSupplierInvoice,
  submitOrder,
  submitRequest,
  updateAccounting,
  voidCreditNote,
  voidPayment,
  voidSupplierInvoice,
} from '@/modules/procurement'
import type { PurchaseOrderDetail, Supplier, SupplierCreditNoteDetail, SupplierInvoiceDetail, SupplierPaymentDetail } from '@/modules/procurement/client'

/**
 * Two proofs that nothing else in the suite makes, against the real migrations (0001-0015) in an in-process Postgres.
 *
 * 1. Financial record immutability. A posted journal entry, a sales payment, a supplier payment, a supplier credit note
 *    and an issued sales invoice are attacked twice: once with raw SQL over the server's own owner connection, to show
 *    what the triggers and constraints refuse by themselves, and once through the services, to show what only the
 *    service layer refuses. The two are kept in separate blocks on purpose, because a rule that lives only in the
 *    service is a rule a hand-written statement can still break.
 *
 * 2. Books versus stock. One full procure-to-pay cycle runs on each accounting basis, and the closing state is then
 *    checked in one place: every posted journal entry balances to the fils, the inventory account equals the stock the
 *    database triggers maintain valued at the PURCHASE ORDER price (not the item's `unit_cost_minor`, which is
 *    deliberately different here), and each supplier invoice's balance equals total minus paid minus credited.
 *
 * All dates are fixed. PGlite runs one transaction at a time, so nothing here is a statement about real locking.
 */

const pg = () => getPglite()

type Basis = 'invoice_basis' | 'receipt_basis'

type World = {
  auth: AuthContext
  basis: Basis
  supplier: Supplier
  warehouse: Warehouse
  flour: Item
  sugar: Item
  inventory: Account
  payable: Account
  tax: Account
  grni: Account
  ppv: Account
  bank: Account
}

/** What one full cycle leaves behind, so the closing assertions can name every document. */
type Cycle = {
  world: World
  order: PurchaseOrderDetail
  invoice: SupplierInvoiceDetail
  creditNote: SupplierCreditNoteDetail
  payment: SupplierPaymentDetail
  /** GRNI measured after the receipt and before any supplier invoice: goods received, not yet invoiced. */
  grniAfterReceipt: number
}

/** The item cost on the catalogue row. Every purchase in this file is priced away from it on purpose. */
const ITEM_UNIT_COST = 800
const FLOUR_ORDER_PRICE = 1_000
const SUGAR_ORDER_PRICE = 2_000

let keyCounter = 0
const nextKey = () => `books-key-${String(++keyCounter).padStart(6, '0')}`
let documentCounter = 0
const nextDocument = (prefix: string) => `${prefix}-${String(++documentCounter).padStart(5, '0')}`

let receiptCycle: Cycle
let invoiceCycle: Cycle
/** A company with a sales invoice, its payment and one hand-made posted journal entry. */
let sales: {
  world: World
  invoice: InvoiceDetail
  paymentId: string
  manualEntry: JournalEntryDetail
  /** A second posted entry, used only by the forged-reversal attempt so it cannot disturb the reversal test. */
  forgeTarget: JournalEntryDetail
  stockInvoice: InvoiceDetail
}

async function count(sql: string, params: unknown[] = []): Promise<number> {
  return (await pg().query<{ n: number }>(sql, params)).rows[0].n
}

async function fils(sql: string, params: unknown[] = []): Promise<bigint> {
  return BigInt((await pg().query<{ n: string }>(sql, params)).rows[0].n)
}

async function rows<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await pg().query<T>(sql, params)).rows
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

/** Net debit of an account over every posted entry. */
async function balanceOf(auth: AuthContext, accountId: string): Promise<number> {
  return Number(
    await fils(
      `select coalesce(sum(l.debit_minor - l.credit_minor), 0)::text as n
         from journal_lines l join journal_entries e on e.tenant_id = l.tenant_id and e.id = l.entry_id
        where l.tenant_id = $1 and l.account_id = $2 and e.status = 'posted'`,
      [auth.tenantId, accountId]
    )
  )
}

async function stockOf(w: World, item: Item): Promise<number> {
  const result = await rows<{ on_hand: number }>(`select on_hand from stock_balances where tenant_id = $1 and item_id = $2 and warehouse_id = $3`, [
    w.auth.tenantId,
    item.id,
    w.warehouse.id,
  ])
  return result[0]?.on_hand ?? 0
}

async function world(slug: string, basis: Basis): Promise<World> {
  const owner = randomUUID()
  await createUser(owner)
  const auth: AuthContext = { userId: owner, tenantId: await bootstrapTenant(slug, slug, owner), permissions: new Set<string>(allPermissions) }
  const supplier = (await createSupplier(auth, { code: 'GULF', name: 'Gulf Foods', paymentTermsDays: 30, notes: null })).data
  const warehouse = (await createWarehouse(auth, nextKey(), { code: 'MAIN', name: 'Main', location: null, capacity: null, status: 'active' })).body.data
  const item = async (sku: string) =>
    (
      await createItem(auth, nextKey(), {
        sku,
        name: `Item ${sku}`,
        unit: 'piece',
        unitCostMinor: ITEM_UNIT_COST,
        sellingPriceMinor: 2_500,
        reorderLevel: 0,
        isActive: true,
      })
    ).body.data
  const account = async (code: string, type: Account['type']) => (await createAccount(auth, { code, name: `Account ${code}`, type, parentId: null, isPostable: true })).data
  const flour = await item('FLOUR')
  const sugar = await item('SUGAR')
  const inventory = await account('1100', 'asset')
  const payable = await account('2100', 'liability')
  const tax = await account('1300', 'asset')
  const grni = await account('2150', 'liability')
  const ppv = await account('5100', 'expense')
  const bank = await account('1010', 'asset')
  await createPeriod(auth, { name: 'FY2026', startsOn: '2026-01-01', endsOn: '2026-12-31' })
  await updateAccounting(auth, {
    version: 0,
    inventoryAccountId: inventory.id,
    payableAccountId: payable.id,
    inputTaxAccountId: tax.id,
    accountingBasis: basis,
    grniAccountId: basis === 'receipt_basis' ? grni.id : null,
    ppvAccountId: basis === 'receipt_basis' ? ppv.id : null,
    priceToleranceBps: 0,
    taxToleranceMinor: 0,
  })
  return { auth, basis, supplier, warehouse, flour, sugar, inventory, payable, tax, grni, ppv, bank }
}

/**
 * Purchase request, approval, order, receipt of everything, a partial supplier invoice, a return, the supplier's credit
 * note for the returned goods and a partial payment. The supplier invoice is priced exactly at the order, so the only
 * value in play is the order price.
 */
async function runCycle(slug: string, basis: Basis): Promise<Cycle> {
  const w = await world(slug, basis)

  const request = (
    await createRequest(w.auth, nextKey(), {
      neededBy: '2026-06-01',
      reason: 'Weekly stock',
      lines: [
        { itemId: w.flour.id, description: 'Flour', quantity: 10 },
        { itemId: w.sugar.id, description: 'Sugar', quantity: 5 },
      ],
    })
  ).body.data
  const submittedRequest = (await submitRequest(w.auth, request.id, { version: request.version })).data
  const approvedRequest = (await approveRequest(w.auth, request.id, { version: submittedRequest.version })).data
  const converted = (
    await convertRequest(w.auth, request.id, nextKey(), {
      version: approvedRequest.version,
      supplierId: w.supplier.id,
      orderDate: '2026-05-02',
      expectedDate: null,
      notes: null,
      lines: approvedRequest.lines.map((entry, index) => ({
        requestLineId: entry.id,
        unitCostMinor: index === 0 ? FLOUR_ORDER_PRICE : SUGAR_ORDER_PRICE,
        taxRateBps: index === 0 ? 500 : 0,
      })),
    })
  ).body.data
  const draftOrder = (await getOrder(w.auth, converted.order.id)).data
  const order = (await submitOrder(w.auth, draftOrder.id, { version: draftOrder.version })).data

  await createReceipt(w.auth, order.id, nextKey(), {
    version: order.version,
    warehouseId: w.warehouse.id,
    receiptDate: '2026-05-10',
    notes: null,
    lines: [
      { orderLineId: order.lines[0].id, quantity: 10 },
      { orderLineId: order.lines[1].id, quantity: 5 },
    ],
  })
  const grniAfterReceipt = await balanceOf(w.auth, w.grni.id)
  const received = (await getOrder(w.auth, order.id)).data

  // Bill the flour only. The 5 sugar stay received and not invoiced, which is what GRNI exists for.
  const invoice = (
    await createSupplierInvoice(w.auth, nextKey(), {
      orderId: order.id,
      supplierInvoiceNumber: nextDocument('SI'),
      invoiceDate: '2026-05-12',
      currency: 'KWD',
      expectedTotalMinor: null,
      notes: null,
      lines: [{ orderLineId: order.lines[0].id, quantity: 10 }],
    })
  ).body.data

  await createReturn(w.auth, nextKey(), {
    orderId: order.id,
    warehouseId: w.warehouse.id,
    returnDate: '2026-05-14',
    reason: 'Two bags split open',
    lines: [{ orderLineId: order.lines[0].id, quantity: 2 }],
  })

  const creditNote = (
    await createCreditNote(w.auth, nextKey(), {
      invoiceId: invoice.id,
      supplierCreditNoteNumber: nextDocument('CN'),
      creditDate: '2026-05-15',
      currency: 'KWD',
      expectedTotalMinor: null,
      reason: 'Goods returned',
      lines: [{ invoiceLineId: invoice.lines[0].id, quantity: 2 }],
    })
  ).body.data

  const payment = (
    await createPayment(w.auth, nextKey(), {
      supplierId: w.supplier.id,
      paymentDate: '2026-05-20',
      amountMinor: 3_000,
      currency: 'KWD',
      method: 'bank_transfer',
      reference: nextDocument('TRF'),
      paidFromAccountId: w.bank.id,
      notes: null,
      allocations: [{ invoiceId: invoice.id, amountMinor: 3_000 }],
    })
  ).body.data

  expect(received.lines[0].receivedQuantity).toBe(10)
  return { world: w, order, invoice, creditNote, payment, grniAfterReceipt }
}

beforeAll(async () => {
  await startDatabase()
  receiptCycle = await runCycle('books-receipt-basis', 'receipt_basis')
  invoiceCycle = await runCycle('books-invoice-basis', 'invoice_basis')

  // A separate company for the sales side, so the sale that takes stock cannot disturb the purchase-only cycles above.
  const w = await world('books-sales', 'invoice_basis')
  const customer = await createCustomer(w.auth, {
    name: 'Retail Co',
    customerType: 'company',
    email: null,
    phone: null,
    taxId: null,
    address: null,
    creditLimitMinor: null,
    status: 'active',
    notes: null,
  })
  const serviceLine = { description: 'Consulting', quantity: 2, unitPriceMinor: 1_000, taxRateBps: 500, itemId: null, warehouseId: null }
  const draft = (
    await createInvoice(w.auth, nextKey(), { customerId: customer.id, issueDate: '2026-05-01', dueDate: '2026-06-01', notes: null, lines: [serviceLine] })
  ).body.data
  const issued = (await submitInvoice(w.auth, draft.id, { version: draft.version })).data
  const settled = (
    await recordPayment(w.auth, draft.id, nextKey(), {
      version: issued.version,
      amountMinor: issued.totalMinor,
      currency: 'KWD',
      method: 'knet',
      paidAt: '2026-05-05T09:00:00.000Z',
      reference: 'KNET-1',
    })
  ).body.data

  const manual = async (memo: string, entryDate: string, amount: number) => {
    const created = (
      await createJournalEntry(w.auth, nextKey(), {
        entryDate,
        memo,
        currency: 'KWD',
        lines: [
          { accountId: w.ppv.id, debitMinor: amount, creditMinor: 0, description: '' },
          { accountId: w.bank.id, debitMinor: 0, creditMinor: amount, description: '' },
        ],
      })
    ).body.data
    return (await postJournalEntry(w.auth, created.id, { version: created.version })).data
  }
  const manualEntry = await manual('Bank charge', '2026-05-06', 500)
  const forgeTarget = await manual('Courier fee', '2026-05-06', 700)

  // A second sales invoice, this one on a stocked item, used to measure what a sale does to the two sides of the books.
  // The stock arrives as a manual movement, with no purchase order and so with no ledger entry of any kind.
  await recordMovement(w.auth, nextKey(), { type: 'IN', itemId: w.flour.id, warehouseId: w.warehouse.id, quantity: 20, note: 'Opening count' })
  const stockDraft = (
    await createInvoice(w.auth, nextKey(), {
      customerId: customer.id,
      issueDate: '2026-05-01',
      dueDate: '2026-06-01',
      notes: null,
      lines: [{ description: 'Flour', quantity: 6, unitPriceMinor: 2_500, taxRateBps: 0, itemId: w.flour.id, warehouseId: w.warehouse.id }],
    })
  ).body.data
  const stockInvoice = (await submitInvoice(w.auth, stockDraft.id, { version: stockDraft.version })).data

  expect(settled.invoice.status).toBe('paid')
  sales = { world: w, invoice: issued, paymentId: settled.payment.id, manualEntry, forgeTarget, stockInvoice }
}, 300_000)
afterAll(stopDatabase)

// ---------------------------------------------------------------------------------------------------------------------

describe('what the database itself refuses, with no service in the way', () => {
  it('never lets a posted journal entry or its lines be edited or deleted', async () => {
    const entry = sales.manualEntry
    expect(await sqlFailure(`update journal_entries set memo = 'tampered' where id = $1`, [entry.id])).toContain('posted journal entry cannot change')
    expect(await sqlFailure(`update journal_entries set status = 'draft', posted_at = null where id = $1`, [entry.id])).toContain('posted journal entry cannot change')
    expect(await sqlFailure(`update journal_entries set entry_date = '2026-07-01' where id = $1`, [entry.id])).toContain('posted journal entry cannot change')
    expect(await sqlFailure(`delete from journal_entries where id = $1`, [entry.id])).toContain('cannot be deleted')
    expect(await sqlFailure(`update journal_lines set debit_minor = 1 where entry_id = $1`, [entry.id])).toContain('lines of a posted')
    expect(await sqlFailure(`delete from journal_lines where entry_id = $1`, [entry.id])).toContain('lines of a posted')
    expect(
      await sqlFailure(`insert into journal_lines (tenant_id, entry_id, line_no, account_id, credit_minor, created_by) values ($1, $2, 9, $3, 1, $4)`, [
        sales.world.auth.tenantId,
        entry.id,
        sales.world.bank.id,
        sales.world.auth.userId,
      ])
    ).toContain('lines of a posted')
    const after = (await getJournalEntry(sales.world.auth, entry.id)).data
    expect(after).toMatchObject({ status: 'posted', memo: 'Bank charge', totalDebitMinor: 500, totalCreditMinor: 500, entryDate: '2026-05-06' })
  })

  it('never lets a sales payment be edited or deleted, and the row survives every attempt', async () => {
    const tenantId = sales.world.auth.tenantId
    expect(await sqlFailure(`update payments set amount_minor = 1 where id = $1`, [sales.paymentId])).toContain('immutable')
    expect(await sqlFailure(`update payments set method = 'cash' where id = $1`, [sales.paymentId])).toContain('immutable')
    expect(await sqlFailure(`update payments set invoice_id = invoice_id where id = $1`, [sales.paymentId])).toContain('immutable')
    expect(await sqlFailure(`delete from payments where id = $1`, [sales.paymentId])).toContain('cannot be deleted')
    expect(await sqlFailure(`delete from payments where tenant_id = $1`, [tenantId])).toContain('cannot be deleted')
    const payment = await rows<{ amount_minor: number; method: string }>(`select amount_minor, method from payments where id = $1`, [sales.paymentId])
    expect(payment).toEqual([{ amount_minor: sales.invoice.totalMinor, method: 'knet' }])
  })

  it('never lets a posted supplier payment or its allocations be edited or deleted', async () => {
    const payment = receiptCycle.payment
    expect(await sqlFailure(`update supplier_payments set amount_minor = 1 where id = $1`, [payment.id])).toContain('cannot change')
    expect(await sqlFailure(`update supplier_payments set reference = 'other' where id = $1`, [payment.id])).toContain('cannot change')
    // Marking it void by hand is refused as well: a void needs a posted entry that reverses the payment's own entry.
    expect(await sqlFailure(`update supplier_payments set status = 'void' where id = $1`, [payment.id])).toContain('reverses the payment entry')
    expect(await sqlFailure(`delete from supplier_payments where id = $1`, [payment.id])).toContain('cannot be deleted')
    expect(await sqlFailure(`update supplier_payment_allocations set amount_minor = 1 where payment_id = $1`, [payment.id])).toContain('immutable')
    expect(await sqlFailure(`delete from supplier_payment_allocations where payment_id = $1`, [payment.id])).toContain('cannot be deleted')
    expect(await count(`select count(*)::int as n from supplier_payments where id = $1 and amount_minor = 3000`, [payment.id])).toBe(1)
  })

  it('never lets a posted supplier credit note or its lines be edited or deleted', async () => {
    const note = receiptCycle.creditNote
    expect(await sqlFailure(`update supplier_credit_notes set total_minor = 1 where id = $1`, [note.id])).toContain('cannot change')
    expect(await sqlFailure(`update supplier_credit_notes set status = 'void' where id = $1`, [note.id])).toContain('reverses the credit note entry')
    expect(await sqlFailure(`delete from supplier_credit_notes where id = $1`, [note.id])).toContain('cannot be deleted')
    expect(await sqlFailure(`update supplier_credit_note_lines set quantity = 1 where credit_note_id = $1`, [note.id])).toContain('immutable')
    expect(await sqlFailure(`delete from supplier_credit_note_lines where credit_note_id = $1`, [note.id])).toContain('cannot be deleted')
    expect(await count(`select count(*)::int as n from supplier_credit_notes where id = $1 and total_minor = 2100`, [note.id])).toBe(1)
  })

  it('never lets a supplier invoice be deleted or its lines be rewritten', async () => {
    const invoice = receiptCycle.invoice
    expect(await sqlFailure(`update supplier_invoices set total_minor = 1 where id = $1`, [invoice.id])).toContain('cannot change')
    expect(await sqlFailure(`delete from supplier_invoices where id = $1`, [invoice.id])).toContain('cannot be deleted')
    expect(await sqlFailure(`update supplier_invoice_lines set unit_cost_minor = 1 where invoice_id = $1`, [invoice.id])).toContain('immutable')
    expect(await sqlFailure(`delete from supplier_invoice_lines where invoice_id = $1`, [invoice.id])).toContain('cannot be deleted')
  })

  it('never lets an issued sales invoice change its amounts, dates or customer, or be deleted', async () => {
    const id = sales.invoice.id
    expect(await sqlFailure(`update invoices set total_minor = total_minor + 1 where id = $1`, [id])).toContain('cannot change its amounts')
    expect(await sqlFailure(`update invoices set subtotal_minor = 1, tax_minor = 0, total_minor = 1 where id = $1`, [id])).toContain('cannot change its amounts')
    expect(await sqlFailure(`update invoices set issue_date = '2026-01-01', due_date = '2026-02-01' where id = $1`, [id])).toContain('cannot change its amounts')
    expect(await sqlFailure(`update invoices set number = 'INV-999999' where id = $1`, [id])).toContain('cannot change its amounts')
    expect(await sqlFailure(`delete from invoices where id = $1`, [id])).toContain('cannot be deleted')
    expect(await sqlFailure(`update invoice_lines set quantity = quantity + 1 where invoice_id = $1`, [id])).toContain('only change while the invoice is a draft')
    expect(await sqlFailure(`delete from invoice_lines where invoice_id = $1`, [id])).toContain('only change while the invoice is a draft')
    expect(await sqlFailure(`update invoices set paid_minor = 0 where id = $1`, [id])).toContain('Paid amount cannot decrease')
  })

  it('refuses to void a paid sales invoice by hand: the paid amount and the void status cannot both stand', async () => {
    const failure = await sqlFailure(`update invoices set status = 'void', voided_at = now(), void_reason = 'by hand' where id = $1`, [sales.invoice.id])
    expect(failure).toContain('invoices_payment_state')
    const still = await rows<{ status: string; paid_minor: number }>(`select status, paid_minor from invoices where id = $1`, [sales.invoice.id])
    expect(still).toEqual([{ status: 'paid', paid_minor: sales.invoice.totalMinor }])
  })

  it('refuses a hand-written reversal that is not a mirror, and a reversal of a document entry', async () => {
    const w = sales.world
    const forged = await rows<{ id: string }>(
      `insert into journal_entries (tenant_id, number, entry_date, source_type, reverses_id, created_by) values ($1, 95001, '2026-05-07', 'reversal', $2, $3) returning id`,
      [w.auth.tenantId, sales.forgeTarget.id, w.auth.userId]
    )
    // Balanced, and on the same accounts, but in the same direction as the original instead of the opposite one.
    await pg().query(`insert into journal_lines (tenant_id, entry_id, line_no, account_id, debit_minor, created_by) values ($1, $2, 1, $3, 700, $4)`, [
      w.auth.tenantId,
      forged[0].id,
      w.ppv.id,
      w.auth.userId,
    ])
    await pg().query(`insert into journal_lines (tenant_id, entry_id, line_no, account_id, credit_minor, created_by) values ($1, $2, 2, $3, 700, $4)`, [
      w.auth.tenantId,
      forged[0].id,
      w.bank.id,
      w.auth.userId,
    ])
    expect(await sqlFailure(`update journal_entries set status = 'posted', posted_by = $2 where id = $1`, [forged[0].id, w.auth.userId])).toContain('mirror')

    // A procurement entry may only be reversed by voiding the document that produced it.
    const receiptEntry = await rows<{ id: string }>(`select id from journal_entries where tenant_id = $1 and source_type = 'goods_receipt' limit 1`, [
      receiptCycle.world.auth.tenantId,
    ])
    expect(receiptEntry).toHaveLength(1)
    expect(
      await sqlFailure(
        `insert into journal_entries (tenant_id, number, entry_date, memo, source_type, reverses_id, created_by) values ($1, 95002, '2026-05-21', 'sneaky', 'reversal', $2, $3)`,
        [receiptCycle.world.auth.tenantId, receiptEntry[0].id, receiptCycle.world.auth.userId]
      )
    ).toContain('cannot be reversed')
  })
})

// ---------------------------------------------------------------------------------------------------------------------

describe('what only the service refuses', () => {
  it('refuses to edit an invoice that left draft, which the database alone would allow for a note', async () => {
    const w = sales.world
    const current = await invoiceRow(w.auth, sales.invoice.id)
    expect(current.status).toBe('paid')
    expect(
      await outcome(
        updateInvoice(w.auth, sales.invoice.id, {
          version: current.version,
          customerId: sales.invoice.customerId,
          issueDate: '2026-05-01',
          dueDate: '2026-06-01',
          notes: 'Rewritten after payment',
          lines: [{ description: 'Consulting', quantity: 9, unitPriceMinor: 1_000, taxRateBps: 500, itemId: null, warehouseId: null }],
        })
      )
    ).toBe('not_editable')
    // The trigger `invoices_freeze` lists the frozen columns, and `notes` is not one of them: the database accepts a
    // note on a paid invoice. The guard for that is the service rule above, which is why both are tested.
    expect(await sqlFailure(`update invoices set notes = 'changed behind the service' where id = $1`, [sales.invoice.id])).toBe('ok')
    expect(await sqlFailure(`update invoices set notes = null where id = $1`, [sales.invoice.id])).toBe('ok')
  })

  it('refuses to void a sales invoice once it is paid', async () => {
    const latest = await rows<{ version: number }>(`select version from invoices where id = $1`, [sales.invoice.id])
    expect(await outcome(voidInvoice(sales.world.auth, sales.invoice.id, { version: latest[0].version, reason: 'Change of mind' }))).toBe('cannot_void')
    expect((await rows<{ status: string }>(`select status from invoices where id = $1`, [sales.invoice.id]))[0].status).toBe('paid')
  })

  it('refuses to void a supplier invoice that carries a payment or a credit note', async () => {
    const w = receiptCycle.world
    const current = (await getSupplierInvoice(w.auth, receiptCycle.invoice.id)).data
    expect(await outcome(voidSupplierInvoice(w.auth, receiptCycle.invoice.id, { version: current.version, reason: 'x', entryDate: '2026-05-25' }))).toMatch(
      /invoice_has_payments|invoice_has_credit_notes/
    )
    expect((await getSupplierInvoice(w.auth, receiptCycle.invoice.id)).data.status).toBe('posted')
  })

  it('refuses to void the same supplier payment or credit note twice', async () => {
    // A throwaway company so the cycles above keep their documents.
    const w = await world('books-double-void', 'receipt_basis')
    const order = await orderAndReceive(w)
    const invoice = (
      await createSupplierInvoice(w.auth, nextKey(), {
        orderId: order.id,
        supplierInvoiceNumber: nextDocument('SI'),
        invoiceDate: '2026-05-12',
        currency: 'KWD',
        expectedTotalMinor: null,
        notes: null,
        lines: [{ orderLineId: order.lines[0].id, quantity: 10 }],
      })
    ).body.data
    await createReturn(w.auth, nextKey(), {
      orderId: order.id,
      warehouseId: w.warehouse.id,
      returnDate: '2026-05-14',
      reason: 'Damaged',
      lines: [{ orderLineId: order.lines[0].id, quantity: 2 }],
    })
    const note = (
      await createCreditNote(w.auth, nextKey(), {
        invoiceId: invoice.id,
        supplierCreditNoteNumber: nextDocument('CN'),
        creditDate: '2026-05-15',
        currency: 'KWD',
        expectedTotalMinor: null,
        reason: 'Goods returned',
        lines: [{ invoiceLineId: invoice.lines[0].id, quantity: 2 }],
      })
    ).body.data
    const payment = (
      await createPayment(w.auth, nextKey(), {
        supplierId: w.supplier.id,
        paymentDate: '2026-05-20',
        amountMinor: 1_000,
        currency: 'KWD',
        method: 'bank_transfer',
        reference: nextDocument('TRF'),
        paidFromAccountId: w.bank.id,
        notes: null,
        allocations: [{ invoiceId: invoice.id, amountMinor: 1_000 }],
      })
    ).body.data

    const voidedPayment = (await voidPayment(w.auth, payment.id, { version: payment.version, reason: 'Bounced', entryDate: '2026-05-21' })).data
    expect(voidedPayment.voidEntryId).not.toBeNull()
    expect(await outcome(voidPayment(w.auth, payment.id, { version: voidedPayment.version, reason: 'again', entryDate: '2026-05-21' }))).toBe('409:payment_not_posted')
    const voidedNote = (await voidCreditNote(w.auth, note.id, { version: note.version, reason: 'Issued twice', entryDate: '2026-05-21' })).data
    expect(voidedNote.voidEntryId).not.toBeNull()
    expect(await outcome(voidCreditNote(w.auth, note.id, { version: voidedNote.version, reason: 'again', entryDate: '2026-05-21' }))).toBe(
      '409:credit_note_not_posted'
    )
    // The void did not delete anything: both documents are still there, with a reversing entry beside them.
    expect(await count(`select count(*)::int as n from supplier_payments where tenant_id = $1`, [w.auth.tenantId])).toBe(1)
    expect(await count(`select count(*)::int as n from supplier_credit_notes where tenant_id = $1`, [w.auth.tenantId])).toBe(1)
    expect(await count(`select count(*)::int as n from journal_entries where tenant_id = $1 and source_type = 'reversal' and status = 'posted'`, [w.auth.tenantId])).toBe(2)
    expect(await balanceOf(w.auth, w.bank.id)).toBe(0)
    expect(await unbalanced(w.auth)).toEqual([])
  })

  it('corrects a hand-made entry only by a reversal, which leaves the original word for word', async () => {
    const w = sales.world
    const original = sales.manualEntry
    const reversal = (await reverseJournalEntry(w.auth, original.id, nextKey(), { version: original.version, entryDate: '2026-05-08', memo: 'Charge refunded' })).body
      .data
    expect(reversal).toMatchObject({ status: 'posted', sourceType: 'reversal', reversesId: original.id, totalDebitMinor: 500, totalCreditMinor: 500 })
    expect(reversal.lines.map((line) => [line.debitMinor, line.creditMinor])).toEqual([
      [0, 500],
      [500, 0],
    ])
    const reread = (await getJournalEntry(w.auth, original.id)).data
    expect(reread).toMatchObject({ status: 'posted', memo: 'Bank charge', totalDebitMinor: 500, reversedById: reversal.id })
    expect(await outcome(reverseJournalEntry(w.auth, original.id, nextKey(), { version: original.version, entryDate: '2026-05-09', memo: '' }))).toBe(
      '409:already_reversed'
    )
    // The pair nets to nothing on every account it touched, without either row being changed.
    const net = await fils(
      `select coalesce(sum(l.debit_minor - l.credit_minor), 0)::text as n from journal_lines l
        where l.tenant_id = $1 and l.entry_id in ($2, $3)`,
      [w.auth.tenantId, original.id, reversal.id]
    )
    expect(net).toBe(0n)
    const perAccount = await rows<{ account_id: string; net: string }>(
      `select l.account_id, sum(l.debit_minor - l.credit_minor)::text as net from journal_lines l
        where l.tenant_id = $1 and l.entry_id in ($2, $3) group by l.account_id`,
      [w.auth.tenantId, original.id, reversal.id]
    )
    expect(perAccount.map((row) => row.net)).toEqual(['0', '0'])
  })
})

/** The current sales invoice row, read straight from the table so the test never relies on a stale copy. */
async function invoiceRow(auth: AuthContext, id: string): Promise<{ status: string; version: number }> {
  const result = await rows<{ status: string; version: number }>(`select status, version from invoices where tenant_id = $1 and id = $2`, [auth.tenantId, id])
  return result[0]
}

/** An approved order for 10 flour and 5 sugar with everything received. */
async function orderAndReceive(w: World): Promise<PurchaseOrderDetail> {
  const created = (
    await createRequest(w.auth, nextKey(), {
      neededBy: '2026-06-01',
      reason: 'Stock',
      lines: [
        { itemId: w.flour.id, description: 'Flour', quantity: 10 },
        { itemId: w.sugar.id, description: 'Sugar', quantity: 5 },
      ],
    })
  ).body.data
  const submitted = (await submitRequest(w.auth, created.id, { version: created.version })).data
  const approved = (await approveRequest(w.auth, created.id, { version: submitted.version })).data
  const converted = (
    await convertRequest(w.auth, created.id, nextKey(), {
      version: approved.version,
      supplierId: w.supplier.id,
      orderDate: '2026-05-02',
      expectedDate: null,
      notes: null,
      lines: approved.lines.map((entry, index) => ({
        requestLineId: entry.id,
        unitCostMinor: index === 0 ? FLOUR_ORDER_PRICE : SUGAR_ORDER_PRICE,
        taxRateBps: index === 0 ? 500 : 0,
      })),
    })
  ).body.data
  const draftOrder = (await getOrder(w.auth, converted.order.id)).data
  const order = (await submitOrder(w.auth, draftOrder.id, { version: draftOrder.version })).data
  await createReceipt(w.auth, order.id, nextKey(), {
    version: order.version,
    warehouseId: w.warehouse.id,
    receiptDate: '2026-05-10',
    notes: null,
    lines: [
      { orderLineId: order.lines[0].id, quantity: 10 },
      { orderLineId: order.lines[1].id, quantity: 5 },
    ],
  })
  return (await getOrder(w.auth, order.id)).data
}

/** Every journal entry whose debits and credits differ by even one fils. */
async function unbalanced(auth: AuthContext): Promise<Array<{ id: string; status: string; difference: string }>> {
  return rows<{ id: string; status: string; difference: string }>(
    `select e.id, e.status, (coalesce(sum(l.debit_minor), 0) - coalesce(sum(l.credit_minor), 0))::text as difference
       from journal_entries e left join journal_lines l on l.tenant_id = e.tenant_id and l.entry_id = e.id
      where e.tenant_id = $1
      group by e.id, e.status
     having coalesce(sum(l.debit_minor), 0) - coalesce(sum(l.credit_minor), 0) <> 0`,
    [auth.tenantId]
  )
}

// ---------------------------------------------------------------------------------------------------------------------

describe.each([
  ['receipt basis, with goods received and not invoiced', 'receipt_basis'],
  ['invoice basis', 'invoice_basis'],
] as const)('the books and the stock agree after a full cycle (%s)', (_label, basis) => {
  const cycle = () => (basis === 'receipt_basis' ? receiptCycle : invoiceCycle)

  it('balances every journal entry to the fils, and leaves no draft behind', async () => {
    const w = cycle().world
    expect(await unbalanced(w.auth)).toEqual([])
    expect(await count(`select count(*)::int as n from journal_entries where tenant_id = $1 and status = 'posted'`, [w.auth.tenantId])).toBeGreaterThan(0)
    expect(await count(`select count(*)::int as n from journal_entries where tenant_id = $1 and status <> 'posted'`, [w.auth.tenantId])).toBe(0)
    const trial = (await getTrialBalance(w.auth, { to: '2026-12-31' })).data
    expect(trial.balanced).toBe(true)
    expect(trial.totalDebitMinor).toBe(trial.totalCreditMinor)
    expect(trial.totalDebitMinor).toBeGreaterThan(0)
  })

  it('matches the inventory account to the stock the triggers maintain, valued at the purchase-order price', async () => {
    const w = cycle().world
    // The ledger is compared with ON_HAND x PURCHASE ORDER UNIT COST, read from `purchase_order_lines.unit_cost_minor`.
    // It is deliberately NOT the item's catalogue cost, `items.unit_cost_minor`, which is 0.800 for both items here.
    const atOrderPrice = await fils(
      `select coalesce(sum(b.on_hand::bigint * l.unit_cost_minor), 0)::text as n
         from stock_balances b
         join lateral (
           select ol.unit_cost_minor from purchase_order_lines ol
            where ol.tenant_id = b.tenant_id and ol.item_id = b.item_id
            order by ol.created_at, ol.id limit 1
         ) l on true
        where b.tenant_id = $1`,
      [w.auth.tenantId]
    )
    const atItemCost = await fils(
      `select coalesce(sum(b.on_hand::bigint * i.unit_cost_minor), 0)::text as n
         from stock_balances b join items i on i.tenant_id = b.tenant_id and i.id = b.item_id
        where b.tenant_id = $1`,
      [w.auth.tenantId]
    )
    // What the supplier has actually billed, net of the credit note. The invoice is priced at the order, which the zero
    // price variance below proves, so this subtotal is the order value of the billed goods and nothing else.
    const billedNet = await fils(
      `select (coalesce((select sum(subtotal_minor) from supplier_invoices where tenant_id = $1 and status = 'posted'), 0)
             - coalesce((select sum(subtotal_minor) from supplier_credit_notes where tenant_id = $1 and status = 'posted'), 0))::text as n`,
      [w.auth.tenantId]
    )
    expect(await stockOf(w, w.flour)).toBe(8)
    expect(await stockOf(w, w.sugar)).toBe(5)
    expect(atOrderPrice).toBe(BigInt(8 * FLOUR_ORDER_PRICE + 5 * SUGAR_ORDER_PRICE))
    expect(atItemCost).toBe(BigInt(13 * ITEM_UNIT_COST))
    expect(atOrderPrice).not.toBe(atItemCost)
    expect(cycle().invoice.priceVarianceMinor).toBe(0)
    expect(billedNet).toBe(BigInt((10 - 2) * FLOUR_ORDER_PRICE))

    const inventoryLedger = BigInt(await balanceOf(w.auth, w.inventory.id))
    const grni = BigInt(await balanceOf(w.auth, w.grni.id))
    if (basis === 'receipt_basis') {
      // The receipt books the goods, so the inventory account is the whole of what the warehouse holds, and the part the
      // supplier has not billed yet is parked in GRNI.
      expect(inventoryLedger).toBe(atOrderPrice)
      expect(grni).toBe(-(atOrderPrice - billedNet))
    } else {
      // The invoice books the goods, so the inventory account carries only the billed part. The rest is on the shelf with
      // no value in the ledger at all, and there is no GRNI account to hold it.
      expect(inventoryLedger).toBe(billedNet)
      expect(grni).toBe(0n)
      expect(atOrderPrice - inventoryLedger).toBe(BigInt(5 * SUGAR_ORDER_PRICE))
    }
  })

  it('keeps the stock ledger, the balances and items.current_stock in step', async () => {
    const w = cycle().world
    const drift = await rows<{ item_id: string; ledger: number; on_hand: number }>(
      `select m.item_id, sum(m.quantity)::int as ledger, b.on_hand
         from stock_movements m
         left join stock_balances b on b.tenant_id = m.tenant_id and b.item_id = m.item_id and b.warehouse_id = m.warehouse_id
        where m.tenant_id = $1
        group by m.item_id, m.warehouse_id, b.on_hand
       having sum(m.quantity) is distinct from b.on_hand`,
      [w.auth.tenantId]
    )
    expect(drift).toEqual([])
    const itemDrift = await rows<{ id: string }>(
      `select i.id from items i left join stock_balances b on b.tenant_id = i.tenant_id and b.item_id = i.id
        where i.tenant_id = $1
        group by i.id, i.current_stock
       having i.current_stock <> coalesce(sum(b.on_hand), 0)`,
      [w.auth.tenantId]
    )
    expect(itemDrift).toEqual([])
    expect(await count(`select count(*)::int as n from stock_balances where tenant_id = $1 and on_hand < 0`, [w.auth.tenantId])).toBe(0)
  })

  it('leaves goods received and not invoiced in GRNI on the receipt basis, and nothing at all on the invoice basis', async () => {
    const w = cycle().world
    const grni = await balanceOf(w.auth, w.grni.id)
    if (basis === 'receipt_basis') {
      // Received 10 flour and 5 sugar, invoiced all 10 flour, returned 2 and credited those 2 back:
      // the 5 sugar at 2.000 are still received and not invoiced.
      expect(cycle().grniAfterReceipt).toBe(-(10 * FLOUR_ORDER_PRICE + 5 * SUGAR_ORDER_PRICE))
      expect(grni).toBe(-(5 * SUGAR_ORDER_PRICE))
    } else {
      expect(cycle().grniAfterReceipt).toBe(0)
      expect(grni).toBe(0)
    }
    expect(await balanceOf(w.auth, w.ppv.id)).toBe(0)
  })

  it('equals total minus paid minus credited on every supplier invoice, in the ledger and in the service', async () => {
    const w = cycle().world
    const settlement = await rows<{ id: string; total: string; paid: string; credited: string }>(
      `select i.id,
              i.total_minor::text as total,
              coalesce((select sum(a.amount_minor) from supplier_payment_allocations a
                          join supplier_payments p on p.tenant_id = a.tenant_id and p.id = a.payment_id
                         where a.tenant_id = i.tenant_id and a.invoice_id = i.id and p.status = 'posted'), 0)::text as paid,
              coalesce((select sum(c.total_minor) from supplier_credit_notes c
                         where c.tenant_id = i.tenant_id and c.invoice_id = i.id and c.status = 'posted'), 0)::text as credited
         from supplier_invoices i where i.tenant_id = $1 and i.status = 'posted'`,
      [w.auth.tenantId]
    )
    expect(settlement).toHaveLength(1)
    const [row] = settlement
    const open = BigInt(row.total) - BigInt(row.paid) - BigInt(row.credited)
    expect(BigInt(row.total)).toBe(BigInt(10 * FLOUR_ORDER_PRICE + 500))
    expect(BigInt(row.paid)).toBe(3_000n)
    expect(BigInt(row.credited)).toBe(2_100n)
    expect(open).toBe(5_400n)
    const detail = (await getSupplierInvoice(w.auth, row.id)).data
    expect(detail).toMatchObject({ totalMinor: 10_500, paidMinor: 3_000, creditedMinor: 2_100, balanceMinor: 5_400, paymentStatus: 'partially_paid' })
    // The payable account carries exactly what is still owed to the supplier, and nothing else.
    expect(BigInt(-(await balanceOf(w.auth, w.payable.id)))).toBe(open)
  })

  it('reports no difference between the ledger and the documents', async () => {
    const w = cycle().world
    const report = (await getReconciliation(w.auth)).data
    expect(report.basis).toBe(basis)
    expect(report.checks.every((entry) => entry.ok)).toBe(true)
    expect(report.ok).toBe(true)
    expect(report.checks.map((entry) => entry.differenceMinor)).toEqual(basis === 'receipt_basis' ? [0, 0, 0] : [0, 0])
  })
})

// ---------------------------------------------------------------------------------------------------------------------

describe('the boundary of the books-versus-stock identity', () => {
  it('shows that a sale takes stock without crediting the inventory account, so the identity covers purchases only', async () => {
    const w = sales.world
    // 20 flour were put in by hand (no purchase order), 6 were sold on an issued invoice.
    expect(await stockOf(w, w.flour)).toBe(14)
    expect(sales.stockInvoice.status).toBe('issued')
    const sold = await count(
      `select coalesce(sum(-m.quantity), 0)::int as n from stock_movements m
        where m.tenant_id = $1 and m.reference_type = 'invoice' and m.reference_id = $2`,
      [w.auth.tenantId, sales.stockInvoice.id]
    )
    expect(sold).toBe(6)
    // There is no cost-of-goods-sold posting in this release, so the inventory account did not move with the stock.
    // That is why the identity above is asserted on purchase-only companies. See docs/AUDIT_COVERAGE.md.
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(0)
    expect(await unbalanced(w.auth)).toEqual([])
  })
})
