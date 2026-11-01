"use server";

import { revalidatePath } from "next/cache";
import * as purchases from "@/services/purchases.service";
import type { DocumentInput, PartyInput } from "@/lib/types";

async function done<T extends { ok: boolean }>(result: T) {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function saveSupplier(input: PartyInput) {
  return done(await purchases.saveSupplier(input));
}

export async function deleteSupplier(id: string) {
  return done(await purchases.deleteSupplier(id));
}

export async function recordSupplierPayment(supplierId: string, amount: number) {
  return done(await purchases.recordSupplierPayment(supplierId, amount));
}

export async function createPurchaseOrder(input: DocumentInput) {
  const result = await purchases.createPurchaseOrder(input);
  if (!result.ok) return result;
  revalidatePath("/", "layout");
  return { ok: true as const, message: result.message ?? "تم إنشاء أمر الشراء وتحديث المخزون" };
}

export async function confirmDraftPurchase(id: string) {
  return done(await purchases.confirmDraftPurchase(id));
}
