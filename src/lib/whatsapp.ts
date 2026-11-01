import { ERP_ORIGIN } from "@/lib/site";

/** Normalize phone digits for Kuwait (+965). Legacy 05… Saudi patterns map to Kuwait when 8 local digits. */
export function phoneDigits(phone: string) {
  let digits = phone.replace(/[^\d]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("965")) return digits;
  // Kuwait mobile: 8 digits starting with 5/6/9
  if (digits.length === 8 && /^[569]/.test(digits)) return `965${digits}`;
  // Local forms like 965xxxxxxxx already handled; strip leading 0 from 05xxxxxxxx → treat last 8
  if (digits.startsWith("0") && digits.length === 9) return `965${digits.slice(1)}`;
  if (digits.length === 8) return `965${digits}`;
  return digits;
}

export function waLink(phone: string, text: string) {
  const digits = phoneDigits(phone);
  if (digits.length < 8) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function payUrl(token: string) {
  return `${ERP_ORIGIN}/pay/${token}`;
}

export function invoiceText(input: {
  customerName: string;
  number: string;
  lines: Array<{ name: string; quantity: string; total: string }>;
  total: string;
  payUrl?: string;
}) {
  const items = input.lines.map((line) => `- ${line.name} × ${line.quantity} = ${line.total}`).join("\n");
  return [
    `مرحباً ${input.customerName}`,
    `فاتورتكم ${input.number} من شركة فنتشر فودز لإدارة المطاعم ذ.م.م.`,
    items,
    `الإجمالي: ${input.total}`,
    input.payUrl ? `رابط الدفع المباشر: ${input.payUrl}` : `التفاصيل: ${ERP_ORIGIN}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function quoteText(input: { name: string; number: string; lines: Array<{ name: string; quantity: string; total: string }>; total: string }) {
  const items = input.lines.map((line) => `- ${line.name} × ${line.quantity} = ${line.total}`).join("\n");
  return [`مرحباً ${input.name}`, `عرض السعر ${input.number}`, items, `الإجمالي: ${input.total}`, ERP_ORIGIN].join("\n");
}

export function statementText(input: { name: string; balance: string }) {
  return [`مرحباً ${input.name}`, `كشف حسابكم لدى فنتشر فودز`, `الرصيد: ${input.balance}`, ERP_ORIGIN].join("\n");
}

export function payLinkText(input: { name: string; number: string; amount: string; url: string }) {
  return [`مرحباً ${input.name}`, `فاتورة ${input.number}`, `المبلغ: ${input.amount}`, `رابط الدفع: ${input.url}`].join("\n");
}
