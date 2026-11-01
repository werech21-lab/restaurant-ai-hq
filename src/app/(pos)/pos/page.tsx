import { Suspense } from "react";
import { connection } from "next/server";
import { PosTerminal } from "@/app/(pos)/pos/pos-terminal";
import { requireUser } from "@/lib/erp-auth";
import { prisma } from "@/lib/db";
import { isModuleEnabled } from "@/lib/modules-db";
import { can, firstAllowedHref } from "@/lib/permissions";

export const metadata = { title: "نقطة البيع | نظام ERP" };

async function PosContent() {
  await connection();
  const user = await requireUser();
  if (!can(user, "pos", "view") && !can(user, "pos", "create")) {
    return (
      <div className="p-8 text-center">
        <p className="text-xl font-bold">ليست لديك صلاحية نقطة البيع</p>
        <a href={firstAllowedHref(user)} className="mt-4 inline-block font-semibold text-blue-700">الانتقال إلى صفحتك</a>
      </div>
    );
  }
  if (!(await isModuleEnabled("pos"))) {
    return (
      <div className="p-8 text-center">
        <p className="text-xl font-bold">نقطة البيع معطلة</p>
        <a href="/app-builder" className="mt-4 inline-block font-semibold text-blue-700">مدير التطبيقات</a>
      </div>
    );
  }
  const [products, customers, walkIn] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: "asc" },
      take: 200,
      include: { category: { select: { name: true } } },
    }),
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.customer.findFirst({ where: { name: "عميل نقدي - الصندوق" }, select: { id: true } }),
  ]);
  return (
    <PosTerminal
      walkInId={walkIn?.id ?? ""}
      customers={customers}
      products={products.map((product) => ({
        id: product.id,
        code: product.code,
        name: product.name,
        category: product.category.name,
        price: product.sellingPrice,
        stock: product.currentStock,
      }))}
    />
  );
}

export default function PosPage() {
  return (
    <Suspense fallback={<div className="p-8 font-bold">جارٍ فتح نقطة البيع...</div>}>
      <PosContent />
    </Suspense>
  );
}
