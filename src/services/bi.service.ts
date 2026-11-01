import { writeActivity } from "@/lib/activity";
import { checkPermission } from "@/lib/erp-auth";
import { prisma } from "@/lib/db";
import { monthRange, round2 } from "@/lib/format";
import { fail, type ActionResult } from "@/lib/types";
import { runLowStockRules } from "@/services/automation.engine";
import { stockoutLabel } from "@/services/forecast.service";

const DAY = 24 * 60 * 60 * 1000;

export async function executiveInsights(now = new Date()) {
  const current = monthRange(now);
  const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previous = monthRange(previousDate);
  const [thisSales, prevSales, thisCogs, prevCogs] = await Promise.all([
    prisma.salesInvoice.aggregate({ where: { createdAt: { gte: current.start, lt: current.end } }, _sum: { totalAmount: true } }),
    prisma.salesInvoice.aggregate({ where: { createdAt: { gte: previous.start, lt: previous.end } }, _sum: { totalAmount: true } }),
    cogsBetween(current.start, current.end),
    cogsBetween(previous.start, previous.end),
  ]);
  const salesNow = thisSales._sum.totalAmount ?? 0;
  const salesPrev = prevSales._sum.totalAmount ?? 0;
  const growth = salesPrev <= 0.001 ? (salesNow > 0 ? 100 : 0) : round2(((salesNow - salesPrev) / salesPrev) * 100);
  const marginNow = salesNow <= 0.001 ? 0 : round2(((salesNow - thisCogs) / salesNow) * 100);

  const margins = await prisma.$queryRaw<Array<{ name: string; sales: number | bigint | null; cogs: number | bigint | null }>>`
    SELECT c.name as name,
           SUM(i.quantity * i.unitPrice) as sales,
           SUM(i.quantity * p.costPrice) as cogs
    FROM SalesInvoiceItem i
    JOIN Product p ON p.id = i.productId
    JOIN Category c ON c.id = p.categoryId
    JOIN SalesInvoice s ON s.id = i.salesInvoiceId
    WHERE s.createdAt >= ${current.start} AND s.createdAt < ${current.end}
    GROUP BY c.name
    ORDER BY sales DESC
  `;

  const since = new Date(now.getTime() - 30 * DAY);
  const [cashAccounts, receipts, payments] = await Promise.all([
    prisma.account.findMany({ where: { code: { in: ["1100", "1200"] } } }),
    prisma.paymentTransaction.aggregate({ where: { type: "RECEIPT", createdAt: { gte: since } }, _sum: { amount: true } }),
    prisma.paymentTransaction.aggregate({ where: { type: "PAYMENT", createdAt: { gte: since } }, _sum: { amount: true } }),
  ]);
  const cash = round2(cashAccounts.reduce((sum, account) => sum + account.balance, 0));
  const inflow = receipts._sum.amount ?? 0;
  const outflow = payments._sum.amount ?? 0;
  const net30 = round2(inflow - outflow);
  const weekly = round2(net30 / 4);
  const weeks = [1, 2, 3, 4].map((week) => ({ week, cash: round2(cash + weekly * week) }));

  const cutoff = new Date(now.getTime() - 90 * DAY);
  const lateCutoff = new Date(now.getTime() - 30 * DAY);
  const [moved, stocked, lateInvoices, products] = await Promise.all([
    prisma.stockMovement.findMany({
      where: { type: "OUT", createdAt: { gte: cutoff } },
      select: { productId: true },
      distinct: ["productId"],
    }),
    prisma.product.findMany({
      where: { currentStock: { gt: 0 } },
      select: { id: true, name: true, code: true, currentStock: true, reorderLevel: true },
      take: 200,
    }),
    prisma.salesInvoice.findMany({
      where: { status: { in: ["UNPAID", "PARTIAL"] }, createdAt: { lt: lateCutoff } },
      include: { customer: { select: { id: true, name: true, balance: true } } },
      orderBy: { createdAt: "asc" },
      take: 20,
    }),
    prisma.product.findMany({
      where: { currentStock: { gt: 0 } },
      select: { id: true, name: true, code: true, currentStock: true },
      take: 80,
    }),
  ]);
  const movedIds = new Set(moved.map((row) => row.productId));
  const dead = stocked.filter((product) => !movedIds.has(product.id)).slice(0, 8);
  const lateMap = new Map<string, { name: string; balance: number }>();
  for (const invoice of lateInvoices) {
    if (invoice.customer.balance <= 0.001 || lateMap.has(invoice.customer.id)) continue;
    lateMap.set(invoice.customer.id, { name: invoice.customer.name, balance: invoice.customer.balance });
  }
  const groups = await prisma.stockMovement.groupBy({
    by: ["productId"],
    where: { type: "OUT", productId: { in: products.map((product) => product.id) } },
    _sum: { quantity: true },
    _min: { createdAt: true },
  });
  const byId = new Map(groups.map((group) => [group.productId, group]));
  const soon = products
    .map((product) => {
      const group = byId.get(product.id);
      const label = stockoutLabel(product.currentStock, group?._sum.quantity ?? 0, group?._min.createdAt ?? null, now);
      const days = Number(label.match(/خلال (\d+) يوم/)?.[1] ?? 9999);
      return { ...product, label, days };
    })
    .filter((product) => product.days <= 14)
    .slice(0, 8);

  return {
    salesNow: round2(salesNow),
    salesPrev: round2(salesPrev),
    growth,
    marginNow,
    margins: margins.map((row) => {
      const sales = Number(row.sales ?? 0);
      const cogs = Number(row.cogs ?? 0);
      return { name: row.name, sales: round2(sales), margin: sales <= 0.001 ? 0 : round2(((sales - cogs) / sales) * 100) };
    }),
    cash,
    net30,
    weeks,
    dead,
    late: [...lateMap.values()].slice(0, 8),
    soon,
  };
}

async function cogsBetween(start: Date, end: Date) {
  const rows = await prisma.$queryRaw<Array<{ cogs: number | bigint | null }>>`
    SELECT SUM(i.quantity * p.costPrice) as cogs
    FROM SalesInvoiceItem i
    JOIN Product p ON p.id = i.productId
    JOIN SalesInvoice s ON s.id = i.salesInvoiceId
    WHERE s.createdAt >= ${start} AND s.createdAt < ${end}
  `;
  return Number(rows[0]?.cogs ?? 0);
}

export async function runRadarActions(): Promise<ActionResult> {
  const gate = await checkPermission("reports", "edit");
  const admin = gate.allowed && gate.user ? gate : await checkPermission("automations", "edit");
  if (!admin.allowed || !admin.user) return fail("تنفيذ الإجراء الآلي متاح للمدير");
  const userId = admin.user.id;
  const insights = await executiveInsights();
  const targets = [...insights.dead.map((item) => item.id), ...insights.soon.map((item) => item.id)];
  await prisma.$transaction(async (tx) => {
    for (const productId of targets) await runLowStockRules(tx, productId, userId);
    if (insights.late.length > 0) {
      await tx.systemNotification.create({
        data: {
          title: "عملاء متأخرون في السداد",
          body: insights.late.map((row) => row.name).join("، "),
          href: "/sales?tab=parties",
        },
      });
    }
    await writeActivity(tx, {
      userId,
      action: "AUTO",
      module: "reports",
      details: `رادار AetherBI: ${targets.length} صنفاً و${insights.late.length} عميلاً`,
    });
  });
  return { ok: true, message: "أُنشئت مسودات إعادة الطلب وتنبيه المتأخرين" };
}
