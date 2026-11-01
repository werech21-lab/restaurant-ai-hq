"use server";

import { revalidatePath } from "next/cache";
import { saveWarehouse, transferStock } from "@/services/warehouse.service";

async function done<T extends { ok: boolean }>(result: T) {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function saveWarehouseAction(input: {
  id?: string;
  name: string;
  location: string;
  managerName: string;
  isDefault: boolean;
}) {
  return done(await saveWarehouse(input));
}

export async function transferStockAction(input: {
  fromId: string;
  toId: string;
  productId: string;
  quantity: number;
  note: string;
}) {
  return done(await transferStock(input));
}
