import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { bootstrapTenant, createUser, getPglite, startDatabase, stopDatabase } from '@/lib/__tests__/support/database'
import type { AuthContext } from '@/lib/auth/context'
import { allPermissions } from '@/lib/auth/permissions'
import { createAccount, createPeriod } from '@/modules/finance'
import { createEmployee, createExpense, createLeave, decideExpense, decideLeave, runPayroll, bookAppointment, actOnAppointment } from '@/modules/hr'
import { createContract } from '@/modules/operations'

vi.mock('@/lib/db', async () => {
  const support = await import('@/lib/__tests__/support/database')
  return { db: support.testDb, withTransaction: support.testWithTransaction }
})

const pg = () => getPglite()
let key = 0
const nextKey = () => `hr-key-${String(++key).padStart(6, '0')}`

let auth: AuthContext

beforeAll(async () => {
  await startDatabase()
  const owner = randomUUID()
  await createUser(owner)
  auth = { userId: owner, tenantId: await bootstrapTenant('HR', 'hr-co', owner), permissions: new Set(allPermissions) }
  const salaries = (await createAccount(auth, { code: '6100', name: 'Salaries', type: 'expense', parentId: null, isPostable: true })).data
  const accrued = (await createAccount(auth, { code: '2300', name: 'Accrued', type: 'liability', parentId: null, isPostable: true })).data
  await createPeriod(auth, { name: 'FY2026', startsOn: '2026-01-01', endsOn: '2026-12-31' })
  await pg().query(
    `update finance_settings set salary_expense_account_id = $2, salary_payable_account_id = $3 where tenant_id = $1`,
    [auth.tenantId, salaries.id, accrued.id],
  )
}, 120_000)
afterAll(stopDatabase)

describe('payroll on the ledger', () => {
  it('posts a balanced salaries accrual, then an employee claim, and keeps leave decisions honest', async () => {
    const chef = await createEmployee(auth, nextKey(), {
      employeeCode: 'EMP-9', fullName: 'Chef', roleTitle: 'Chef', department: 'Kitchen', branchId: null,
      basicSalaryMinor: 400_000, allowancesMinor: 0, residencyExpiry: null, status: 'active',
    })
    await createEmployee(auth, nextKey(), {
      employeeCode: 'EMP-8', fullName: 'Cashier', roleTitle: 'Cashier', department: 'Sales', branchId: null,
      basicSalaryMinor: 100_000, allowancesMinor: 0, residencyExpiry: null, status: 'active',
    })
    const posted = await runPayroll(auth, nextKey(), { period: '2026-10', entryDate: '2026-10-31', deductions: [] })
    expect(posted.body.data).toMatchObject({ period: '2026-10', grossMinor: 500_000, deductionsMinor: 0, netMinor: 500_000, status: 'posted' })
    await expect(runPayroll(auth, nextKey(), { period: '2026-10', entryDate: '2026-10-31', deductions: [] })).rejects.toMatchObject({ code: 'invalid_transition' })

    const lines = await pg().query<{ debit: string; credit: string; source: string }>(
      `select l.debit_minor::text as debit, l.credit_minor::text as credit, e.source_type as source
       from journal_lines l join journal_entries e on e.tenant_id = l.tenant_id and e.id = l.entry_id
       where e.tenant_id = $1 and e.source_type = 'payroll' order by l.line_no`,
      [auth.tenantId],
    )
    expect(lines.rows).toEqual([
      { debit: '500000', credit: '0', source: 'payroll' },
      { debit: '0', credit: '500000', source: 'payroll' },
    ])

    const leave = await createLeave(auth, nextKey(), { employeeId: chef.body.data.id, leaveType: 'annual', startDate: '2026-11-02', endDate: '2026-11-04' })
    expect(leave.body.data.days).toBe(3)
    const decided = await decideLeave(auth, leave.body.data.id, { decision: 'approved', version: 1 })
    expect(decided.data.approvalStatus).toBe('approved')

    const claim = await createExpense(auth, nextKey(), { employeeId: chef.body.data.id, category: 'Transport', amountMinor: 15_000 })
    const approved = await decideExpense(auth, nextKey(), claim.body.data.id, { decision: 'approved', entryDate: '2026-10-31', version: 1 })
    expect(approved.body.data.journalEntryId).toEqual(expect.any(String))

    const contract = await createContract(auth, nextKey(), {
      title: 'Produce', counterparty: 'Palm', startDate: '2019-01-01', endDate: '2020-01-01', valueMinor: 2_400_000, renewalAlertDays: 30, status: 'active',
    })
    expect(contract.body.data.renewalDue).toBe(true)
  })

  it('books an HQ appointment and completes the handover only after confirmation', async () => {
    const booked = await bookAppointment(auth, nextKey(), {
      requestCode: 'HQ-TEST-0001',
      employeeName: 'فهد العازمي',
      branchId: null,
      requestType: 'passport_handover',
      actionDirection: 'pickup_from_hq',
      appointmentDate: '2026-11-03',
      appointmentTimeSlot: '10:00-10:30',
      hqCounterOrOfficer: 'شباك الوثائق',
      notesAr: 'استلام جواز',
    })
    expect(booked.body.data.status).toBe('booked')
    const confirmed = await actOnAppointment(auth, booked.body.data.id, { action: 'confirm', version: booked.body.data.version })
    const done = await actOnAppointment(auth, booked.body.data.id, { action: 'complete', version: confirmed.data.version })
    expect(done.data.status).toBe('completed_handover')
  })
})
