import { writeActivity } from "@/lib/activity";
import { checkPermission } from "@/lib/erp-auth";
import { cleanText } from "@/lib/documents";
import { prisma } from "@/lib/db";
import { LOCKED_MODULES, MODULES } from "@/lib/modules";
import { fail, ok } from "@/lib/types";

const ENTITIES = ["PRODUCT", "CUSTOMER", "SUPPLIER", "INVOICE"] as const;
const FIELD_TYPES = ["TEXT", "NUMBER", "DATE", "SELECT"] as const;

export async function listAppModules() {
  const rows = await prisma.appModule.findMany({ orderBy: { name: "asc" } });
  if (rows.length > 0) return rows;
  return MODULES.map((item) => ({
    id: item.key,
    key: item.key,
    name: item.label,
    description: item.label,
    isEnabled: true,
  }));
}

export async function setModuleEnabled(key: string, isEnabled: boolean) {
  const gate = await checkPermission("app-builder", "edit");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  if (!isEnabled && (LOCKED_MODULES as readonly string[]).includes(key)) {
    return fail("لا يمكن تعطيل هذه الوحدة حتى لا يُقفل الدخول إلى النظام");
  }
  const row = await prisma.appModule.findUnique({ where: { key } });
  if (!row) return fail("الوحدة غير معرّفة. أعد تشغيل التغذية أولاً");
  await prisma.appModule.update({ where: { key }, data: { isEnabled } });
  await prisma.activityLog.create({
    data: {
      userId: gate.user.id,
      action: "EDIT",
      module: "app-builder",
      details: `${isEnabled ? "تفعيل" : "تعطيل"} وحدة ${row.name}`,
    },
  });
  return ok(isEnabled ? "تم تفعيل الوحدة" : "تم تعطيل الوحدة");
}

export async function listCustomFields(entityType?: string) {
  return prisma.customFieldDefinition.findMany({
    where: entityType ? { entityType, isActive: true } : undefined,
    orderBy: [{ entityType: "asc" }, { fieldName: "asc" }],
  });
}

export async function saveCustomField(input: { entityType: string; fieldName: string; fieldType: string; options: string }) {
  const gate = await checkPermission("app-builder", "create");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  if (!(ENTITIES as readonly string[]).includes(input.entityType)) return fail("نوع الكيان غير مدعوم");
  if (!(FIELD_TYPES as readonly string[]).includes(input.fieldType)) return fail("نوع الحقل غير مدعوم");
  const fieldName = cleanText(input.fieldName, 80);
  if (fieldName.length < 2) return fail("اسم الحقل مطلوب");
  const options = input.fieldType === "SELECT" ? cleanText(input.options, 300) : "";
  if (input.fieldType === "SELECT" && !options) return fail("أدخل خيارات القائمة مفصولة بفاصلة");
  const existing = await prisma.customFieldDefinition.findUnique({
    where: { entityType_fieldName: { entityType: input.entityType, fieldName } },
  });
  if (existing) return fail("هذا الحقل موجود مسبقاً لنفس الكيان");
  await prisma.customFieldDefinition.create({
    data: { entityType: input.entityType, fieldName, fieldType: input.fieldType, options, isActive: true },
  });
  await prisma.activityLog.create({
    data: {
      userId: gate.user.id,
      action: "CREATE",
      module: "app-builder",
      details: `حقل مخصص ${fieldName} على ${input.entityType}`,
    },
  });
  return ok("تم إضافة الحقل وسيظهر في النماذج والجداول");
}

export async function deleteCustomField(id: string) {
  const gate = await checkPermission("app-builder", "delete");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  const row = await prisma.customFieldDefinition.findUnique({ where: { id } });
  if (!row) return fail("الحقل غير موجود");
  await prisma.customFieldDefinition.delete({ where: { id } });
  await prisma.activityLog.create({
    data: {
      userId: gate.user.id,
      action: "DELETE",
      module: "app-builder",
      details: `حذف الحقل المخصص ${row.fieldName}`,
    },
  });
  return ok("تم حذف الحقل");
}
