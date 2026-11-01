"use server";

import { revalidatePath } from "next/cache";
import { saveCompanySettings, saveOrganization, setOrganizationModules } from "@/services/saas.service";

async function done<T extends { ok: boolean }>(result: T) {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function saveOrganizationAction(input: {
  id?: string;
  name: string;
  slug: string;
  plan: string;
  currency: string;
  taxRate: number;
  taxNumber: string;
  phone: string;
  address: string;
  invoiceFooter: string;
  isDefault: boolean;
  isActive: boolean;
  subscriptionEndsAt: string;
}) {
  return done(await saveOrganization(input));
}

export async function setOrganizationModulesAction(id: string, modules: string[]) {
  return done(await setOrganizationModules(id, modules));
}

export async function saveCompanySettingsAction(input: {
  name: string;
  currency: string;
  taxRate: number;
  taxNumber: string;
  phone: string;
  address: string;
  invoiceFooter: string;
}) {
  return done(await saveCompanySettings(input));
}
