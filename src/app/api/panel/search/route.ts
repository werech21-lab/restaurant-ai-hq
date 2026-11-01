import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/erp-auth'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export type PanelSearchHit = {
  id: string
  kind: 'employee' | 'product' | 'invoice' | 'journal' | 'supplier' | 'customer' | 'document' | 'module'
  title: string
  subtitle: string
  href: string
}

const MODULE_LINKS: Array<{ title: string; href: string; keywords: string }> = [
  { title: 'HR', href: '/hr', keywords: 'hr employees payroll موارد بشرية' },
  { title: 'Compliance Radar', href: '/hr/compliance-radar', keywords: 'compliance residency civil health اقامة' },
  { title: 'Smart HR Upload', href: '/hr/smart-folder-upload', keywords: 'upload folder hr' },
  { title: 'Inventory', href: '/inventory', keywords: 'stock products مخزون' },
  { title: 'POS', href: '/pos', keywords: 'cashier كاشير' },
  { title: 'Accounting', href: '/accounting', keywords: 'journal accounts محاسبة' },
  { title: 'Reconciliation', href: '/accounting/reconciliation', keywords: 'nbk bank talabat reconcile مطابقة' },
  { title: 'Purchases', href: '/purchases', keywords: 'suppliers مشتريات' },
  { title: 'Sales', href: '/sales', keywords: 'invoices مبيعات' },
  { title: 'Delivery Hub', href: '/delivery-hub', keywords: 'talabat deliveroo jahez' },
  { title: 'CRM', href: '/crm', keywords: 'customers leads' },
  { title: 'Recipes', href: '/recipes', keywords: 'bom food cost' },
]

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 })

  const q = (request.nextUrl.searchParams.get('q') || '').trim().slice(0, 80)
  if (q.length < 1) return NextResponse.json({ data: [] as PanelSearchHit[] })

  const hits: PanelSearchHit[] = []
  const lower = q.toLowerCase()

  for (const mod of MODULE_LINKS) {
    if (mod.keywords.toLowerCase().includes(lower) || mod.title.toLowerCase().includes(lower) || mod.href.includes(lower)) {
      hits.push({ id: mod.href, kind: 'module', title: mod.title, subtitle: 'Module', href: mod.href })
    }
  }

  const [employees, products, invoices, journals, suppliers, customers, docs] = await Promise.all([
    prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
        OR: [{ name: { contains: q } }, { code: { contains: q } }, { jobTitle: { contains: q } }],
      },
      take: 12,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true, jobTitle: true, department: true },
    }),
    prisma.product.findMany({
      where: { OR: [{ name: { contains: q } }, { code: { contains: q } }] },
      take: 12,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    }),
    prisma.salesInvoice.findMany({
      where: { OR: [{ invoiceNumber: { contains: q } }] },
      take: 8,
      orderBy: { createdAt: 'desc' },
      select: { id: true, invoiceNumber: true, totalAmount: true, customer: { select: { name: true } } },
    }),
    prisma.journalEntry.findMany({
      where: { OR: [{ entryNumber: { contains: q } }, { description: { contains: q } }] },
      take: 8,
      orderBy: { date: 'desc' },
      select: { id: true, entryNumber: true, description: true },
    }),
    prisma.supplier.findMany({
      where: { name: { contains: q } },
      take: 8,
      select: { id: true, name: true, balance: true },
    }),
    prisma.customer.findMany({
      where: { OR: [{ name: { contains: q } }, { phone: { contains: q } }] },
      take: 8,
      select: { id: true, name: true, phone: true },
    }),
    prisma.hrDocument.findMany({
      where: { OR: [{ fileName: { contains: q } }, { relativePath: { contains: q } }] },
      take: 8,
      orderBy: { createdAt: 'desc' },
      select: { id: true, fileName: true, category: true, employee: { select: { name: true, code: true } } },
    }),
  ])

  for (const row of employees) {
    hits.push({
      id: row.id,
      kind: 'employee',
      title: row.name,
      subtitle: `${row.code} · ${row.jobTitle}${row.department ? ` · ${row.department}` : ''}`,
      href: `/hr?doc=${row.id}`,
    })
  }
  for (const row of products) {
    hits.push({
      id: row.id,
      kind: 'product',
      title: row.name,
      subtitle: row.code,
      href: `/inventory?q=${encodeURIComponent(row.code)}`,
    })
  }
  for (const row of invoices) {
    hits.push({
      id: row.id,
      kind: 'invoice',
      title: row.invoiceNumber,
      subtitle: `${row.customer.name} · ${row.totalAmount.toFixed(3)} KWD`,
      href: `/sales?q=${encodeURIComponent(row.invoiceNumber)}`,
    })
  }
  for (const row of journals) {
    hits.push({
      id: row.id,
      kind: 'journal',
      title: row.entryNumber,
      subtitle: row.description.slice(0, 80),
      href: `/accounting?tab=journals&q=${encodeURIComponent(row.entryNumber)}`,
    })
  }
  for (const row of suppliers) {
    hits.push({
      id: row.id,
      kind: 'supplier',
      title: row.name,
      subtitle: `Balance ${row.balance.toFixed(3)} KWD`,
      href: `/purchases?tab=parties&q=${encodeURIComponent(row.name)}`,
    })
  }
  for (const row of customers) {
    hits.push({
      id: row.id,
      kind: 'customer',
      title: row.name,
      subtitle: row.phone || 'Customer',
      href: `/crm?q=${encodeURIComponent(row.name)}`,
    })
  }
  for (const row of docs) {
    hits.push({
      id: row.id,
      kind: 'document',
      title: row.fileName,
      subtitle: `${row.category}${row.employee ? ` · ${row.employee.code} ${row.employee.name}` : ''}`,
      href: row.employee ? `/hr?doc=${row.employee.name}` : '/hr/smart-folder-upload',
    })
  }

  // Dept ingest docs
  try {
    const deptDocs = await prisma.deptIngestDocument.findMany({
      where: { OR: [{ fileName: { contains: q } }, { entityLabel: { contains: q } }] },
      take: 8,
      orderBy: { createdAt: 'desc' },
      select: { id: true, fileName: true, module: true, entityLabel: true },
    })
    for (const row of deptDocs) {
      hits.push({
        id: row.id,
        kind: 'document',
        title: row.fileName,
        subtitle: `${row.module}${row.entityLabel ? ` · ${row.entityLabel}` : ''}`,
        href: `/smart-ingest/${row.module}`,
      })
    }
  } catch {
    /* table may be missing on older DBs */
  }

  return NextResponse.json({ data: hits.slice(0, 40) })
}
