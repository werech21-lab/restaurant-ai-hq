import { getCurrentUser } from "@/lib/erp-auth";
import { prisma } from "@/lib/db";

function sqlValue(value: unknown) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof Date) return `'${value.toISOString()}'`;
  return `'${String(value).replaceAll("'", "''")}'`;
}

function inserts(table: string, rows: Array<Record<string, unknown>>) {
  return rows
    .map((row) => {
      const keys = Object.keys(row);
      const values = keys.map((key) => sqlValue(row[key]));
      return `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${values.join(", ")});`;
    })
    .join("\n");
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.role.isAdmin) {
    return Response.json({ ok: false, message: "النسخة الاحتياطية متاحة لمدير النظام فقط" }, { status: 401 });
  }
  const [products, customers, suppliers, invoices, organizations] = await Promise.all([
    prisma.product.findMany({ select: { code: true, name: true, currentStock: true, costPrice: true, sellingPrice: true }, take: 500 }),
    prisma.customer.findMany({ select: { name: true, phone: true, email: true, balance: true }, take: 500 }),
    prisma.supplier.findMany({ select: { name: true, phone: true, email: true, balance: true }, take: 500 }),
    prisma.salesInvoice.findMany({ select: { invoiceNumber: true, totalAmount: true, paidAmount: true, status: true, createdAt: true }, take: 500 }),
    prisma.organization.findMany({ select: { name: true, slug: true, plan: true, currency: true, taxRate: true, isActive: true }, take: 50 }),
  ]);
  const tables = { products, customers, suppliers, invoices, organizations };
  const sql = [
    "-- AetherBI Enterprise ERP portable backup",
    "-- excludes passwords and gateway secrets",
    inserts("ProductExport", products),
    inserts("CustomerExport", customers),
    inserts("SupplierExport", suppliers),
    inserts("InvoiceExport", invoices),
    inserts("OrganizationExport", organizations),
  ].join("\n");
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), tables, sql }, null, 2);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="aetherbi-backup.json"',
    },
  });
}
