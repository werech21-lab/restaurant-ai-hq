import { prisma } from "@/lib/db";

const DAY = 24 * 60 * 60 * 1000;

export function stockoutLabel(stock: number, totalOut: number, firstAt: Date | null, now: Date) {
  if (stock <= 0.0001) return "نفد المخزون";
  if (!firstAt || totalOut <= 0.0001) return "لا توجد حركة صادر";
  const span = Math.max(1, (now.getTime() - firstAt.getTime()) / DAY);
  const daily = totalOut / span;
  if (daily <= 0) return "لا توجد حركة صادر";
  const days = Math.ceil(stock / daily);
  const rate = daily >= 1 ? daily.toFixed(2) : daily.toFixed(3);
  const horizon = days > 999 ? "أكثر من 999 يوم" : `${days} يوم`;
  return `${rate} / يوم · خلال ${horizon}`;
}

export async function forecastLabels(products: Array<{ id: string; currentStock: number }>, now: Date) {
  const labels = new Map<string, string>();
  if (products.length === 0) return labels;
  const groups = await prisma.stockMovement.groupBy({
    by: ["productId"],
    where: { type: "OUT", productId: { in: products.map((product) => product.id) } },
    _sum: { quantity: true },
    _min: { createdAt: true },
  });
  const byId = new Map(groups.map((group) => [group.productId, group]));
  for (const product of products) {
    const group = byId.get(product.id);
    labels.set(
      product.id,
      stockoutLabel(product.currentStock, group?._sum.quantity ?? 0, group?._min.createdAt ?? null, now),
    );
  }
  return labels;
}
