"use server";

import { revalidatePath } from "next/cache";
import { convertQuotation, markQuotationSent, moveLead, saveLead, saveQuotation } from "@/services/crm.service";

async function done<T extends { ok: boolean }>(result: T) {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function saveLeadAction(input: {
  id?: string;
  title: string;
  contactName: string;
  phone: string;
  email: string;
  expectedValue: number;
  stage: string;
  notes: string;
}) {
  return done(await saveLead(input));
}

export async function moveLeadAction(id: string, stage: string) {
  return done(await moveLead(id, stage));
}

export async function saveQuotationAction(input: {
  customerId?: string;
  leadId?: string;
  validUntil?: string;
  notes: string;
  items: Array<{ productId: string; quantity: number; price: number }>;
}) {
  return done(await saveQuotation(input));
}

export async function sendQuotationAction(id: string) {
  return done(await markQuotationSent(id));
}

export async function convertQuotationAction(id: string) {
  return done(await convertQuotation(id));
}
