"use server";

import { revalidatePath } from "next/cache";
import { deleteUser as removeUser, saveUser as persistUser, type UserInput } from "@/services/rbac.service";

export type { UserInput };

async function done<T extends { ok: boolean }>(result: T) {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function saveUser(input: UserInput) {
  return done(await persistUser(input));
}

export async function deleteUser(id: string) {
  return done(await removeUser(id));
}
