"use server";

import { revalidatePath } from "next/cache";
import { saveRule, setRuleActive } from "@/services/automation.service";

async function done<T extends { ok: boolean }>(result: T) {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function createAutomation(input: { name: string; trigger: string; action: string; supplierId: string }) {
  return done(await saveRule(input));
}

export async function toggleAutomation(id: string, isActive: boolean) {
  return done(await setRuleActive(id, isActive));
}
