import { round2, round3 } from "@/lib/format";
import type { LineInput } from "@/lib/types";

export function normalizeLines(items: LineInput[]) {
  const invalid = (error: string) => ({ ok: false as const, error });
  if (!items.length) return invalid("أضف صنفاً واحداً على الأقل");
  const seen = new Set<string>();
  const lines: LineInput[] = [];
  for (const item of items) {
    if (!item.productId) return invalid("اختر الصنف في كل سطر");
    if (seen.has(item.productId)) return invalid("لا يمكن تكرار الصنف في نفس المستند");
    seen.add(item.productId);
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      return invalid("الكمية يجب أن تكون أكبر من صفر");
    }
    if (!Number.isFinite(item.price) || item.price < 0) return invalid("السعر غير صالح");
    const quantity = round3(item.quantity);
    const price = round2(item.price);
    if (quantity <= 0) return invalid("الكمية يجب أن تكون أكبر من صفر");
    lines.push({ productId: item.productId, quantity, price });
  }
  const total = round2(lines.reduce((sum, line) => sum + round2(line.quantity * line.price), 0));
  return { ok: true as const, lines, total };
}

export function cleanText(value: unknown, max = 120) {
  return String(value ?? "").trim().slice(0, max);
}

export function cleanEmail(value: unknown) {
  return cleanText(value, 160).toLowerCase();
}
