"use server";

import { revalidatePath } from "next/cache";
import * as sales from "@/services/sales.service";
import type { ActionResult, DocumentInput, PartyInput } from "@/lib/types";

async function done(result: ActionResult) {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function saveCustomer(input: PartyInput) {
  return done(await sales.saveCustomer(input));
}

export async function deleteCustomer(id: string) {
  return done(await sales.deleteCustomer(id));
}

export async function recordCustomerPayment(customerId: string, amount: number) {
  return done(await sales.recordCustomerPayment(customerId, amount));
}

export async function createSalesInvoice(input: DocumentInput) {
  const result = await sales.createSalesInvoice(input);
  if (!result.ok) return result;
  revalidatePath("/", "layout");
  return { ok: true as const, id: result.id, message: result.message ?? "تم إنشاء فاتورة البيع وخصم الكميات من المخزون" };
}
