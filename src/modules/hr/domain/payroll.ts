import { DomainError } from '@/lib/domain-error'

const DAY_MS = 86_400_000

function utcDay(iso: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) throw new DomainError('invalid_date', 'A date must be YYYY-MM-DD.')
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

/** Inclusive calendar days. 1 October through 1 October is one day. */
export function inclusiveDays(startDate: string, endDate: string): number {
  const days = Math.round((utcDay(endDate) - utcDay(startDate)) / DAY_MS) + 1
  if (days < 1 || days > 366) throw new DomainError('invalid_date', 'Leave must cover between 1 and 366 days.')
  return days
}

export type PayslipDraft = { employeeId: string; grossMinor: number; deductionsMinor: number; netMinor: number }

/** Gross is basic plus allowances. Net is gross minus deductions. All three are whole fils. */
export function payslipAmounts(basicMinor: number, allowancesMinor: number, deductionsMinor: number): { grossMinor: number; deductionsMinor: number; netMinor: number } {
  if (!Number.isSafeInteger(basicMinor) || !Number.isSafeInteger(allowancesMinor) || !Number.isSafeInteger(deductionsMinor)) {
    throw new DomainError('invalid_amount', 'Salary amounts must be whole fils.')
  }
  if (basicMinor < 0 || allowancesMinor < 0 || deductionsMinor < 0) throw new DomainError('invalid_amount', 'Salary amounts cannot be negative.')
  const grossMinor = basicMinor + allowancesMinor
  if (deductionsMinor > grossMinor) throw new DomainError('invalid_amount', 'Deductions cannot exceed gross pay.')
  return { grossMinor, deductionsMinor, netMinor: grossMinor - deductionsMinor }
}

export function payrollTotals(slips: readonly PayslipDraft[]): { grossMinor: number; deductionsMinor: number; netMinor: number } {
  return slips.reduce(
    (totals, slip) => ({
      grossMinor: totals.grossMinor + slip.grossMinor,
      deductionsMinor: totals.deductionsMinor + slip.deductionsMinor,
      netMinor: totals.netMinor + slip.netMinor,
    }),
    { grossMinor: 0, deductionsMinor: 0, netMinor: 0 },
  )
}
