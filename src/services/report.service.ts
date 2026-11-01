import { Prisma } from "@prisma/client";
import { checkPermission } from "@/lib/erp-auth";
import { toCsv } from "@/lib/csv";
import { prisma } from "@/lib/db";
import {
  MOVEMENT_LABEL,
  STATUS_LABEL,
  formatDate,
  formatMoney,
  formatMonth,
  formatQty,
  monthRange,
  movementTypeFromQuery,
} from "@/lib/format";
import { MODULES } from "@/lib/modules";
import { likeContains } from "@/lib/pagination";
import { costOfGoods, inventoryValuation, purchaseSummary, salesSummary } from "@/lib/reports";
import { countLowStock, listLowStock } from "@/lib/stock";
import { forecastLabels } from "@/services/forecast.service";
import { customerStatement, supplierStatement } from "@/services/ledger.service";

export { costOfGoods, inventoryValuation, purchaseSummary, salesSummary, countLowStock, listLowStock };

const MODULE_LABEL = Object.fromEntries(MODULES.map((item) => [item.key, item.label]));

function readSearch(search: string) {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return {
    q: (params.get("q") || "").trim(),
    tab: params.get("tab") || "",
    status: params.get("status") || "",
    filter: params.get("filter") || "",
    module: params.get("module") || params.get("filter") || "",
    id: params.get("id") || "",
  };
}

