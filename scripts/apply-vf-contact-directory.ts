/**
 * Bind VF Contact List 21-10-2026 mobiles/emails/EXT onto Employee + Warehouse rows.
 * Run: npx tsx scripts/apply-vf-contact-directory.ts
 */
import path from 'node:path'
import { createRequire } from 'node:module'
import { matchDirectoryPerson, VF_BRANCHES, VF_PEOPLE, formatKwMobile } from '../src/lib/vf-contact-directory'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('@prisma/client') as {
  PrismaClient: new (args?: { datasources?: { db?: { url?: string } } }) => import('@prisma/client').PrismaClient
}

const sqliteUrl = `file:${path.join(process.cwd(), 'prisma', 'dev.db').replace(/\\/g, '/')}`

async function main() {
  const prisma = new PrismaClient({ datasources: { db: { url: sqliteUrl } } })
  const admin = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } })
  if (!admin) throw new Error('No active user')

  const employees = await prisma.employee.findMany()
  let empUpdated = 0
  for (const emp of employees) {
    const person = matchDirectoryPerson(emp.name)
    if (!person) continue
    const phoneParts = [
      person.mobile ? formatKwMobile(person.mobile) : null,
      person.email || null,
      person.ext ? `EXT ${person.ext}` : null,
      person.direct ? `DIR ${person.direct}` : null,
    ].filter(Boolean)
    const phone = phoneParts.join(' · ').slice(0, 80)
    await prisma.employee.update({
      where: { id: emp.id },
      data: {
        phone,
        jobTitle: person.title || emp.jobTitle,
      },
    })
    await prisma.activityLog.create({
      data: {
        userId: admin.id,
        action: 'VF_DIRECTORY_BIND',
        module: 'hr',
        details: JSON.stringify({
          employeeId: emp.id,
          name: person.name,
          email: person.email ?? null,
          mobile: person.mobile ?? null,
          ext: person.ext ?? null,
          direct: person.direct ?? null,
          source: 'VF Contact List 21-10-2026',
        }),
      },
    })
    empUpdated += 1
  }

  // Ensure directory-only people exist as inactive stubs if missing (executives not in Odoo dump)
  let empCreated = 0
  for (const person of VF_PEOPLE) {
    const exists = employees.some((e) => matchDirectoryPerson(e.name)?.name === person.name)
    if (exists) continue
    if (!person.mobile && !person.email) continue
    const code = `VF${(person.ext || person.mobile || person.name.slice(0, 4)).replace(/\W/g, '').slice(0, 8)}`
    const taken = await prisma.employee.findUnique({ where: { code } })
    if (taken) continue
    await prisma.employee.create({
      data: {
        code,
        name: person.name,
        jobTitle: person.title,
        department:
          person.group === 'finance'
            ? 'Finance Department'
            : person.group === 'hr'
              ? 'HR & Admin Department'
              : person.group === 'ops'
                ? 'Rest. Operations Department'
                : person.group === 'marketing'
                  ? 'Marketing Department'
                  : person.group === 'it'
                    ? 'IT'
                    : person.group === 'executive'
                      ? 'Executive'
                      : 'Head Office',
        phone: [person.mobile ? formatKwMobile(person.mobile) : null, person.email, person.ext ? `EXT ${person.ext}` : null]
          .filter(Boolean)
          .join(' · ')
          .slice(0, 80),
        basicSalary: 0,
        status: 'ACTIVE',
      },
    })
    empCreated += 1
  }

  const warehouses = await prisma.warehouse.findMany()
  let whUpdated = 0
  for (const branch of VF_BRANCHES) {
    const wh =
      warehouses.find((row) => row.code === branch.code) ||
      warehouses.find((row) =>
        branch.warehouseMatch.some((token) => `${row.name} ${row.location ?? ''} ${row.code ?? ''}`.includes(token)),
      )
    if (!wh) {
      await prisma.warehouse.create({
        data: {
          code: branch.code,
          name: branch.nameEn,
          location: `${branch.nameAr} · EXT ${branch.ext} · ${branch.direct}${branch.email ? ` · ${branch.email}` : ''}`,
          managerName: `EXT ${branch.ext} · ${branch.direct}`,
          isDefault: branch.code === 'CK',
        },
      })
      whUpdated += 1
      continue
    }
    await prisma.warehouse.update({
      where: { id: wh.id },
      data: {
        code: wh.code || branch.code,
        managerName: `EXT ${branch.ext} · Tel ${branch.direct}`,
        location: [branch.nameAr, `EXT ${branch.ext}`, branch.direct, branch.email].filter(Boolean).join(' · '),
      },
    })
    whUpdated += 1
  }

  console.log(JSON.stringify({ empUpdated, empCreated, whUpdated, people: VF_PEOPLE.length, branches: VF_BRANCHES.length }, null, 2))
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
