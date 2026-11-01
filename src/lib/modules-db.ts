import { prisma } from "@/lib/db";

export async function isModuleEnabled(key: string) {
  const row = await prisma.appModule.findUnique({ where: { key } });
  return !row || row.isEnabled;
}

export async function enabledModuleKeys() {
  const rows = await prisma.appModule.findMany();
  if (rows.length === 0) return null;
  return rows.filter((row) => row.isEnabled).map((row) => row.key);
}
