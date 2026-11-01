import { Suspense } from "react";
import { Shell } from "@/components/shell";

export const dynamic = "force-dynamic";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
