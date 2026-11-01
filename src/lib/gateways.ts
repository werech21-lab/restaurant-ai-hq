export const GATEWAY_PROVIDERS = ["MYFATOORAH", "STRIPE", "TAP"] as const;
export const PAYMENT_METHODS = ["KNET", "VISA_MASTER", "APPLE_PAY"] as const;

export const PROVIDER_LABEL: Record<string, string> = {
  MYFATOORAH: "ماي فاتورة",
  STRIPE: "سترايب",
  TAP: "تاب",
};

export const METHOD_LABEL: Record<string, string> = {
  KNET: "كي نت",
  VISA_MASTER: "فيزا / ماستركارد",
  APPLE_PAY: "أبل باي",
};

export function parseMethods(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => PAYMENT_METHODS.includes(item as (typeof PAYMENT_METHODS)[number]));
  } catch {
    return [];
  }
}

export function maskSecret(value: string) {
  if (!value) return "";
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}
