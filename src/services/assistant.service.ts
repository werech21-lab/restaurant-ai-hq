import { requireUser } from "@/lib/erp-auth";
import { prisma } from "@/lib/db";
import { dayRange, formatMoney, formatMonth, formatQty, monthRange } from "@/lib/format";
import { can } from "@/lib/permissions";
import { costOfGoods, salesSummary, purchaseSummary } from "@/lib/reports";
import { forecastLabels } from "@/services/forecast.service";
import { countLowStock, listLowStock } from "@/lib/stock";

export type AssistantReply = {
  title: string;
  summary: string;
  columns?: string[];
  rows?: string[][];
};

function normalize(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[؟?]/g, "")
    .replace(/\s+/g, " ");
}

function has(text: string, ...needles: string[]) {
  return needles.some((needle) => text.includes(needle));
}

function denied(): AssistantReply {
  return { title: "صلاحية غير كافية", summary: "ليست لديك صلاحية للاطلاع على هذه البيانات." };
}

export async function answerQuestion(question: string): Promise<AssistantReply> {
  const user = await requireUser();
  const text = normalize(question);
  if (!text) {
    return {
      title: "المساعد الذكي",
      summary: "اكتب سؤالاً بالعربية، مثل: كم مبيعات اليوم؟ أو ما هي الأصناف الناقصة؟",
    };
  }

  const allow = (...modules: string[]) => modules.some((module) => can(user, module, "view"));
  const now = new Date();

  if (text.includes("مساعد") || text === "مساعده" || text.includes("ماذا تستطيع") || text.includes("الاوامر")) {
    return {
      title: "أوامر أفهمها",
      summary: "أحلّل قاعدة البيانات المحلية مباشرة، من غير اتصال خارجي.",
      columns: ["مثال"],
      rows: [
        ["كم مبيعات اليوم؟"],
        ["كم مبيعات الشهر؟"],
        ["كم مشتريات الشهر؟"],
        ["ما مجمل ربح الشهر؟"],
        ["ما هي الأصناف الناقصة؟"],
        ["متى ينفد المخزون؟"],
        ["من هم أكثر العملاء مديونية؟"],
        ["من هم أكثر الموردين استحقاقاً؟"],
        ["ما الفرص البيعية المفتوحة؟"],
        ["كم صافي الرواتب؟"],
        ["ما روابط الدفع المعلقة؟"],
      ],
    };
  }

  if (text.includes("ينفد") || text.includes("توقع") || text.includes("نفاد")) {
    if (!allow("inventory", "reports", "dashboard")) return denied();
    const products = await prisma.product.findMany({
      where: { currentStock: { gt: 0 } },
      select: { id: true, code: true, name: true, currentStock: true },
    });
    const labels = await forecastLabels(products, now);
    const soon = products
      .map((product) => {
        const label = labels.get(product.id) ?? "";
        const match = label.match(/خلال (\d+)/);
        return { product, label, days: match ? Number(match[1]) : 9999 };
      })
      .filter((item) => item.label.includes("خلال"))
      .sort((a, b) => a.days - b.days)
      .slice(0, 8);
    return {
      title: "توقع نفاد المخزون",
      summary: "يُحسب من مجموع حركات الصادر مقسوماً على الأيام منذ أول حركة صادر.",
      columns: ["الصنف", "الرمز", "الرصيد", "التوقع"],
      rows: soon.map((item) => [item.product.name, item.product.code, formatQty(item.product.currentStock), item.label]),
    };
  }

  if (has(text, "ناقص", "حد الطلب", "منخفض") && has(text, "صنف", "اصناف", "مخزون")) {
    if (!allow("inventory", "reports", "dashboard")) return denied();
    const [count, items] = await Promise.all([countLowStock(), listLowStock(8)]);
    return {
      title: "أصناف تحت حد الطلب",
      summary: count === 0 ? "لا توجد أصناف تحت حد الطلب." : `عدد الأصناف الناقصة ${count}.`,
      columns: ["الصنف", "الرمز", "الرصيد", "حد الطلب"],
      rows: items.map((item) => [item.name, item.code, formatQty(item.currentStock), formatQty(item.reorderLevel)]),
    };
  }

  if (has(text, "عميل", "عملاء") && has(text, "مديون", "اكثر", "اعلى", "ديون")) {
    if (!allow("sales", "reports", "dashboard")) return denied();
    const rows = await prisma.customer.findMany({
      where: { balance: { gt: 0 } },
      orderBy: { balance: "desc" },
      take: 8,
    });
    const total = rows.reduce((sum, row) => sum + row.balance, 0);
    return {
      title: "أكثر العملاء مديونية",
      summary: rows.length === 0 ? "لا توجد مديونيات على العملاء." : `أعلى الأرصدة الظاهرة مجموعها ${formatMoney(total)}.`,
      columns: ["العميل", "الهاتف", "المديونية"],
      rows: rows.map((row) => [row.name, row.phone || "—", formatMoney(row.balance)]),
    };
  }

  if (has(text, "مورد", "موردين") && has(text, "مستحق", "اكثر", "اعلى", "ديون", "مديون")) {
    if (!allow("purchases", "reports", "dashboard")) return denied();
    const rows = await prisma.supplier.findMany({
      where: { balance: { gt: 0 } },
      orderBy: { balance: "desc" },
      take: 8,
    });
    return {
      title: "أكثر الموردين استحقاقاً",
      summary: rows.length === 0 ? "لا توجد أرصدة مستحقة للموردين." : "مرتبة حسب الرصيد المستحق تنازلياً.",
      columns: ["المورد", "الهاتف", "المستحق"],
      rows: rows.map((row) => [row.name, row.phone || "—", formatMoney(row.balance)]),
    };
  }

  if (text.includes("ربح") || text.includes("خسار")) {
    if (!allow("reports", "dashboard", "sales")) return denied();
    const { start, end } = monthRange(now);
    const [sales, cogs] = await Promise.all([salesSummary(start, end), costOfGoods(start, end)]);
    const profit = sales.total - cogs;
    return {
      title: `مجمل ربح ${formatMonth(now)}`,
      summary: `${formatMoney(profit)} = مبيعات ${formatMoney(sales.total)} − تكلفة البضاعة ${formatMoney(cogs)}.`,
      columns: ["البيان", "القيمة"],
      rows: [
        ["المبيعات", formatMoney(sales.total)],
        ["تكلفة البضاعة المباعة", formatMoney(cogs)],
        ["مجمل الربح", formatMoney(profit)],
      ],
    };
  }

  if (text.includes("مبيعات")) {
    if (!allow("sales", "reports", "dashboard")) return denied();
    const today = text.includes("اليوم");
    const range = today ? dayRange(now) : monthRange(now);
    const summary = await salesSummary(range.start, range.end);
    const month = today ? null : summary;
    const extra = today ? await salesSummary(monthRange(now).start, monthRange(now).end) : null;
    return {
      title: today ? "مبيعات اليوم" : `مبيعات ${formatMonth(now)}`,
      summary: today
        ? `مبيعات اليوم ${formatMoney(summary.total)} من ${summary.count} فاتورة. مبيعات الشهر ${formatMoney(extra?.total ?? 0)}.`
        : `إجمالي المبيعات ${formatMoney(summary.total)} من ${summary.count} فاتورة.`,
      columns: ["البيان", "القيمة"],
      rows: [
        [today ? "مبيعات اليوم" : `مبيعات ${formatMonth(now)}`, formatMoney(summary.total)],
        ["عدد الفواتير", String(summary.count)],
        ...(month ? [] : extra ? [[`مبيعات ${formatMonth(now)}`, formatMoney(extra.total)]] : []),
      ],
    };
  }

  if (text.includes("مشتريات")) {
    if (!allow("purchases", "reports", "dashboard")) return denied();
    const today = text.includes("اليوم");
    const range = today ? dayRange(now) : monthRange(now);
    const summary = await purchaseSummary(range.start, range.end);
    return {
      title: today ? "مشتريات اليوم" : `مشتريات ${formatMonth(now)}`,
      summary: `الإجمالي ${formatMoney(summary.total)} من ${summary.count} أمر شراء.`,
      columns: ["البيان", "القيمة"],
      rows: [
        ["الإجمالي", formatMoney(summary.total)],
        ["عدد الأوامر", String(summary.count)],
      ],
    };
  }

  if (text.includes("فاتور")) {
    if (!allow("sales", "reports", "dashboard")) return denied();
    const { start, end } = monthRange(now);
    const summary = await salesSummary(start, end);
    return {
      title: "فواتير البيع",
      summary: `فواتير ${formatMonth(now)}: ${summary.count} بإجمالي ${formatMoney(summary.total)}.`,
    };
  }

  const customerName = text.match(/(?:رصيد|مديونيه|حساب) العميل (.+)/)?.[1]?.trim();
  if (customerName) {
    if (!allow("sales", "reports", "dashboard")) return denied();
    const rows = await prisma.customer.findMany({
      where: { name: { contains: customerName } },
      take: 5,
    });
    return {
      title: "رصيد العميل",
      summary: rows.length === 0 ? "لم أجد عميلاً بهذا الاسم." : `نتائج مطابقة لـ ${customerName}.`,
      columns: ["العميل", "المديونية"],
      rows: rows.map((row) => [row.name, formatMoney(row.balance)]),
    };
  }

  const productName = text.match(/(?:مخزون|كميه)(?: الصنف)? (.+)/)?.[1]?.trim();
  if (productName) {
    if (!allow("inventory", "reports", "dashboard")) return denied();
    const rows = await prisma.product.findMany({
      where: { OR: [{ name: { contains: productName } }, { code: { contains: productName } }] },
      take: 5,
    });
    const labels = await forecastLabels(rows, now);
    return {
      title: "رصيد الصنف",
      summary: rows.length === 0 ? "لم أجد صنفاً بهذا الاسم أو الرمز." : `نتائج مطابقة لـ ${productName}.`,
      columns: ["الصنف", "الرمز", "الرصيد", "التوقع"],
      rows: rows.map((row) => [row.name, row.code, formatQty(row.currentStock), labels.get(row.id) ?? "—"]),
    };
  }

  if (has(text, "فرص", "فرصه", "عملاء محتمل")) {
    if (!allow("crm", "dashboard")) return denied();
    const rows = await prisma.lead.findMany({
      where: { stage: { in: ["NEW", "QUALIFIED", "PROPOSAL"] } },
      orderBy: { expectedValue: "desc" },
      take: 8,
    });
    const total = rows.reduce((sum, row) => sum + row.expectedValue, 0);
    return {
      title: "الفرص البيعية المفتوحة",
      summary: rows.length === 0 ? "لا توجد فرص مفتوحة." : `قيمتها المتوقعة ${formatMoney(total)}.`,
      columns: ["الفرصة", "الجهة", "المرحلة", "القيمة"],
      rows: rows.map((row) => [row.title, row.contactName, row.stage, formatMoney(row.expectedValue)]),
    };
  }

  if (has(text, "راتب", "رواتب", "مسير")) {
    if (!allow("hr", "dashboard")) return denied();
    const rows = await prisma.payroll.findMany({
      where: { status: "DRAFT" },
      include: { employee: { select: { name: true } } },
      take: 12,
    });
    const total = rows.reduce((sum, row) => sum + row.netSalary, 0);
    return {
      title: "رواتب لم تُصرف",
      summary: rows.length === 0 ? "لا توجد مسودات رواتب." : `صافي المسودات ${formatMoney(total)}.`,
      columns: ["الموظف", "الشهر", "الصافي"],
      rows: rows.map((row) => [row.employee.name, `${row.month}/${row.year}`, formatMoney(row.netSalary)]),
    };
  }

  if (has(text, "دفع", "روابط الدفع", "كي نت")) {
    if (!allow("payments", "sales", "dashboard")) return denied();
    const rows = await prisma.paymentLink.findMany({
      where: { status: "PENDING" },
      include: { invoice: { select: { invoiceNumber: true } }, organization: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    });
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    return {
      title: "روابط دفع بانتظار التحصيل",
      summary: rows.length === 0 ? "لا توجد روابط معلّقة." : `عددها ${rows.length} ومجموعها ${formatMoney(total)}.`,
      columns: ["البيان", "المبلغ", "العملة"],
      rows: rows.map((row) => [row.invoice?.invoiceNumber ?? row.organization?.name ?? "رابط", formatMoney(row.amount, row.currency), row.currency]),
    };
  }

  if (has(text, "موظف", "حضور")) {
    if (!allow("hr")) return denied();
    const rows = await prisma.employee.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, take: 8 });
    return {
      title: "الموظفون النشطون",
      summary: `عدد الملفات الظاهرة ${rows.length}.`,
      columns: ["الموظف", "القسم", "الأساسي"],
      rows: rows.map((row) => [row.name, row.department, formatMoney(row.basicSalary)]),
    };
  }

  return {
    title: "لم أفهم الطلب",
    summary: "جرّب: كم مبيعات اليوم؟ ما هي الأصناف الناقصة؟ ما الفرص البيعية المفتوحة؟ كم صافي الرواتب؟ ما روابط الدفع المعلقة؟",
  };
}
