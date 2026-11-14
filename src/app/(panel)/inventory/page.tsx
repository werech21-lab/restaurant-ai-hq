import { Suspense } from "react";
import { connection } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/erp-auth";
import { Forbidden, PageSkeleton } from "@/components/erp-ui";
import { formatQty, movementTypeFromQuery } from "@/lib/format";
import { movementLabel } from "@/lib/i18n/auto-translate";
import { datetimeFor, getLocale, moneyFor } from "@/lib/i18n/server";
import { PAGE_SIZE, readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { getActiveScope, movementWhereForScope } from "@/lib/scope";
import { queryProducts } from "@/lib/stock";
import { forecastLabels } from "@/services/forecast.service";
import { isDecommissionedSiteText } from "@/services/warehouse.service";
import { InventoryPanel } from "@/app/(panel)/inventory/inventory-panel";

export const metadata = {
  title: "المخزون وحركات المواد | شركة فنتشر فودز ذ.م.م.",
  description: "إدارة المخزون، المواد الخام، التحويلات الداخلية وتقييم البضاعة لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.",
};

async function InventoryContent({ searchParams }: { searchParams: Promise<RawQuery> }) {
  await connection();
  const locale = await getLocale();
  const query = await readQuery(searchParams);
  const user = await requireUser();
  if (!can(user, "inventory", "view")) return <Forbidden href={firstAllowedHref(user)} />;

  const scope = await getActiveScope(query);
  const tab = query.tab === "categories" || query.tab === "movements" || query.tab === "fefo" ? query.tab : "products";
  const skip = (query.page - 1) * PAGE_SIZE;
  let total = 0;
  let products: Awaited<ReturnType<typeof queryProducts>>["rows"] = [];
  let categories: Array<{ id: string; name: string; description: string | null; _count: { products: number } }> = [];
  let movements: Array<{
    id: string;
    type: string;
    quantity: number;
    balanceAfter: number;
    note: string | null;
    createdAt: Date;
    product: { name: string; code: string };
    createdBy: { name: string };
  }> = [];

  if (tab === "categories") {
    const where = query.q ? { name: { contains: query.q } } : {};
    const [count, rows] = await Promise.all([
      prisma.category.count({ where }),
      prisma.category.findMany({
        where,
        include: { _count: { select: { products: true } } },
        orderBy: { name: "asc" },
        skip,
        take: PAGE_SIZE,
      }),
    ]);
    total = count;
    categories = rows;
  } else if (tab === "movements") {
    const type = movementTypeFromQuery(query.q);
    const where: Prisma.StockMovementWhereInput = {
      ...movementWhereForScope(scope.warehouseIds),
      ...(query.q
        ? {
            OR: [
              { note: { contains: query.q } },
              { product: { name: { contains: query.q } } },
              { product: { code: { contains: query.q } } },
              ...(type ? [{ type }] : []),
            ],
          }
        : {}),
    };
    const [count, rows] = await Promise.all([
      prisma.stockMovement.count({ where }),
      prisma.stockMovement.findMany({
        where,
        include: {
          product: { select: { name: true, code: true } },
          warehouse: { select: { name: true, code: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: PAGE_SIZE,
      }),
    ]);
    const cleanRows = rows.filter(
      (r) =>
        !isDecommissionedSiteText(
          `${r.warehouse?.code ?? ""} ${r.warehouse?.name ?? ""} ${r.note ?? ""} ${r.product.code} ${r.product.name}`,
        ),
    );
    total = Math.max(cleanRows.length, count - (rows.length - cleanRows.length));
    movements = cleanRows;
  } else {
    // Decoupled from hidden scope filters to display all enterprise stock items reliably
    const result = await queryProducts({
      q: query.q,
      page: query.page,
      lowStock: query.filter === "low_stock",
      warehouseIds: [],
    });
    total = result.total;
    products = result.rows;
  }

  const forecasts =
    tab === "products" ? await forecastLabels(products.map((row) => ({ id: row.id, currentStock: row.currentStock })), new Date()) : new Map<string, string>();

  return (
    <InventoryPanel
      tab={tab}
      q={query.q}
      page={query.page}
      total={total}
      filter={query.filter}
      canCreate={can(user, "inventory", "create")}
      canEdit={can(user, "inventory", "edit")}
      canDelete={can(user, "inventory", "delete")}
      products={products.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        categoryId: row.categoryId,
        categoryName: row.category.name,
        costPrice: row.costPrice,
        sellingPrice: row.sellingPrice,
        reorderLevel: row.reorderLevel,
        low: row.currentStock <= row.reorderLevel,
        costLabel: moneyFor(locale, row.costPrice),
        sellLabel: moneyFor(locale, row.sellingPrice),
        stockLabel: formatQty(row.currentStock),
        reorderLabel: formatQty(row.reorderLevel),
        forecastLabel: forecasts.get(row.id) ?? "—",
        customData: row.customData,
      }))}
      categories={categories.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description ?? "",
        productCount: row._count.products,
      }))}
      movements={movements.map((row) => ({
        id: row.id,
        dateLabel: datetimeFor(locale, row.createdAt),
        productName: row.product.name,
        code: row.product.code,
        type: row.type,
        typeLabel: movementLabel(locale, row.type),
        quantityLabel: formatQty(row.quantity),
        balanceLabel: formatQty(row.balanceAfter),
        note: row.note ?? "",
        userName: row.createdBy.name,
      }))}
    />
  );
}

export default function InventoryPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  return (
    <main className="w-full max-w-none px-4 py-6 sm:px-6" suppressHydrationWarning>
      <Suspense fallback={<PageSkeleton title="Inventory" />}>
        <InventoryContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
