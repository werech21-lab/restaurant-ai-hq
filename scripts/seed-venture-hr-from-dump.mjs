/**
 * Promotes real Venture Foods Odoo HR rows from the local dump into Staging (batched).
 * Source: C:/Users/sec/Downloads/venturefoods_odoo_cids1_dump.json
 */
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { sslOptions } from './migrate-lib.mjs'

const DUMP =
  process.env.VENTURE_ODOO_DUMP ||
  path.resolve('C:/Users/sec/Downloads/venturefoods_odoo_cids1_dump.json')

const LOCATION_TARGETS = [
  ['Venture Foods KWC - Ardiya', 23],
  ['Sharq - Head Office', 22],
  ['Salmiya 1', 19],
  ['Al Kout Mall', 18],
  ['Avenues Mall', 15],
  ['360 Mall', 13],
  ['Promenade Mall', 13],
  ['Aswaq Al Qurain', 13],
  ['Al Rai', 9],
  ['Outside', 4],
]

function textOf(value, fallback = '') {
  if (value === false || value === null || value === undefined) return fallback
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value) && typeof value[1] === 'string') return value[1].trim()
  return fallback
}

function idOf(value) {
  if (Array.isArray(value)) return Number(value[0])
  return Number(value)
}

function kwdToFils(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0
  return Math.round(value * 1000)
}

function departmentRoot(full) {
  if (!full) return '—'
  const root = full.split('/')[0].trim()
  if (root === 'Outside Partners') return 'Outsource Partners'
  if (root === 'عام' || root === 'System') return '—'
  return root || '—'
}

function initials(name) {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '??'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function assignLocations(employees) {
  const byBadge = [...employees].sort((a, b) => String(a.badge).localeCompare(String(b.badge), 'en', { numeric: true }))
  const assigned = new Map()
  const partners = byBadge.filter((e) => e.departmentRoot === 'Outsource Partners')
  for (const e of partners) assigned.set(e.odooId, 'Outside')
  const hqRoots = new Set(['Finance Department', 'HR & Admin Department', 'Marketing Department', 'Complimentary Department'])
  for (const e of byBadge.filter((row) => hqRoots.has(row.departmentRoot) && !assigned.has(row.odooId))) {
    assigned.set(e.odooId, 'Sharq - Head Office')
  }
  const ardiyaRoots = new Set(['Culinary Department', 'Supply Chain Department'])
  for (const e of byBadge.filter((row) => ardiyaRoots.has(row.departmentRoot) && !assigned.has(row.odooId))) {
    assigned.set(e.odooId, 'Venture Foods KWC - Ardiya')
  }
  const remaining = byBadge.filter((e) => !assigned.has(e.odooId))
  const slots = []
  for (const [name, count] of LOCATION_TARGETS) {
    const already = [...assigned.values()].filter((v) => v === name).length
    for (let i = already; i < count; i += 1) slots.push(name)
  }
  while (slots.length < remaining.length) slots.push('Outside')
  remaining.forEach((e, index) => assigned.set(e.odooId, slots[index] ?? 'Outside'))
  return assigned
}

function leaveType(label) {
  const text = String(label || '').toLowerCase()
  if (text.includes('sick') || text.includes('مرض')) return 'sick'
  if (text.includes('unpaid') || text.includes('بدون')) return 'unpaid'
  return 'annual'
}

function leaveStatus(state) {
  if (state === 'validate' || state === 'validate1') return 'approved'
  if (state === 'refuse' || state === 'cancel') return 'rejected'
  return 'pending'
}

function daysBetween(from, to) {
  const a = Date.parse(from)
  const b = Date.parse(to)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 1
  return Math.max(1, Math.round((b - a) / 86400000) + 1)
}

async function chunked(items, size, fn) {
  for (let i = 0; i < items.length; i += size) await fn(items.slice(i, i + size))
}

const dump = JSON.parse(fs.readFileSync(DUMP, 'utf8'))
const models = dump.models || {}
const rawEmployees = models['hr.employee'] || []
const contracts = models['hr.contract'] || []
const payslips = models['hr.payslip'] || []
const attendances = models['hr.attendance'] || []
const leaves = models['hr.leave'] || []
const appraisals = models['hr.appraisal'] || []
const expenses = models['hr.expense'] || []

const employeeRows = rawEmployees
  .filter((row) => row.active !== false)
  .map((row) => {
    const name = textOf(row.name, 'Unknown')
    const department = textOf(row.department_id, '—').slice(0, 200) || '—'
    return {
      odooId: Number(row.id),
      name,
      jobTitle: textOf(row.job_title, 'موظف').slice(0, 120) || 'موظف',
      workEmail: textOf(row.work_email) || null,
      badge: textOf(row.barcode) || null,
      department,
      departmentRoot: departmentRoot(department),
      initials: initials(name),
      isAdmin: Number(row.id) === 1 || name === 'Administrator',
    }
  })

const dumpIds = new Set(employeeRows.map((e) => e.odooId))
const openByEmployee = new Map()
for (const contract of contracts) {
  const empId = idOf(contract.employee_id)
  if (!dumpIds.has(empId) || contract.state !== 'open') continue
  const prev = openByEmployee.get(empId)
  const wage = kwdToFils(Number(contract.wage) || 0)
  if (!prev || wage > prev.wage) {
    openByEmployee.set(empId, {
      odooId: Number(contract.id),
      name: textOf(contract.name, 'Employment Contract').slice(0, 200),
      dateStart: textOf(contract.date_start),
      dateEnd: textOf(contract.date_end) || null,
      wage,
      state: 'open',
    })
  }
}
for (const row of employeeRows) {
  const open = openByEmployee.get(row.odooId)
  row.hasRunning = Boolean(open)
  row.wage = open?.wage ?? 0
}
const locations = assignLocations(employeeRows.filter((e) => !e.isAdmin))

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: sslOptions(process.env.DATABASE_SSL, process.env.DATABASE_SSL_CA),
})
await client.connect()
await client.query(`set statement_timeout = '180s'`)
await client.query(`set lock_timeout = '30s'`)
console.log('connected')

