import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { writeActivity } from "@/lib/activity";
import { checkPermission, requireUser } from "@/lib/erp-auth";
import { cleanEmail, cleanText } from "@/lib/documents";
import { prisma } from "@/lib/db";
import { MODULE_KEYS } from "@/lib/modules";
import { emptyPermissions, type PermissionSnapshot } from "@/lib/permissions";
import { fail, ok, type ActionResult } from "@/lib/types";

export type UserInput = {
  id?: string;
  name: string;
  email: string;
  password?: string;
  roleId: string;
  isActive: boolean;
};

export type RoleInput = {
  id?: string;
  name: string;
  description: string;
  isAdmin: boolean;
  permissions: PermissionSnapshot[];
};

async function wouldRemoveLastAdmin(userId: string, nextRoleIsAdmin: boolean, nextActive: boolean) {
  const current = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
  if (!current?.role.isAdmin || !current.isActive) return false;
  if (nextRoleIsAdmin && nextActive) return false;
  const others = await prisma.user.count({
    where: { id: { not: userId }, isActive: true, role: { isAdmin: true } },
  });
  return others === 0;
}

function normalizePermissions(rows: PermissionSnapshot[], isAdmin: boolean) {
  const byModule = new Map(rows.map((row) => [row.module, row]));
  return MODULE_KEYS.map((module) => {
    const row = byModule.get(module);
    const flags = isAdmin
      ? { canView: true, canCreate: true, canEdit: true, canDelete: true }
      : {
          canView: Boolean(row?.canView),
          canCreate: Boolean(row?.canCreate),
          canEdit: Boolean(row?.canEdit),
          canDelete: Boolean(row?.canDelete),
        };
    return { module, ...flags };
  });
}

