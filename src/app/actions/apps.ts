"use server";

import { revalidatePath } from "next/cache";
import { deleteCustomField, listCustomFields, saveCustomField, setModuleEnabled } from "@/services/apps.service";

async function done<T extends { ok: boolean }>(result: T) {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function toggleModule(key: string, isEnabled: boolean) {
  return done(await setModuleEnabled(key, isEnabled));
}

export async function createCustomField(input: { entityType: string; fieldName: string; fieldType: string; options: string }) {
  return done(await saveCustomField(input));
}

export async function removeCustomField(id: string) {
  return done(await deleteCustomField(id));
}

export async function loadCustomFields(entityType: string) {
  const rows = await listCustomFields(entityType);
  return rows.map((row) => ({
    id: row.id,
    fieldName: row.fieldName,
    fieldType: row.fieldType,
    options: row.options,
  }));
}
