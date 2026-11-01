"use server";

import { revalidatePath } from "next/cache";
import { detectTelegramChat, saveNotificationSettings } from "@/services/notification.service";
import { ERP_ORIGIN } from "@/lib/site";

function done<T extends { ok: boolean }>(result: T) {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function detectTelegramAction(token: string) {
  return done(await detectTelegramChat(token));
}

export async function saveNotificationsAction(input: {
  whatsappMode: string;
  whatsappBridgeUrl: string;
  whatsappBridgeSecret: string;
  metaPhoneNumberId: string;
  metaAccessToken: string;
}) {
  return done(await saveNotificationSettings(input));
}

export async function checkDomainAction() {
  try {
    const response = await fetch(`${ERP_ORIGIN}/api/health`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    const body = await response.text();
    if (!response.ok) return { ok: false as const, message: `الاستجابة ${response.status}` };
    return { ok: true as const, message: body.slice(0, 180) };
  } catch {
    return { ok: false as const, message: "النطاق غير متصل بعد أو الشهادة غير جاهزة" };
  }
}
