import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'

const DEFAULT_PIN = '1234'

export async function ensureEmployeePin(employeeId: string) {
  const emp = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!emp) return null
  if (emp.pinHash) return emp
  const pinHash = await bcrypt.hash(DEFAULT_PIN, 10)
  return prisma.employee.update({ where: { id: employeeId }, data: { pinHash } })
}

export async function authenticateEss(code: string, pin: string) {
  const emp = await prisma.employee.findFirst({
    where: { code: code.trim(), status: 'ACTIVE' },
  })
  if (!emp) return null
  let hash = emp.pinHash
  if (!hash) {
    const updated = await ensureEmployeePin(emp.id)
    hash = updated?.pinHash || null
  }
  if (!hash) return null
  const ok = await bcrypt.compare(pin, hash)
  if (!ok) return null
  return emp
}

export async function getEssProfile(employeeId: string) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!employee || employee.status !== 'ACTIVE') return null
  const [payrolls, attendance, documents] = await Promise.all([
    prisma.payroll.findMany({
      where: { employeeId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 24,
    }),
    prisma.attendance.findMany({
      where: { employeeId },
      orderBy: { date: 'desc' },
      take: 40,
    }),
    prisma.hrDocument.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        fileName: true,
        category: true,
        fileUrl: true,
        expiryDate: true,
        civilId: true,
        status: true,
      },
    }),
  ])
  return {
    employee: {
      id: employee.id,
      code: employee.code,
      name: employee.name,
      jobTitle: employee.jobTitle,
      department: employee.department,
      civilId: employee.civilId,
      civilIdExpiry: employee.civilIdExpiry,
      passportExpiry: employee.passportExpiry,
      healthCardExpiry: employee.healthCardExpiry,
      workPermitExpiry: employee.workPermitExpiry,
      drivingLicenseExpiry: employee.drivingLicenseExpiry,
    },
    payrolls,
    attendance,
    documents,
  }
}

export async function submitEssLeave(input: {
  employeeId: string
  type: 'compensatory' | 'legal' | 'sick'
  dateFrom: string
  dateTo: string
  note?: string
}) {
  const from = new Date(input.dateFrom)
  const to = new Date(input.dateTo)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    throw new Error('invalid_dates')
  }
  const admin = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } })
  if (!admin) throw new Error('no_admin')

  // Mark attendance days as LEAVE
  let days = 0
  for (let t = from.getTime(); t <= to.getTime(); t += 86_400_000) {
    const day = new Date(Date.UTC(new Date(t).getUTCFullYear(), new Date(t).getUTCMonth(), new Date(t).getUTCDate()))
    await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: input.employeeId, date: day } },
      create: {
        employeeId: input.employeeId,
        date: day,
        status: 'LEAVE',
        hoursWorked: 0,
        checkIn: null,
        checkOut: null,
      },
      update: { status: 'LEAVE', hoursWorked: 0, checkIn: null, checkOut: null },
    })
    days += 1
  }

  await prisma.activityLog.create({
    data: {
      userId: admin.id,
      action: 'ESS_LEAVE_REQUEST',
      module: 'hr',
      details: JSON.stringify({
        employeeId: input.employeeId,
        type: input.type,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        note: input.note || null,
        status: 'pending_hr_ops',
        approvers: ['Sheyam Hekmat', 'Zahraa Ali', 'Choukrallah Nassif'],
      }),
    },
  })

  return { days, status: 'pending_hr_ops' as const }
}

export async function listPendingEssLeaves() {
  const rows = await prisma.activityLog.findMany({
    where: { action: 'ESS_LEAVE_REQUEST', module: 'hr' },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return rows.map((row) => {
    const details = JSON.parse(row.details || '{}') as Record<string, unknown>
    return { id: row.id, createdAt: row.createdAt.toISOString(), ...details }
  })
}

export async function decideEssLeave(input: { logId: string; decision: 'approved' | 'rejected'; actorId: string }) {
  const row = await prisma.activityLog.findUnique({ where: { id: input.logId } })
  if (!row) throw new Error('not_found')
  const details = JSON.parse(row.details || '{}') as Record<string, unknown>
  details.status = input.decision
  details.decidedBy = input.actorId
  details.decidedAt = new Date().toISOString()
  await prisma.activityLog.update({
    where: { id: row.id },
    data: { details: JSON.stringify(details) },
  })
  return details
}
