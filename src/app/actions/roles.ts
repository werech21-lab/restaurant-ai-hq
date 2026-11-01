"use server";

import { revalidatePath } from "next/cache";
import { deleteRole as removeRole, saveRole as persistRole, type RoleInput } from "@/services/rbac.service";

export type { RoleInput };

async function done<T extends { ok: boolean }>(result: T) {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function saveRole(input: RoleInput) {
  return done(await persistRole(input));
}

export async function deleteRole(id: string) {
  return done(await removeRole(id));
}
