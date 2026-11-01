"use server";

import { revalidatePath } from "next/cache";
import {
  deleteCategory as removeCategory,
  deleteProduct as removeProduct,
  saveCategory as persistCategory,
  saveProduct as persistProduct,
  type CategoryInput,
  type ProductInput,
} from "@/services/inventory.service";

async function done<T extends { ok: boolean }>(result: T) {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function saveCategory(input: CategoryInput) {
  return done(await persistCategory(input));
}

export async function deleteCategory(id: string) {
  return done(await removeCategory(id));
}

export async function saveProduct(input: ProductInput) {
  return done(await persistProduct(input));
}

export async function deleteProduct(id: string) {
  return done(await removeProduct(id));
}
