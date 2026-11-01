import type { Prisma } from "@prisma/client";

export async function writeActivity(
  tx: Prisma.TransactionClient,
  entry: { userId: string; action: string; module: string; details: string },
) {
  await tx.activityLog.create({ data: entry });
}