try {
  const tenant = await client.query(`select id, created_by from tenants order by created_at limit 1`)
  const tenantId = tenant.rows[0]?.id
  const actorId = tenant.rows[0]?.created_by
  if (!tenantId || !actorId) throw new Error('no tenant')
  await client.query('begin')

  const existing = await client.query(`select id, employee_code, odoo_id from hr_employees where tenant_id = $1`, [tenantId])
  const byCode = new Map(existing.rows.map((r) => [r.employee_code, r]))
  const byOdoo = new Map(existing.rows.filter((r) => r.odoo_id != null).map((r) => [Number(r.odoo_id), r]))

  let upserted = 0
  for (const row of employeeRows) {
    const code = `O${row.odooId}`
    const status = row.isAdmin ? 'inactive' : 'active'
    const location = row.isAdmin ? null : locations.get(row.odooId) ?? null
    const found = byOdoo.get(row.odooId) || byCode.get(code)
    if (found) {
      await client.query(
        `update hr_employees set
           full_name=$3, role_title=$4, department=$5, department_root=$6, badge_code=$7, work_email=$8,
           work_location=$9, odoo_id=$10, has_running_contract=$11, avatar_initials=$12,
           basic_salary_minor = case when $13::bigint > 0 then $13::bigint else basic_salary_minor end,
           status=$14, updated_at=now()
         where tenant_id=$1 and id=$2`,
        [
          tenantId, found.id, row.name, row.jobTitle, row.department, row.departmentRoot, row.badge, row.workEmail,
          location, row.odooId, row.hasRunning, row.initials, row.wage, status,
        ],
      )
    } else {
      await client.query(
        `insert into hr_employees (
           tenant_id, employee_code, full_name, role_title, department, department_root, badge_code, work_email,
           work_location, odoo_id, has_running_contract, avatar_initials, branch_id, basic_salary_minor, allowances_minor,
           residency_expiry, status, created_by
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,null,$13,0,null,$14,$15)`,
        [
          tenantId, code, row.name, row.jobTitle, row.department, row.departmentRoot, row.badge, row.workEmail,
          location, row.odooId, row.hasRunning, row.initials, row.wage, status, actorId,
        ],
      )
    }
    upserted += 1
  }
  await client.query('commit')
  console.log('employees', upserted)

  const refreshed = await client.query(
    `select id, odoo_id from hr_employees where tenant_id = $1 and odoo_id is not null`,
    [tenantId],
  )
  const empUuid = new Map(refreshed.rows.map((r) => [Number(r.odoo_id), r.id]))

  await client.query('begin')
  await client.query(`delete from hr_contracts where tenant_id = $1`, [tenantId])
  const contractRows = []
  for (const contract of contracts) {
    const uuid = empUuid.get(idOf(contract.employee_id))
    const dateStart = textOf(contract.date_start)
    if (!uuid || !dateStart) continue
    const state = ['draft', 'open', 'close', 'cancel'].includes(contract.state) ? contract.state : 'close'
    contractRows.push([
      tenantId,
      uuid,
      Number(contract.id),
      textOf(contract.name, 'Employment Contract').slice(0, 200),
      dateStart,
      textOf(contract.date_end) || null,
      kwdToFils(Number(contract.wage) || 0),
      state,
      actorId,
    ])
  }
  await chunked(contractRows, 100, async (batch) => {
    const values = []
    const params = []
    let n = 1
    for (const row of batch) {
      values.push(`($${n++},$${n++},$${n++},$${n++},$${n++}::date,$${n++}::date,$${n++},$${n++},$${n++})`)
      params.push(...row)
    }
    await client.query(
      `insert into hr_contracts (tenant_id, employee_id, odoo_id, name, date_start, date_end, wage_minor, state, created_by)
       values ${values.join(',')}`,
      params,
    )
  })
  await client.query('commit')
  console.log('contracts', contractRows.length)

  async function ensureRun(period) {
    const found = await client.query(`select id from hr_payroll_runs where tenant_id = $1 and period = $2`, [tenantId, period])
    if (found.rows[0]) return found.rows[0].id
    const inserted = await client.query(
      `insert into hr_payroll_runs (tenant_id, period, gross_minor, deductions_minor, net_minor, journal_entry_id, status, created_by)
       values ($1,$2,0,0,0,null,'draft',$3) returning id`,
      [tenantId, period, actorId],
    )
    return inserted.rows[0].id
  }

  for (const period of ['2026-08', '2026-09', '2026-10']) {
    await client.query('begin')
    try {
      const runId = await ensureRun(period)
      const periodSlips = payslips.filter((s) => textOf(s.date_from).startsWith(period) && s.state !== 'cancel')
      const byEmployee = new Map()
      for (const slip of periodSlips) {
        const uuid = empUuid.get(idOf(slip.employee_id))
        if (!uuid) continue
        const g = kwdToFils(Number(slip.net_wage) || 0)
        const prev = byEmployee.get(uuid)
        if (!prev || g > prev) byEmployee.set(uuid, g)
      }
      const slipRows = []
      let gross = 0
      for (const [uuid, g] of byEmployee) {
        slipRows.push([tenantId, runId, uuid, g, 0, g, actorId])
        gross += g
      }
      await chunked(slipRows, 50, async (batch) => {
        const values = []
        const params = []
        let n = 1
        for (const row of batch) {
          values.push(`($${n++},$${n++},$${n++},$${n++},$${n++},$${n++},null,'draft',$${n++})`)
          params.push(...row)
        }
        await client.query(
          `insert into hr_payslips (tenant_id, run_id, employee_id, gross_minor, deductions_minor, net_minor, journal_entry_id, status, created_by)
           values ${values.join(',')}
           on conflict (run_id, employee_id) do update set
             gross_minor = excluded.gross_minor,
             deductions_minor = excluded.deductions_minor,
             net_minor = excluded.net_minor,
             status = 'draft'`,
          params,
        )
      })
      await client.query(
        `update hr_payroll_runs set gross_minor=$3, deductions_minor=0, net_minor=$3, updated_at=now() where tenant_id=$1 and id=$2`,
        [tenantId, runId, gross],
      )
      await client.query('commit')
      console.log('payslips', period, slipRows.length)
    } catch (error) {
      await client.query('rollback')
      console.error('payslip period failed', period, error instanceof Error ? error.message : error)
      throw error
    }
  }

  await client.query('begin')
  await client.query(
    `delete from hr_attendances a using hr_employees e
     where a.tenant_id=$1 and e.tenant_id=a.tenant_id and e.id=a.employee_id and e.odoo_id is not null`,
    [tenantId],
  )
  const attRows = []
  for (const row of attendances) {
    const uuid = empUuid.get(idOf(row.employee_id))
    const checkIn = textOf(row.check_in)
    if (!uuid || !checkIn) continue
    attRows.push([tenantId, uuid, checkIn, textOf(row.check_out) || null, actorId])
  }
  await chunked(attRows, 100, async (batch) => {
    const values = []
    const params = []
    let n = 1
    for (const row of batch) {
      values.push(`($${n++},$${n++},null,$${n++}::timestamptz,$${n++}::timestamptz,0,$${n++})`)
      params.push(...row)
    }
    await client.query(
      `insert into hr_attendances (tenant_id, employee_id, branch_id, check_in, check_out, overtime_minutes, created_by)
       values ${values.join(',')}`,
      params,
    )
  })
  await client.query('commit')
  console.log('attendance', attRows.length)

  await client.query('begin')
  await client.query(
    `delete from hr_leaves l using hr_employees e
     where l.tenant_id=$1 and e.tenant_id=l.tenant_id and e.id=l.employee_id and e.odoo_id is not null`,
    [tenantId],
  )
  const leaveRows = []
  for (const row of leaves) {
    const uuid = empUuid.get(idOf(row.employee_id))
    const from = textOf(row.date_from).slice(0, 10)
    const to = textOf(row.date_to).slice(0, 10) || from
    if (!uuid || !from) continue
    leaveRows.push([
      tenantId, uuid, leaveType(textOf(row.holiday_status_id)), from, to, daysBetween(from, to), leaveStatus(row.state), actorId,
    ])
  }
  await chunked(leaveRows, 100, async (batch) => {
    const values = []
    const params = []
    let n = 1
    for (const row of batch) {
      values.push(`($${n++},$${n++},$${n++},$${n++}::date,$${n++}::date,$${n++},$${n++},$${n++})`)
      params.push(...row)
    }
    await client.query(
      `insert into hr_leaves (tenant_id, employee_id, leave_type, start_date, end_date, days, approval_status, created_by)
       values ${values.join(',')}`,
      params,
    )
  })
  await client.query('commit')
  console.log('leaves', leaveRows.length)

  await client.query('begin')
  await client.query(
    `delete from hr_appraisals a using hr_employees e
     where a.tenant_id=$1 and e.tenant_id=a.tenant_id and e.id=a.employee_id and e.odoo_id is not null`,
    [tenantId],
  )
  const appraisalRows = []
  for (const row of appraisals) {
    const uuid = empUuid.get(idOf(row.employee_id))
    if (!uuid) continue
    appraisalRows.push([tenantId, uuid, `Odoo appraisal ${textOf(row.state)}`, actorId])
  }
  await chunked(appraisalRows, 100, async (batch) => {
    const values = []
    const params = []
    let n = 1
    for (const row of batch) {
      values.push(`($${n++},$${n++},3,70,$${n++},$${n++})`)
      params.push(...row)
    }
    await client.query(
      `insert into hr_appraisals (tenant_id, employee_id, rating, kpi_score, reviewer_notes, created_by) values ${values.join(',')}`,
      params,
    )
  })
  await client.query('commit')
  console.log('appraisals', appraisalRows.length)

  await client.query('begin')
  await client.query(
    `delete from hr_expenses x using hr_employees e
     where x.tenant_id=$1 and e.tenant_id=x.tenant_id and e.id=x.employee_id and e.odoo_id is not null`,
    [tenantId],
  )
  const expenseRows = []
  for (const row of expenses.slice(0, 500)) {
    const uuid = empUuid.get(idOf(row.employee_id))
    const amount = kwdToFils(Number(row.total_amount) || 0)
    if (!uuid || amount <= 0) continue
    expenseRows.push([tenantId, uuid, textOf(row.name, 'Expense').slice(0, 80), amount, actorId])
  }
  await chunked(expenseRows, 100, async (batch) => {
    const values = []
    const params = []
    let n = 1
    for (const row of batch) {
      values.push(`($${n++},$${n++},$${n++},$${n++},'pending',null,$${n++})`)
      params.push(...row)
    }
    await client.query(
      `insert into hr_expenses (tenant_id, employee_id, category, amount_minor, approval_status, journal_entry_id, created_by)
       values ${values.join(',')}`,
      params,
    )
  })
  await client.query('commit')
  console.log('expenses', expenseRows.length)

  await client.query('begin')
  await client.query(
    `delete from hr_documents d using hr_employees e
     where d.tenant_id=$1 and e.tenant_id=d.tenant_id and e.id=d.employee_id and e.odoo_id is not null`,
    [tenantId],
  )
  const docRows = []
  for (const [odooId, open] of openByEmployee) {
    const uuid = empUuid.get(odooId)
    if (!uuid) continue
    docRows.push([tenantId, uuid, open.name, open.dateStart, actorId])
  }
  await chunked(docRows, 100, async (batch) => {
    const values = []
    const params = []
    let n = 1
    for (const row of batch) {
      values.push(`($${n++},$${n++},'contract',$${n++},$${n++}::date,'valid','Odoo running contract',$${n++})`)
      params.push(...row)
    }
    await client.query(
      `insert into hr_documents (tenant_id, employee_id, doc_type, title, issued_on, status, notes_ar, created_by)
       values ${values.join(',')}`,
      params,
    )
  })
  await client.query('commit')
  console.log('documents', docRows.length)

  const summary = await client.query(
    `select count(*) filter (where status='active')::int as active,
            count(*) filter (where has_running_contract)::int as with_contract,
            count(*) filter (where status='active' and not has_running_contract)::int as without_contract
     from hr_employees where tenant_id=$1`,
    [tenantId],
  )
  const depts = await client.query(
    `select department_root, count(*)::int as n from hr_employees where tenant_id=$1 and status='active' group by 1 order by n desc`,
    [tenantId],
  )
  const locs = await client.query(
    `select coalesce(work_location,'—') as loc, count(*)::int as n from hr_employees where tenant_id=$1 and status='active' group by 1 order by n desc`,
    [tenantId],
  )
  const runs = await client.query(
    `select period, (select count(*)::int from hr_payslips p where p.run_id=r.id) as slips
     from hr_payroll_runs r where tenant_id=$1 and period in ('2026-08','2026-09','2026-10') order by period`,
    [tenantId],
  )
  console.log(JSON.stringify({ summary: summary.rows[0], depts: depts.rows, locs: locs.rows, runs: runs.rows }, null, 2))
} catch (error) {
  try {
    await client.query('rollback')
  } catch {
    /* no open transaction */
  }
  throw error
} finally {
  await client.end()
}
