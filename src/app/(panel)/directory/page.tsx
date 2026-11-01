import { Suspense } from 'react'
import { connection } from 'next/server'
import { requireUser } from '@/lib/erp-auth'
import { Forbidden, PageHeader, PageSkeleton } from '@/components/erp-ui'
import { getLocale, tx } from '@/lib/i18n/server'
import { can, firstAllowedHref } from '@/lib/permissions'
import { formatKwMobile, matchDirectoryPerson, VF_BRANCHES, VF_BRAND_HOTLINES, VF_PEOPLE } from '@/lib/vf-contact-directory'
import { prisma } from '@/lib/db'

export const metadata = { title: 'VF Phone & PBX Directory | AetherBI ERP' }

async function DirectoryContent() {
  await connection()
  const locale = await getLocale()
  const user = await requireUser()
  if (!can(user, 'hr', 'view') && !can(user, 'warehouses', 'view')) {
    return <Forbidden href={firstAllowedHref(user)} />
  }

  const [employees, warehouses] = await Promise.all([
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

  const linkedPeople = VF_PEOPLE.map((person) => {
    const emp = employees.find((row) => matchDirectoryPerson(row.name)?.name === person.name)
    return { person, employee: emp ?? null }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title={tx(locale, 'دليل الهواتف والبدالة (VF Phone & PBX Directory)', 'VF Phone & PBX Directory')}
        description={tx(
          locale,
          'الدليل الرسمي لشركة فنتشر فودز — تحويلات البدالة والموبايل والإيميلات · VF Contact List 21-10-2026',
          'Official Venture Foods extensions, mobiles, and emails · VF Contact List 21-10-2026',
        )}
      />

      <div className="flex flex-wrap gap-2 text-sm">
        <a href="/hr" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700">
          {tx(locale, 'الموارد البشرية', 'HR')}
        </a>
        <a href="/warehouses" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700">
          {tx(locale, 'المستودعات والفروع', 'Warehouses')}
        </a>
        <a href="/erp/aggregator-radar" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-800">
          {tx(locale, 'رادار التوصيل · تنبيهات حصرية', 'Aggregator radar · exclusive alerts')}
        </a>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <header className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold text-slate-900">
            {tx(locale, 'الإدارة والموظفون — تحويلات وموبايل وإيميل', 'Leadership & staff — EXT / mobile / email')}
          </h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 text-start">{tx(locale, 'الاسم', 'Name')}</th>
                <th className="px-4 py-3 text-start">{tx(locale, 'المسمى', 'Title')}</th>
                <th className="px-4 py-3 text-start">EXT</th>
                <th className="px-4 py-3 text-start">{tx(locale, 'مباشر', 'Direct')}</th>
                <th className="px-4 py-3 text-start">{tx(locale, 'موبايل', 'Mobile')}</th>
                <th className="px-4 py-3 text-start">{tx(locale, 'البريد', 'Email')}</th>
                <th className="px-4 py-3 text-start">{tx(locale, 'ربط HR', 'HR link')}</th>
              </tr>
            </thead>
            <tbody>
              {linkedPeople.map(({ person, employee }) => (
                <tr key={`${person.name}-${person.ext ?? person.mobile}`} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-semibold text-slate-900">{person.name}</td>
                  <td className="px-4 py-3 text-slate-600">{person.title}</td>
                  <td className="px-4 py-3" dir="ltr">
                    {person.ext ?? '—'}
                  </td>
                  <td className="px-4 py-3" dir="ltr">
                    {person.direct ?? '—'}
                  </td>
                  <td className="px-4 py-3" dir="ltr">
                    {person.mobile ? (
                      <a className="text-blue-700 hover:underline" href={`https://wa.me/965${person.mobile.replace(/\D/g, '')}`}>
                        {formatKwMobile(person.mobile)}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3" dir="ltr">
                    {person.email ? (
                      <a className="text-blue-700 hover:underline" href={`mailto:${person.email}`}>
                        {person.email}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {employee ? (
                      <span>
                        {employee.code} · {employee.phone || tx(locale, 'مربوط', 'linked')}
                      </span>
                    ) : (
                      tx(locale, 'دليل فقط', 'directory only')
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <header className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold text-slate-900">{tx(locale, 'الخطوط الساخنة للبراندات', 'Brand hotlines')}</h2>
        </header>
        <ul className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {VF_BRAND_HOTLINES.map((row) => (
            <li key={row.brand} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-900">{row.brand}</p>
              <p className="mt-1" dir="ltr">
                {row.phones.map((phone) => (
                  <span key={phone} className="mr-2 inline-block text-slate-700">
                    {phone}
                  </span>
                ))}
              </p>
              {row.email ? (
                <a className="mt-1 block text-blue-700" href={`mailto:${row.email}`} dir="ltr">
                  {row.email}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <header className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold text-slate-900">{tx(locale, 'تحويلات وخطوط الفروع', 'Branch extensions & direct lines')}</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 text-start">{tx(locale, 'الفرع', 'Branch')}</th>
                <th className="px-4 py-3 text-start">EXT</th>
                <th className="px-4 py-3 text-start">{tx(locale, 'مباشر', 'Direct')}</th>
                <th className="px-4 py-3 text-start">{tx(locale, 'البريد', 'Email')}</th>
                <th className="px-4 py-3 text-start">{tx(locale, 'المستودع', 'Warehouse')}</th>
              </tr>
            </thead>
            <tbody>
              {VF_BRANCHES.map((branch) => {
                const wh = warehouses.find(
                  (row) =>
                    row.code === branch.code ||
                    branch.warehouseMatch.some((token) => `${row.name} ${row.location ?? ''}`.includes(token)),
                )
                return (
                  <tr key={branch.code + branch.ext} className="border-b border-slate-100">
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-900">{locale === 'en' ? branch.nameEn : branch.nameAr}</span>
                      <span className="mt-0.5 block text-xs text-slate-500" dir="ltr">
                        {branch.code}
                      </span>
                    </td>
                    <td className="px-4 py-3" dir="ltr">
                      {branch.ext}
                    </td>
                    <td className="px-4 py-3" dir="ltr">
                      {branch.direct}
                    </td>
                    <td className="px-4 py-3" dir="ltr">
                      {branch.email ? (
                        <a className="text-blue-700 hover:underline" href={`mailto:${branch.email}`}>
                          {branch.email}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {wh ? (
                        <a className="text-blue-700 hover:underline" href={`/warehouses?q=${wh.id}`}>
                          {wh.name}
                          {wh.managerName ? ` · ${wh.managerName}` : ''}
                        </a>
                      ) : (
                        tx(locale, 'غير مربوط بعد', 'not linked yet')
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default function DirectoryPage() {
  return (
    <Suspense fallback={<PageSkeleton title="VF Directory" />}>
      <DirectoryContent />
    </Suspense>
  )
}
