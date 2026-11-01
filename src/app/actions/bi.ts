"use server";

import { revalidatePath } from "next/cache";
import { runRadarActions } from "@/services/bi.service";

export async function runRadarAction() {
  const result = await runRadarActions();
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
