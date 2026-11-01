import { checkPermission } from "@/lib/erp-auth";
import { cleanText } from "@/lib/documents";
import { prisma } from "@/lib/db";
import { MODULES } from "@/lib/modules";
import { fail, ok } from "@/lib/types";
import { modulesForPlan, parseModules } from "@/lib/plans";

const PLANS = ["STARTER", "PRO", "ENTERPRISE"] as const;
const CURRENCIES = ["KWD", "SAR", "USD"] as const;

function slugify(value: string) {
  const latin = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  return latin || `org-${Date.now().toString(36)}`;
}

export async function listOrganizations(skip: number, take: number, q: string) {
  const where = q ? { OR: [{ name: { contains: q } }, { slug: { contains: q } }, { taxNumber: { contains: q } }] } : {};
  const [rows, total] = await Promise.all([
    prisma.organization.findMany({ where, skip, take, orderBy: [{ isDefault: "desc" }, { name: "asc" }] }),
    prisma.organization.count({ where }),
  ]);
  return { rows, total };
}

export async function saveOrganization(input: {
  id?: string;
  name: string;
  slug: string;
  plan: string;
  currency: string;
  taxRate: number;
  taxNumber: string;
  phone: string;
  address: string;
  invoiceFooter: string;
  isDefault: boolean;
  isActive: boolean;
  subscriptionEndsAt: string;
}) {
  const gate = await checkPermission("saas", input.id ? "edit" : "create");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  const name = cleanText(input.name, 140);
  if (name.length < 2) return fail("اسم الشركة مطلوب");
  const plan = (PLANS as readonly string[]).includes(input.plan) ? input.plan : "STARTER";
  const currency = (CURRENCIES as readonly string[]).includes(input.currency) ? input.currency : "SAR";
  const slug = slugify(input.slug || name);
  const taxRate = Number(input.taxRate);
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) return fail("نسبة الضريبة بين 0 و 100");
  const data = {
    name,
    slug,
    plan,
    currency,
    taxRate,
    taxNumber: cleanText(input.taxNumber, 40),
    phone: cleanText(input.phone, 30),
    address: cleanText(input.address, 200),
    invoiceFooter: cleanText(input.invoiceFooter, 240),
    isActive: input.isActive,
    subscriptionEndsAt: input.subscriptionEndsAt ? new Date(input.subscriptionEndsAt) : null,
    enabledModules: JSON.stringify(modulesForPlan(plan)),
  };
  await prisma.$transaction(async (tx) => {
    if (input.isDefault) await tx.organization.updateMany({ data: { isDefault: false } });
    if (input.id) {
      const current = await tx.organization.findUnique({ where: { id: input.id } });
      if (!current) return;
      await tx.organization.update({
        where: { id: input.id },
        data: {
          ...data,
          enabledModules: current.plan === plan ? current.enabledModules : data.enabledModules,
          isDefault: input.isDefault || current.isDefault,
        },
      });
    } else {
      const count = await tx.organization.count();
      await tx.organization.create({ data: { ...data, isDefault: input.isDefault || count === 0 } });
    }
    await tx.activityLog.create({
      data: {
        userId: gate.user!.id,
        action: input.id ? "EDIT" : "CREATE",
        module: "saas",
        details: `${input.id ? "تعديل" : "إنشاء"} شركة ${name} على باقة ${plan}`,
      },
    });
  });
  return ok("تم حفظ الشركة");
}

export async function setOrganizationModules(id: string, modules: string[]) {
  const gate = await checkPermission("saas", "edit");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  const allowed = new Set(MODULES.map((item) => item.key));
  const next = modules.filter((item) => allowed.has(item as (typeof MODULES)[number]["key"]));
  if (!next.includes("dashboard")) next.push("dashboard");
  await prisma.organization.update({ where: { id }, data: { enabledModules: JSON.stringify(next) } });
  await prisma.activityLog.create({
    data: { userId: gate.user.id, action: "EDIT", module: "saas", details: "تحديث وحدات الباقة للشركة" },
  });
  return ok("تم تحديث وحدات الباقة");
}

export async function saveCompanySettings(input: {
  name: string;
  currency: string;
  taxRate: number;
  taxNumber: string;
  phone: string;
  address: string;
  invoiceFooter: string;
}) {
  const gate = await checkPermission("saas", "edit");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  const org = (await prisma.organization.findFirst({ where: { isDefault: true } })) ?? (await prisma.organization.findFirst());
  if (!org) return fail("لا توجد شركة افتراضية. أنشئها من لوحة المنصة");
  const currency = (CURRENCIES as readonly string[]).includes(input.currency) ? input.currency : org.currency;
  const taxRate = Number(input.taxRate);
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) return fail("نسبة الضريبة بين 0 و 100");
  await prisma.organization.update({
    where: { id: org.id },
    data: {
      name: cleanText(input.name, 140) || org.name,
      currency,
      taxRate,
      taxNumber: cleanText(input.taxNumber, 40),
      phone: cleanText(input.phone, 30),
      address: cleanText(input.address, 200),
      invoiceFooter: cleanText(input.invoiceFooter, 240),
    },
  });
  await prisma.activityLog.create({
    data: { userId: gate.user.id, action: "EDIT", module: "saas", details: `تحديث إعدادات ${org.name}` },
  });
  return ok("تم حفظ إعدادات الشركة والعملة والضريبة");
}

export function describePlan(plan: string) {
  const modules = modulesForPlan(plan);
  return { plan, modules, count: modules.length };
}

export { parseModules };
