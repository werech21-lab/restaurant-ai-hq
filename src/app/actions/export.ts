"use server";

import { exportCsv } from "@/services/report.service";

export async function exportTable(kind: string, search: string) {
  return exportCsv(kind, search);
}
