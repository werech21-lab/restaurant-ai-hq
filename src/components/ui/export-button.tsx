"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { exportTable } from "@/app/actions/export";
import { btnGhost } from "@/components/erp-ui";
import { useI18n } from "@/lib/i18n";

export function ExportCsvButton({
  kind,
  filename,
  query,
}: {
  kind: string;
  filename: string;
  query?: string;
}) {
  const [pending, setPending] = useState(false);
  const { locale } = useI18n();
  const en = locale === "en";

  async function download() {
    setPending(true);
    try {
      const csv = await exportTable(kind, query ?? window.location.search);
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setPending(false);
    }
  }

  return (
    <button type="button" className={btnGhost} onClick={download} disabled={pending}>
      <Download size={16} />
      {pending ? (en ? "Exporting…" : "جارٍ التصدير...") : en ? "Export Excel/CSV" : "تصدير إلى Excel/CSV"}
    </button>
  );
}
