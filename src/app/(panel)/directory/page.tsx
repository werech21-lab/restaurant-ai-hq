import { Suspense } from 'react'
import { connection } from 'next/server'
import { DirectoryView } from '@/app/(panel)/directory/directory-view'
import { Forbidden, PageSkeleton } from '@/components/erp-ui'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/erp-auth'
import { getLocale } from '@/lib/i18n/server'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import { can, firstAllowedHref } from '@/lib/permissions'
import {
  matchDirectoryPerson,
  VF_BRANCHES,
  VF_BRAND_HOTLINES,
  VF_PEOPLE,
} from '@/lib/vf-contact-directory'

export const metadata = { title: 'VF Phone & PBX Directory | AetherBI ERP' }

async function DirectoryContent() {
  await connection()
  const locale = await getLocale()
  const user = await requireUser()
  if (!can(user, 'hr', 'view') && !can(user, 'warehouses', 'view')) {
    return <Forbidden href={firstAllowedHref(user)} />
  }

  let employees: Array<{
    id: string
    name: string
    phone: string | null
    jobTitle: string
    department: string
    code: string
  }> = []
  let warehouses: Array<{
    id: string
    code: string | null
    name: string
    location: string | null
    managerName: string | null
  }> = []
  let hasError = false

  try {
    const [empRows, whRows] = await Promise.all([
      prisma.employee.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, phone: true, jobTitle: true, department: true, code: true },
        orderBy: { name: 'asc' },
        take: 300,
      }),
      prisma.warehouse.findMany({
        select: { id: true, code: true, name: true, location: true, managerName: true },
        orderBy: { name: 'asc' },
      }),
    ])
    employees = empRows.filter(
      (row) => !isExcludedOdooEntity(row.name) && !isExcludedOdooEntity(row.department),
    )
    warehouses = whRows.filter(
      (row) =>
        !isExcludedOdooEntity(row.name) &&
        !isExcludedOdooEntity(row.location ?? '') &&
        !isExcludedOdooEntity(row.code ?? ''),
    )
  } catch {
    hasError = true
  }

  const linkedPeople = VF_PEOPLE.filter((p) => !isExcludedOdooEntity(p.name)).map((person) => {
    const emp = employees.find((row) => matchDirectoryPerson(row.name)?.name === person.name)
    return {
      person,
      employee: emp
        ? {
            id: emp.id,
            code: emp.code,
            phone: emp.phone,
            department: emp.department,
          }
        : null,
    }
  })

  const hotlines = VF_BRAND_HOTLINES.filter((row) => !isExcludedOdooEntity(row.brand))

  const branches = VF_BRANCHES.filter(
    (b) => !isExcludedOdooEntity(b.nameEn) && !isExcludedOdooEntity(b.nameAr),
  ).map((branch) => {
    const wh = warehouses.find(
      (row) =>
        row.code === branch.code ||
        branch.warehouseMatch.some((token) => `${row.name} ${row.location ?? ''}`.includes(token)),
    )
    return {
      branch,
      warehouse: wh
        ? {
            id: wh.id,
            name: wh.name,
            location: wh.location,
            managerName: wh.managerName,
          }
        : null,
    }
  })

  return (
    <DirectoryView
      locale={locale === 'en' ? 'en' : 'ar'}
      people={linkedPeople}
      hotlines={hotlines}
      branches={branches}
      hasError={hasError}
    />
  )
}

export default function DirectoryPage() {
  return (
    <Suspense fallback={<PageSkeleton title="VF Directory" />}>
      <DirectoryContent />
    </Suspense>
  )
}
