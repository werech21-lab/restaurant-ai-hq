"use server";

import { guardAny } from "@/lib/erp-auth";
import { formatMoney, formatQty } from "@/lib/format";
import { prisma } from "@/lib/db";
import type { SearchHit } from "@/lib/types";

export async function searchRoles(query: string): Promise<SearchHit[]> {
  const gate = await guardAny(["users", "roles"]);
  if (!gate.user) return [];
  const q = query.trim();
  const rows = await prisma.role.findMany({
    where: q ? { name: { contains: q } } : {},
    orderBy: { name: "asc" },
    take: 20,
  });
  return rows.map((row) => ({
    id: row.id,
    label: row.name,
    meta: row.isAdmin ? "مدير نظام" : "دور تشغيلي",
  }));
}

export async function searchProducts(query: string): Promise<SearchHit[]> {
  const gate = await guardAny(["inventory", "purchases", "sales", "pos"]);
  if (!gate.user) return [];
  const q = query.trim();
  const rows = await prisma.product.findMany({
    where: q ? { OR: [{ name: { contains: q } }, { code: { contains: q } }] } : {},
    orderBy: { name: "asc" },
    take: 20,
    select: {
      id: true,
      name: true,
      code: true,
      costPrice: true,
      sellingPrice: true,
      currentStock: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    label: row.name,
    meta: `${row.code} • متاح ${formatQty(row.currentStock)}`,
    costPrice: row.costPrice,
    sellingPrice: row.sellingPrice,
    stock: row.currentStock,
  }));
}

export async function searchCategories(query: string): Promise<SearchHit[]> {
  const gate = await guardAny(["inventory"]);
  if (!gate.user) return [];
  const q = query.trim();
  const rows = await prisma.category.findMany({
    where: q ? { name: { contains: q } } : {},
    orderBy: { name: "asc" },
    take: 20,
  });
  return rows.map((row) => ({ id: row.id, label: row.name, meta: row.description ?? "" }));
}

export async function searchSuppliers(query: string): Promise<SearchHit[]> {
  const gate = await guardAny(["purchases"]);
  if (!gate.user) return [];
  const q = query.trim();
  const rows = await prisma.supplier.findMany({
    where: q
      ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }, { email: { contains: q } }] }
      : {},
    orderBy: { name: "asc" },
    take: 20,
  });
  return rows.map((row) => ({
    id: row.id,
    label: row.name,
    meta: `رصيد ${formatMoney(row.balance)}`,
  }));
}

export async function searchCustomers(query: string): Promise<SearchHit[]> {
  const gate = await guardAny(["sales", "pos"]);
  if (!gate.user) return [];
  const q = query.trim();
  const rows = await prisma.customer.findMany({
    where: q
      ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }, { email: { contains: q } }] }
      : {},
    orderBy: { name: "asc" },
    take: 20,
  });
  return rows.map((row) => ({
    id: row.id,
    label: row.name,
    meta: `مديونية ${formatMoney(row.balance)}`,
  }));
}
