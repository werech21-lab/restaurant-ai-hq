import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/erp-auth";
import { Forbidden, PageSkeleton } from "@/components/erp-ui";
import { formatDate } from "@/lib/format";
import { PAGE_SIZE, readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { UsersPanel } from "@/app/(panel)/users/users-panel";

export const metadata = { title: "المستخدمون | نظام ERP" };

async function UsersContent({ searchParams }: { searchParams: Promise<RawQuery> }) {
  await connection();
  const query = await readQuery(searchParams);
  const user = await requireUser();
  if (!can(user, "users", "view")) return <Forbidden href={firstAllowedHref(user)} />;

  const where = query.q
    ? { OR: [{ name: { contains: query.q } }, { email: { contains: query.q } }] }
    : {};
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
        createdAtLabel: formatDate(row.createdAt),
      }))}
    />
  );
}

export default function UsersPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  return (
    <Suspense fallback={<PageSkeleton title="المستخدمين" />}>
      <UsersContent searchParams={searchParams} />
    </Suspense>
  );
}
