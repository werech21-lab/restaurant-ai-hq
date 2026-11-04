import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requireUser } from "@/lib/erp-auth";
import { Forbidden, PageSkeleton } from "@/components/erp-ui";
import { datetimeFor, getLocale, tx } from "@/lib/i18n/server";
import { PAGE_SIZE, readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { UsersPanel } from "@/app/(panel)/users/users-panel";
import { ensureVentureFoodsTeam } from "@/lib/ensure-venture-foods-team";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: tx(locale, "إدارة المستخدمين والصلاحيات | شركة فنتشر فودز ذ.م.م.", "Users & Permissions Management | Venture Foods W.L.L."),
    description: "إدارة حسابات المستخدمين وصلاحيات الوصول لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.",
  };
}

async function UsersContent({ searchParams }: { searchParams: Promise<RawQuery> }) {
  await connection();
  await ensureVentureFoodsTeam();
  const locale = await getLocale();
  const query = await readQuery(searchParams);
  const user = await requireUser();
  if (!can(user, "users", "view")) return <Forbidden href={firstAllowedHref(user)} />;

  const where = {
    isActive: true,
    NOT: [
      { name: { startsWith: "[retired]" } },
      { email: "admin@erp.com" },
    ],
    ...(query.q
      ? { OR: [{ name: { contains: query.q } }, { email: { contains: query.q } }] }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: { role: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return (
    <UsersPanel
      q={query.q}
      page={query.page}
      total={total}
      canCreate={can(user, "users", "create")}
      canEdit={can(user, "users", "edit")}
      canDelete={can(user, "users", "delete")}
      rows={rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        isActive: row.isActive,
        roleId: row.role.id,
        roleName: row.role.name,
        createdAtLabel: datetimeFor(locale, row.createdAt),
      }))}
    />
  );
}

export default function UsersPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  return (
    <div className="w-full max-w-none">
      <Suspense fallback={<PageSkeleton title="إدارة المستخدمين والصلاحيات" />}>
        <UsersContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
