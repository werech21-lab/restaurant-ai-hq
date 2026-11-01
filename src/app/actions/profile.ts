"use server";

import { revalidatePath } from "next/cache";
import { updateProfile as persistProfile } from "@/services/rbac.service";
import type { ActionResult } from "@/lib/types";

export async function updateProfile(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const result = await persistProfile(formData);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
