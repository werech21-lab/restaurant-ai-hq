import { checkPermission } from "@/lib/erp-auth";
import { cleanText } from "@/lib/documents";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/types";

export async function listRules() {
  const rules = await prisma.automationRule.findMany({ orderBy: { createdAt: "desc" }, take: 25 });
  const suppliers = await prisma.supplier.findMany({ take: 25, select: { id: true, name: true } });
  const names = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
  return rules.map((rule) => ({ ...rule, supplierName: rule.supplierId ? names.get(rule.supplierId) ?? "" : "" }));
}

export async function saveRule(input: { name: string; trigger: string; action: string; supplierId: string }) {
  const gate = await checkPermission("automations", "create");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  const name = cleanText(input.name, 120);
  if (name.length < 2) return fail("اسم القاعدة مطلوب");
  if (input.trigger !== "STOCK_BELOW_REORDER") return fail("المحفز غير مدعوم");
  if (input.action !== "DRAFT_PURCHASE") return fail("الإجراء غير مدعوم");
  if (!input.supplierId) return fail("اختر المورد الافتراضي");
  const supplier = await prisma.supplier.findUnique({ where: { id: input.supplierId } });
  if (!supplier) return fail("المورد غير موجود");
  await prisma.automationRule.create({
    data: { name, trigger: input.trigger, action: input.action, supplierId: supplier.id, isActive: true },
  });
  await prisma.activityLog.create({
    data: {
      userId: gate.user.id,
      action: "CREATE",
      module: "automations",
      details: `قاعدة أتمتة ${name} من المورد ${supplier.name}`,
    },
  });
  return ok("تم حفظ القاعدة وستعمل عند أي حركة مخزون لاحقة");
}

export async function setRuleActive(id: string, isActive: boolean) {
  const gate = await checkPermission("automations", "edit");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  const rule = await prisma.automationRule.findUnique({ where: { id } });
  if (!rule) return fail("القاعدة غير موجودة");
  await prisma.automationRule.update({ where: { id }, data: { isActive } });
  await prisma.activityLog.create({
    data: {
      userId: gate.user.id,
      action: "EDIT",
      module: "automations",
      details: `${isActive ? "تفعيل" : "إيقاف"} القاعدة ${rule.name}`,
    },
  });
  return ok(isActive ? "تم تفعيل القاعدة" : "تم إيقاف القاعدة");
}
