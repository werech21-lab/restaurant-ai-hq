import { prisma } from '@/lib/db'
import { postEntry } from '@/services/accounting.engine'

export type WpsRow = {
  barcode: string
  employeeName: string
  civilId: string
  iban: string
  bankName: string
  basic: string
  allowances: string
  deductions: string
  net: string
}

function kwd3(value: number) {
  return (Number.isFinite(value) ? value : 0).toFixed(3)
}

function syntheticIban(code: string) {
  const digits = code.replace(/\D/g, '').padStart(10, '0').slice(-10)
  return `KW81NBOK000000000000${digits}`.slice(0, 30)
}

export async function buildNbkWpsExport(month: number, year: number) {
  const slips = await prisma.payroll.findMany({
    where: { month, year },
    include: { employee: true },
    orderBy: { employee: { name: 'asc' } },
  })

  const rows: WpsRow[] = slips.map((slip) => ({
    barcode: slip.employee.code,
    employeeName: slip.employee.name,
    civilId: slip.employee.civilId || '',
    iban: slip.employee.iban || syntheticIban(slip.employee.code),
    bankName: slip.employee.bankName || 'National Bank of Kuwait (NBK)',
    basic: kwd3(slip.basicSalary),
    allowances: kwd3(slip.totalAllowances),
    deductions: kwd3(slip.totalDeductions),
    net: kwd3(slip.netSalary),
  }))

  // Fallback: active employees with salary if no payslips for period
  if (rows.length === 0) {
    const employees = await prisma.employee.findMany({
      where: { status: 'ACTIVE', basicSalary: { gt: 0 } },
      orderBy: { name: 'asc' },
    })
    for (const emp of employees) {
      const net = emp.basicSalary + emp.allowances - emp.deductions
      rows.push({
        barcode: emp.code,
        employeeName: emp.name,
        civilId: emp.civilId || '',
        iban: emp.iban || syntheticIban(emp.code),
        bankName: emp.bankName || 'National Bank of Kuwait (NBK)',
        basic: kwd3(emp.basicSalary),
        allowances: kwd3(emp.allowances),
        deductions: kwd3(emp.deductions),
        net: kwd3(net),
      })
    }
  }

  const header = [
    'Barcode',
    'Employee Name',
    'Civil ID',
    'IBAN',
    'Bank',
    'Basic Salary (KWD)',
    'Allowances (KWD)',
    'Deductions (KWD)',
    'Net Salary (KWD)',
  ]
  const csv = [
    header.join(','),
    ...rows.map((row) =>
      [
        row.barcode,
        `"${row.employeeName.replace(/"/g, '""')}"`,
        row.civilId,
        row.iban,
        `"${row.bankName.replace(/"/g, '""')}"`,
        row.basic,
        row.allowances,
        row.deductions,
        row.net,
      ].join(','),
    ),
  ].join('\n')

  const totalNet = rows.reduce((sum, row) => sum + Number(row.net), 0)

  return {
    month,
    year,
    count: rows.length,
    totalNet: kwd3(totalNet),
    rows,
    csv,
    fileName: `VF_NBK_WPS_${year}-${String(month).padStart(2, '0')}.csv`,
    bankAccounts: {
      nbkPayroll: '2007694489',
      nbkHr: '2040201976',
      glExpense: ['40319', '40320'],
      glPayable: '20302',
      glBank: ['10213', '10143'],
    },
  }
}

async function ensureGlAccounts() {
  const needed: Array<{ code: string; name: string; type: string }> = [
    { code: '40319', name: 'Salaries & Wages — Branches', type: 'EXPENSE' },
    { code: '40320', name: 'Salaries & Wages — Central Kitchen', type: 'EXPENSE' },
    { code: '20302', name: 'Accrued Salaries Payable', type: 'LIABILITY' },
    { code: '10213', name: 'NBK Payroll Account 2007694489', type: 'ASSET' },
    { code: '10143', name: 'NBK HR Account 2040201976', type: 'ASSET' },
  ]
  for (const row of needed) {
    const existing = await prisma.account.findUnique({ where: { code: row.code } })
    if (!existing) {
      await prisma.account.create({ data: { code: row.code, name: row.name, type: row.type, balance: 0 } })
    }
  }
}

/** Post monthly payroll: Dr expense 40319/40320, Cr payable 20302, then Dr 20302 Cr NBK bank. */
export async function postPayrollJournal(input: {
  month: number
  year: number
  actorId: string
}) {
  await ensureGlAccounts()
  const pack = await buildNbkWpsExport(input.month, input.year)
  const total = Number(pack.totalNet)
  if (!(total > 0)) throw new Error('no_payroll_amount')

  const ckShare = Math.round(total * 0.18 * 1000) / 1000
  const branchShare = Math.round((total - ckShare) * 1000) / 1000 // exact residual so Dr = Cr

  const bankMain = Math.round(total * 0.85 * 1000) / 1000
  const bankHr = Math.round((total - bankMain) * 1000) / 1000

  const accrual = await prisma.$transaction(async (tx) =>
    postEntry(tx, {
      description: `مسير رواتب ${input.year}-${String(input.month).padStart(2, '0')} · استحقاق`,
      referenceType: 'PAYROLL_ACCRUAL',
      referenceId: `${input.year}-${input.month}`,
      createdById: input.actorId,
      lines: [
        { code: '40319', debit: branchShare, credit: 0 },
        { code: '40320', debit: ckShare, credit: 0 },
        { code: '20302', debit: 0, credit: total },
      ],
    }),
  )

  const payment = await prisma.$transaction(async (tx) =>
    postEntry(tx, {
      description: `تحويل رواتب NBK WPS ${input.year}-${String(input.month).padStart(2, '0')}`,
      referenceType: 'PAYROLL_NBK_TRANSFER',
      referenceId: `${input.year}-${input.month}`,
      createdById: input.actorId,
      lines: [
        { code: '20302', debit: total, credit: 0 },
        { code: '10213', debit: 0, credit: bankMain },
        { code: '10143', debit: 0, credit: bankHr },
      ],
    }),
  )

  await prisma.activityLog.create({
    data: {
      userId: input.actorId,
      action: 'PAYROLL_NBK_POSTED',
      module: 'hr',
      details: JSON.stringify({
        month: input.month,
        year: input.year,
        totalNet: pack.totalNet,
        accrualEntry: accrual.entryNumber,
        paymentEntry: payment.entryNumber,
        employees: pack.count,
      }),
    },
  })

  return {
    accrualEntryNumber: accrual.entryNumber,
    paymentEntryNumber: payment.entryNumber,
    totalNet: pack.totalNet,
    employees: pack.count,
    bankSplit: { '10213': bankMain, '10143': bankHr },
  }
}
