import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fail, ok, type ActionResult } from "@/lib/types";

export function txError(message: string): never {
  throw new Error(`ERR:${message}`);
}

export async function runTx(
  work: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<ActionResult> {
  try {
    await prisma.$transaction(async (tx) => {
      await work(tx);
    });
    return ok();
  } catch (error) {
    const text = error instanceof Error ? error.message : "";
    const marker = text.indexOf("ERR:");
    if (marker >= 0) {
      return fail(text.slice(marker + 4).split("\n")[0] || "تعذر تنفيذ العملية");
    }
    throw error;
  }
}