export async function saveUser(input: UserInput): Promise<ActionResult> {
  const gate = await checkPermission("users", input.id ? "edit" : "create");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");

  const name = cleanText(input.name, 80);
  const email = cleanEmail(input.email);
  const password = String(input.password || "");
  if (name.length < 2) return fail("الاسم يجب أن يكون حرفين على الأقل");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("البريد الإلكتروني غير صالح");
  if (!input.roleId) return fail("اختر دوراً للمستخدم");
  if (!input.id && password.length < 6) return fail("كلمة المرور 6 أحرف على الأقل");
  if (input.id && password && password.length < 6) return fail("كلمة المرور 6 أحرف على الأقل");

  const role = await prisma.role.findUnique({ where: { id: input.roleId } });
  if (!role) return fail("الدور المحدد غير موجود");
  if (input.id && (await wouldRemoveLastAdmin(input.id, role.isAdmin, input.isActive))) {
    return fail("لا يمكن إيقاف آخر مدير نظام أو سحب دور الإدارة منه");
  }

  const actorId = gate.user.id;
  try {
    await prisma.$transaction(async (tx) => {
      if (!input.id) {
        await tx.user.create({
          data: {
            name,
            email,
            passwordHash: await bcrypt.hash(password, 10),
            roleId: role.id,
            isActive: input.isActive,
          },
        });
      } else {
        await tx.user.update({
          where: { id: input.id },
          data: {
            name,
            email,
            roleId: role.id,
            isActive: input.isActive,
            ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
          },
        });
      }
      await writeActivity(tx, {
        userId: actorId,
        action: input.id ? "EDIT" : "CREATE",
        module: "users",
        details: `${input.id ? "تعديل" : "إنشاء"} مستخدم ${name} بدور ${role.name}`,
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("البريد الإلكتروني مستخدم مسبقاً");
    }
    throw error;
  }
  return ok(input.id ? "تم تحديث المستخدم" : "تم إنشاء المستخدم");
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const gate = await checkPermission("users", "delete");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  if (gate.user.id === id) return fail("لا يمكنك حذف حسابك الحالي");

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return fail("المستخدم غير موجود");
  const [movements, payments, logs] = await Promise.all([
    prisma.stockMovement.count({ where: { createdById: id } }),
    prisma.paymentTransaction.count({ where: { createdById: id } }),
    prisma.activityLog.count({ where: { userId: id } }),
  ]);
  if (movements || payments || logs) {
    return fail("لا يمكن حذف مستخدم مرتبط بحركات أو سندات أو سجل رقابة. أوقف الحساب بدلاً من ذلك");
  }
  if (await wouldRemoveLastAdmin(id, false, false)) return fail("لا يمكن حذف آخر مدير نظام");
  const actorId = gate.user.id;
  await prisma.$transaction(async (tx) => {
    await tx.user.delete({ where: { id } });
    await writeActivity(tx, {
      userId: actorId,
      action: "DELETE",
      module: "users",
      details: `حذف مستخدم ${target.name}`,
    });
  });
  return ok("تم حذف المستخدم");
}

export async function saveRole(input: RoleInput): Promise<ActionResult> {
  const gate = await checkPermission("roles", input.id ? "edit" : "create");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");

  const name = cleanText(input.name, 80);
  const description = cleanText(input.description, 240);
  if (name.length < 2) return fail("اسم الدور يجب أن يكون حرفين على الأقل");

  if (input.id && !input.isAdmin) {
    const activeAdminsElsewhere = await prisma.user.count({
      where: { isActive: true, role: { isAdmin: true, id: { not: input.id } } },
    });
    const usersOnRole = await prisma.user.count({
      where: { roleId: input.id, isActive: true },
    });
    const role = await prisma.role.findUnique({ where: { id: input.id } });
    if (role?.isAdmin && usersOnRole > 0 && activeAdminsElsewhere === 0) {
      return fail("هذا الدور يحمل آخر مديري النظام، أبقِ صلاحية المدير مفعّلة");
    }
  }

  const permissions = normalizePermissions(input.permissions ?? emptyPermissions(), input.isAdmin);
  const actorId = gate.user.id;
  await prisma.$transaction(async (tx) => {
    const role = input.id
      ? await tx.role.update({
          where: { id: input.id },
          data: { name, description, isAdmin: input.isAdmin },
        })
      : await tx.role.create({
          data: { name, description, isAdmin: input.isAdmin },
        });

    for (const permission of permissions) {
      await tx.permission.upsert({
        where: { roleId_module: { roleId: role.id, module: permission.module } },
        update: permission,
        create: { roleId: role.id, ...permission },
      });
    }
    await writeActivity(tx, {
      userId: actorId,
      action: input.id ? "EDIT" : "CREATE",
      module: "roles",
      details: `${input.id ? "تعديل" : "إنشاء"} دور ${name}`,
    });
  });
  return ok(input.id ? "تم تحديث الدور وصلاحياته" : "تم إنشاء الدور");
}

export async function deleteRole(id: string): Promise<ActionResult> {
  const gate = await checkPermission("roles", "delete");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  const users = await prisma.user.count({ where: { roleId: id } });
  if (users > 0) return fail("لا يمكن حذف دور مرتبط بمستخدمين");
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) return fail("الدور غير موجود");
  if (role.isAdmin) {
    const others = await prisma.role.count({ where: { isAdmin: true, id: { not: id } } });
    if (others === 0) return fail("لا يمكن حذف دور المدير الوحيد");
  }
  const actorId = gate.user.id;
  await prisma.$transaction(async (tx) => {
    await tx.role.delete({ where: { id } });
    await writeActivity(tx, {
      userId: actorId,
      action: "DELETE",
      module: "roles",
      details: `حذف دور ${role.name}`,
    });
  });
  return ok("تم حذف الدور");
}

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const name = cleanText(formData.get("name"), 80);
  if (name.length < 2) return fail("الاسم يجب أن يكون حرفين على الأقل");

  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  const data: { name: string; passwordHash?: string } = { name };

  if (currentPassword || newPassword || confirmPassword) {
    if (newPassword.length < 6) return fail("كلمة المرور الجديدة 6 أحرف على الأقل");
    if (newPassword !== confirmPassword) return fail("تأكيد كلمة المرور غير مطابق");
    const row = await prisma.user.findUnique({ where: { id: user.id } });
    if (!row) return fail("المستخدم غير موجود");
    const matches = await bcrypt.compare(currentPassword, row.passwordHash);
    if (!matches) return fail("كلمة المرور الحالية غير صحيحة");
    data.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data });
    await writeActivity(tx, {
      userId: user.id,
      action: "EDIT",
      module: "users",
      details: data.passwordHash ? `تحديث الملف الشخصي وكلمة المرور لـ ${name}` : `تحديث الاسم إلى ${name}`,
    });
  });
  return ok("تم حفظ بيانات الملف الشخصي");
}
