"use server";

import { revalidatePath } from "next/cache";
import { createManualJournal } from "@/services/accounting.service";

export async function saveManualJournal(input: {
  description: string;
  lines: Array<{ accountId: string; debit: number; credit: number }>;
}) {
  const result = await createManualJournal(input);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
