import { describe, expect, it } from 'vitest'
import { DomainError } from '@/lib/domain-error'
import { inclusiveDays, payrollTotals, payslipAmounts } from '@/modules/hr/domain/payroll'
import { buildEmployeeExpenseLines, buildPayrollLines } from '@/modules/finance/domain/operational-posting'

const expense = '10000000-0000-4000-8000-000000000010'
const payable = '10000000-0000-4000-8000-000000000011'

describe('payroll amounts', () => {
  it('counts inclusive leave days and refuses a reversed range', () => {
    expect(inclusiveDays('2026-11-02', '2026-11-04')).toBe(3)
    expect(inclusiveDays('2026-10-20', '2026-10-20')).toBe(1)
    expect(() => inclusiveDays('2026-11-04', '2026-11-02')).toThrow(DomainError)
  })

  it('keeps a payslip and a run in whole fils, and refuses deductions above gross', () => {
    expect(payslipAmounts(400_000, 50_000, 20_000)).toEqual({ grossMinor: 450_000, deductionsMinor: 20_000, netMinor: 430_000 })
    const slips = [
      { employeeId: 'a', ...payslipAmounts(400_000, 50_000, 20_000) },
      { employeeId: 'b', ...payslipAmounts(250_000, 25_000, 10_000) },
      { employeeId: 'c', ...payslipAmounts(350_000, 40_000, 15_000) },
    ]
    expect(payrollTotals(slips)).toEqual({ grossMinor: 1_115_000, deductionsMinor: 45_000, netMinor: 1_070_000 })
    expect(() => payslipAmounts(1000, 0, 1001)).toThrow(DomainError)
  })

  it('posts payroll and an employee claim as a balanced accrual', () => {
    const payroll = buildPayrollLines(1_070_000, expense, payable, 'مسير رواتب')
    const claim = buildEmployeeExpenseLines(15_000, expense, payable, 'عهدة')
    expect(payroll[0]).toMatchObject({ accountId: expense, debitMinor: 1_070_000, creditMinor: 0 })
    expect(payroll[1]).toMatchObject({ accountId: payable, debitMinor: 0, creditMinor: 1_070_000 })
    expect(claim.reduce((sum, line) => sum + line.debitMinor - line.creditMinor, 0)).toBe(0)
    expect(() => buildPayrollLines(0, expense, payable, 'x')).toThrow(DomainError)
  })
})
