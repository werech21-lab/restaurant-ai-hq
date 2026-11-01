import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/erp-auth";
import { Forbidden, PageSkeleton } from "@/components/erp-ui";
import { MODULES } from "@/lib/modules";
import { PAGE_SIZE, readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref, type PermissionSnapshot } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { RolesPanel } from "@/app/(panel)/roles/roles-panel";

export const metadata = { title: "Roles | AetherBI" };

function matrix(rows: Array<{ module: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>) {
  const byModule = new Map(rows.map((row) => [row.module, row]));
  return MODULES.map((module) => {
    const row = byModule.get(module.key);
    return {
      module: module.key,
      canView: row?.canView ?? false,
      canCreate: row?.canCreate ?? false,
      canEdit: row?.canEdit ?? false,
      canDelete: row?.canDelete ?? false,
    } satisfies PermissionSnapshot;
  });
}

async function RolesContent({ searchParams }: { searchParams: Promise<RawQuery> }) {
  await connection();
  const query = await readQuery(searchParams);
  const user = await requireUser();
  if (!can(user, "roles", "view")) return <Forbidden href={firstAllowedHref(user)} />;

  const where = query.q ? { name: { contains: query.q } } : {};
  const [total, roles] = await Promise.all([
    prisma.role.count({ where }),
    prisma.role.findMany({
      where,
      include: { _count: { select: { users: true } } },
      orderBy: { name: "asc" },
      skip: (query.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const selectedId = query.role || roles[0]?.id || "";
  const selected = selectedId
    ? await prisma.role.findUnique({
        where: { id: selectedId },
        include: { permissions: true, _count: { select: { users: true } } },
      })
    : null;

  return (
    <RolesPanel
      q={query.q}
      page={query.page}
      total={total}
      canCreate={can(user, "roles", "create")}
      canEdit={can(user, "roles", "edit")}
      canDelete={can(user, "roles", "delete")}
      rows={roles.map((role) => ({
        id: role.id,
        name: role.name,
        description: role.description ?? "",
        isAdmin: role.isAdmin,
        userCount: role._count.users,
      }))}
      selected={
        selected
          ? {
              id: selected.id,
              name: selected.name,
              description: selected.description ?? "",
              isAdmin: selected.isAdmin,
              userCount: selected._count.users,
              permissions: matrix(selected.permissions),
            }
          : null
      }
    />
  );
}

export default function RolesPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  return (
    <Suspense fallback={<PageSkeleton title="Roles" />}>
      <RolesContent searchParams={searchParams} />
    </Suspense>
  );
}
