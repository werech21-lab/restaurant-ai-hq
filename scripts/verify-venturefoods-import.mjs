import { createRequire } from 'node:module'
import path from 'node:path'
const require = createRequire(import.meta.url)
const { PrismaClient } = require('@prisma/client')
const url = `file:${path.join(process.cwd(), 'prisma', 'dev.db').replace(/\\/g, '/')}`
const p = new PrismaClient({ datasources: { db: { url } } })
const c = {
  products: await p.product.count(),
  employees: await p.employee.count(),
  accounts: await p.account.count(),
  journals: await p.journalEntry.count(),
  customers: await p.customer.count(),
  suppliers: await p.supplier.count(),
  warehouses: await p.warehouse.count(),
  whStock: await p.warehouseStock.count(),
  payroll: await p.payroll.count(),
  attendance: await p.attendance.count(),
  expenses: await p.journalEntry.count({ where: { referenceType: 'ODOO_EXPENSE' } }),
}
const sampleEmp = await p.employee.findMany({
  take: 5,
  orderBy: { basicSalary: 'desc' },
  select: { name: true, jobTitle: true, basicSalary: true, department: true, code: true },
})
const sampleProd = await p.product.findMany({
  where: { sellingPrice: { gt: 0 } },
  take: 5,
  select: { code: true, name: true, sellingPrice: true },
})
console.log(JSON.stringify({ c, sampleEmp, sampleProd }, null, 2))
await p.$disconnect()
