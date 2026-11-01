import type { Queryable } from '@/lib/pg'
import { erpSectors } from '@/lib/erp-sectors'
import { ventureBrands } from '@/modules/governance/client'

export type SearchHit = {
  id: string
  kind: 'employee' | 'brand' | 'branch' | 'item' | 'invoice' | 'module'
  title: string
  subtitle: string
  href: string
}

function like(needle: string): string {
  return `%${needle.replace(/[%_\\]/g, '')}%`
}

/** Tenant-scoped quick search for the Ctrl+K palette. */
export async function globalSearch(tx: Queryable, tenantId: string, rawQuery: string): Promise<SearchHit[]> {
  const query = rawQuery.trim().slice(0, 80)
  if (query.length < 1) return []
  const pattern = like(query)
  const hits: SearchHit[] = []

  for (const sector of erpSectors) {
    const title = sector.title
    for (const link of sector.links) {
      const blob = `${link.href} ${link.title} ${title}`.toLowerCase()
      if (blob.includes(query.toLowerCase()) || link.href.includes(query)) {
        hits.push({ id: link.href, kind: 'module', title: link.title, subtitle: title, href: link.href })
      }
    }
  }

  for (const brand of ventureBrands) {
    const blob = `${brand.code} ${brand.nameEn} ${brand.nameAr}`.toLowerCase()
    if (blob.includes(query.toLowerCase())) {
      hits.push({
        id: brand.code,
        kind: 'brand',
        title: brand.nameAr,
        subtitle: brand.nameEn,
        href: `/erp/aggregator-radar`,
      })
    }
  }

  const employees = await tx.query<{ id: string; fullName: string; badge: string | null; code: string; role: string }>(
    `select id, full_name as "fullName", badge_code as badge, employee_code as code, role_title as role
     from hr_employees
     where tenant_id = $1 and status = 'active'
       and (full_name ilike $2 or coalesce(badge_code,'') ilike $2 or employee_code ilike $2)
     order by full_name limit 12`,
    [tenantId, pattern],
  )
  for (const row of employees.rows) {
    hits.push({
      id: row.id,
      kind: 'employee',
      title: row.fullName,
      subtitle: `${row.badge ?? row.code} · ${row.role}`,
      href: `/erp/hr?tab=employees`,
    })
  }

  const branches = await tx.query<{ id: string; name: string; code: string }>(
    `select id, name, code from branches where tenant_id = $1 and status = 'active' and (name ilike $2 or code ilike $2) order by name limit 8`,
    [tenantId, pattern],
  )
  for (const row of branches.rows) {
    hits.push({ id: row.id, kind: 'branch', title: row.name, subtitle: row.code, href: `/erp/org` })
  }

  const items = await tx.query<{ id: string; name: string; sku: string }>(
    `select id, name, sku from items where tenant_id = $1 and is_active = true and (name ilike $2 or sku ilike $2) order by name limit 10`,
    [tenantId, pattern],
  )
  for (const row of items.rows) {
    hits.push({ id: row.id, kind: 'item', title: row.name, subtitle: row.sku, href: `/erp/inventory?tab=catalog&item=${row.id}` })
  }

  const invoices = await tx.query<{ id: string; number: string; customer: string; total: string }>(
    `select id, number, customer_name as customer, total_minor::text as total
     from invoices
     where tenant_id = $1 and (number ilike $2 or customer_name ilike $2)
     order by created_at desc limit 8`,
    [tenantId, pattern],
  )
  for (const row of invoices.rows) {
    hits.push({
      id: row.id,
      kind: 'invoice',
      title: row.number,
      subtitle: row.customer,
      href: `/erp/finance?tab=invoicing&invoice=${row.id}`,
    })
  }

  return hits.slice(0, 40)
}
