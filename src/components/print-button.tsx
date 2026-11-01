"use client";

import { Printer } from "lucide-react";
import { btnPrimary } from "@/components/erp-ui";

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" className={btnPrimary} onClick={() => window.print()}>
      <Printer size={16} />
      {label}
    </button>
  );
}