export async function listAudit(options: { q: string; module: string; skip: number; take: number }) {
  const where: Prisma.ActivityLogWhereInput = {
    ...(options.module ? { module: options.module } : {}),
    ...(options.q
      ? {
          OR: [
            { details: { contains: options.q } },
            { action: { contains: options.q } },
            { user: { name: { contains: options.q } } },
            { user: { email: { contains: options.q } } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: options.skip,
      take: options.take,
    }),
  ]);
  return { total, rows };
}

export async function listPayments(options: { q: string; skip: number; take: number }) {
  const where: Prisma.PaymentTransactionWhereInput = options.q
    ? {
        OR: [
          { reference: { contains: options.q } },
          { note: { contains: options.q } },
          { type: { contains: options.q } },
        ],
      }
    : {};
  const [total, rows, receipt, payment] = await Promise.all([
    prisma.paymentTransaction.count({ where }),
    prisma.paymentTransaction.findMany({
      where,
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: options.skip,
      take: options.take,
    }),
    prisma.paymentTransaction.aggregate({ where: { ...where, type: "RECEIPT" }, _sum: { amount: true } }),
    prisma.paymentTransaction.aggregate({ where: { ...where, type: "PAYMENT" }, _sum: { amount: true } }),
  ]);
  const partyIds = {
    customers: rows.filter((row) => row.partyType === "CUSTOMER").map((row) => row.partyId),
    suppliers: rows.filter((row) => row.partyType === "SUPPLIER").map((row) => row.partyId),
  };
  const [customers, suppliers] = await Promise.all([
    partyIds.customers.length
      ? prisma.customer.findMany({ where: { id: { in: partyIds.customers } }, select: { id: true, name: true } })
      : [],
    partyIds.suppliers.length
      ? prisma.supplier.findMany({ where: { id: { in: partyIds.suppliers } }, select: { id: true, name: true } })
      : [],
  ]);
  const names = new Map<string, string>();
  for (const row of customers) names.set(`CUSTOMER:${row.id}`, row.name);
  for (const row of suppliers) names.set(`SUPPLIER:${row.id}`, row.name);
  return {
    total,
    receipts: receipt._sum.amount ?? 0,
    payments: payment._sum.amount ?? 0,
    rows: rows.map((row) => ({
      ...row,
      partyName: names.get(`${row.partyType}:${row.partyId}`) ?? "—",
    })),
  };
}

export async function exportCsv(kind: string, search: string) {
  const query = readSearch(search);
  if (kind === "customer-statement" || kind === "supplier-statement") {
    const gate = await checkPermission(kind === "customer-statement" ? "sales" : "purchases", "view");
    if (!gate.allowed) return gate.message || "ممنوع";
    const statement = kind === "customer-statement" ? await customerStatement(query.id) : await supplierStatement(query.id);
    if (!statement) return "كشف الحساب غير موجود";
    return toCsv(
      ["التاريخ", "البيان", "المرجع", "مدين", "دائن", "الرصيد"],
      statement.lines.map((line) => [
        formatDate(line.at),
        line.kind,
        line.reference,
        line.debit ? formatMoney(line.debit) : "",
        line.credit ? formatMoney(line.credit) : "",
        formatMoney(line.balance),
      ]),
    );
  }
  if (kind === "users") {
    const gate = await checkPermission("users", "view");
    if (!gate.allowed) return gate.message || "ممنوع";
    const where = query.q
      ? { OR: [{ name: { contains: query.q } }, { email: { contains: query.q } }] }
      : {};
    const rows = await prisma.user.findMany({
      where,
      include: { role: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return toCsv(
      ["الاسم", "البريد", "الدور", "الحالة"],
      rows.map((row) => [row.name, row.email, row.role.name, row.isActive ? "نشط" : "موقوف"]),
    );
  }

  if (kind === "roles") {
    const gate = await checkPermission("roles", "view");
    if (!gate.allowed) return gate.message || "ممنوع";
    const where = query.q ? { name: { contains: query.q } } : {};
    const rows = await prisma.role.findMany({
      where,
      include: { _count: { select: { users: true } }, permissions: true },
      orderBy: { name: "asc" },
    });
    return toCsv(
      ["الدور", "الوصف", "مدير", "عدد المستخدمين", "صلاحيات العرض"],
      rows.map((row) => [
        row.name,
        row.description ?? "",
        row.isAdmin ? "نعم" : "لا",
        row._count.users,
        row.permissions
          .filter((item) => item.canView)
          .map((item) => MODULE_LABEL[item.module] ?? item.module)
          .join(" | "),
      ]),
    );
  }

  if (kind === "inventory") {
    const gate = await checkPermission("inventory", "view");
    if (!gate.allowed) return gate.message || "ممنوع";
    if (query.tab === "categories") {
      const rows = await prisma.category.findMany({
        where: query.q ? { name: { contains: query.q } } : {},
        include: { _count: { select: { products: true } } },
        orderBy: { name: "asc" },
      });
      return toCsv(
        ["القسم", "الوصف", "عدد الأصناف"],
        rows.map((row) => [row.name, row.description ?? "", row._count.products]),
      );
    }
    if (query.tab === "movements") {
      const type = movementTypeFromQuery(query.q);
      const where: Prisma.StockMovementWhereInput = query.q
        ? {
            OR: [
              { note: { contains: query.q } },
              { reference: { contains: query.q } },
              { product: { name: { contains: query.q } } },
              { product: { code: { contains: query.q } } },
              ...(type ? [{ type }] : []),
            ],
          }
        : {};
      const rows = await prisma.stockMovement.findMany({
        where,
        include: { product: true, createdBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      });
      return toCsv(
        ["التاريخ", "الصنف", "الرمز", "النوع", "الكمية", "الرصيد بعد الحركة", "المرجع", "البيان", "المستخدم"],
        rows.map((row) => [
          formatDate(row.createdAt),
          row.product.name,
          row.product.code,
          MOVEMENT_LABEL[row.type] ?? row.type,
          formatQty(row.quantity),
          formatQty(row.balanceAfter),
          row.reference ?? "",
          row.note ?? "",
          row.createdBy.name,
        ]),
      );
    }
    if (query.filter === "low_stock") {
      const like = likeContains(query.q);
      const ids = query.q
        ? await prisma.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM Product
            WHERE currentStock <= reorderLevel
              AND (name LIKE ${like} ESCAPE '\\' OR code LIKE ${like} ESCAPE '\\')
            ORDER BY name ASC
          `
        : await prisma.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM Product WHERE currentStock <= reorderLevel ORDER BY name ASC
          `;
      const rows = ids.length
        ? await prisma.product.findMany({
            where: { id: { in: ids.map((row) => row.id) } },
            include: { category: true },
          })
        : [];
      const order = new Map(ids.map((row, index) => [row.id, index]));
      rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      return await productCsv(rows);
    }
    const rows = await prisma.product.findMany({
      where: query.q ? { OR: [{ name: { contains: query.q } }, { code: { contains: query.q } }] } : {},
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });
    return await productCsv(rows);
  }

  if (kind === "purchases" || kind === "sales") {
    const gate = await checkPermission(kind, "view");
    if (!gate.allowed) return gate.message || "ممنوع";
    if (query.tab === "parties") {
      if (kind === "sales") {
        const rows = await prisma.customer.findMany({
          where: query.q
            ? { OR: [{ name: { contains: query.q } }, { phone: { contains: query.q } }, { email: { contains: query.q } }] }
            : {},
          orderBy: { name: "asc" },
        });
        return toCsv(
          ["العميل", "الهاتف", "البريد", "الرصيد"],
          rows.map((row) => [row.name, row.phone ?? "", row.email ?? "", formatMoney(row.balance)]),
        );
      }
      const rows = await prisma.supplier.findMany({
        where: query.q
          ? { OR: [{ name: { contains: query.q } }, { phone: { contains: query.q } }, { email: { contains: query.q } }] }
          : {},
        orderBy: { name: "asc" },
      });
      return toCsv(
        ["المورد", "الهاتف", "البريد", "الرصيد"],
        rows.map((row) => [row.name, row.phone ?? "", row.email ?? "", formatMoney(row.balance)]),
      );
    }
    const status = ["PAID", "PARTIAL", "UNPAID"].includes(query.status) ? query.status : "";
    if (kind === "sales") {
      const rows = await prisma.salesInvoice.findMany({
        where: {
          ...(status ? { status } : {}),
          ...(query.q
            ? { OR: [{ invoiceNumber: { contains: query.q } }, { customer: { name: { contains: query.q } } }] }
            : {}),
        },
        include: { customer: true },
        orderBy: { createdAt: "desc" },
      });
      return toCsv(
        ["الفاتورة", "العميل", "التاريخ", "قبل الخصم", "الخصم", "الصافي", "المحصّل", "الحالة"],
        rows.map((row) => [
          row.invoiceNumber,
          row.customer.name,
          formatDate(row.createdAt),
          formatMoney(row.subtotal),
          formatMoney(row.discount),
          formatMoney(row.totalAmount),
          formatMoney(row.paidAmount),
          STATUS_LABEL[row.status] ?? row.status,
        ]),
      );
    }
    const rows = await prisma.purchaseOrder.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(query.q
          ? { OR: [{ orderNumber: { contains: query.q } }, { supplier: { name: { contains: query.q } } }] }
          : {}),
      },
      include: { supplier: true },
      orderBy: { createdAt: "desc" },
    });
    return toCsv(
      ["الأمر", "المورد", "التاريخ", "الإجمالي", "المدفوع", "الحالة"],
      rows.map((row) => [
        row.orderNumber,
        row.supplier.name,
        formatDate(row.createdAt),
        formatMoney(row.totalAmount),
        formatMoney(row.paidAmount),
        STATUS_LABEL[row.status] ?? row.status,
      ]),
    );
  }

  if (kind === "reports") {
    const gate = await checkPermission("reports", "view");
    if (!gate.allowed) return gate.message || "ممنوع";
    if (query.tab === "customers" || query.tab === "suppliers") {
      const where = {
        balance: { gt: 0 },
        ...(query.q ? { OR: [{ name: { contains: query.q } }, { phone: { contains: query.q } }] } : {}),
      };
      if (query.tab === "customers") {
        const rows = await prisma.customer.findMany({ where, orderBy: { balance: "desc" } });
        return toCsv(
          ["العميل", "الهاتف", "البريد", "المديونية"],
          rows.map((row) => [row.name, row.phone ?? "", row.email ?? "", formatMoney(row.balance)]),
        );
      }
      const rows = await prisma.supplier.findMany({ where, orderBy: { balance: "desc" } });
      return toCsv(
        ["المورد", "الهاتف", "البريد", "المستحق"],
        rows.map((row) => [row.name, row.phone ?? "", row.email ?? "", formatMoney(row.balance)]),
      );
    }
    if (!query.tab || query.tab === "pnl") {
      const now = new Date();
      const { start, end } = monthRange(now);
      const [monthSales, allSales, monthCogs, allCogs] = await Promise.all([
        salesSummary(start, end),
        salesSummary(),
        costOfGoods(start, end),
        costOfGoods(),
      ]);
      const label = formatMonth(now);
      return toCsv(
        ["البيان", "القيمة"],
        [
          [`مبيعات ${label}`, formatMoney(monthSales.total)],
          [`تكلفة البضاعة ${label}`, formatMoney(monthCogs)],
          [`مجمل الربح ${label}`, formatMoney(monthSales.total - monthCogs)],
          ["إجمالي المبيعات", formatMoney(allSales.total)],
          ["إجمالي تكلفة البضاعة المباعة", formatMoney(allCogs)],
          ["مجمل الربح التراكمي", formatMoney(allSales.total - allCogs)],
        ],
      );
    }
    if (query.tab === "payments") {
      const data = await listPayments({ q: query.q, skip: 0, take: 100000 });
      return toCsv(
        ["التاريخ", "النوع", "الطرف", "الاسم", "المبلغ", "المرجع", "البيان", "المستخدم"],
        data.rows.map((row) => [
          formatDate(row.createdAt),
          row.type === "RECEIPT" ? "سند قبض" : "سند صرف",
          row.partyType === "CUSTOMER" ? "عميل" : "مورد",
          row.partyName,
          formatMoney(row.amount),
          row.reference ?? "",
          row.note ?? "",
          row.createdBy.name,
        ]),
      );
    }
    const rows = await prisma.product.findMany({
      where: query.q ? { OR: [{ name: { contains: query.q } }, { code: { contains: query.q } }] } : {},
      orderBy: { name: "asc" },
    });
    const labels = await forecastLabels(
      rows.map((row) => ({ id: row.id, currentStock: row.currentStock })),
      new Date(),
    );
    return toCsv(
      ["الصنف", "الرمز", "الكمية", "التكلفة", "البيع", "قيمة التكلفة", "قيمة البيع", "توقع النفاد"],
      rows.map((row) => [
        row.name,
        row.code,
        formatQty(row.currentStock),
        formatMoney(row.costPrice),
        formatMoney(row.sellingPrice),
        formatMoney(row.currentStock * row.costPrice),
        formatMoney(row.currentStock * row.sellingPrice),
        labels.get(row.id) ?? "",
      ]),
    );
  }

  if (kind === "audit") {
    const gate = await checkPermission("audit", "view");
    if (!gate.allowed) return gate.message || "ممنوع";
    const data = await listAudit({ q: query.q, module: query.module, skip: 0, take: 100000 });
    return toCsv(
      ["التاريخ", "الموظف", "البريد", "القسم", "الإجراء", "التفاصيل"],
      data.rows.map((row) => [
        formatDate(row.createdAt),
        row.user.name,
        row.user.email,
        MODULE_LABEL[row.module] ?? row.module,
        row.action,
        row.details,
      ]),
    );
  }

  return "التصدير غير متاح لهذا الجدول";
}

async function productCsv(
  rows: Array<{
    id: string;
    code: string;
    name: string;
    currentStock: number;
    reorderLevel: number;
    costPrice: number;
    sellingPrice: number;
    category: { name: string };
  }>,
) {
  const labels = await forecastLabels(
    rows.map((row) => ({ id: row.id, currentStock: row.currentStock })),
    new Date(),
  );
  return toCsv(
    ["الرمز", "الصنف", "القسم", "الرصيد", "حد الطلب", "التكلفة", "البيع", "الحالة", "توقع النفاد"],
    rows.map((row) => [
      row.code,
      row.name,
      row.category.name,
      formatQty(row.currentStock),
      formatQty(row.reorderLevel),
      formatMoney(row.costPrice),
      formatMoney(row.sellingPrice),
      row.currentStock <= row.reorderLevel ? "تحت حد الطلب" : "متوفر",
      labels.get(row.id) ?? "",
    ]),
  );
}
