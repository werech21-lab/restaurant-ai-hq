"use server";

import { revalidatePath } from "next/cache";
import {
  checkoutPaymentLink,
  createInvoicePayLink,
  createSubscriptionPayLink,
  saveGatewayConfig,
} from "@/services/payment-gateway.service";

function done<T extends { ok: boolean }>(result: T) {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function saveGatewayAction(input: {
  provider: string;
  apiKey: string;
  webhookSecret: string;
  isTestMode: boolean;
  isActive: boolean;
  supportedMethods: string[];
}) {
  return done(await saveGatewayConfig(input));
}

export async function createInvoicePayLinkAction(invoiceId: string) {
  return done(await createInvoicePayLink({ invoiceId }));
}

export async function createInvoicePayLinkByNumberAction(invoiceNumber: string) {
  return done(await createInvoicePayLink({ invoiceNumber }));
}

export async function createSubscriptionPayLinkAction(organizationId: string, amount: number) {
  return done(await createSubscriptionPayLink(organizationId, amount));
}

export async function checkoutPaymentAction(token: string, method: string) {
  return done(await checkoutPaymentLink(token, method));
}
