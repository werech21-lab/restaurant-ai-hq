export function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function round3(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

const CURRENCY_LABEL: Record<string, string> = {
  SAR: "ر.س",
  KWD: "د.ك",
  USD: "$",
};

export function formatMoney(value: number, currency = "SAR") {
  const safe = Number.isFinite(value) ? value : 0;
  const negative = safe < 0;
  const [whole, fraction] = Math.abs(safe).toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const label = CURRENCY_LABEL[currency] ?? "ر.س";
  return `${negative ? "-" : ""}${grouped}.${fraction} ${label}`;
}

export function formatQty(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  if (Number.isInteger(safe)) return String(safe);
  return safe.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatMonth(value: Date) {
  const months = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ];
  return `${months[value.getMonth()]} ${value.getFullYear()}`;
}

export function monthRange(value = new Date()) {
  const start = new Date(value.getFullYear(), value.getMonth(), 1);
  const end = new Date(value.getFullYear(), value.getMonth() + 1, 1);
  return { start, end };
}

export function dayRange(value = new Date()) {
  const start = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  ASSET: "أصول",
  LIABILITY: "خصوم",
  EQUITY: "حقوق ملكية",
  REVENUE: "إيرادات",
  EXPENSE: "مصروفات",
};

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "مسودة",
  PAID: "مدفوعة",
  PARTIAL: "مدفوعة جزئياً",
  UNPAID: "غير مدفوعة",
  PENDING: "بانتظار الدفع",
  EXPIRED: "منتهي",
  SENT: "مُرسل",
  ACCEPTED: "مقبول",
  CONVERTED: "محوّل",
};

export const MOVEMENT_LABEL: Record<string, string> = {
  OPENING: "رصيد افتتاحي",
  IN: "وارد",
  OUT: "صادر",
  TRANSFER_OUT: "تحويل صادر",
  TRANSFER_IN: "تحويل وارد",
};

export function paymentStatus(total: number, paid: number) {
  if (paid >= total - 0.001) return "PAID";
  if (paid > 0.001) return "PARTIAL";
  return "UNPAID";
}

export function movementTypeFromQuery(query: string) {
  const value = query.trim();
  const upper = value.toUpperCase();
  if (value.includes("افتتاح") || upper === "OPENING") return "OPENING";
  if (value.includes("وارد") || upper === "IN") return "IN";
  if (value.includes("تحويل صادر") || upper === "TRANSFER_OUT") return "TRANSFER_OUT";
  if (value.includes("تحويل وارد") || upper === "TRANSFER_IN") return "TRANSFER_IN";
  if (value.includes("صادر") || upper === "OUT") return "OUT";
  return "";
}

export function statusTone(status: string) {
  if (status === "PAID") return "bg-emerald-600 text-white";
  if (status === "DRAFT") return "bg-blue-600 text-white";
  if (status === "PARTIAL" || status === "PENDING") return "bg-amber-500 text-white";
  return "bg-red-600 text-white";
}
