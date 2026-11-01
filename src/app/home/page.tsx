import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/erp-auth";
import { firstAllowedHref } from "@/lib/permissions";


async function Go() {
  await connection();
  const user = await requireUser();
  redirect(firstAllowedHref(user));
  return null;
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <Go />
    </Suspense>
  );
}
