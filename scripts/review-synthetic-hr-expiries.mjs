/**
 * Review-only list of employee expiry dates that match the removed synthetic formula.
 * Does not update or delete any row.
 *
 * The old writer, removed from src/services/hr-compliance.service.ts, set a missing
 * expiry to hireDate + an offset in whole days (86_400_000 ms):
 *   civil     = 300 + (code.charCodeAt(0) % 90)
 *   passport  = 600 + (code.charCodeAt(last) % 200)
 *   health    = 120 + (Number(code) % 80 || 20)
 *   work      = 280 + (Number(code) % 100 || 30)
 *   driving   = 200 + (Number(code) % 60 || 10)  when job title matched driv|سائق|courier|mandoob
 * When hireDate was missing, the base was Date.now() minus 365 days at the moment of the write.
 *
 * Run yourself when you want the list (this file is not executed by the follow-up change):
 *   node --env-file=.env.local scripts/review-synthetic-hr-expiries.mjs
 * The script prints employee code, name, field, stored day, and why it matched.
 * It never prints DATABASE_URL.
 */
import { PrismaClient } from '@prisma/client'

const DAY_MS = 86_400_000
const FIELDS = [
  'civilIdExpiry',
  'passportExpiry',
  'healthCardExpiry',
  'workPermitExpiry',
  'drivingLicenseExpiry',
]

function offsetDays(code, field) {
  const text = String(code ?? '')
  const first = text.charCodeAt(0)
  const last = text.charCodeAt(Math.max(0, text.length - 1))
  const numeric = Number(text)
  const modOr = (divisor, fallback) => {
    const value = numeric % divisor
    return value || fallback
  }
  if (field === 'civilIdExpiry') return 300 + (first % 90)
  if (field === 'passportExpiry') return 600 + (last % 200)
  if (field === 'healthCardExpiry') return 120 + modOr(80, 20)
  if (field === 'workPermitExpiry') return 280 + modOr(100, 30)
  if (field === 'drivingLicenseExpiry') return 200 + modOr(60, 10)
  return null
}

function drivingWasWritten(jobTitle) {
  return /driv|سائق|courier|mandoob/i.test(String(jobTitle ?? ''))
}

function utcDay(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null
  return value.toISOString().slice(0, 10)
}

function sameInstant(stored, expected) {
  return Math.abs(stored.getTime() - expected.getTime()) < 1000
}

function sameUtcDay(stored, expected) {
  return utcDay(stored) !== null && utcDay(stored) === utcDay(expected)
}

if (!process.env.DATABASE_URL) {
  process.stderr.write('DATABASE_URL is not set. Nothing was read.\n')
  process.exit(1)
}

const prisma = new PrismaClient()

try {
  {
    const employees = await prisma.employee.findMany({
      select: {
        code: true,
        name: true,
        jobTitle: true,
        hireDate: true,
        civilIdExpiry: true,
        passportExpiry: true,
        healthCardExpiry: true,
        workPermitExpiry: true,
        drivingLicenseExpiry: true,
      },
      orderBy: { code: 'asc' },
    })

    const rows = []
    for (const emp of employees) {
      const offsets = {}
      for (const field of FIELDS) {
        if (field === 'drivingLicenseExpiry' && !drivingWasWritten(emp.jobTitle)) continue
        const days = offsetDays(emp.code, field)
        if (days === null || !Number.isFinite(days)) continue
        offsets[field] = days
      }

      if (emp.hireDate instanceof Date && !Number.isNaN(emp.hireDate.getTime())) {
        for (const [field, days] of Object.entries(offsets)) {
          const stored = emp[field]
          if (!(stored instanceof Date)) continue
          const expected = new Date(emp.hireDate.getTime() + days * DAY_MS)
          if (sameInstant(stored, expected) || sameUtcDay(stored, expected)) {
            rows.push({
              code: emp.code,
              name: emp.name,
              field,
              storedDay: utcDay(stored),
              expectedDay: utcDay(expected),
              reason: 'hireDate plus the removed offset',
            })
          }
        }
      }

      const present = Object.keys(offsets).filter((field) => emp[field] instanceof Date)
      if (present.length >= 2) {
        const anchor = present[0]
        const anchorStored = emp[anchor]
        for (const field of present.slice(1)) {
          const stored = emp[field]
          const expected = new Date(anchorStored.getTime() + (offsets[field] - offsets[anchor]) * DAY_MS)
          const already = rows.some((row) => row.code === emp.code && row.field === field)
          if (!already && (sameInstant(stored, expected) || sameUtcDay(stored, expected))) {
            rows.push({
              code: emp.code,
              name: emp.name,
              field,
              storedDay: utcDay(stored),
              expectedDay: utcDay(expected),
              reason: `day gap from ${anchor} matches the removed offsets`,
            })
          }
        }
      }
    }

    process.stdout.write(`employees_scanned\t${employees.length}\n`)
    process.stdout.write(`synthetic_matches\t${rows.length}\n`)
    process.stdout.write('code\tname\tfield\tstored_day\texpected_day\treason\n')
    for (const row of rows) {
      process.stdout.write(
        `${row.code}\t${row.name}\t${row.field}\t${row.storedDay}\t${row.expectedDay}\t${row.reason}\n`,
      )
    }
  }
} finally {
  await prisma.$disconnect()
}
