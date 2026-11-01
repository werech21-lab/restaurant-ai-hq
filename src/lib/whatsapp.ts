import { ERP_ORIGIN } from "@/lib/site";

export function phoneDigits(phone: string) {
  let digits = phone.replace(/[^\d]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("05") && digits.length === 10) digits = `966${digits.slice(1)}`;
  if (digits.startsWith("5") && digits.length === 9) digits = `966${digits}`;
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
    `فاتورتكم ${input.number} من نظام AetherBI ERP`,
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
  return [`مرحباً ${input.name}`, `كشف حسابكم لدى AetherBI ERP`, `الرصيد: ${input.balance}`, ERP_ORIGIN].join("\n");
}

export function payLinkText(input: { name: string; number: string; amount: string; url: string }) {
  return [`مرحباً ${input.name}`, `فاتورة ${input.number}`, `المبلغ: ${input.amount}`, `رابط الدفع: ${input.url}`].join("\n");
}
